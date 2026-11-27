extends RefCounted
## Wspólny generator z JS: s = (s * 1664525 + 1013904223) mod 2^32, wynik s / 2^32.
## Ten sam ciąg co lcg() w tests/silnik.test.js i tools/headless.js, więc scenariusze dają te same skróty.

var s: int = 0


func _init(seed_value: int = 1) -> void:
	s = seed_value & 0xFFFFFFFF


## Następna liczba z [0, 1).
func next() -> float:
	s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
	return float(s) / 4294967296.0


## Pierwsze n liczb dla ziarna (do testów parytetu).
static func sequence(seed_value: int, n: int) -> Array:
	var r = load("res://core/rng.gd").new(seed_value)
	var out: Array = []
	for i in n:
		out.append(r.next())
	return out
