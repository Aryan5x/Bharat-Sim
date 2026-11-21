# BharatSim laptop worker installer for Windows 10/11.
#
# Get a personal worker key at https://bharatsim.onrender.com/connect, then in PowerShell:
#   $env:BHARATSIM_WORKER_KEY="bsw_..."; irm https://bharatsim.onrender.com/install/windows.ps1 | iex
#
# Installs into %LOCALAPPDATA%\BharatSim only (no admin rights, does not touch an existing Android SDK):
#   Java 17 runtime (Eclipse Temurin), Android command-line tools, platform-tools, emulator, build-tools,
#   an Android 11 system image (about 3 GB in total), the BharatSim worker and a Python virtual environment.
# Nothing is installed until you type YES. Remove everything by deleting %LOCALAPPDATA%\BharatSim
# (and the "BharatSim Lab" scheduled task if you created it).
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Key = $env:BHARATSIM_WORKER_KEY
$Api = if ($env:BHARATSIM_API_URL) { $env:BHARATSIM_API_URL.TrimEnd("/") } else { "https://bharatsim.onrender.com" }
$Repo = if ($env:BHARATSIM_REPO_ZIP) { $env:BHARATSIM_REPO_ZIP } else { "https://codeload.github.com/kaustubhdua/Bharat-Sim/zip/refs/heads/main" }
$Home_ = Join-Path $env:LOCALAPPDATA "BharatSim"
$Sdk = Join-Path $Home_ "android-sdk"
$Jdk = Join-Path $Home_ "jdk"
$App = Join-Path $Home_ "app"
$Venv = Join-Path $Home_ "venv"
$Image = "system-images;android-30;google_apis;x86_64"

function Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; throw $msg }

