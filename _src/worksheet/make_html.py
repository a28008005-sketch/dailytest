"""days.json → 권별 워크시트 HTML (그림 있음 / 그림 없음)
사용: python3 make_html.py <작업폴더>
"""
import json, sys, os, html, segno, io
W = sys.argv[1]
D = json.load(open(W + '/days.json'))
os.makedirs(W + '/html', exist_ok=True)
LV = {  # 기존 워크시트에서 뽑은 레벨별 색
 'phonics': dict(name='Phonics', hdr='#e03131', panel='#fdf5f5', strong='#f4b9b9', zebra='#fce8e8', line='#f6c1c1', badge='#fceaea', img='#f4b7b7', dark='#8e1b1b', num='#cc9898', hint='#bb7676'),
 'lv240':  dict(name='240', hdr='#f07b0f', panel='#fef6ee', strong='#fad2ad', zebra='#fce8d6', line='#fbd7b7', badge='#fef2e7', img='#fad1ab', dark='#94480a', num='#cfad91', hint='#bf916c'),
 'lv520':  dict(name='520', hdr='#f2b705', panel='#fef9ea', strong='#fbe7aa', zebra='#fcefc9', line='#fbe9b4', badge='#fef8e6', img='#fae6a8', dark='#7a5a00', num='#c3b58c', hint='#af9c66'),
 'lv860':  dict(name='860', hdr='#1da35c', panel='#f1f9f5', strong='#b2e0c8', zebra='#dbf0e5', line='#bbe3ce', badge='#e8f6ef', img='#b0dfc6', dark='#0e6136', num='#93b8a5', hint='#6ea086'),
 'lv1240': dict(name='1240', hdr='#2563c9', panel='#f1f5fc', strong='#b5caed', zebra='#dce6f6', line='#bed0ef', badge='#e9effa', img='#b3c8ec', dark='#163e82', num='#96a8c7', hint='#738bb4'),
 'lv1680': dict(name='1680', hdr='#7b3fbf', panel='#f7f4fb', strong='#d2bee9', zebra='#eae1f5', line='#d7c5ec', badge='#f2ecf9', img='#d1bce9', dark='#4c2079', num='#ae9bc3', hint='#9479af'),
}
X = ('<svg class="x" viewBox="-6.6 -6.6 13.2 13.2"><circle r="6.12" fill="#e03131" stroke="#fff" stroke-width=".9"/>'
     '<path d="M-2.45-2.45L2.45 2.45M-2.45 2.45L2.45-2.45" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></svg>')
def readable(q, url):
    # 판독기가 실제로 읽어 내는지 확인 (특정 무늬는 일부 판독기가 못 읽는다)
    import cv2, numpy as np
    m = np.array([[0 if c else 255 for c in row] for row in q.matrix], np.uint8)
    m = cv2.copyMakeBorder(cv2.resize(m, None, fx=8, fy=8, interpolation=cv2.INTER_NEAREST), 32, 32, 32, 32, cv2.BORDER_CONSTANT, value=255)
    return cv2.QRCodeDetector().detectAndDecode(cv2.cvtColor(m, cv2.COLOR_GRAY2BGR))[0] == url
def qr(key):
    url = f'https://a28008005-sketch.github.io/dailytest/?d={key}'
    q = segno.make(url, error='m', micro=False)
    if not readable(q, url):
        for mask in range(8):
            q2 = segno.make(url, error='m', micro=False, mask=mask)
            if readable(q2, url): q = q2; break
        else: print('QR 확인 필요', key)
    b = io.BytesIO(); q.save(b, kind='svg', border=0, xmldecl=False, svgns=True, nl=False, dark='#16202b', omitsize=True)
    return b.getvalue().decode()
CSS = open(os.path.dirname(os.path.abspath(__file__)) + '/sheet.css').read()
def esc(s): return html.escape(s, quote=False)
for lv, c in LV.items():
    for v in range(1, 7):
        keys = sorted([k for k, o in D.items() if o['lv'] == lv and o['vol'] == v], key=lambda k: (D[k]['unit'], D[k]['day']))
        for kind in ('pic', 'plain'):
            out = []
            for k in keys:
                o = D[k]
                rows = []; sec = None
                for it in o['items']:
                    if it['kind'] != sec:
                        sec = it['kind']; rows.append(f'<div class="sec">{"단어" if sec == "word" else "문장"}</div>')
                    pic = ''
                    if kind == 'pic':
                        im = f'<img src="../img/{it["img"]}.jpg" alt="">' if it['img'] else ''
                        pic = f'<div class="c-img"><span class="ph{"" if it["img"] else " empty"}">{im}{X if it["x"] else ""}</span></div>'
                    rows.append(f'<div class="row{" z" if it["no"] % 2 == 0 else ""}"><div class="c-no">{it["no"]}</div>{pic}'
                                f'<div class="c-en">{esc(it["en"])}</div><div class="c-ko">{esc(it["ko"])}</div></div>')
                boxes = ''.join(f'<span class="box"><i>{i}</i></span>' for i in range(1, 11))
                out.append(f'''<section class="sheet" data-key="{k}">
<div class="hdr"><span class="badge">{c["name"]}</span><span class="ttl">V{v} · Unit {o["unit"]} · Day {o["day"]}</span><span class="org">고래영어학원</span></div>
<div class="panel"><div class="pl">
 <div class="ln"><b>음원듣고 / 읽기10번</b><span class="boxes">{boxes}</span></div>
 <div class="ln l2"><b>녹음 제출</b><span class="rec"></span><b>이름</b><span class="name"></span><span class="hint">읽을 때마다 칸에 표시하세요</span></div>
</div><div class="qr">{qr(k)}<span>QR 찍고 듣기</span></div></div>
<div class="list">{"".join(rows)}</div>
</section>''')
            vars_ = ';'.join(f'--{a}:{b}' for a, b in c.items() if a != 'name')
            title = f'{c["name"]} Vol.{v} Daily Test 학생용'
            doc = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>{title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@500;700;800&family=Lexend:wght@600&display=block">
<style>:root{{{vars_}}}{CSS}</style></head><body class="{kind}">{"".join(out)}
<script src="../fit.js"></script></body></html>'''
            open(f'{W}/html/{c["name"]}_vol{v}{"_pic" if kind == "pic" else ""}.html', 'w').write(doc)
print('ok')
