# BharatSim lab supervisor: keeps the Android emulator and the worker running.
#
# Runs under Windows Task Scheduler (see scripts/install_lab_task.ps1), so it does not
# depend on any terminal or editor session. Every 20 s it checks:
#   - the emulator (AVD bharat_low) is online and booted; if not, it starts it;
#   - the worker process is alive; if not, it restarts it against the deployed API.
# Logs: worker\.cache\supervisor.log, worker.log, worker.err.log, emulator.log
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$Cache = Join-Path $Root "worker\.cache"
New-Item -ItemType Directory -Force $Cache | Out-Null
$Sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$Adb = Join-Path $Sdk "platform-tools\adb.exe"
$Emulator = Join-Path $Sdk "emulator\emulator.exe"
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$Log = Join-Path $Cache "supervisor.log"
$Avd = "bharat_low"
$Serial = "emulator-5554"
$ApiUrl = if ($env:BHARATSIM_API_URL) { $env:BHARATSIM_API_URL } else { "https://bharatsim.onrender.com" }

function Write-Log($msg) { Add-Content -Path $Log -Value ("[{0}] {1}" -f (Get-Date -Format s), $msg) }

function Test-EmulatorBooted {
    $devices = & $Adb devices 2>$null | Out-String
    if ($devices -notmatch "$Serial\s+device") { return $false }
    $boot = (& $Adb -s $Serial shell getprop sys.boot_completed 2>$null | Out-String).Trim()
    return $boot -eq "1"
}

function Start-Emulator {
    if (Get-Process -Name "qemu-system-*" -ErrorAction SilentlyContinue) {
        Write-Log "emulator process exists but is not booted yet; waiting"
    } else {
        Write-Log "starting emulator $Avd"
        Start-Process -FilePath $Emulator -ArgumentList "-avd", $Avd, "-no-snapshot-save", "-no-boot-anim", "-gpu", "swiftshader_indirect" `
            -WindowStyle Minimized -RedirectStandardOutput (Join-Path $Cache "emulator.log") -RedirectStandardError (Join-Path $Cache "emulator.err.log")
    }
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 5
        if (Test-EmulatorBooted) { Write-Log "emulator booted"; return $true }
    }
    Write-Log "emulator did not boot within 5 minutes"
    return $false
}

function Get-WorkerProcess {
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*dev_worker.py*" }
}

function Start-Worker {
    Write-Log "starting worker against $ApiUrl"
    $env:BHARATSIM_API_URL = $ApiUrl
    $env:ANDROID_SERIAL = $Serial
    Start-Process -FilePath $Python -ArgumentList "-u", "scripts\dev_worker.py" -WorkingDirectory $Root -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $Cache "worker.log") -RedirectStandardError (Join-Path $Cache "worker.err.log")
}

Write-Log "supervisor started (pid $PID)"
& $Adb start-server 2>$null | Out-Null
$missing = 0
while ($true) {
    try {
        # The engine restarts the emulator itself for 3-4 GB personas, so only act when the
        # emulator process has been gone for two checks in a row (about 40 s).
        $qemu = Get-Process -Name "qemu-system-*" -ErrorAction SilentlyContinue
        if ($qemu) { $missing = 0 } else { $missing++ }
        if ($missing -ge 2 -or ($missing -ge 1 -and -not (Get-WorkerProcess))) {
            Start-Emulator | Out-Null
            $missing = 0
        }
        if ((Test-EmulatorBooted) -and -not (Get-WorkerProcess)) { Start-Worker }
    } catch {
        Write-Log "error: $_"
    }
    Start-Sleep -Seconds 20
}
