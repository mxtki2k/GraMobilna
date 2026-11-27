extends SceneTree
## Runner parytetu: dla każdego tests/golden/<moduł>.json wywołuje funkcję z core/<moduł>.gd
## i porównuje wynik ze złotym wynikiem z JS (tolerancja 1e-9, kolejność kluczy nieistotna).
## Uruchomienie: godot --headless --path janusz_godot --script tests/parity.gd [-- moduł ...]

const TOL := 1e-9
const MAX_REPORT := 12

var checks := 0
var failures := 0


func _init() -> void:
	var only: Array = []
	var args := OS.get_cmdline_user_args()
	for a in args:
		only.append(a)
	var dir := DirAccess.open("res://tests/golden")
	if dir == null:
		printerr("Brak katalogu tests/golden: uruchom node tools/golden.js")
		quit(2)
		return
	var names: Array = []
	for f in dir.get_files():
		if f.ends_with(".json"):
			names.append(f.trim_suffix(".json"))
	names.sort()
	for n in names:
		if only.is_empty() or n in only:
			_run_module(n)
	print("\nparytet: %d sprawdzeń, %d błędów" % [checks, failures])
	quit(1 if failures > 0 else 0)


func _run_module(name: String) -> void:
	var txt := FileAccess.get_file_as_string("res://tests/golden/%s.json" % name)
	var g = JSON.parse_string(txt)
	if g == null:
		_fail(name, "niepoprawny JSON")
		return
	var script_path := "res://core/%s.gd" % name
	if not ResourceLoader.exists(script_path):
		_fail(name, "brak modułu " + script_path)
		return
	var scr = load(script_path)
	if scr == null or not scr.can_instantiate():
		_fail(name, "moduł się nie kompiluje: " + script_path)
		return
	var inst = scr.new()
	var bad := 0
	var n_ok := 0
	for i in g.cases.size():
		var c: Dictionary = g.cases[i]
		var fn: String = c.fn
		if not inst.has_method(fn):
			_fail(name, "brak funkcji " + fn)
			return
		var got = inst.callv(fn, _fix_args(c.args))
		var path := _diff(got, c.out, "")
		checks += 1
		if path != "":
			bad += 1
			failures += 1
			if bad <= MAX_REPORT:
				printerr("FAIL %s.%s(%s) -> %s; oczekiwano %s; różnica: %s" % [name, fn, JSON.stringify(c.args), JSON.stringify(got), JSON.stringify(c.out), path])
		else:
			n_ok += 1
	print("%-8s %d/%d zgodnych (wersja źródła %s)" % [name, n_ok, g.cases.size(), g.version])


## Liczby z JSON są floatami; argumenty całkowite przekazujemy jako int, gdy to liczby całkowite.
func _fix_args(a: Array) -> Array:
	var out: Array = []
	for v in a:
		if typeof(v) == TYPE_FLOAT and v == floor(v) and absf(v) < 9.0e15:
			out.append(int(v))
		else:
			out.append(v)
	return out


func _fail(name: String, msg: String) -> void:
	failures += 1
	printerr("FAIL %s: %s" % [name, msg])


func _is_num(v) -> bool:
	return typeof(v) == TYPE_INT or typeof(v) == TYPE_FLOAT


## Pusty string = zgodne; inaczej ścieżka pierwszej różnicy.
func _diff(a, b, path: String) -> String:
	if _is_num(a) and _is_num(b):
		return "" if absf(float(a) - float(b)) <= TOL * (1.0 + absf(float(b))) else path + " (" + str(a) + " != " + str(b) + ")"
	if typeof(a) != typeof(b):
		return path + " (typ " + type_string(typeof(a)) + " != " + type_string(typeof(b)) + ")"
	if typeof(a) == TYPE_DICTIONARY:
		if a.size() != b.size():
			return path + " (inny zestaw kluczy)"
		for k in b.keys():
			if not a.has(k):
				return path + "." + str(k) + " (brak klucza)"
			var d := _diff(a[k], b[k], path + "." + str(k))
			if d != "":
				return d
		return ""
	if typeof(a) == TYPE_ARRAY:
		if a.size() != b.size():
			return path + " (długość " + str(a.size()) + " != " + str(b.size()) + ")"
		for i in a.size():
			var d := _diff(a[i], b[i], path + "[" + str(i) + "]")
			if d != "":
				return d
		return ""
	return "" if a == b else path + " (" + str(a) + " != " + str(b) + ")"
