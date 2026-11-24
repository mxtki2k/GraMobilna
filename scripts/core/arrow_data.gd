extends RefCounted
## Jedna strzałka (łódź): lista komórek od dziobu (cells[0]) do rufy
## i kierunek, w którym dziób wypływa z planszy.

var cells: Array[Vector2i] = []
var dir: Vector2i = Vector2i.RIGHT


static func create(p_cells: Array[Vector2i], p_dir: Vector2i):
	var a = new()
	a.cells = p_cells
	a.dir = p_dir
	return a


func head() -> Vector2i:
	return cells[0]


func length() -> int:
	return cells.size()


## Komórki przed dziobem aż do krawędzi planszy (bez komórki dziobu).
func ray(width: int, height: int) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	var p := cells[0] + dir
	while p.x >= 0 and p.y >= 0 and p.x < width and p.y < height:
		out.append(p)
		p += dir
	return out
