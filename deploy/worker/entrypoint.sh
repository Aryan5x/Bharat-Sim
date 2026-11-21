#!/usr/bin/env bash
set -euo pipefail

echo "Starting headless Android emulator with KVM..."
emulator @bharatsim-api35 -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 2048 -wipe-data -no-snapshot &
EMU_PID=$!

echo "Waiting for Android emulator to complete boot..."
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    sleep 2
done
echo "Android emulator is online and ready (emulator-5554)."

echo "Starting BharatSim Worker Daemon..."
exec python3 /opt/bharatsim/worker/agent.py
