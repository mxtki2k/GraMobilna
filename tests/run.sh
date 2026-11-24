#!/usr/bin/env bash
# Uruchamia testy logiki w trybie headless. GODOT=/ścieżka/do/godot ./tests/run.sh
set -e
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
# Import zasobów (SVG) potrzebny przy świeżym klonie; w edytorze dzieje się automatycznie.
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
"$GODOT" --headless --path . --script tests/run_tests.gd
