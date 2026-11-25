# Firebird -> PostgreSQL Sync Cron Script
# Windows Task Scheduler - runs daily at 05:00

$APP_DIR  = "C:\Apps\EuroblockShift"
$PORT     = if ($env:PORT) { $env:PORT } else { "3001" }
$API_URL  = "http://localhost:$PORT/api/firebird-sync"

# Read FIREBIRD_SYNC_SECRET from .env.local (Task Scheduler SYSTEM account cannot access NSSM env vars)
$ENV_FILE = "$APP_DIR\.env.local"
$SECRET   = ""
if (Test-Path $ENV_FILE) {
  $line = Get-Content $ENV_FILE | Where-Object { $_ -match '^FIREBIRD_SYNC_SECRET=' }
  if ($line) { $SECRET = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'") }
}

if ([string]::IsNullOrWhiteSpace($SECRET)) {
  throw "FIREBIRD_SYNC_SECRET must be configured in .env.local before running sync."
}

$LOG_DIR  = "$APP_DIR\logs"
$LOG_FILE = "$LOG_DIR\firebird-sync-$(Get-Date -Format 'yyyy-MM-dd').log"

if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR | Out-Null }

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content $LOG_FILE "[$timestamp] Firebird sync started..."

try {
    $response = Invoke-RestMethod `
        -Uri $API_URL `
        -Method POST `
        -Headers @{ "Authorization" = "Bearer $SECRET" } `
        -ContentType "application/json" `
        -TimeoutSec 120

    $msg = "[$timestamp] OK: totalSynced=$($response.totalSynced)"
    Add-Content $LOG_FILE $msg
    Write-Host $msg

    foreach ($table in $response.results.PSObject.Properties) {
        $t = $table.Value
        $line = "  $($table.Name): synced=$($t.synced)"
        if ($t.error) { $line += " ERROR: $($t.error)" }
        Add-Content $LOG_FILE $line
        Write-Host $line
    }
} catch {
    $errMsg = "[$timestamp] ERROR: $_"
    Add-Content $LOG_FILE $errMsg
    Write-Host $errMsg
}
