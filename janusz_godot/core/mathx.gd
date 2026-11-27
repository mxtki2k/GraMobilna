extends RefCounted
## Zgodność z JavaScriptem (lista pułapek w PLAN_GODOT.md). Wszystko static, bez stanu.

const NBSP := " "


## Math.round z JS: połówki zawsze w górę (−2,5 → −2), inaczej niż round() w Godocie.
## Bez floor(x + 0.5): dla 0,49999999999999994 dodawanie zaokrągla do 1, a JS daje 0.
static func round_js(x: float) -> int:
	var f: float = floor(x)
	return int(f) + (1 if x - f >= 0.5 else 0)


## Dzielenie całkowite z zaokrągleniem w dół także dla liczb ujemnych (Math.floor(a / b)).
static func fdiv(a: int, b: int) -> int:
	return int(floor(float(a) / float(b)))


## Reszta zawsze nieujemna (dla dodatniego b), jak ((a % b) + b) % b w JS.
static func pmod(a: int, b: int) -> int:
	return posmod(a, b)


## Dwie cyfry z zerem wiodącym: pad(n) z czas.js.
static func pad2(n: int) -> String:
	return ("0" if n < 10 else "") + str(n)


## Math.round(n).toLocaleString('pl-PL') + ' zł': grupowanie po 3 cyfry twardą spacją od 5 cyfr,
## "-0" dla małych liczb ujemnych (tak robi JS).
static func zl(n: float) -> String:
	return _pl_int(n) + " zł"


static func _pl_int(n: float) -> String:
	var r := round_js(n)
	var neg := r < 0 or (n < 0.0 and r == 0)
	var digits := str(absi(r))
	var out := digits
	if digits.length() >= 5:
		out = ""
		var cnt := 0
		for i in range(digits.length() - 1, -1, -1):
			out = digits[i] + out
			cnt += 1
			if cnt % 3 == 0 and i > 0:
				out = NBSP + out
	return ("-" if neg else "") + out
