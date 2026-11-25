# deploy-server.ps1 - Run on Windows Server as Administrator
# Location: C:\Apps\EuroblockShift\deploy-server.ps1

param(
    [string]$AppDir   = "C:\Apps\EuroblockShift",
    [int]   $Port     = 3010,
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Start,
    [switch]$Stop
)

$ErrorActionPreference = "Stop"
$ServiceName = "EuroblockApp"
$nodeCmd     = Get-Command node -ErrorAction SilentlyContinue
$NodeExe     = if ($nodeCmd) { $nodeCmd.Source } else { $null }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Euroblock -- Server Setup"              -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (-not $NodeExe) {
    Write-Host "[ERROR] Node.js is not installed!" -ForegroundColor Red
    Write-Host "  Download LTS from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "Node.js: $(node --version)" -ForegroundColor Green

# Check .env.local
$EnvFile = Join-Path $AppDir ".env.local"
if (-not (Test-Path $EnvFile)) {
    Write-Host ""
    Write-Host "[ERROR] .env.local not found: $EnvFile" -ForegroundColor Red
    Write-Host "  Copy .env.production.example to .env.local and configure it" -ForegroundColor Yellow
    exit 1
}
Write-Host ".env.local : OK" -ForegroundColor Green

# Check server.js
$ServerJs = Join-Path $AppDir "server.js"
if (-not (Test-Path $ServerJs)) {
    Write-Host "[ERROR] server.js not found: $ServerJs" -ForegroundColor Red
    Write-Host "  Make sure the ZIP was extracted correctly" -ForegroundColor Yellow
    exit 1
}
Write-Host "server.js  : OK" -ForegroundColor Green

# Parse .env.local into hashtable
function Read-EnvFile([string]$Path) {
    $vars = @{}
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line -match '^([^=]+)=(.*)$') {
            $k = $Matches[1].Trim()
            $v = $Matches[2].Trim().Trim('"')
            $vars[$k] = $v
        }
    }
    return $vars
}

# Run Prisma migration
function Run-Migration {
    Write-Host ""
    Write-Host "[Migration] Running Prisma DB migration..." -ForegroundColor Yellow
    $vars = Read-EnvFile $EnvFile
    if (-not $vars.ContainsKey('DATABASE_URL') -or [string]::IsNullOrWhiteSpace($vars['DATABASE_URL'])) {
        throw "DATABASE_URL is missing or empty in .env.local."
    }

    # Invoke the bundled CLI directly; standalone packages have no .bin shims.
    $PrismaCli = Join-Path $AppDir "node_modules\prisma\build\index.js"
    $PrismaEngine = Join-Path $AppDir "node_modules\@prisma\engines\schema-engine-windows.exe"
    $PrismaConfig = Join-Path $AppDir "prisma.config.ts"
    $SchemaFile = Join-Path $AppDir "prisma\schema.prisma"
    $MigrationDir = Join-Path $AppDir "prisma\migrations"
    foreach ($file in @($PrismaCli, $PrismaEngine, $PrismaConfig, $SchemaFile)) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "Required migration file not found: $file. Rebuild and extract the deploy ZIP."
        }
    }
    if (-not (Test-Path -LiteralPath $MigrationDir -PathType Container)) {
        throw "Migration directory not found: $MigrationDir. Rebuild and extract the deploy ZIP."
    }
    $MigrationFiles = @(Get-ChildItem -Path (Join-Path $MigrationDir "*\migration.sql") -File)
    if ($MigrationFiles.Count -eq 0) {
        throw "No migration.sql files found in $MigrationDir. Rebuild and extract the deploy ZIP."
    }

    $PreviousDatabaseUrl = $env:DATABASE_URL
    $PreviousSchemaEngine = $env:PRISMA_SCHEMA_ENGINE_BINARY
    $env:DATABASE_URL = $vars['DATABASE_URL']
    $env:PRISMA_SCHEMA_ENGINE_BINARY = $PrismaEngine
    Push-Location -LiteralPath $AppDir
    try {
        & $NodeExe $PrismaCli migrate deploy --config $PrismaConfig
        if ($LASTEXITCODE -ne 0) {
            throw "Prisma migrate deploy failed (exit code $LASTEXITCODE)."
        }
    } finally {
        Pop-Location
        $env:DATABASE_URL = $PreviousDatabaseUrl
        $env:PRISMA_SCHEMA_ENGINE_BINARY = $PreviousSchemaEngine
    }
    Write-Host "  Migration OK" -ForegroundColor Green
}

# Install NSSM (Windows service manager)
function Get-Nssm {
    $nssm = Get-Command nssm -ErrorAction SilentlyContinue
    if ($nssm) { return $nssm.Source }

    Write-Host "[Setup] Downloading NSSM..." -ForegroundColor Yellow
    $nssmDir = "C:\nssm"
    $nssmZip = "$nssmDir\nssm.zip"
    New-Item -ItemType Directory -Path $nssmDir -Force | Out-Null
    Invoke-WebRequest "https://nssm.cc/release/nssm-2.24.zip" -OutFile $nssmZip
    Expand-Archive $nssmZip -DestinationPath $nssmDir -Force
    $nssmExe = Get-ChildItem "$nssmDir\*\win64\nssm.exe" | Select-Object -First 1
    Copy-Item $nssmExe.FullName "$nssmDir\nssm.exe" -Force
    $env:PATH = "$nssmDir;$env:PATH"
    return "$nssmDir\nssm.exe"
}

