extends Node2D
## Szary prototyp: plansza, tap, wypływanie łodzi, życia, wygrana/porażka.
## Cała logika reguł jest w scripts/core/; tu tylko rysowanie i wejście.

const Difficulty = preload("res://scripts/core/difficulty.gd")
const Solver = preload("res://scripts/core/solver.gd")

const SAVE_PATH := "user://save.json"
const MAX_LIVES := 3
const VIEW := Vector2(720, 1280)
const BOARD_RECT := Rect2(40, 200, 640, 860)

const PALETTE: Array[Color] = [
	Color("f4a259"), Color("e76f51"), Color("f6d55c"), Color("8ecae6"),
	Color("b5e48c"), Color("cdb4db"), Color("ff8fa3"), Color("90e0ef"),
]
const SEA_TOP := Color("0b2a43")
const SEA_BOTTOM := Color("12486b")
const BOARD_COL := Color(1, 1, 1, 0.07)

var level_no := 1
var level
var blockers: Array = []
var owner_map: Dictionary = {}
var alive := PackedByteArray()
var sliding := PackedByteArray()
var offsets := PackedFloat32Array()
var exit_need := PackedFloat32Array()
var lives := MAX_LIVES
var state := "play"  # play | won | lost

var cell := 60.0
var origin := Vector2.ZERO

var shake_idx := -1
var shake_t := 0.0
var hint_idx := -1
var hint_t := 0.0
var flash_t := 0.0

var btn_hint := Rect2(60, 1110, 300, 100)
var btn_restart := Rect2(380, 1110, 280, 100)
var btn_prev := Rect2(30, 50, 100, 100)
var btn_next := Rect2(590, 50, 100, 100)


func _ready() -> void:
	level_no = _load_progress()
	load_level(level_no)


func _load_progress() -> int:
	if FileAccess.file_exists(SAVE_PATH):
		var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
		var data = JSON.parse_string(f.get_as_text())
		if data is Dictionary and data.has("level"):
			return maxi(1, int(data["level"]))
	return 1


func _save_progress(n: int) -> void:
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"level": n}))


func load_level(n: int) -> void:
	level_no = maxi(1, n)
	level = Difficulty.generate_level(level_no)
	blockers = Solver.blockers(level)
	owner_map = level.cell_owner_map()
	var count: int = level.arrows.size()
	alive = PackedByteArray()
	alive.resize(count)
	alive.fill(1)
	sliding = PackedByteArray()
	sliding.resize(count)
	offsets = PackedFloat32Array()
	offsets.resize(count)
	exit_need = PackedFloat32Array()
	exit_need.resize(count)
	for i in count:
		exit_need[i] = _steps_to_exit(level.arrows[i])
	lives = MAX_LIVES
	state = "play"
	shake_idx = -1
	hint_idx = -1
	_layout()
	_save_progress(level_no)


func _steps_to_exit(a) -> float:
	var worst := 0
	for c in a.cells:
		var s := 0
		var p: Vector2i = c
		while p.x >= 0 and p.y >= 0 and p.x < level.width and p.y < level.height:
			p += a.dir
			s += 1
		worst = maxi(worst, s)
	return float(worst) + 0.5


func _layout() -> void:
	cell = minf(minf(BOARD_RECT.size.x / level.width, BOARD_RECT.size.y / level.height), 120.0)
	var size := Vector2(cell * level.width, cell * level.height)
	origin = BOARD_RECT.position + (BOARD_RECT.size - size) * 0.5


# ---------------------------------------------------------------- gra

func alive_count() -> int:
	var n := 0
	for v in alive:
		n += v
	return n


func sliding_count() -> int:
	var n := 0
	for v in sliding:
		n += v
	return n


## Tap na komórkę planszy. Zwraca "escaped", "blocked" lub "" (pusto / poza grą).
func tap_cell(c: Vector2i) -> String:
	if state != "play":
		return ""
	if not owner_map.has(c):
		return ""
	var i: int = owner_map[c]
	if alive[i] == 0:
		return ""
	var free := true
	for b in blockers[i]:
		if alive[b] == 1:
			free = false
			break
	if free:
		alive[i] = 0
		sliding[i] = 1
		if hint_idx == i:
			hint_idx = -1
		return "escaped"
	lives -= 1
	shake_idx = i
	shake_t = 0.4
	flash_t = 0.3
	if lives <= 0:
		state = "lost"
	return "blocked"


func give_hint() -> void:
	if state != "play":
		return
	var free := Solver.free_arrows(blockers, alive)
	if free.is_empty():
		return
	hint_idx = free[0]
	hint_t = 2.0


func _process(delta: float) -> void:
	for i in sliding.size():
		if sliding[i] == 1:
			offsets[i] += (6.0 + offsets[i] * 6.0) * delta
			if offsets[i] >= exit_need[i]:
				sliding[i] = 0
	shake_t = maxf(0.0, shake_t - delta)
	hint_t = maxf(0.0, hint_t - delta)
	flash_t = maxf(0.0, flash_t - delta)
	if state == "play" and alive_count() == 0 and sliding_count() == 0:
		state = "won"
		_save_progress(level_no + 1)
	queue_redraw()


# ---------------------------------------------------------------- wejście

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_on_press(make_input_local(event).position)


