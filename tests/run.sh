#!/usr/bin/env bash
# Uruchamia testy logiki w trybie headless. GODOT=/ścieżka/do/godot ./tests/run.sh
set -e
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
"$GODOT" --headless --path . --script tests/run_tests.gd
