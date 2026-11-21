# Registers "BharatSim Lab" in Windows Task Scheduler: starts the lab supervisor at logon,
# restarts it if it stops, and never time-limits it. Run once in PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\install_lab_task.ps1
# Remove with:
#   Unregister-ScheduledTask -TaskName "BharatSim Lab" -Confirm:$false
$Root = Split-Path -Parent $PSScriptRoot
$Script = Join-Path $Root "scripts\lab_supervisor.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Script`"" -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName "BharatSim Lab" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "BharatSim Lab"
"BharatSim Lab task registered and started."
