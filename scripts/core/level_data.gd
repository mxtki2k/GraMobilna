extends RefCounted
## Poziom: plansza width x height z listą strzałek. Czysta logika, zero grafiki.

var width: int = 0
var height: int = 0
var arrows: Array = []  # Array of ArrowData
var seed_value: int = 0
var params: Dictionary = {}


## Mapa komórka -> indeks strzałki, która ją zajmuje.
func cell_owner_map() -> Dictionary:
	var m := {}
	for i in arrows.size():
		for c in arrows[i].cells:
			m[c] = i
	return m


func fill_ratio() -> float:
	var n := 0
	for a in arrows:
		n += a.cells.size()
	return float(n) / float(maxi(width * height, 1))


## Zwraca "" gdy poziom jest poprawny, inaczej opis błędu.
func validate() -> String:
	var seen := {}
	for i in arrows.size():
		var a = arrows[i]
		if a.cells.is_empty():
			return "arrow %d is empty" % i
		if a.dir not in [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.UP, Vector2i.DOWN]:
			return "arrow %d has bad dir" % i
		for j in a.cells.size():
			var c: Vector2i = a.cells[j]
			if c.x < 0 or c.y < 0 or c.x >= width or c.y >= height:
				return "arrow %d cell %s out of bounds" % [i, c]
			if seen.has(c):
				return "cell %s used twice" % c
			seen[c] = i
			if j > 0:
				var d: Vector2i = c - a.cells[j - 1]
				if absi(d.x) + absi(d.y) != 1:
					return "arrow %d not connected at %d" % [i, j]
		if a.cells.size() > 1 and a.cells[1] != a.cells[0] - a.dir:
			return "arrow %d body must trail behind head" % i
	return ""


## Podgląd tekstowy do debugowania: dziób = < > ^ v, ciało = litera.
func to_ascii() -> String:
	var grid: Array = []
	for y in height:
		var row: Array = []
		for x in width:
			row.append(".")
		grid.append(row)
	for i in arrows.size():
		var a = arrows[i]
		var letter := char(97 + (i % 26))
		for j in a.cells.size():
			var c: Vector2i = a.cells[j]
			grid[c.y][c.x] = letter
		var h: Vector2i = a.cells[0]
		var g := ">"
		if a.dir == Vector2i.LEFT:
			g = "<"
		elif a.dir == Vector2i.UP:
			g = "^"
		elif a.dir == Vector2i.DOWN:
			g = "v"
		grid[h.y][h.x] = g
	var lines: PackedStringArray = []
	for row in grid:
		lines.append(" ".join(row))
	return "\n".join(lines)
