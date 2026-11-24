extends RefCounted
## Generator poziomów metodą odwrotną.
## Strzałki dokładamy w kolejności ODWROTNEJ do wypływania: każda nowa strzałka
## ma wolny pas przed dziobem względem wszystkich już położonych, ale jej ciało
## może zasłaniać drogę wcześniej położonym. Dzięki temu poziom jest ZAWSZE
## rozwiązywalny (kolejność wypływania = odwrotność kolejności układania).
##
## Głębokość łańcuchów blokad: z prawdopodobieństwem chain_bias nowa strzałka
## jest celowo stawiana w pasie wypłynięcia jeszcze niezasłoniętej strzałki
## o największym "up" (najdłuższy łańcuch zależności za nią).
##
## params: width, height, fill (0..1), min_len, max_len, bend (0..1),
##         chain_bias (0..1), edge_reject (0..1), min_ray (>=1)
## Uwaga: używamy wyłącznie własnego RandomNumberGenerator (determinizm).

const ArrowData = preload("res://scripts/core/arrow_data.gd")
const LevelData = preload("res://scripts/core/level_data.gd")

const DIRS: Array[Vector2i] = [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP]


static func generate(params: Dictionary, seed_value: int):
	var w: int = params.get("width", 8)
	var h: int = params.get("height", 8)
	var fill: float = params.get("fill", 0.7)
	var min_len: int = params.get("min_len", 2)
	var max_len: int = params.get("max_len", 5)
	var bend: float = params.get("bend", 0.3)
	var chain_bias: float = params.get("chain_bias", 0.6)
	var edge_reject: float = params.get("edge_reject", 0.0)
	var min_ray: int = params.get("min_ray", 1)

	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value

	var level = LevelData.new()
	level.width = w
	level.height = h
	level.seed_value = seed_value
	level.params = params.duplicate()

	var occupied := {}  # Vector2i -> arrow idx
	var ray_map := {}  # Vector2i -> Array of arrow idx whose ray crosses it
	var up: Array[int] = []  # najdłuższy łańcuch zależności za strzałką
	var cover: Array[int] = []  # ile strzałek aktualnie zasłania daną strzałkę
	var target_cells := int(float(w * h) * fill)
	var filled := 0
	var fails := 0
	var max_fails := 80
	var tournament := 1 + roundi(chain_bias * 4.0)

	while filled < target_cells and fails < max_fails:
		# Pod koniec obniżamy minimalną długość, by domknąć luki.
		var cur_min := min_len if fails < max_fails / 2 else 1
		var cand = null
		for k in 12:
			var forced = null
			if level.arrows.size() > 0 and rng.randf() < chain_bias:
				forced = _pick_chain_cell(rng, level, occupied, up, cover, tournament, w, h)
			var reject := edge_reject if fails < max_fails / 2 else 0.0
			cand = _try_candidate(rng, w, h, occupied, cur_min, max_len, bend, reject, min_ray, forced)
			if cand != null:
				break
		if cand == null:
			fails += 1
			continue
		fails = 0
		var idx: int = level.arrows.size()
		var arrow = ArrowData.create(cand.cells, cand.dir)
		level.arrows.append(arrow)
		# Kogo zasłania nowa strzałka?
		var blocked := {}
		for c in arrow.cells:
			if ray_map.has(c):
				for j in ray_map[c]:
					blocked[j] = true
		var best_up := -1
		for j in blocked.keys():
			best_up = maxi(best_up, up[j])
		up.append(best_up + 1)
		cover.append(0)
		for j in blocked.keys():
			cover[j] += 1
		for c in arrow.cells:
			occupied[c] = idx
		filled += arrow.cells.size()
		for c in arrow.ray(w, h):
			if not ray_map.has(c):
				ray_map[c] = []
			ray_map[c].append(idx)
	return level


