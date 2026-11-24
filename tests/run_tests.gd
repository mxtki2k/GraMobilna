extends SceneTree
## Testy logiki rdzenia. Uruchomienie: GODOT=/ścieżka/do/godot ./tests/run.sh

const ArrowData = preload("res://scripts/core/arrow_data.gd")
const LevelData = preload("res://scripts/core/level_data.gd")
const Solver = preload("res://scripts/core/solver.gd")
const LevelGenerator = preload("res://scripts/core/level_generator.gd")
const Difficulty = preload("res://scripts/core/difficulty.gd")

var checks := 0
var failures := 0


func check(cond: bool, msg: String) -> void:
	checks += 1
	if not cond:
		failures += 1
		printerr("FAIL: " + msg)


func _init() -> void:
	test_solver_basic()
	test_solver_cycle()
	test_validation()
	test_generator_determinism()
	test_generator_solvable_many_seeds()
	test_difficulty_curve()
	print("\n%d checks, %d failures" % [checks, failures])
	quit(1 if failures > 0 else 0)


func make_level(w: int, h: int, defs: Array):
	var lv = LevelData.new()
	lv.width = w
	lv.height = h
	for d in defs:
		var cells: Array[Vector2i] = []
		for c in d[0]:
			cells.append(c)
		lv.arrows.append(ArrowData.create(cells, d[1]))
	return lv


func test_solver_basic() -> void:
	# B (w (1,0)) płynie w górę (wolne od razu), A (w (0,0)) płynie w prawo i jest zasłonięta przez B.
	var lv = make_level(3, 2, [
		[[Vector2i(0, 0)], Vector2i.RIGHT],
		[[Vector2i(1, 0)], Vector2i.UP],
	])
	check(lv.validate() == "", "basic level valid")
	var s = Solver.solve(lv)
	check(s.solvable, "basic solvable")
	check(s.depth == 2, "basic depth is 2, got %d" % s.depth)
	check(s.order == [1, 0], "basic order B then A, got %s" % str(s.order))
	var bl = Solver.blockers(lv)
	var alive := PackedByteArray([1, 1])
	check(Solver.free_arrows(bl, alive) == [1], "only B free at start")
	alive[1] = 0
	check(Solver.free_arrows(bl, alive) == [0], "A free after B left")


func test_solver_cycle() -> void:
	# A patrzy w prawo i jest zasłonięta przez B; B patrzy w lewo i jest zasłonięta przez A.
	var lv = make_level(3, 1, [
		[[Vector2i(0, 0)], Vector2i.RIGHT],
		[[Vector2i(2, 0)], Vector2i.LEFT],
	])
	var s = Solver.solve(lv)
	check(not s.solvable, "cycle is unsolvable")
	check(s.stuck.size() == 2, "cycle leaves both stuck")


func test_validation() -> void:
	var overlap = make_level(3, 3, [
		[[Vector2i(0, 0)], Vector2i.RIGHT],
		[[Vector2i(0, 0)], Vector2i.UP],
	])
	check(overlap.validate() != "", "overlap rejected")
	var oob = make_level(2, 2, [[[Vector2i(5, 5)], Vector2i.RIGHT]])
	check(oob.validate() != "", "out of bounds rejected")
	var bad_body = make_level(3, 3, [
		[[Vector2i(1, 1), Vector2i(1, 0)], Vector2i.RIGHT],
	])
	check(bad_body.validate() != "", "body in front of head rejected")
	var ok_body = make_level(3, 3, [
		[[Vector2i(1, 1), Vector2i(0, 1), Vector2i(0, 0)], Vector2i.RIGHT],
	])
	check(ok_body.validate() == "", "bent body behind head accepted")


func test_generator_determinism() -> void:
	var p := Difficulty.params_for_level(120)
	var a = LevelGenerator.generate(p, 12345)
	var b = LevelGenerator.generate(p, 12345)
	var c = LevelGenerator.generate(p, 54321)
	check(a.to_ascii() == b.to_ascii(), "same seed -> same level")
	check(a.to_ascii() != c.to_ascii(), "different seed -> different level")


func test_generator_solvable_many_seeds() -> void:
	var configs := [
		{"width": 4, "height": 4, "fill": 0.6, "min_len": 1, "max_len": 3, "bend": 0.2, "chain_bias": 0.5},
		{"width": 8, "height": 8, "fill": 0.75, "min_len": 2, "max_len": 6, "bend": 0.4, "chain_bias": 0.9},
		{"width": 12, "height": 12, "fill": 0.85, "min_len": 3, "max_len": 8, "bend": 0.5, "chain_bias": 1.0},
		{"width": 6, "height": 10, "fill": 0.7, "min_len": 2, "max_len": 5, "bend": 0.3, "chain_bias": 0.7},
	]
	var bad := 0
	var total := 0
	for cfg in configs:
		for s in 150:
			var lv = LevelGenerator.generate(cfg, s * 977 + 3)
			total += 1
			var err: String = lv.validate()
			if err != "":
				bad += 1
				printerr("invalid level seed %d: %s" % [s, err])
				continue
			if lv.arrows.is_empty() or not Solver.solve(lv).solvable:
				bad += 1
				printerr("unsolvable/empty level cfg %s seed %d" % [str(cfg), s])
	check(bad == 0, "%d/%d generated levels valid and solvable" % [total - bad, total])


func test_difficulty_curve() -> void:
	var buckets := [[1, 10], [50, 60], [100, 110], [190, 200]]
	var depth_avg: Array[float] = []
	print("\nlevels      size  arrows  fill  depth  avg_blk  free0  ms/level")
	var all_ok := true
	for bk in buckets:
		var n := 0
		var sum_arrows := 0.0
		var sum_fill := 0.0
		var sum_depth := 0.0
		var sum_blk := 0.0
		var sum_free := 0.0
		var t0 := Time.get_ticks_msec()
		var size := 0
		for lvn in range(bk[0], bk[1] + 1):
			var lv = Difficulty.generate_level(lvn)
			if lv.validate() != "" or not Solver.solve(lv).solvable:
				all_ok = false
			var an := Solver.analyze(lv)
			size = lv.width
			sum_arrows += an.arrows
			sum_fill += an.fill
			sum_depth += an.depth
			sum_blk += an.avg_blockers
			sum_free += an.free_at_start
			n += 1
		var ms := float(Time.get_ticks_msec() - t0) / float(n)
		depth_avg.append(sum_depth / n)
		print("%3d-%-3d    %2dx%-2d  %5.1f  %.2f  %5.1f  %6.2f  %5.1f  %6.1f" % [
			bk[0], bk[1], size, size, sum_arrows / n, sum_fill / n,
			sum_depth / n, sum_blk / n, sum_free / n, ms])
	check(all_ok, "every level on the curve is valid and solvable")
	check(depth_avg[3] > depth_avg[0] * 2.0, "late levels much deeper than early (%.1f vs %.1f)" % [depth_avg[3], depth_avg[0]])
	print("\nPrzykład: poziom 25")
	print(Difficulty.generate_level(25).to_ascii())
	# Wszystkie 1..300 muszą być rozwiązywalne.
	var unsolvable := 0
	for lvn in range(1, 301):
		if not Solver.solve(Difficulty.generate_level(lvn)).solvable:
			unsolvable += 1
	check(unsolvable == 0, "levels 1..300 all solvable")
