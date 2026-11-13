"""원본 QR 데이터(test/index.html)를 기준으로 워크시트 데이터를 조립한다.

- 항목·순서·개수: 원본 QR 데이터 그대로 (단어 → 문장)
- 한글 뜻: 기존 워크시트 → 보카앱(voca) → 원본 QR 데이터 순으로 가져온다
- 그림·부정문 X: 기존 워크시트(그림 있음)에 있던 것을 그대로 쓴다
사용: python3 build_data.py <작업폴더> <기존PDF폴더>   (작업폴더에 extract_ws.py가 만든 ws.json이 있어야 함)
"""
import json, re, sys, os, collections, hashlib, io
import pymupdf as fitz
from PIL import Image
W = sys.argv[1]
R = os.path.dirname(os.path.abspath(__file__)) + '/../..'
P = sys.argv[2] if len(sys.argv) > 2 else R + '/print'  # 기존 워크시트 PDF 폴더
t = open(R + '/test/index.html').read()
D = json.loads(re.search(r'<script id="dayData" type="application/json">(.*?)</script>', t, re.S).group(1))['days']
WS = json.load(open(W + '/ws.json'))
s = open(R + '/voca/index.html').read(); dec = json.JSONDecoder(); V = {}
for m in re.finditer(r'\{"id":"((?:phonics|lv\d+)-V\dU\dD\d)","label"', s):
    o, _ = dec.raw_decode(s, m.start()); V[o['id']] = o

