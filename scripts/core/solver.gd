extends RefCounted
## Solver i analiza poziomów.
## Reguła gry: strzałka może wypłynąć, gdy żadna komórka przed jej dziobem
## (do krawędzi) nie jest zajęta przez inną strzałkę, która nadal jest na planszy.
## Poziom jest rozwiązywalny <=> graf zależności nie ma cykli.


## Dla każdej strzałki: indeksy strzałek stojących jej na drodze.
static func blockers(level) -> Array:
	var owner: Dictionary = level.cell_owner_map()
	var out: Array = []
	for i in level.arrows.size():
		var seen := {}
		for c in level.arrows[i].ray(level.width, level.height):
			if owner.has(c) and owner[c] != i:
				seen[owner[c]] = true
		var list: Array[int] = []
		for k in seen.keys():
			list.append(k)
		list.sort()
		out.append(list)
	return out


## Zdejmuje warstwami wolne strzałki. rounds[k] = strzałki wolne w rundzie k.
static func solve(level) -> Dictionary:
	var bl := blockers(level)
	var n: int = level.arrows.size()
	var removed := PackedByteArray()
	removed.resize(n)
	var remaining := n
	var rounds: Array = []
	var order: Array[int] = []
	while remaining > 0:
		var layer: Array[int] = []
		for i in n:
			if removed[i] == 1:
				continue
			var free := true
			for b in bl[i]:
				if removed[b] == 0:
					free = false
					break
			if free:
				layer.append(i)
		if layer.is_empty():
			break
		for i in layer:
			removed[i] = 1
			order.append(i)
		remaining -= layer.size()
		rounds.append(layer)
	var stuck: Array[int] = []
	for i in n:
		if removed[i] == 0:
			stuck.append(i)
	return {
		"solvable": remaining == 0,
		"rounds": rounds,
		"depth": rounds.size(),
		"order": order,
		"stuck": stuck,
	}


## Strzałki, które można wypuścić teraz (alive[i] == 1 gdy jeszcze na planszy).
## Używane przez podpowiedź i walidację tapnięcia.
static func free_arrows(bl: Array, alive: PackedByteArray) -> Array[int]:
	var out: Array[int] = []
	for i in bl.size():
		if alive[i] == 0:
			continue
		var free := true
		for b in bl[i]:
			if alive[b] == 1:
				free = false
				break
		if free:
			out.append(i)
	return out


static func analyze(level) -> Dictionary:
	var s := solve(level)
	var bl := blockers(level)
	var total := 0
	var mx := 0
	for list in bl:
		total += list.size()
		mx = maxi(mx, list.size())
	var n: int = level.arrows.size()
	return {
		"solvable": s.solvable,
		"arrows": n,
		"fill": level.fill_ratio(),
		"depth": s.depth,
		"avg_blockers": float(total) / float(maxi(n, 1)),
		"max_blockers": mx,
		"free_at_start": (s.rounds[0].size() if s.rounds.size() > 0 else 0),
	}
