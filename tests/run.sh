#!/usr/bin/env bash
# Wszystkie testy: Node (logika JS, silnik, scenariusze), Godot (Arrow Escape) i parytet JS <-> GDScript (Janusz).
# GODOT=/ścieżka/do/godot ./tests/run.sh      (bez GODOT części Godota są pomijane, gdy brak `godot` w PATH)
set -e
cd "$(dirname "$0")/.."
FAIL=0

echo "== Node: testy logiki i scenariusze"
for f in tests/*.test.js; do
  if ! node "$f" >/tmp/janusz_test.out 2>&1; then echo "FAIL $f"; tail -5 /tmp/janusz_test.out; FAIL=1; fi
done

GODOT="${GODOT:-godot}"
if command -v "$GODOT" >/dev/null 2>&1 || [ -x "$GODOT" ]; then
  echo "== Godot: Arrow Escape"
  "$GODOT" --headless --path . --import >/dev/null 2>&1 || true
  "$GODOT" --headless --path . --script tests/run_tests.gd || FAIL=1
  echo "== Godot: parytet Janusza (złote dane z JS)"
  node tools/golden.js >/dev/null
  "$GODOT" --headless --path janusz_godot --import >/dev/null 2>&1 || true
  "$GODOT" --headless --path janusz_godot --script tests/parity.gd || FAIL=1
else
  echo "== Godot niedostępny: pomijam Arrow Escape i parytet (ustaw GODOT=/ścieżka/do/godot)"
fi
exit $FAIL
