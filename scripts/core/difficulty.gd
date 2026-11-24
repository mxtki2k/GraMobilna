extends RefCounted
## Krzywa trudności: numer poziomu -> parametry generatora.
## Ten sam numer poziomu zawsze daje ten sam poziom (stały seed).

const LevelGenerator = preload("res://scripts/core/level_generator.gd")

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
	}


static func seed_for_level(n: int) -> int:
	return (n * 2654435761 + 104729) % 4294967296


static func generate_level(n: int):
	return LevelGenerator.generate(params_for_level(n), seed_for_level(n))