def n(x): return re.sub(r'\s+', ' ', x.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')).strip()
def z(x): return re.sub(r'[^a-z0-9]', '', n(x).lower())
def nz(x): return re.sub(r'\s', '', n(x))

LVF = {'phonics': 'phonics', 'lv240': '240', 'lv520': '520', 'lv860': '860', 'lv1240': '1240', 'lv1680': '1680'}
os.makedirs(W + '/img', exist_ok=True)
docs = {}
def doc(lv, v):
    k = (lv, v)
    if k not in docs: docs[k] = fitz.open(f'{P}/{LVF[lv]}_vol{v}_pic.pdf')
    return docs[k]
imgcache = {}
def save_img(lv, v, xref):
    k = (lv, v, xref)
    if k in imgcache: return imgcache[k]
    d = doc(lv, v); pix = fitz.Pixmap(d, xref)
    info = d.xref_get_key(xref, 'SMask')
    if pix.alpha: pix = fitz.Pixmap(pix, 0)
    if pix.n > 3: pix = fitz.Pixmap(fitz.csRGB, pix)
    im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
    if info[0] == 'xref':  # 둥근 모서리 마스크가 있으면 흰 바탕에 합성
        m = fitz.Pixmap(d, int(info[1].split()[0]))
        mk = Image.open(io.BytesIO(m.tobytes('png'))).convert('L').resize(im.size)
        bg = Image.new('RGB', im.size, 'white'); bg.paste(im, (0, 0), mk); im = bg
    im.thumbnail((320, 240), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=88)
    h = hashlib.md5(b.getvalue()).hexdigest()[:12]
    fn = f'{W}/img/{h}.jpg'
    if not os.path.exists(fn): open(fn, 'wb').write(b.getvalue())
    imgcache[k] = h; return h

# 기존 워크시트 항목: 레벨별 영어 → 출현 목록
occ = collections.defaultdict(lambda: collections.defaultdict(list))
alltxt = collections.defaultdict(list)
for k, o in WS['pic'].items():
    lv = k.split('-')[0]
    for it in o['items']:
        occ[lv][n(it['en'])].append(dict(it, day=k))
        alltxt[n(it['en'])].append((lv, dict(it, day=k)))
for k, o in WS['plain'].items():
    lv = k.split('-')[0]
    for it in o['items']:
        if n(it['en']) not in occ[lv]: occ[lv][n(it['en'])].append(dict(it, day=k, img=None))
zmap = collections.defaultdict(dict)
for lv in occ:
    for en in occ[lv]: zmap[lv].setdefault(z(en), en)
vko = collections.defaultdict(dict)
for k, o in V.items():
    lv = k.split('-')[0]
    for it in o['items']:
        if it.get('ko'): vko[lv].setdefault(n(it['en']), n(it['ko']))

# 원본 QR 데이터의 한글은 사진에서 읽어 온 것이라 띄어쓰기가 깨진 곳이 있다. 띄어쓰기만 바로잡는다.
SPACING = {
    '그 녀는 수줍어한다.': '그녀는 수줍어한다.',
    '그들은 졸 리다.': '그들은 졸리다.',
    '나는 내내 그 유 수 풀 에 있 었다.': '나는 내내 그 유수풀에 있었다.',
    'Sam 은 동물 들을 좋아해요.': 'Sam은 동물들을 좋아해요.',
    'Sam 은 동물들을 좋아해요.': 'Sam은 동물들을 좋아해요.',
    '젖 은': '젖은',
    '그 원숭이는 긴 꼬리를 가지 고 있나요?': '그 원숭이는 긴 꼬리를 가지고 있나요?',
    '나는 저지방 우유가 다 떨어 져서 슈퍼마켓에 가요.': '나는 저지방 우유가 다 떨어져서 슈퍼마켓에 가요.',
    '우 리는 캠프파이어를 만들 거예 요.': '우리는 캠프파이어를 만들 거예요.',
}
# 기존 자료의 명백한 오타 (원장님 확인)
TYPO = {'오란색': '노란색'}
POS = ["I don't mind waiting.", "It won't be scary if you close your eyes.", "I can't wait to travel.",
       "If I didn't have a parachute, I would get hurt.", "If you have not eaten meat bone tea, you should try it.",
       "Speaking Chinese is not easy.", "In the future, we'll not have to drive on the road.",
       "You aren't going to believe this.", "Lena wasn't scared anymore.", "My family is not the same."]
def isneg(e):
    e = n(e)
    if e in POS or 'can\'t wait to' in e or e.lower() == 'not' or re.match(r"don.t forget", e, re.I) or re.search(r", and you will not", e, re.I): return False
    m = re.match(r"(.*),\s*\w+n't\s+\w+\s*\?$", e)
    if m: e = m.group(1)
    return bool(re.search(r"n't|\bnot\b|cannot", e, re.I))

out = {}; report = collections.defaultdict(list)
for k, o in D.items():
    lv = o['L']; m = re.match(r'.*-V(\d)U(\d)D(\d)', k); vol, unit, day = map(int, m.groups())
    items = []
    for no, (en0, ko0, kind) in enumerate(o['items'], 1):
        key = n(en0)
        if key not in occ[lv] and z(en0) in zmap[lv]:
            key = zmap[lv][z(en0)]  # 띄어쓰기·문장부호만 다른 경우 (예: 'It is a fish !')
        oc = occ[lv].get(key, [])
        same = [x for x in oc if x['day'] == k]
        en = key if oc else re.sub(r'\s+([!?.,])', r'\1', n(en0))
        # 한글 뜻
        kos = collections.Counter(n(x['ko']) for x in oc if x['ko'])
        ko = ''
        if same and same[0]['ko']: ko = n(same[0]['ko'])
        elif kos:
            pick = [c for c in kos if ko0 and nz(c) == nz(ko0)]
            ko = pick[0] if pick else kos.most_common(1)[0][0]
        elif ko0: ko = SPACING.get(n(ko0), n(ko0)); report['ko_qr'].append((k, en0, ko))
        elif vko[lv].get(n(en0)): ko = vko[lv][n(en0)]; report['ko_voca'].append((k, en0, ko))
        else: report['ko_none'].append((k, en0))
        # 그림 · X표시
        src = [x for x in same if x.get('img') is not None] or [x for x in oc if x.get('img') is not None]
        img = None; x = None
        if src:
            c = collections.Counter((x_['vol'], x_['img']) for x_ in src).most_common(1)[0][0] if not same or same[0].get('img') is None else (same[0]['vol'], same[0]['img'])
            img = save_img(lv, c[0], c[1])
            xs = [x_['x'] for x_ in (same or src)]
            x = sum(xs) * 2 > len(xs)
        else:
            other = [(l2, it) for l2, it in alltxt.get(key, []) if it.get('img') is not None]
            if other:
                l2, it = other[0]; img = save_img(l2, it['vol'], it['img']); report['img_other_level'].append((k, en0, l2))
            else: report['img_none'].append((k, en0))
        if x is None: x = isneg(en)
        if not oc: report['new_item'].append((k, en0))
        ko = TYPO.get(ko, ko)
        items.append({'no': no, 'kind': kind, 'en': en, 'ko': ko, 'img': img, 'x': bool(x and img)})
    out[k] = {'lv': lv, 'vol': vol, 'unit': unit, 'day': day, 'items': items}
json.dump(out, open(W + '/days.json', 'w'), ensure_ascii=False)
json.dump(report, open(W + '/report.json', 'w'), ensure_ascii=False, indent=1)
for r, v in report.items(): print(r, len(v))
print(len(out), 'days', len(os.listdir(W + '/img')), 'images')