## Wybiera wolną komórkę w pasie wypłynięcia strzałki z najwyższym "up"
## (turniej z `tournament` losowych strzałek). Null, gdy brak miejsca.
static func _pick_chain_cell(
	rng: RandomNumberGenerator,
	level,
	occupied: Dictionary,
	up: Array[int],
	cover: Array[int],
	tournament: int,
	w: int,
	h: int
):
	# Cel: strzałki jeszcze niezasłonięte (wolne od startu) o najdłuższym łańcuchu "up".
	# Zasłonięcie wolnej strzałki zmniejsza odsetek wolnych i wydłuża łańcuch.
	var pool: Array[int] = []
	for j in cover.size():
		if cover[j] == 0:
			pool.append(j)
	if pool.is_empty():
		for j in cover.size():
			pool.append(j)
	var best := -1
	for t in tournament:
		var j: int = pool[rng.randi_range(0, pool.size() - 1)]
		if best == -1 or up[j] > up[best]:
			best = j
	var free_cells: Array[Vector2i] = []
	for c in level.arrows[best].ray(w, h):
		if not occupied.has(c):
			free_cells.append(c)
	if free_cells.is_empty():
		return null
	# Bliżej dziobu = bardziej prawdopodobne (twardsza blokada).
	var r := rng.randf()
	return free_cells[int(r * r * free_cells.size())]


static func _shuffled(rng: RandomNumberGenerator, arr: Array[Vector2i]) -> Array[Vector2i]:
	var a := arr.duplicate()
	for i in range(a.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var tmp: Vector2i = a[i]
		a[i] = a[j]
		a[j] = tmp
	return a


static func _try_candidate(
	rng: RandomNumberGenerator,
	w: int,
	h: int,
	occupied: Dictionary,
	min_len: int,
	max_len: int,
	bend: float,
	edge_reject: float,
	min_ray: int,
	forced_head = null
):
	var head: Vector2i
	if forced_head != null:
		head = forced_head
	else:
		head = Vector2i(rng.randi_range(0, w - 1), rng.randi_range(0, h - 1))
	if occupied.has(head):
		return null

	# Kierunki w losowej kolejności; bierzemy pierwszy z wolnym pasem.
	var dir := Vector2i.ZERO
	var ray_cells := {}
	var tries: Array[Vector2i] = [DIRS[rng.randi_range(0, 3)]]
	if forced_head != null:
		tries = _shuffled(rng, DIRS)
	for d in tries:
		var cells_ok := true
		var rc := {}
		var p := head + d
		while p.x >= 0 and p.y >= 0 and p.x < w and p.y < h:
			if occupied.has(p):
				cells_ok = false
				break
			rc[p] = true
			p += d
		if cells_ok:
			dir = d
			ray_cells = rc
			break
	if dir == Vector2i.ZERO:
		return null
	# Strzałka z krótkim pasem (dziób przy krawędzi) jest prawie zawsze wolna i trudno ją zasłonić.
	# Im trudniejszy poziom, tym rzadziej je dopuszczamy.
	if ray_cells.size() < min_ray and rng.randf() < edge_reject:
		return null

	var want := rng.randi_range(min_len, max_len)
	var cells: Array[Vector2i] = [head]
	var visited := {head: true}
	var last_step := -dir  # pierwszy krok ciała: tuż za dziobem
	var cur := head
	while cells.size() < want:
		var options: Array[Vector2i] = []
		if cells.size() == 1:
			options.append(-dir)
		else:
			var turns: Array[Vector2i] = []
			for d in DIRS:
				if d != last_step and d != -last_step:
					turns.append(d)
			turns = _shuffled(rng, turns)
			if rng.randf() < bend:
				options.append_array(turns)
				options.append(last_step)
			else:
				options.append(last_step)
				options.append_array(turns)
		var moved := false
		for d in options:
			var n := cur + d
			if n.x < 0 or n.y < 0 or n.x >= w or n.y >= h:
				continue
			if occupied.has(n) or visited.has(n) or ray_cells.has(n):
				continue
			cells.append(n)
			visited[n] = true
			last_step = d
			cur = n
			moved = true
			break
		if not moved:
			break
	if cells.size() < min_len:
		return null
	return {"cells": cells, "dir": dir}
