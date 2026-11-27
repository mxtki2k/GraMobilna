extends RefCounted
## Port czas.js: kalendarz i zegar gry. Własny algorytm kalendarza (bez Time i stref czasowych).
## Zegar to minuty od 1 marca 2027, 00:00 (poniedziałek). Parytet: tests/golden/czas.json.

const Mathx = preload("res://core/mathx.gd")

const START_HOUR := 8
const TIME_SCALE := 5
const MONTHS_GEN := ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"]
const MONTHS_NOM := ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"]
const WEEKDAYS := ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"]
const WD_SHORT := ["niedz.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."]
const NIGHT := {"payMult": 1.25, "accPenalty": 0.08, "attention": 0.75, "accident": 1.8, "police": 1.25, "drink": 0.15, "absent": 0.1, "moodHit": 3, "hazard": 1.3}
const DAY := {"payMult": 1, "accPenalty": 0, "attention": 1, "accident": 1, "police": 1, "drink": 0, "absent": 0, "moodHit": 0, "hazard": 1}


## Dni od 1970-01-01 dla daty (m: 1..12). Algorytm „days from civil”.
static func days_from_civil(y: int, m: int, d: int) -> int:
	var yy := y - (1 if m <= 2 else 0)
	var era := Mathx.fdiv(yy, 400)
	var yoe := yy - era * 400
	var mp := (m + 9) % 12
	var doy := (153 * mp + 2) / 5 + d - 1
	var doe := yoe * 365 + yoe / 4 - yoe / 100 + doy
	return era * 146097 + doe - 719468


## Odwrotnie: dni od 1970-01-01 -> {y, m (1..12), d}.
static func civil_from_days(z: int) -> Dictionary:
	var zz := z + 719468
	var era := Mathx.fdiv(zz, 146097)
	var doe := zz - era * 146097
	var yoe := (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
	var y := yoe + era * 400
	var doy := doe - (365 * yoe + yoe / 4 - yoe / 100)
	var mp := (5 * doy + 2) / 153
	var d := doy - (153 * mp + 2) / 5 + 1
	var m := mp + 3 if mp < 10 else mp - 9
	return {"y": y + (1 if m <= 2 else 0), "m": m, "d": d}


static func start_clock() -> int:
	return START_HOUR * 60


static func date_of(clock: float) -> Dictionary:
	var total := int(floor(clock))
	var days := days_from_civil(2027, 3, 1) + Mathx.fdiv(total, 1440)
	var md := Mathx.pmod(total, 1440)
	var c := civil_from_days(days)
	return {"y": c.y, "m": c.m - 1, "day": c.d, "wd": Mathx.pmod(days + 4, 7), "hour": md / 60, "min": md % 60,
		"monthKey": str(c.y) + "-" + Mathx.pad2(c.m), "dayIndex": int(floor(clock / 1440.0)) + 1}


static func hm(clock: float) -> String:
	var d := date_of(clock)
	return Mathx.pad2(d.hour) + ":" + Mathx.pad2(d.min)


static func label(clock: float) -> String:
	var d := date_of(clock)
	return WD_SHORT[d.wd] + ", " + str(d.day) + " " + MONTHS_GEN[d.m] + " " + str(d.y) + ", " + Mathx.pad2(d.hour) + ":" + Mathx.pad2(d.min)


static func day_label(clock: float) -> String:
	var d := date_of(clock)
	return WEEKDAYS[d.wd] + ", " + str(d.day) + " " + MONTHS_GEN[d.m] + " " + str(d.y)


static func month_name(key: String) -> String:
	var p := key.split("-")
	return MONTHS_NOM[int(p[1]) - 1] + " " + str(int(p[0]))


static func season(clock: float) -> String:
	var m: int = date_of(clock).m
	if m == 11 or m <= 1:
		return "zima"
	if m <= 4:
		return "wiosna"
	if m <= 7:
		return "lato"
	return "jesień"


static func is_night_hour(h: int) -> bool:
	return h >= 22 or h < 6


static func is_night(clock: float) -> bool:
	return is_night_hour(date_of(clock).hour)


## Najbliższa chwila o godzinie „HH:MM” nie wcześniejsza niż clock.
static func next_at(clock: float, time_str: String) -> float:
	var p := time_str.split(":")
	var target := int(p[0]) * 60 + int(p[1])
	var c: float = floor(clock / 1440.0) * 1440.0 + target
	if c < clock:
		c += 1440.0
	return c


static func job_start(clock: float, time_str: String, wait_days: float = 0.0) -> float:
	return next_at(clock, time_str) + wait_days * 1440.0


## Minuty pracy dla jednostek naprawy (noc trwa o 10% dłużej).
static func minutes(units: float, night: bool) -> int:
	return Mathx.round_js(maxf(1.0, units) * TIME_SCALE * (1.1 if night else 1.0))


static func fmt_min(mins: float) -> String:
	var m := Mathx.round_js(mins)
	if m < 60:
		return str(m) + " min"
	var h := Mathx.fdiv(m, 60)
	var r := Mathx.pmod(m, 60)
	return (str(h) + " h " + Mathx.pad2(r) + " min") if r != 0 else (str(h) + " h")


static func fmt_units(units: float, night: bool) -> String:
	return fmt_min(minutes(units, night))


static func mods(night: bool) -> Dictionary:
	return (NIGHT if night else DAY).duplicate()


static func days_between(a: float, b: float) -> int:
	return int(floor(b / 1440.0)) - int(floor(a / 1440.0))
