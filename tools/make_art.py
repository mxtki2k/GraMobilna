#!/usr/bin/env python3
"""Generuje przykładowe grafiki SVG do gry (własne, bez zewnętrznych źródeł).
Uruchom: python3 tools/make_art.py  (zapisuje do assets/art/)."""
import math
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "art"
OUT.mkdir(parents=True, exist_ok=True)


def write(name, svg):
    (OUT / name).write_text(svg.strip() + "\n", encoding="utf-8")


def waves(width, y, amp, length, phase):
    pts = [f"M {-length} {y}"]
    x = -length
    while x < width + length:
        pts.append(f"Q {x + length / 4} {y - amp} {x + length / 2} {y} T {x + length} {y}")
        x += length
    return " ".join(pts)


# --- tło morza 720x1280 ---
layers = []
for i, y in enumerate(range(140, 1280, 70)):
    amp = 7 + (i % 3) * 3
    length = 120 + (i % 4) * 30
    opacity = 0.05 + 0.04 * ((i % 3))
    layers.append(f'<path d="{waves(720, y, amp, length, i)}" fill="none" stroke="#bfe6ff" stroke-opacity="{opacity:.2f}" stroke-width="3" stroke-linecap="round"/>')
foam = []
for k in range(60):
    x = (k * 163) % 720
    y = (k * 271) % 1280
    r = 2 + (k % 3)
    foam.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffffff" fill-opacity="0.10"/>')
write("sea_bg.svg", f"""
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
  <defs>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b2a43"/><stop offset="1" stop-color="#14527a"/>
    </linearGradient>
    <radialGradient id="vig" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/>
    </radialGradient>
  </defs>
  <rect width="720" height="1280" fill="url(#sea)"/>
  {''.join(layers)}
  {''.join(foam)}
  <rect width="720" height="1280" fill="url(#vig)"/>
</svg>
""")

# --- dziób łodzi (biały, barwiony w grze przez modulate), wskazuje w prawo ---
write("bow.svg", """
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cdd6dc"/>
    </linearGradient>
  </defs>
  <path d="M8 26 C56 18 98 34 124 64 C98 94 56 110 8 102 Z" fill="url(#hull)" stroke="#5f717d" stroke-width="5" stroke-linejoin="round"/>
  <path d="M22 40 C58 36 88 48 104 64 C88 80 58 92 22 88 Z" fill="#ffffff" fill-opacity="0.6" stroke="#5f717d" stroke-opacity="0.55" stroke-width="3"/>
  <circle cx="56" cy="64" r="8" fill="#5f717d" fill-opacity="0.55"/>
  <circle cx="56" cy="64" r="3.5" fill="#ffffff" fill-opacity="0.9"/>
</svg>
""")

# --- koło ratunkowe (życia) ---
write("life_ring.svg", """
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="27" fill="none" stroke="#c1272d" stroke-width="14"/>
  <circle cx="32" cy="32" r="27" fill="none" stroke="#ffffff" stroke-width="14" stroke-dasharray="21.2 21.2" stroke-dashoffset="10.6"/>
  <circle cx="32" cy="32" r="34" fill="none" stroke="#7a1418" stroke-width="2"/>
  <circle cx="32" cy="32" r="20" fill="none" stroke="#7a1418" stroke-width="2"/>
</svg>
""")

# --- przykładowe przeszkody na później ---
write("shark_fin.svg", """
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <ellipse cx="64" cy="108" rx="52" ry="9" fill="#ffffff" fill-opacity="0.22"/>
  <ellipse cx="64" cy="108" rx="34" ry="5" fill="#ffffff" fill-opacity="0.3"/>
  <path d="M26 108 C48 100 52 52 66 14 C80 50 100 92 108 108 Z" fill="#6f8794" stroke="#3b4f5a" stroke-width="5" stroke-linejoin="round"/>
  <path d="M60 30 C58 62 46 94 34 104" fill="none" stroke="#9db4c0" stroke-width="5" stroke-linecap="round" stroke-opacity="0.7"/>
</svg>
""")
write("rock.svg", """
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <ellipse cx="64" cy="106" rx="54" ry="10" fill="#ffffff" fill-opacity="0.2"/>
  <path d="M14 104 C10 76 30 50 48 46 C58 22 92 24 100 50 C118 58 120 90 112 104 Z" fill="#7b8794" stroke="#414b55" stroke-width="5" stroke-linejoin="round"/>
  <path d="M40 58 C50 40 78 38 90 56" fill="none" stroke="#b0bac4" stroke-width="5" stroke-linecap="round" stroke-opacity="0.8"/>
  <path d="M30 96 C46 88 64 92 86 98" fill="none" stroke="#414b55" stroke-width="4" stroke-linecap="round" stroke-opacity="0.45"/>
</svg>
""")
write("crate.svg", """
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <ellipse cx="64" cy="108" rx="48" ry="8" fill="#ffffff" fill-opacity="0.2"/>
  <rect x="22" y="26" width="84" height="76" rx="8" fill="#c98a4b" stroke="#6e4520" stroke-width="5"/>
  <path d="M22 52 H106 M22 78 H106" stroke="#6e4520" stroke-width="4"/>
  <path d="M30 34 L98 94 M98 34 L30 94" stroke="#a6692f" stroke-width="7" stroke-linecap="round" stroke-opacity="0.7"/>
</svg>
""")

# --- ikona aplikacji ---
write("icon.svg", """
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16507a"/><stop offset="1" stop-color="#0b2a43"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#sea)"/>
  <path d="M10 98 Q26 88 42 98 T74 98 T106 98 T138 98" fill="none" stroke="#bfe6ff" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round"/>
  <path d="M10 112 Q26 102 42 112 T74 112 T106 112 T138 112" fill="none" stroke="#bfe6ff" stroke-opacity="0.2" stroke-width="5" stroke-linecap="round"/>
  <g transform="translate(14 22) scale(0.85)">
    <path d="M8 26 C56 18 98 34 124 64 C98 94 56 110 8 102 Z" fill="#f4a259" stroke="#8a4b17" stroke-width="6" stroke-linejoin="round"/>
    <path d="M22 40 C58 36 88 48 104 64 C88 80 58 92 22 88 Z" fill="#fff1e0" fill-opacity="0.75" stroke="#8a4b17" stroke-opacity="0.5" stroke-width="3"/>
    <circle cx="56" cy="64" r="8" fill="#8a4b17" fill-opacity="0.55"/>
  </g>
</svg>
""")
print("zapisano:", ", ".join(sorted(p.name for p in OUT.glob("*.svg"))))
