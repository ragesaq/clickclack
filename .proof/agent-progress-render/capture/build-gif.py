#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFont

BEFORE = '/tmp/ccdemo-before-cap'
AFTER  = '/tmp/ccdemo-after-cap'
OUT    = '/tmp/ccdemo-pairs'
os.makedirs(OUT, exist_ok=True)

N = 34
PANEL_W = 660          # scaled panel width
HEADER_H = 46
DIV = 4                # divider width
PAD = 0

src = Image.open(f'{AFTER}/frame_0000.png')
sw, sh = src.size                      # 1340x1000
PANEL_H = round(sh * PANEL_W / sw)      # proportional

try:
    f_bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    f_sub  = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
except Exception:
    f_bold = ImageFont.load_default(); f_sub = ImageFont.load_default()

BG = (244, 241, 233)
BEFORE_C = (120, 113, 108)
AFTER_C  = (176, 138, 11)
DIVC = (210, 205, 196)

def panel(path, title, sub, accent):
    im = Image.open(path).convert('RGB').resize((PANEL_W, PANEL_H), Image.LANCZOS)
    canvas = Image.new('RGB', (PANEL_W, PANEL_H + HEADER_H), BG)
    d = ImageDraw.Draw(canvas)
    # header bar
    d.rectangle([0, 0, PANEL_W, HEADER_H], fill=BG)
    d.line([0, HEADER_H-1, PANEL_W, HEADER_H-1], fill=accent, width=3)
    d.text((14, 6), title, font=f_bold, fill=accent)
    tw = d.textlength(title, font=f_bold)
    d.text((14 + tw + 12, 12), sub, font=f_sub, fill=(110, 104, 98))
    canvas.paste(im, (0, HEADER_H))
    return canvas

for i in range(N):
    b = panel(f'{BEFORE}/frame_{i:04d}.png', 'BEFORE', 'stock web client \u2014 no consumer', BEFORE_C)
    a = panel(f'{AFTER}/frame_{i:04d}.png',  'AFTER',  'this PR \u2014 renders agent.progress', AFTER_C)
    W = PANEL_W*2 + DIV
    H = b.height
    comp = Image.new('RGB', (W, H), DIVC)
    comp.paste(b, (0, 0))
    comp.paste(a, (PANEL_W + DIV, 0))
    comp.save(f'{OUT}/pair_{i:04d}.png')

# Build an ordered sequence with dwell control (repeat indices)
seq = []
seq += [0]*5                      # idle dwell
seq += list(range(6, 20))         # 14 line frames (l1..l7)
seq += [20,21,22]*2               # finalized dwell
seq += [23,24,25,26,27]*3         # answer landed dwell (longer)
seq += [28,29,30,31,32,33]        # clearing
seq += [33]*8                     # final dwell on cleared state

with open(f'{OUT}/seq.txt', 'w') as f:
    for idx in seq:
        f.write(f"file '{OUT}/pair_{idx:04d}.png'\n")
        f.write("duration 0.16\n")
    # ffmpeg concat needs last file repeated w/o duration
    f.write(f"file '{OUT}/pair_{seq[-1]:04d}.png'\n")

print('pairs:', N, 'seq frames:', len(seq), 'panel:', PANEL_W, 'x', PANEL_H)