func _on_press(pos: Vector2) -> void:
	if state == "won":
		load_level(level_no + 1)
		return
	if state == "lost":
		load_level(level_no)
		return
	if btn_prev.has_point(pos):
		load_level(level_no - 1)
	elif btn_next.has_point(pos):
		load_level(level_no + 1)
	elif btn_restart.has_point(pos):
		load_level(level_no)
	elif btn_hint.has_point(pos):
		give_hint()
	else:
		var rel := (pos - origin) / cell
		var c := Vector2i(floori(rel.x), floori(rel.y))
		if c.x >= 0 and c.y >= 0 and c.x < level.width and c.y < level.height:
			tap_cell(c)


# ---------------------------------------------------------------- rysowanie

func _cell_center(c: Vector2i) -> Vector2:
	return origin + (Vector2(c) + Vector2(0.5, 0.5)) * cell


func _draw() -> void:
	_draw_sea()
	_draw_board()
	for i in level.arrows.size():
		if alive[i] == 1 or sliding[i] == 1:
			_draw_arrow(i)
	_draw_hud()
	if flash_t > 0.0:
		draw_rect(Rect2(Vector2.ZERO, VIEW), Color(1, 0.1, 0.1, flash_t * 0.5))
	if state != "play":
		_draw_overlay()


func _draw_sea() -> void:
	var steps := 16
	for k in steps:
		var t := float(k) / float(steps)
		var y := VIEW.y * t
		draw_rect(Rect2(0, y, VIEW.x, VIEW.y / steps + 1.0), SEA_TOP.lerp(SEA_BOTTOM, t))


func _draw_board() -> void:
	var size := Vector2(cell * level.width, cell * level.height)
	draw_rect(Rect2(origin - Vector2(10, 10), size + Vector2(20, 20)), BOARD_COL)
	for y in level.height:
		for x in level.width:
			draw_circle(_cell_center(Vector2i(x, y)), cell * 0.05, Color(1, 1, 1, 0.18))


func _draw_arrow(i: int) -> void:
	var a = level.arrows[i]
	var col: Color = PALETTE[i % PALETTE.size()]
	var d := Vector2(a.dir)
	var perp := Vector2(-d.y, d.x)
	var off := d * offsets[i] * cell
	if shake_idx == i and shake_t > 0.0:
		off += perp * sin(shake_t * 60.0) * cell * 0.12
		col = col.lerp(Color(1, 0.2, 0.2), 0.5)
	var pts := PackedVector2Array()
	for c in a.cells:
		pts.append(_cell_center(c) + off)
	var w := cell * 0.5
	if hint_idx == i and hint_t > 0.0:
		var glow := 0.5 + 0.5 * sin(hint_t * 12.0)
		_draw_body(pts, w + cell * 0.22, Color(0.75, 0.8, 0.85).lerp(Color.WHITE, glow))
	_draw_body(pts, w, col)
	# dziób
	var hc := pts[0]
	var tip := hc + d * cell * 0.46
	var l := hc - d * cell * 0.02 + perp * cell * 0.34
	var r := hc - d * cell * 0.02 - perp * cell * 0.34
	draw_colored_polygon(PackedVector2Array([tip, l, r]), col.lightened(0.25))


func _draw_body(pts: PackedVector2Array, width: float, col: Color) -> void:
	if pts.size() > 1:
		draw_polyline(pts, col, width, true)
	for p in pts:
		draw_circle(p, width * 0.5, col)


func _draw_hud() -> void:
	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(0, 112), "Poziom %d" % level_no, HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 52, Color.WHITE)
	var left := alive_count() + sliding_count()
	draw_string(font, Vector2(0, 168), "Łodzie: %d / %d" % [left, level.arrows.size()], HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 28, Color(1, 1, 1, 0.7))
	# życia
	for k in MAX_LIVES:
		var p := Vector2(VIEW.x * 0.5 - (MAX_LIVES - 1) * 24 + k * 48, 1080 + 0)
		draw_circle(p, 14, Color("ff6b6b") if k < lives else Color(1, 1, 1, 0.15))
	# nawigacja poziomów (prototyp)
	_draw_button(btn_prev, "<")
	_draw_button(btn_next, ">")
	_draw_button(btn_hint, "Podpowiedź")
	_draw_button(btn_restart, "Od nowa")
	if level_no == 1:
		draw_string(font, Vector2(0, 1030 + 40), "Dotknij łódź, żeby wypłynęła. Zablokowana kosztuje życie.", HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 24, Color(1, 1, 1, 0.8))


func _draw_button(r: Rect2, text: String) -> void:
	draw_rect(r, Color(1, 1, 1, 0.12))
	draw_rect(r, Color(1, 1, 1, 0.3), false, 2.0)
	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(r.position.x, r.position.y + r.size.y * 0.62), text, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 34, Color.WHITE)


func _draw_overlay() -> void:
	draw_rect(Rect2(Vector2.ZERO, VIEW), Color(0, 0, 0, 0.6))
	var font := ThemeDB.fallback_font
	var title := "Flota bezpieczna!" if state == "won" else "Fala dopadła flotę"
	var sub := "Dotknij, aby przejść dalej" if state == "won" else "Dotknij, aby spróbować ponownie"
	draw_string(font, Vector2(0, 600), title, HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 60, Color.WHITE)
	draw_string(font, Vector2(0, 680), sub, HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 32, Color(1, 1, 1, 0.8))
