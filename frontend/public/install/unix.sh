#!/usr/bin/env bash
# BharatSim laptop worker installer for macOS and Linux.
#
# Get a personal worker key at https://bharatsim.onrender.com/connect, then:
#   curl -fsSL https://bharatsim.onrender.com/install/unix.sh -o bharatsim-install.sh
#   BHARATSIM_WORKER_KEY="bsw_..." bash bharatsim-install.sh
#
# Installs into ~/.bharatsim only (no sudo, does not touch an existing Android SDK): Java 17 runtime
# (Eclipse Temurin), Android command-line tools, platform-tools, emulator, build-tools, an Android 11
# system image (about 3 GB), the BharatSim worker and a Python virtual environment.
# Nothing is installed until you type YES. Remove everything with: rm -rf ~/.bharatsim
set -euo pipefail

KEY="${BHARATSIM_WORKER_KEY:-}"
API="${BHARATSIM_API_URL:-https://bharatsim.onrender.com}"; API="${API%/}"
REPO_ZIP="${BHARATSIM_REPO_ZIP:-https://codeload.github.com/kaustubhdua/Bharat-Sim/zip/refs/heads/main}"
HOME_DIR="${BHARATSIM_HOME:-$HOME/.bharatsim}"
SDK="$HOME_DIR/android-sdk"; JDK="$HOME_DIR/jdk"; APP="$HOME_DIR/app"; VENV="$HOME_DIR/venv"

step() { printf '\n\033[36m[%s] %s\033[0m\n' "$1" "$2"; }
fail() { printf '\n\033[31mERROR: %s\033[0m\n' "$1"; exit 1; }

echo "BharatSim laptop worker installer"
[[ "$KEY" =~ ^bsw_(u-[0-9a-f]{10})_[A-Za-z0-9_-]{43}$ ]] || fail "Set BHARATSIM_WORKER_KEY first (get one at $API/connect)."
WORKER_ID="${BASH_REMATCH[1]}"

OS="$(uname -s)"; ARCH="$(uname -m)"
case "$OS" in
  Darwin) TOOLS_OS=mac; JRE_OS=mac ;;
  Linux) TOOLS_OS=linux; JRE_OS=linux ;;
  *) fail "Unsupported OS $OS (use the Windows installer on Windows)." ;;
esac
case "$ARCH" in
  arm64|aarch64) JRE_ARCH=aarch64; IMAGE="system-images;android-30;google_apis;arm64-v8a"; UV_ARCH=aarch64 ;;
  x86_64|amd64) JRE_ARCH=x64; IMAGE="system-images;android-30;google_apis;x86_64"; UV_ARCH=x86_64 ;;
  *) fail "Unsupported CPU $ARCH." ;;
esac
if [[ "$OS" == "Darwin" ]]; then UV_TARGET="$UV_ARCH-apple-darwin"; else UV_TARGET="$UV_ARCH-unknown-linux-gnu"; fi

cat <<EOF

This will set up an Android test lab on this computer for your BharatSim account:
  - Java 17 runtime, Android SDK tools, emulator and an Android 11 image (about 3 GB download)
  - the BharatSim worker (Python), connected to $API as worker $WORKER_ID
Everything goes into $HOME_DIR. The worker only runs tests that YOU upload to BharatSim.
EOF
read -r -p "Type YES to continue: " ANSWER < /dev/tty
[[ "$ANSWER" == "YES" ]] || { echo "Cancelled. Nothing was installed."; exit 0; }
mkdir -p "$HOME_DIR/logs"

step 1 "Checking hardware virtualization"
if [[ "$OS" == "Linux" ]]; then
  if [[ ! -e /dev/kvm ]]; then
    echo "  /dev/kvm is missing: enable virtualization in BIOS and install KVM (e.g. sudo apt install qemu-kvm)."
  elif [[ ! -w /dev/kvm ]]; then
    echo "  You cannot write /dev/kvm. Run: sudo usermod -aG kvm \$USER  (then log out and in)."
  fi
fi

step 2 "Python 3.12 for the worker (private copy via uv; your own Python is not used or changed)"
# scikit-learn 1.6.1 (needed by the worker's ML model) has prebuilt packages only for Python 3.9-3.13; a newer
# system Python would try to compile it. uv (https://github.com/astral-sh/uv) fetches a private Python 3.12.
UV="$HOME_DIR/uv/uv"
if [[ ! -x "$UV" ]]; then
  mkdir -p "$HOME_DIR/uv"
  curl -fL "https://github.com/astral-sh/uv/releases/latest/download/uv-$UV_TARGET.tar.gz" -o "$HOME_DIR/uv.tar.gz"
  tar -xzf "$HOME_DIR/uv.tar.gz" -C "$HOME_DIR/uv" --strip-components 1; rm "$HOME_DIR/uv.tar.gz"
fi
export UV_PYTHON_INSTALL_DIR="$HOME_DIR/python" UV_CACHE_DIR="$HOME_DIR/uv-cache"
"$UV" python install 3.12 || fail "Could not download Python 3.12 (check your internet connection and run again)."

