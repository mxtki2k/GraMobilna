extends RefCounted
## Krzywa trudności: numer poziomu -> parametry generatora.
## Ten sam numer poziomu zawsze daje ten sam poziom (stały seed).

const LevelGenerator = preload("res://scripts/core/level_generator.gd")
const Solver = preload("res://scripts/core/solver.gd")

const RAMP_LEVELS := 200


static func params_for_level(n: int) -> Dictionary:
	var t := clampf(float(n - 1) / float(RAMP_LEVELS - 1), 0.0, 1.0)
	var size := 3 + roundi(t * 9.0)  # 3x3 .. 12x12
	return {
		"width": size,
		"height": size,
		"fill": lerpf(0.5, 0.82, t),
		"min_len": 1 + roundi(t * 2.0),
		"max_len": 2 + roundi(t * 6.0),
		"bend": lerpf(0.1, 0.5, t),
		"chain_bias": lerpf(0.3, 0.95, t),
		"edge_reject": lerpf(0.0, 0.9, t),
		"min_ray": 1 + roundi(t * 2.0),
	}


static func seed_for_level(n: int) -> int:
	return (n * 2654435761 + 104729) % 4294967296


## Ile kandydatów generujemy dla poziomu (więcej = trudniejszy wybór, wolniejsze ładowanie).
static func candidates_for_level(n: int) -> int:
	var t := clampf(float(n - 1) / float(RAMP_LEVELS - 1), 0.0, 1.0)
	return 1 + roundi(t * 4.0)


## Ocena trudności: głębsze łańcuchy i mniej łódek wolnych od startu = trudniej.
static func score(level) -> float:
	var an := Solver.analyze(level)
	var n := maxi(an.arrows, 1)
	return float(an.depth) + 8.0 * (1.0 - float(an.free_at_start) / float(n))


## Generuje kilka kandydatów (deterministycznie) i bierze najtrudniejszego dla danej krzywej.
static func generate_level(n: int):
	var params := params_for_level(n)
	var base := seed_for_level(n)
	var best = null
	var best_score := -INF
	for i in candidates_for_level(n):
		var lv = LevelGenerator.generate(params, base + i * 7919)
		var s := score(lv)
		if s > best_score:
			best_score = s
			best = lv
	return best