Write-Host "BharatSim laptop worker installer" -ForegroundColor Green
if ($Key -notmatch '^bsw_(u-[0-9a-f]{10})_[A-Za-z0-9_-]{43}$') {
    Fail "Set your personal worker key first: `$env:BHARATSIM_WORKER_KEY=`"bsw_...`" (get one at $Api/connect)"
}
$WorkerId = $Matches[1]

Write-Host @"

This will set up an Android test lab on this laptop for your BharatSim account:
  - Java 17 runtime, Android SDK command-line tools, emulator and an Android 11 image (about 3 GB download)
  - the BharatSim worker (Python), connected to $Api as worker $WorkerId
Everything goes into $Home_. The worker only runs tests that YOU upload to BharatSim.
"@
$answer = Read-Host "Type YES to continue"
if ($answer -ne "YES") { Write-Host "Cancelled. Nothing was installed."; return }
New-Item -ItemType Directory -Force $Home_, (Join-Path $Home_ "logs") | Out-Null

Step 1 "Checking hardware virtualization"
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
if ($cpu.VirtualizationFirmwareEnabled -eq $false) {
    Write-Host "  Virtualization looks disabled in BIOS/UEFI. The emulator needs it (Intel VT-x / AMD-V)." -ForegroundColor Yellow
}

Step 2 "Finding Python 3.10+"
$Python = $null
foreach ($cand in @("py -3.12", "py -3.11", "py -3.10", "python")) {
    $parts = $cand.Split(" ")
    try {
        $v = & $parts[0] $parts[1..9] -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
        if ($v -and [version]$v -ge [version]"3.10") { $Python = $parts; break }
    } catch {}
}
if (-not $Python) {
    $ok = Read-Host "Python 3.10+ was not found. Install Python 3.12 with winget now? (Y/N)"
    if ($ok -notin @("Y", "y")) { Fail "Install Python 3.10+ from python.org, then run this again." }
    winget install -e --id Python.Python.3.12 --accept-source-agreements --scope user
    $Python = @("py", "-3.12")
}
Write-Host "  using $($Python -join ' ')"

Step 3 "Java 17 runtime (needed by the Android SDK tools)"
$Java = Get-ChildItem -Path $Jdk -Filter java.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $Java) {
    $zip = Join-Path $Home_ "jre.zip"
    Invoke-WebRequest "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse" -OutFile $zip
    Expand-Archive $zip -DestinationPath $Jdk -Force; Remove-Item $zip
    $Java = Get-ChildItem -Path $Jdk -Filter java.exe -Recurse | Select-Object -First 1
}
$env:JAVA_HOME = Split-Path (Split-Path $Java.FullName)
$env:ANDROID_HOME = $Sdk; $env:ANDROID_SDK_ROOT = $Sdk

Step 4 "Android SDK command-line tools"
$SdkManager = Join-Path $Sdk "cmdline-tools\latest\bin\sdkmanager.bat"
if (-not (Test-Path $SdkManager)) {
    $zip = Join-Path $Home_ "cmdline-tools.zip"
    Invoke-WebRequest "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" -OutFile $zip
    $tmp = Join-Path $Home_ "cmdline-tmp"; Expand-Archive $zip -DestinationPath $tmp -Force; Remove-Item $zip
    New-Item -ItemType Directory -Force (Join-Path $Sdk "cmdline-tools") | Out-Null
    Move-Item (Join-Path $tmp "cmdline-tools") (Join-Path $Sdk "cmdline-tools\latest") -Force
    Remove-Item $tmp -Recurse -Force
}

Step 5 "Android SDK licenses (please read and accept)"
& $SdkManager --sdk_root=$Sdk --licenses

Step 6 "Downloading emulator, platform-tools, build-tools and the Android 11 image (about 3 GB, takes a while)"
& $SdkManager --sdk_root=$Sdk "platform-tools" "emulator" "build-tools;34.0.0" $Image
if ($LASTEXITCODE -ne 0) { Fail "sdkmanager could not install the Android packages." }

Step 7 "Creating the budget-phone emulator (bharat_low: 2 GB RAM, 2 cores, 720p)"
$AvdManager = Join-Path $Sdk "cmdline-tools\latest\bin\avdmanager.bat"
"no" | & $AvdManager create avd -n bharat_low -k $Image -d "pixel_3a" --force | Out-Null
$cfg = Join-Path $env:USERPROFILE ".android\avd\bharat_low.avd\config.ini"
if (Test-Path $cfg) {
    $lines = Get-Content $cfg | Where-Object { $_ -notmatch '^(hw\.ramSize|hw\.cpu\.ncore|hw\.lcd\.width|hw\.lcd\.height|hw\.lcd\.density|hw\.keyboard)=' }
    $lines += "hw.ramSize=2048", "hw.cpu.ncore=2", "hw.lcd.width=720", "hw.lcd.height=1280", "hw.lcd.density=320", "hw.keyboard=yes"
    Set-Content -Path $cfg -Value $lines -Encoding ascii
}
$accel = & (Join-Path $Sdk "emulator\emulator.exe") -accel-check 2>&1 | Out-String
if ($accel -notmatch "is installed and usable|is operational|accel:\s*0") {
    Write-Host "  The emulator cannot use hardware acceleration yet:" -ForegroundColor Yellow
    Write-Host ("  " + ($accel.Trim() -replace "`n", "`n  "))
    Write-Host "  Enable 'Windows Hypervisor Platform' (Windows Features) and virtualization in BIOS, reboot, then run: $Home_\start-lab.cmd" -ForegroundColor Yellow
}

Step 8 "Downloading the BharatSim worker"
$zip = Join-Path $Home_ "bharatsim.zip"
Invoke-WebRequest $Repo -OutFile $zip
$tmp = Join-Path $Home_ "src-tmp"; if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Expand-Archive $zip -DestinationPath $tmp -Force; Remove-Item $zip
$src = Get-ChildItem $tmp -Directory | Select-Object -First 1
if (Test-Path $App) { Remove-Item $App -Recurse -Force }
New-Item -ItemType Directory -Force $App | Out-Null
Copy-Item (Join-Path $src.FullName "worker") (Join-Path $App "worker") -Recurse
Remove-Item $tmp -Recurse -Force

Step 9 "Python environment"
& $Python[0] $Python[1..9] -m venv $Venv
$VenvPy = Join-Path $Venv "Scripts\python.exe"
& $VenvPy -m pip install --quiet --upgrade pip
& $VenvPy -m pip install --quiet "scikit-learn==1.6.1" "joblib==1.4.2"
if ($LASTEXITCODE -ne 0) { Fail "pip could not install the worker's packages." }

Step 10 "Writing configuration"
@"
# BharatSim personal worker. Keep this file private: the key lets this laptop run your own tests.
BHARATSIM_API_URL=$Api
BHARATSIM_WORKER_TOKEN=$Key
BHARATSIM_WORKER_ID=$WorkerId
ANDROID_HOME=$Sdk
ANDROID_SDK_ROOT=$Sdk
ANDROID_SERIAL=emulator-5554
BHARATSIM_AVD=bharat_low
BHARATSIM_WORKER_ENGINE=engine
BHARATSIM_ENABLE_LOCAL_APK_EXECUTION=true
"@ | Set-Content -Path (Join-Path $Home_ "worker.env") -Encoding ascii
$start = "@echo off`r`ncd /d `"$App`"`r`nset BHARATSIM_HOME=$Home_`r`nstart `"BharatSim Lab`" /min `"$VenvPy`" -m worker.lab`r`n"
Set-Content -Path (Join-Path $Home_ "start-lab.cmd") -Value $start -Encoding ascii

Step 11 "Starting the lab"
Start-Process -FilePath (Join-Path $Home_ "start-lab.cmd") -WindowStyle Minimized
$auto = Read-Host "Start the BharatSim lab automatically when you log in? (Y/N)"
if ($auto -in @("Y", "y")) {
    $action = New-ScheduledTaskAction -Execute (Join-Path $Home_ "start-lab.cmd") -WorkingDirectory $App
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName "BharatSim Lab" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
    Write-Host "  Autostart registered (task 'BharatSim Lab')."
}

Write-Host "`nDone. The emulator boots in about a minute; your laptop then shows as online at $Api/connect." -ForegroundColor Green
Write-Host "Logs: $Home_\logs   Start again any time: $Home_\start-lab.cmd"
