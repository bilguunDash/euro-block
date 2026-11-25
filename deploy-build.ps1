# deploy-build.ps1 - Run on dev PC to create euroblock-deploy.zip

param(
    [switch]$SkipBuild,
    [string]$OutFile = 'euroblock-deploy.zip'
)

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
if ($OutFile -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$') {
    throw 'OutFile must be a ZIP filename within the project directory.'
}
$OutZip      = Join-Path $ProjectRoot $OutFile
$StageRoot   = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
$StageDir    = Join-Path $StageRoot "euroblock-stage-$([guid]::NewGuid().ToString('N'))"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Euroblock -- Deploy Package Builder"    -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build. Next 15's full worker-thread build cannot clone its config
# during static generation, so compile and generate run as separate phases.
Set-Location $ProjectRoot
if (-not $SkipBuild) {
    Write-Host "[1/5] Generating Prisma client and building Next.js ..." -ForegroundColor Yellow
    $LocalSchemaEngine = Join-Path $ProjectRoot 'node_modules\@prisma\engines\schema-engine-windows.exe'
    if (Test-Path -LiteralPath $LocalSchemaEngine -PathType Leaf) {
        $env:PRISMA_SCHEMA_ENGINE_BINARY = $LocalSchemaEngine
    }
    & (Join-Path $ProjectRoot 'node_modules\.bin\prisma.cmd') generate
    if ($LASTEXITCODE -ne 0) { throw "Prisma client generation failed" }

    & (Join-Path $ProjectRoot 'node_modules\.bin\tsc.cmd') --noEmit --incremental false
    if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed" }

    $env:EUROBLOCK_BUILD_WORKER_THREADS = '1'
    & (Join-Path $ProjectRoot 'node_modules\.bin\next.cmd') build --experimental-build-mode compile
    if ($LASTEXITCODE -ne 0) { throw "Next.js compile phase failed" }

    $env:EUROBLOCK_BUILD_WORKER_THREADS = '0'
    & (Join-Path $ProjectRoot 'node_modules\.bin\next.cmd') build --experimental-build-mode generate
    if ($LASTEXITCODE -ne 0) { throw "Next.js generate phase failed" }
} else {
    Write-Host "[1/5] Using existing completed Next.js build ..." -ForegroundColor Yellow
    foreach ($builtFile in @('.next\BUILD_ID', '.next\standalone\server.js')) {
        if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $builtFile) -PathType Leaf)) {
            throw "Completed build file not found: $builtFile"
        }
    }
}

# Step 2: Staging folder
Write-Host "[2/5] Preparing staging folder..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $StageDir | Out-Null

$StandaloneDir = Join-Path $ProjectRoot ".next\standalone"
if (-not (Test-Path $StandaloneDir)) {
    throw ".next\standalone not found. Make sure output: 'standalone' is set in next.config.ts"
}
Copy-Item "$StandaloneDir\*" $StageDir -Recurse -Force

# Static assets
$StaticDst = Join-Path $StageDir ".next\static"
New-Item -ItemType Directory -Path $StaticDst -Force | Out-Null
Copy-Item (Join-Path $ProjectRoot ".next\static\*") $StaticDst -Recurse -Force

# Public folder
$PublicSrc = Join-Path $ProjectRoot "public"
if (Test-Path $PublicSrc) {
    $PublicDst = Join-Path $StageDir "public"
    New-Item -ItemType Directory -Path $PublicDst -Force | Out-Null
    Get-ChildItem -LiteralPath $PublicSrc -Force |
        Where-Object { $_.Name -ne 'uploads' } |
        Copy-Item -Destination $PublicDst -Recurse -Force
}

