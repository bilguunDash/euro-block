# PC-2 deer Windows Task Scheduler tokhiruulakh
# PowerShell-g Administrator-aar neegeed ene script-g ajilluul:
#   PowerShell -ExecutionPolicy Bypass -File "C:\euroblock\scripts\setup-task-scheduler.ps1"

$TaskName   = "EuroblockERPSync"
$AppDir     = if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { "C:\Apps\EuroblockShift" }
$ScriptPath = "$AppDir\scripts\erp-sync-cron.ps1"

# Khuuchin task baival ustga
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Shine task uusgekh
$action   = New-ScheduledTaskAction -Execute "PowerShell.exe" `
              -Argument ("-NonInteractive -ExecutionPolicy Bypass -File `"" + $ScriptPath + "`"")
$trigger  = New-ScheduledTaskTrigger -Daily -At "05:00AM"
$settings = New-ScheduledTaskSettingsSet `
              -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
              -RestartCount 3 `
              -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "ERP sync - ogloo 5:00" `
    | Out-Null

Write-Host "Task Scheduler burgegdlee: $TaskName" -ForegroundColor Green
Write-Host "Daraagiin ajillakh tsag: ogloony 05:00" -ForegroundColor Green
Write-Host ""
Write-Host "Nen daruu shalgakh:" -ForegroundColor Cyan
Write-Host ("  Start-ScheduledTask -TaskName " + $TaskName) -ForegroundColor White
Write-Host ("  Get-ScheduledTaskInfo -TaskName " + $TaskName) -ForegroundColor White

# ── Firebird Sync Task ────────────────────────────────────────────────────────

$FbTaskName   = "EuroblockFirebirdSync"
$FbScriptPath = "$AppDir\scripts\firebird-sync-cron.ps1"


Unregister-ScheduledTask -TaskName $FbTaskName -Confirm:$false -ErrorAction SilentlyContinue

$fbAction   = New-ScheduledTaskAction -Execute "PowerShell.exe" `
                -Argument ("-NonInteractive -ExecutionPolicy Bypass -File `"" + $FbScriptPath + "`"")
$fbTrigger  = New-ScheduledTaskTrigger -Daily -At "05:00AM"
$fbSettings = New-ScheduledTaskSettingsSet `
                -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
                -RestartCount 3 `
                -RestartInterval (New-TimeSpan -Minutes 2)
$fbPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName $FbTaskName `
    -Action $fbAction `
    -Trigger $fbTrigger `
    -Settings $fbSettings `
    -Principal $fbPrincipal `
    -Description "Firebird → PostgreSQL sync - ogloo 5:00" `
    | Out-Null

Write-Host ""
Write-Host "Task Scheduler burgegdlee: $FbTaskName" -ForegroundColor Green
Write-Host "Daraagiin ajillakh tsag: ogloony 05:00" -ForegroundColor Green
Write-Host ""
Write-Host "Nen daruu shalgakh:" -ForegroundColor Cyan
Write-Host ("  Start-ScheduledTask -TaskName " + $FbTaskName) -ForegroundColor White
Write-Host ("  Get-ScheduledTaskInfo -TaskName " + $FbTaskName) -ForegroundColor White
