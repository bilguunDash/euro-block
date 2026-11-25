# ERP Sync Cron Script
# Windows Task Scheduler - runs daily at 05:00
# Run setup-task-scheduler.ps1 to register

$APP_DIR = "C:\Apps\EuroblockShift"
$PORT    = if ($env:PORT) { $env:PORT } else { "3001" }
$API_URL = "http://localhost:$PORT/api/erp-sync"

# Read ERP_SYNC_SECRET from .env.local (Task Scheduler SYSTEM account cannot access NSSM env vars)
$ENV_FILE = "$APP_DIR\.env.local"
$SECRET   = ""
if (Test-Path $ENV_FILE) {
  $line = Get-Content $ENV_FILE | Where-Object { $_ -match '^ERP_SYNC_SECRET=' }
  if ($line) { $SECRET = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'") }
}

if ([string]::IsNullOrWhiteSpace($SECRET)) {
  throw "ERP_SYNC_SECRET must be configured in .env.local before running sync."
}

$LOG_DIR  = "$APP_DIR\logs"
$LOG_FILE = "$LOG_DIR\erp-sync-$(Get-Date -Format 'yyyy-MM-dd').log"

if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR | Out-Null }

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content $LOG_FILE "[$timestamp] ERP sync started... ($API_URL)"

try {
    $response = Invoke-RestMethod `
        -Uri $API_URL `
        -Method POST `
        -Headers @{ "Authorization" = "Bearer $SECRET" } `
        -ContentType "application/json" `
        -TimeoutSec 60

    $msg = "[$timestamp] OK: total=$($response.total), created=$($response.created), skipped=$($response.skipped), errors=$($response.errors)"
    Add-Content $LOG_FILE $msg
    Write-Host $msg

    if ($response.createdList -and $response.createdList.Count -gt 0) {
        Add-Content $LOG_FILE "  New users:"
        foreach ($name in $response.createdList) {
            Add-Content $LOG_FILE "    - $name"
        }
    }
} catch {
    $errMsg = "[$timestamp] ERROR: $_"
    Add-Content $LOG_FILE $errMsg
    Write-Host $errMsg
}
