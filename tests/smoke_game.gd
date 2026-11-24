extends SceneTree
## Test dymny prototypu: wczytuje scenę, rozgrywa poziomy zgodnie z solverem.

const Solver = preload("res://scripts/core/solver.gd")

var checks := 0
var failures := 0


func check(cond: bool, msg: String) -> void:
	checks += 1
	if not cond:
		failures += 1
		printerr("FAIL: " + msg)


func _init() -> void:
	var scene: PackedScene = load("res://scenes/main.tscn")
	var game = scene.instantiate()
	root.add_child(game)
	# _ready wykonuje się po dodaniu do drzewa
	await process_frame
	game.load_level(7)
	var s = Solver.solve(game.level)
	# zablokowana łódź kosztuje życie (jeśli taka jest)
	var blocked_idx := -1
	for i in game.level.arrows.size():
		if not game.blockers[i].is_empty():
			blocked_idx = i
			break
	if blocked_idx >= 0:
		var res: String = game.tap_cell(game.level.arrows[blocked_idx].cells[0])
		check(res == "blocked", "blocked tap rejected")
		check(game.lives == 2, "blocked tap costs a life")
	# rozwiąż poziom
	for i in s.order:
		var res2: String = game.tap_cell(game.level.arrows[i].cells[0])
		check(res2 == "escaped", "arrow %d escapes in solver order" % i)
	for k in 10:
		game._process(0.5)
	check(game.state == "won", "level won after all arrows left")
	# porażka po 3 błędach
	game.load_level(30)
	var cnt := 0
	for i in game.level.arrows.size():
		if not game.blockers[i].is_empty() and cnt < 3:
			game.tap_cell(game.level.arrows[i].cells[0])
			cnt += 1
	check(game.state == "lost", "lost after 3 mistakes (blocked taps: %d)" % cnt)
	# podpowiedź wskazuje wolną łódź
	game.load_level(12)
	game.give_hint()
	check(game.hint_idx >= 0 and game.blockers[game.hint_idx].is_empty(), "hint points to a free arrow")
	# wszystkie poziomy 1..60 przechodzą grą
	var ok := true
	for n in range(1, 61):
		game.load_level(n)
		for i in Solver.solve(game.level).order:
			if game.tap_cell(game.level.arrows[i].cells[0]) != "escaped":
				ok = false
		for k in 20:
			game._process(0.5)
		if game.state != "won":
			ok = false
	check(ok, "levels 1..60 playable to victory via tap_cell")
	print("%d checks, %d failures" % [checks, failures])
	quit(1 if failures > 0 else 0)