# Uploaded records belong to the server, not to a deploy archive. Also remove
# any upload directory that standalone tracing may have included.
$StagedUploads = [System.IO.Path]::GetFullPath((Join-Path $StageDir 'public\uploads'))
$ExpectedUploads = [System.IO.Path]::GetFullPath($StageDir).TrimEnd('\') + '\public\uploads'
if ($StagedUploads -ne $ExpectedUploads) { throw 'Unexpected staged uploads path.' }
if (Test-Path -LiteralPath $StagedUploads -PathType Container) {
    Remove-Item -LiteralPath $StagedUploads -Recurse -Force
}

# Prisma schema + migrations
$PrismaDst = Join-Path $StageDir "prisma"
New-Item -ItemType Directory -Path $PrismaDst -Force | Out-Null
Copy-Item (Join-Path $ProjectRoot "prisma\schema.prisma") $PrismaDst -Force
$MigDir = Join-Path $ProjectRoot "prisma\migrations"
if (-not (Test-Path -LiteralPath $MigDir -PathType Container)) {
    throw "prisma\migrations not found. Cannot build a deploy package without migrations."
}
Copy-Item -LiteralPath $MigDir -Destination $PrismaDst -Recurse -Force

# Standalone tracing excludes Prisma CLI. Add its installed runtime dependencies
# and Windows schema engine explicitly; Prisma 7 also needs prisma.config.ts.
$PrismaConfig = Join-Path $ProjectRoot "prisma.config.ts"
Copy-Item -LiteralPath $PrismaConfig -Destination $StageDir -Force
Write-Host "  Packaging Prisma CLI and migration engine..." -ForegroundColor Yellow
& node (Join-Path $ProjectRoot "scripts\package-prisma-cli.cjs") $ProjectRoot $StageDir
if ($LASTEXITCODE -ne 0) { throw "Prisma CLI packaging failed" }

# Server startup script
$ServerScript = Join-Path $ProjectRoot "deploy-server.ps1"
Copy-Item -LiteralPath $ServerScript -Destination $StageDir -Force
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'docs\windows-deployment.md') -Destination (Join-Path $StageDir 'DEPLOY-README.md') -Force

# Cron / helper scripts
$ScriptsDir = Join-Path $ProjectRoot "scripts"
if (Test-Path $ScriptsDir) {
    $ScriptsDst = Join-Path $StageDir "scripts"
    New-Item -ItemType Directory -Path $ScriptsDst -Force | Out-Null
    Copy-Item "$ScriptsDir\*" $ScriptsDst -Recurse -Force
}

# Strip any real .env* files that Next.js standalone tracing may have copied
# into .next/standalone (it bundles .env/.env.local/.env.production if present
# at build time) -- these must never end up in the deploy zip. Only the
# checked-in .env.production.example template is intentionally re-added below.
Get-ChildItem -Path $StageDir -Filter ".env*" -File -Force -ErrorAction SilentlyContinue | Remove-Item -Force

# .env example
$EnvExample = Join-Path $ProjectRoot ".env.production.example"
if (Test-Path $EnvExample) {
    Copy-Item $EnvExample $StageDir -Force
}

# Step 3: Zip
Write-Host "[3/5] Creating ZIP archive..." -ForegroundColor Yellow
if (Test-Path $OutZip) { Remove-Item $OutZip -Force }
Compress-Archive -Path "$StageDir\*" -DestinationPath $OutZip -CompressionLevel Optimal

# Step 4: Cleanup
Write-Host "[4/5] Cleaning temp folder..." -ForegroundColor Yellow
if ([System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($StageDir)) -ne $StageRoot) {
    throw "Refusing to remove a staging folder outside $StageRoot"
}
Remove-Item -LiteralPath $StageDir -Recurse -Force

# Step 5: Done
$ZipSize = [math]::Round((Get-Item $OutZip).Length / 1MB, 1)
Write-Host ""
Write-Host "[5/5] Done!" -ForegroundColor Green
Write-Host ""
Write-Host "  File : $OutZip" -ForegroundColor White
Write-Host "  Size : $ZipSize MB" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Copy $OutFile to the Server"
Write-Host "  2. Extract to C:\euroblock\"
Write-Host "  3. Copy .env.production.example to .env.local and configure"
Write-Host "  4. Follow DEPLOY-README.md; pass -AppDir C:\euroblock explicitly"
Write-Host ""