step 3 "Java 17 runtime (needed by the Android SDK tools)"
JAVA_BIN="$(find "$JDK" -type f -name java -path '*/bin/*' 2>/dev/null | head -1 || true)"
if [[ -z "$JAVA_BIN" ]]; then
  mkdir -p "$JDK"
  curl -fL "https://api.adoptium.net/v3/binary/latest/17/ga/$JRE_OS/$JRE_ARCH/jre/hotspot/normal/eclipse" -o "$HOME_DIR/jre.tar.gz"
  tar -xzf "$HOME_DIR/jre.tar.gz" -C "$JDK"; rm "$HOME_DIR/jre.tar.gz"
  JAVA_BIN="$(find "$JDK" -type f -name java -path '*/bin/*' | head -1)"
fi
export JAVA_HOME="$(cd "$(dirname "$JAVA_BIN")/.." && pwd)"
export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"

step 4 "Android SDK command-line tools"
SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"
if [[ ! -x "$SDKMANAGER" ]]; then
  curl -fL "https://dl.google.com/android/repository/commandlinetools-$TOOLS_OS-11076708_latest.zip" -o "$HOME_DIR/tools.zip"
  rm -rf "$HOME_DIR/tools-tmp"; mkdir -p "$HOME_DIR/tools-tmp" "$SDK/cmdline-tools"
  (cd "$HOME_DIR/tools-tmp" && unzip -q "$HOME_DIR/tools.zip"); rm "$HOME_DIR/tools.zip"
  rm -rf "$SDK/cmdline-tools/latest"; mv "$HOME_DIR/tools-tmp/cmdline-tools" "$SDK/cmdline-tools/latest"; rm -rf "$HOME_DIR/tools-tmp"
fi

step 5 "Android SDK licenses (please read and accept)"
"$SDKMANAGER" --sdk_root="$SDK" --licenses < /dev/tty

step 6 "Downloading emulator, platform-tools, build-tools and the Android 11 image (about 3 GB)"
"$SDKMANAGER" --sdk_root="$SDK" "platform-tools" "emulator" "build-tools;34.0.0" "$IMAGE"

step 7 "Creating the budget-phone emulator (bharat_low: 2 GB RAM, 2 cores, 720p)"
echo no | "$SDK/cmdline-tools/latest/bin/avdmanager" create avd -n bharat_low -k "$IMAGE" -d pixel_3a --force >/dev/null
CFG="$HOME/.android/avd/bharat_low.avd/config.ini"
if [[ -f "$CFG" ]]; then
  grep -vE '^(hw\.ramSize|hw\.cpu\.ncore|hw\.lcd\.width|hw\.lcd\.height|hw\.lcd\.density|hw\.keyboard)=' "$CFG" > "$CFG.tmp" || true
  printf 'hw.ramSize=2048\nhw.cpu.ncore=2\nhw.lcd.width=720\nhw.lcd.height=1280\nhw.lcd.density=320\nhw.keyboard=yes\n' >> "$CFG.tmp"
  mv "$CFG.tmp" "$CFG"
fi
"$SDK/emulator/emulator" -accel-check || echo "  Hardware acceleration is not usable yet; the emulator may not start until it is."

step 8 "Downloading the BharatSim worker"
curl -fL "$REPO_ZIP" -o "$HOME_DIR/bharatsim.zip"
rm -rf "$HOME_DIR/src-tmp" "$APP"; mkdir -p "$HOME_DIR/src-tmp" "$APP"
(cd "$HOME_DIR/src-tmp" && unzip -q "$HOME_DIR/bharatsim.zip"); rm "$HOME_DIR/bharatsim.zip"
cp -R "$HOME_DIR"/src-tmp/*/worker "$APP/worker"; rm -rf "$HOME_DIR/src-tmp"

step 9 "Python environment (prebuilt packages only, nothing is compiled)"
rm -rf "$VENV"  # a previous failed attempt may have left a broken venv
"$UV" venv --python 3.12 "$VENV"
"$UV" pip install --python "$VENV/bin/python" --only-binary ":all:" "scikit-learn==1.6.1" "joblib==1.4.2" \
  || fail "Could not install the worker's Python packages."
"$VENV/bin/python" -c "import sklearn, joblib; print('  scikit-learn', sklearn.__version__, 'ready')"

step 10 "Writing configuration"
umask 077
cat > "$HOME_DIR/worker.env" <<EOF
# BharatSim personal worker. Keep this file private: the key lets this computer run your own tests.
BHARATSIM_API_URL=$API
BHARATSIM_WORKER_TOKEN=$KEY
BHARATSIM_WORKER_ID=$WORKER_ID
ANDROID_HOME=$SDK
ANDROID_SDK_ROOT=$SDK
ANDROID_SERIAL=emulator-5554
BHARATSIM_AVD=bharat_low
BHARATSIM_WORKER_ENGINE=engine
BHARATSIM_ENABLE_LOCAL_APK_EXECUTION=true
EOF
umask 022
cat > "$HOME_DIR/start-lab.sh" <<EOF
#!/usr/bin/env bash
cd "$APP" && BHARATSIM_HOME="$HOME_DIR" nohup "$VENV/bin/python" -m worker.lab >> "$HOME_DIR/logs/lab.out" 2>&1 &
echo "BharatSim lab started (logs: $HOME_DIR/logs)"
EOF
chmod +x "$HOME_DIR/start-lab.sh"

step 11 "Starting the lab"
"$HOME_DIR/start-lab.sh"
echo
echo "Done. The emulator boots in about a minute; this computer then shows as online at $API/connect."
echo "Start again after a reboot with: $HOME_DIR/start-lab.sh"