# Open firewall port
function Open-Firewall([int]$P) {
    $rule = Get-NetFirewallRule -DisplayName "Euroblock $P" -ErrorAction SilentlyContinue
    if (-not $rule) {
        Write-Host "[Firewall] Opening port $P..." -ForegroundColor Yellow
        New-NetFirewallRule -DisplayName "Euroblock $P" `
            -Direction Inbound -Protocol TCP -LocalPort $P -Action Allow | Out-Null
        Write-Host "  Port $P opened" -ForegroundColor Green
    } else {
        Write-Host "[Firewall] Port $P already open" -ForegroundColor Green
    }
}

# Build every service environment variable (KEY=VALUE) for ONE nssm call:
# 'nssm set <svc> AppEnvironmentExtra ...' replaces the whole REG_MULTI_SZ list.
# -Port is authoritative for PORT. Windows PowerShell 5.1 does not escape an
# embedded double quote or a trailing backslash inside a quoted native argument,
# so such values are rejected here instead of reaching nssm corrupted.
function Get-ServiceEnvPairs([string]$Path, [int]$P) {
    $vars  = Read-EnvFile $Path
    $pairs = @("PORT=$P")
    foreach ($k in @($vars.Keys | Sort-Object)) {
        if ($k -eq 'PORT') {
            Write-Host "  PORT in .env.local ignored; service uses -Port $P" -ForegroundColor Yellow
            continue
        }
        $pair = "$k=$($vars[$k])"
        if ($pair.Contains('"')) {
            throw ".env.local value for $k contains a double quote, which Windows PowerShell 5.1 cannot pass to nssm intact. Remove the double quote and re-run."
        }
        if ($pair -match '\s' -and $pair.EndsWith('\')) {
            throw ".env.local value for $k contains whitespace and ends with a backslash, which Windows PowerShell 5.1 cannot pass to nssm intact. Remove the trailing backslash and re-run."
        }
        $pairs += $pair
    }
    return $pairs
}

# ---- Actions ------------------------------------------------

if ($Uninstall) {
    Write-Host "[Uninstall] Stopping and removing service..." -ForegroundColor Yellow
    $n = Get-Nssm
    & $n stop   $ServiceName | Out-Null
    & $n remove $ServiceName confirm | Out-Null
    Write-Host "Done." -ForegroundColor Green
    exit 0
}

if ($Stop) {
    Write-Host "[Stop] Stopping service..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped." -ForegroundColor Green
    exit 0
}

if ($Start) {
    Write-Host "[Start] Starting service..." -ForegroundColor Yellow
    Start-Service -Name $ServiceName
    Write-Host "Started." -ForegroundColor Green
    exit 0
}

# ---- Default: Install + Start --------------------------------

try {
    Run-Migration
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Service setup cancelled because the database migration did not succeed." -ForegroundColor Red
    exit 1
}
Open-Firewall $Port

$nssm = Get-Nssm
Write-Host ""
Write-Host "[Service] Installing Windows Service..." -ForegroundColor Yellow

try {
    $envPairs = @(Get-ServiceEnvPairs $EnvFile $Port)
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Service setup cancelled; the existing service was not changed." -ForegroundColor Red
    exit 1
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "  Removing old service..." -ForegroundColor Yellow
    & $nssm stop   $ServiceName | Out-Null
    & $nssm remove $ServiceName confirm | Out-Null
}

$LogDir = Join-Path $AppDir "logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

& $nssm install $ServiceName $NodeExe "$AppDir\server.js"
& $nssm set     $ServiceName AppDirectory    $AppDir
& $nssm set     $ServiceName AppStdout       "$LogDir\app.log"
& $nssm set     $ServiceName AppStderr       "$LogDir\error.log"
& $nssm set     $ServiceName AppRotateFiles  1
& $nssm set     $ServiceName AppRotateBytes  10485760
& $nssm set     $ServiceName Start           SERVICE_AUTO_START
& $nssm set     $ServiceName DisplayName     "Euroblock Shift App"
& $nssm set     $ServiceName Description     "Euroblock AAC Shift Registration System"

# Inject PORT + all .env.local variables in ONE call (each call replaces the list)
& $nssm set $ServiceName AppEnvironmentExtra @envPairs

& $nssm start $ServiceName

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Installation complete!"                -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  App URL : http://localhost:$Port"       -ForegroundColor White
Write-Host "  Log     : $LogDir\app.log"              -ForegroundColor White
Write-Host "  Service : $ServiceName"                 -ForegroundColor White
Write-Host ""
Write-Host "Service commands:" -ForegroundColor Cyan
Write-Host "  Stop      : .\deploy-server.ps1 -Stop"
Write-Host "  Start     : .\deploy-server.ps1 -Start"
Write-Host "  Uninstall : .\deploy-server.ps1 -Uninstall"
Write-Host ""
