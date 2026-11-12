"""변환된 슬라이드 그림과 엑셀(문장·단어)을 모아, 잠긴(암호화된) 앱 자료로 만든다.

자료는 공개 주소에 올라가도 비밀번호 없이는 열리지 않는다.
  학생 비밀번호  → 슬라이드·문장·단어
  선생님 비밀번호 → 위 전부 + 정답지(Grammar Map 정답)

사용법: python3 -I build.py <dl폴더> <work폴더> <출력폴더> <학생비번> <선생님비번>
"""
import glob, hashlib, json, os, re, subprocess, sys, base64
import openpyxl
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from PIL import Image

DL, WORK, OUT, PW_STUDENT, PW_TEACHER = sys.argv[1:6]
ITER = 250000

BOOKS = [
    ('SN1', 'Supernova 1'), ('SN2', 'Supernova 2'), ('SN3', 'Supernova 3'),
    ('SN4', 'Supernova 4'), ('SNP1', 'Supernova PLUS 1'), ('SNP2', 'Supernova PLUS 2'),
]

os.makedirs(f'{OUT}/c', exist_ok=True)
# 키는 한 번 만들면 계속 쓴다 (다시 빌드해도 이미 올린 그림을 바꿀 필요가 없게)
keyfile = f'{WORK}/keys.json'
if os.path.exists(keyfile):
    keys = json.load(open(keyfile))
else:
    keys = {'student': os.urandom(32).hex(), 'teacher': os.urandom(32).hex(), 'salt': os.urandom(16).hex()}
    json.dump(keys, open(keyfile, 'w'))
K_ST, K_TE = bytes.fromhex(keys['student']), bytes.fromhex(keys['teacher'])

def name_for(label, key):
    return hashlib.sha256(key + label.encode()).hexdigest()[:20]

def seal(data, key):
    nonce = os.urandom(12)
    return nonce + AESGCM(key).encrypt(nonce, data, None)

written = set()
def put(label, data, key):
    n = name_for(label, key)
    p = f'{OUT}/c/{n}'
    written.add(n)
    if not os.path.exists(p):
        open(p, 'wb').write(seal(data, key))
    return n

def wrap(pw, inner):
    """비밀번호로 실제 열쇠를 감싼다. 비밀번호를 바꿔도 그림을 다시 잠글 필요가 없다."""
    salt = os.urandom(16)
    kek = PBKDF2HMAC(hashes.SHA256(), 32, salt, ITER).derive(pw.encode())
    return {'salt': base64.b64encode(salt).decode(), 'iter': ITER,
            'box': base64.b64encode(seal(inner, kek)).decode()}

def cell(v):
    if v is None: return ''
    return re.sub(r'\s+', ' ', str(v)).strip()

def clean_en(s):
    return re.sub(r'\s*/\s*', ' ', s).replace('  ', ' ').strip()

def read_sheet(wb, name):
    """시트를 {문장번호: (지문번호, 행)} 으로 읽는다."""
    out = {}
    if name not in wb.sheetnames: return out
    for r in list(wb[name].iter_rows(values_only=True))[1:]:
        if not r or r[0] is None or r[1] is None: continue
        try: no, ps = int(str(r[0]).strip()), int(str(r[1]).strip())
        except ValueError: continue
        out[no] = (ps, [cell(c) for c in r])
    return out

def col(row, i):
    return row[i] if row and len(row) > i else ''

# 책마다 엑셀 칸 구성이 달라서, 어느 시트·몇 번째 칸에 무엇이 있는지 적어 둔다.
#   en 영어 문장 / ko 의역 / dje 직독직해(영어, / 로 끊음) / djk 직독직해(우리말)
#   gn 문법 설명 / ch 어법선택 문제 / ord 문장배열 조각 / bl 빈칸 문제 / ba 빈칸 정답 / voc 단어
SHEETS = {
    'SN1': {'en': ('1~62(의역)', 2), 'ko': ('1~62(의역)', 3), 'dje': ('1~62(직독직해)', 2), 'djk': ('1~62(직독직해)', 3),
            'ch': ('1~62(어법선택)', 2), 'ord': ('1~62(문장배열&영작)', 2), 'bl': ('1~62(빈칸채우기)', 2), 'ba': ('1~62(빈칸채우기)', 4)},
    'SN2': {'en': ('의역', 2), 'ko': ('의역', 3), 'dje': ('직독직해', 2), 'djk': ('직독직해', 3),
            'ch': ('어법선택', 2), 'ord': ('문장배열', 2), 'bl': ('빈칸채우기', 2), 'ba': ('빈칸채우기', 3)},
    'SN3': {'en': ('파트3', 2), 'ko': ('파트3', 4), 'dje': ('파트3', 2), 'djk': ('파트3', 3), 'gn': ('1~62(의역)', 3),
            'ch': ('1~62(의역)', 5), 'ord': ('파트3', 5), 'bl': ('파트4', 2), 'ba': ('파트4', 3), 'voc': ('1~62(의역)', 6)},
    'SN4': {'en': ('종합', 2), 'ko': ('종합', 5), 'djk': ('종합', 4), 'gn': ('종합', 3), 'ch': ('종합', 6),
            'ord': ('문장배열_문제', 2), 'bl': ('빈칸채우기', 3), 'ba': ('빈칸채우기', 4), 'voc': ('종합', 7)},
}

def norm(s):
    return re.sub(r'[^a-z0-9\']+', ' ', s.lower()).strip()

def choice_answers(q, en):
    """'[ were used / used ]' 같은 괄호마다 정답 보기를 찾는다. 원래 문장에 들어 있는 쪽이 정답."""
    groups = list(re.finditer(r'[\[(]\s*([^\[\]()]+?/[^\[\]()]+?)\s*[\])]', q))
    if not groups: return None
    ne = ' ' + norm(en) + ' '
    ans = []
    for g in groups:
        opts = [o.strip() for o in g.group(1).split('/') if o.strip()]
        before = norm(q[:g.start()]).split()[-2:]
        after = norm(re.sub(r'[\[(][^\])]*[\])]', ' ', q[g.end():])).split()[:2]
        hit = [k for k, o in enumerate(opts) if ' ' + norm(' '.join(before + [o] + after)) + ' ' in ne]
        if len(hit) != 1:
            hit = [k for k, o in enumerate(opts) if ' ' + norm(' '.join([o] + after)) + ' ' in ne]
        if len(hit) != 1:
            hit = [k for k, o in enumerate(opts) if ' ' + norm(o) + ' ' in ne]
        ans.append(hit[0] if len(hit) == 1 else -1)
    return ans

def sentences_sn(book):
    wb = openpyxl.load_workbook(f'{DL}/{book}/haeseok.xlsx', read_only=True, data_only=True)
    spec = SHEETS[book]
    sheets = {name: read_sheet(wb, name) for name, _ in spec.values()}
    base = sheets[spec['en'][0]]
    out = []
    for no in sorted(base):
        ps = base[no][0]
        if ps <= 0 and out: ps = out[-1]['p']  # 엑셀에 지문 번호가 0으로 잘못 적힌 줄
        get = lambda k: col(sheets[spec[k][0]].get(no, (0, None))[1], spec[k][1]) if k in spec else ''
        en = clean_en(re.sub(r'[()]', '', get('en'))) if book == 'SN3' else clean_en(get('en'))
        x = {}
        dje, djk = get('dje'), get('djk')
        if djk: x['dj'] = [dje if '/' in dje else '', djk]
        if get('gn'): x['gn'] = get('gn')
        ch = get('ch')
        m = re.search(r'[\[(]?\s*답\s*[:：]', ch or '')
        if m:  # 바꿔 쓰기 같은 서술형 문제: 문제와 답을 따로 둔다
            x['cq'] = ch[:m.start()].strip(); x['cqa'] = re.sub(r'[\])]\s*$', '', ch[m.end():]).strip()
            ch = ''
        if ch and re.search(r'[\[(][^\])]*/[^\])]*[\])]', ch):
            x['ch'] = ch; x['ca'] = choice_answers(ch, en)
        od = get('ord')
        if od and od.count('/') >= 2 and norm(od) != norm(en): x['ord'] = [c.strip() for c in od.split('/') if c.strip()]
        bl, ba = get('bl'), get('ba')
        if bl and ba and '_' in bl: x['bl'] = bl; x['ba'] = ba
        if get('voc'):
            v = []
            for line in re.split(r'\n|\s{2,}|,\s*(?=[A-Za-z][A-Za-z ]*:)', wb[spec['voc'][0]] and get('voc')):
                if ':' in line:
                    w, m = line.split(':', 1)
                    if w.strip(): v.append([w.strip(), m.strip()])
            if v: x['voc'] = v
        out.append({'no': no, 'p': ps, 'en': en, 'ko': get('ko'), 'x': x})
    return out

def sentences_snp(book):
    out, no = [], 0
    for f in sorted(glob.glob(f'{DL}/{book}/sentences/*.xlsx')):
        ps = int(re.findall(r'\d+', os.path.basename(f))[-1])
        ws = openpyxl.load_workbook(f, read_only=True, data_only=True).worksheets[0]
        for r in ws.iter_rows(values_only=True):
            if not r or not cell(r[0]): continue
            no += 1
            en = cell(r[0])
            out.append({'no': no, 'p': ps, 'en': en, 'ko': cell(r[1]) if len(r) > 1 else '', 'x': {'ord': auto_chunks(en, no)}})
    return out

def auto_chunks(en, seed):
    """PLUS 책은 문장배열 자료가 없어서 문장을 4~7조각으로 나눠 섞는다 (쉼표·접속사 앞에서 우선 끊음)."""
    words = en.split()
    if len(words) < 5: return []
    n = max(3, min(7, len(words) // 3))
    cuts = set()
    for i, w in enumerate(words[:-1]):
        if w.endswith(',') or words[i + 1].lower() in ('and', 'but', 'that', 'which', 'who', 'when', 'because', 'to', 'in', 'of', 'for', 'with'):
            cuts.add(i + 1)
    size = len(words) / n
    for k in range(1, n):
        target = round(k * size)
        near = [c for c in cuts if abs(c - target) <= 1]
        cuts.add(near[0] if near else target)
    cuts = sorted(c for c in cuts if 0 < c < len(words))
    pieces, last = [], 0
    for c in cuts:
        if c - last >= 2: pieces.append(' '.join(words[last:c])); last = c
    pieces.append(' '.join(words[last:]))
    import random
    rnd = random.Random(seed)
    shuffled = pieces[:]
    for _ in range(5):
        rnd.shuffle(shuffled)
        if shuffled != pieces: break
    return shuffled

def words_sn(book):
    wb = openpyxl.load_workbook(f'{DL}/{book}/words.xlsx', read_only=True, data_only=True)
    sets = []
    for i, s in enumerate(wb.sheetnames):
        ws = [[cell(r[0]), cell(r[1]) if len(r) > 1 else ''] for r in wb[s].iter_rows(values_only=True) if r and cell(r[0])]
        if ws: sets.append({'name': f'단어 {i + 1}', 'words': ws})
    return sets

def words_by_passage(sets, sents):
    """단어장은 지문 순서대로 적혀 있다. 단어마다 앞으로 나아가며 그 단어가 나오는 지문을 찾는다."""
    texts = {}
    for x in sents: texts[x['p']] = texts.get(x['p'], '') + ' ' + norm(x['en'])
    order = sorted(texts)
    def keys(w):
        w = re.sub(r'\(.*?\)|~|[A-Z]\.?\s*$', ' ', w)
        ks = [t for t in norm(w).split() if len(t) > 2 and t not in ('the', 'and', 'one', 'sth', 'someone', 'something', 'with', 'from', 'for')]
        return ks or norm(w).split()[:1]
    def found(ks, t):
        return all(re.search(r'\b' + re.escape(k[:max(4, len(k) - 2)]), t) for k in ks)
    per, pos, miss = {}, 0, 0
    for st in sets:
        for w, m in st['words']:
            ks = keys(w)
            hit = None
            for j in range(pos, min(pos + 6, len(order))):
                if found(ks, texts[order[j]]): hit = j; break
            if hit is None:
                hit = next((j for j in range(len(order)) if found(ks, texts[order[j]])), None)
                if hit is None: miss += 1; hit = pos
            else:
                pos = hit
            per.setdefault(order[hit], []).append([w, m])
    return per, miss

def words_snp(book):
    per = {}
    for f in sorted(glob.glob(f'{DL}/{book}/words/*.xlsx')):
        ps = int(re.findall(r'\d+', os.path.basename(f))[-1])
        ws = openpyxl.load_workbook(f, read_only=True, data_only=True).worksheets[0]
        per[ps] = [[cell(r[0]), cell(r[1]) if len(r) > 1 else ''] for r in ws.iter_rows(values_only=True) if r and cell(r[0])]
    return per

def page_files(prefix):
    """pdftoppm은 10장 이상이면 번호 앞에 0을 붙인다(-01). 번호 순서대로 찾는다."""
    fs = glob.glob(glob.escape(prefix) + '-*.webp')
    return sorted(fs, key=lambda x: int(re.findall(r'-(\d+)\.webp$', x)[0]))

def slide_pages(did, m):
    pages = []
    fulls, bases = page_files(f'{WORK}/img/{did}.full'), page_files(f'{WORK}/img/{did}.base')
    for i, full in enumerate(fulls, 1):
        fb = open(full, 'rb').read()
        pg = {'a': put(f'{did}/{i}/full', fb, K_ST)}
        if len(bases) == len(fulls):
            bb = open(bases[i - 1], 'rb').read()
            if bb != fb:  # 숨길 정답이 있는 장만 '문제' 그림을 따로 둔다
                pg['q'] = put(f'{did}/{i}/base', bb, K_ST)
        pages.append(pg)
    return pages

def pdf_pages(pdf, label, key):
    tmp = f'{WORK}/pdfimg/{label}'
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    if not glob.glob(tmp + '-*.webp'):
        subprocess.run(['pdftoppm', '-png', '-scale-to-x', '1400', '-scale-to-y', '-1', pdf, tmp], check=True)
        for png in glob.glob(tmp + '-*.png'):
            Image.open(png).convert('RGB').save(png[:-4] + '.webp', 'WEBP', quality=75, method=6)
            os.remove(png)
    files = sorted(glob.glob(tmp + '-*.webp'), key=lambda x: int(re.findall(r'-(\d+)\.webp$', x)[0]))
    return [{'a': put(f'{label}/{i}', open(f, 'rb').read(), key)} for i, f in enumerate(files, 1)]

def reading_answers(book):
    """리딩 정답지(Reading AK)를 지문별로 나눈다.
    SN1~4: 한 쪽이 좌우 반쪽으로 나뉘고 반쪽마다 지문 하나. 회색 CORE 표지·빈 반쪽·책 표지는 건너뛴다.
    PLUS: 쪽 위에 적힌 지문 번호(001 …)를 읽어 나눈다."""
    pdf = f'{DL}/{book}/ak/reading.pdf'
    if not os.path.exists(pdf): return {}
    tmp = f'{WORK}/rak/{book}'
    os.makedirs(tmp, exist_ok=True)
    per = {}
    if book.startswith('SNP'):
        if not glob.glob(tmp + '/p-*.webp'):
            subprocess.run(['pdftoppm', '-png', '-scale-to-x', '1400', '-scale-to-y', '-1', pdf, tmp + '/p'], check=True, stderr=subprocess.DEVNULL)
            for png in glob.glob(tmp + '/p-*.png'):
                Image.open(png).convert('RGB').save(png[:-4] + '.webp', 'WEBP', quality=75, method=6); os.remove(png)
        cur = None
        for i, f in enumerate(page_files(tmp + '/p'), 1):
            t = subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), '-layout', pdf, '-'], capture_output=True, text=True).stdout
            if len(t) < 2500: continue  # CORE 표지·단원 소개 쪽 (글자가 거의 없음)
            m = re.search(r'(?m)^\s*(0\d\d)\b', '\n'.join(t.splitlines()[:20]))
            if m: cur = int(m.group(1))
            if cur: per.setdefault(cur, []).append({'a': put(f'{book}-rak/{i}', open(f, 'rb').read(), K_ST)})
        return per
    if not glob.glob(tmp + '/h-*.webp'):
        subprocess.run(['pdftoppm', '-png', '-scale-to-x', '2600', '-scale-to-y', '-1', pdf, tmp + '/p'], check=True, stderr=subprocess.DEVNULL)
        pages = sorted(glob.glob(tmp + '/p-*.png'), key=lambda x: int(re.findall(r'-(\d+)\.png', x)[0]))
        n = 0
        for k, f in enumerate(pages):
            im = Image.open(f).convert('RGB'); w, h = im.size
            g = im.convert('L')
            vals = []
            for x0, x1 in ((0, w // 2), (w // 2, w)):
                reg = g.crop((x0 + 30, int(h * .1), x1 - 30, int(h * .6))).resize((200, 200))
                px = list(reg.getdata()); vals.append(sum(1 for v in px if v < 200) / len(px))
            if k == 0 and min(vals) < 0.015: continue  # 책 표지
            for (x0, x1), v in zip(((0, w // 2), (w // 2, w)), vals):
                if v > 0.6 or v < 0.015: continue      # CORE 표지 / 빈 반쪽
                n += 1
                im.crop((x0, 0, x1, h)).save(f'{tmp}/h-{n}.webp', 'WEBP', quality=75, method=6)
            os.remove(f)
    for i, f in enumerate(page_files(tmp + '/h'), 1):
        per[i] = [{'a': put(f'{book}-rak/{i}', open(f, 'rb').read(), K_ST)}]
    return per

def sentence_of_slide(did, i):
    """슬라이드 글자에서 '001_01' 같은 문장 번호를 읽는다 (구문 PPT 한 장 = 한 문장)."""
    pdf = f'{WORK}/pdf/{did}.full.pdf'
    t = subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), '-layout', pdf, '-'], capture_output=True, text=True).stdout
    m = re.search(r'\b(\d{3})\s*_\s*(\d{2})\b', t)
    return int(m.group(1)) if m else None

manifest = json.load(open(f'{WORK}/manifest.json'))
catalog = {'books': []}
teacher = {'books': {}}
for book, title in BOOKS:
    sents = sentences_snp(book) if book.startswith('SNP') else sentences_sn(book)
    s2p = {s['no']: s['p'] for s in sents}
    passages = {}
    def P(n):
        return passages.setdefault(n, {'n': n, 'rn': [], 'sx': [], 'sent': [], 'words': [], 'ans': []})
    for s in sents:
        P(s['p'])['sent'].append([s['no'], s['en'], s['ko'], s.get('x') or {}])
    for did, m in sorted(manifest.items()):
        if m['book'] != book: continue
        pages = slide_pages(did, m)
        if not pages: print('NO PAGES', did, flush=True); continue
        if m['kind'] == 'reading_note':
            P(m['passage'])['rn'] += pages
            continue
        if book.startswith('SNP'):
            # PLUS 책: 파일 이름 'SPL_1_06' = 지문 4~6 묶음. 장 수를 지문별 문장 수 비율로 나눈다.
            end = int(re.findall(r'SPL_\d_(\d+)', m['src'])[0])
            ends = sorted(int(re.findall(r'SPL_\d_(\d+)', v['src'])[0]) for v in manifest.values()
                          if v['book'] == book and v['kind'] == 'syntax_ppt')
            start = max([e for e in ends if e < end], default=0) + 1
            group = [n for n in range(start, end + 1)]
            weight = [max(1, sum(1 for x in sents if x['p'] == n)) for n in group]
            tot, acc, bounds = sum(weight), 0, []
            for w in weight:
                acc += w; bounds.append(acc / tot)
            for i, pg in enumerate(pages):
                pos = (i + 0.5) / len(pages)
                ps = group[next(k for k, b in enumerate(bounds) if pos <= b + 1e-9)]
                P(ps)['sx'].append(pg)
            continue
        # 구문 PPT: 슬라이드마다 어느 문장(→ 지문)인지 찾아 넣는다
        last = s2p.get(m['from'])
        for i, pg in enumerate(pages, 1):
            no = sentence_of_slide(did, i)
            ps = s2p.get(no) if no else None
            if ps is None:
                # 슬라이드에 번호가 안 적힌 책: 장 수를 문장 범위에 고르게 나눠 맞춘다
                span = m['to'] - m['from'] + 1
                guess = m['from'] + (i - 1) * span // max(len(pages), 1)
                ps = s2p.get(guess) or last or s2p.get(m['from'], 1)
            last = ps
            pg['s'] = no
            P(ps)['sx'].append(pg)
    wsets = []
    if book.startswith('SNP'):
        for ps, w in words_snp(book).items():
            P(ps)['words'] = w
    else:
        wsets = words_sn(book)
        per, miss = words_by_passage(wsets, sents)
        for ps, w in per.items(): P(ps)['words'] = w
        print(book, 'words per passage', sum(len(v) for v in per.values()), 'unmatched', miss, flush=True)
    rak = reading_answers(book)
    for ps, pgs in rak.items(): P(ps)['ans'] = pgs
    print(book, 'reading answers for', len(rak), 'passages', flush=True)
    # 문장별 단어(SN3·SN4 엑셀의 voca 칸)도 지문 단어에 더한다
    for s_ in sents:
        for w, m in (s_.get('x') or {}).get('voc', []):
            ws_ = P(s_['p'])['words']
            if not any(norm(w) == norm(a) for a, _ in ws_): ws_.append([w, m])
    extras = []
    gm = glob.glob(f'{DL}/{book}/grammarmap/Grammar Map_*.pdf')
    if gm: extras.append({'id': 'gm', 'name': 'Grammar Map', 'pages': pdf_pages(gm[0], f'{book}-gm', K_ST)})
    gak = f'{DL}/{book}/ak/grammar.pdf'
    if os.path.exists(gak): extras.insert(0, {'id': 'gak', 'name': 'Grammar 해설 (정답·해설)', 'pages': pdf_pages(gak, f'{book}-gak', K_ST)})
    gf = f'{DL}/{book}/grammar_fill.pdf'
    if os.path.exists(gf): extras.append({'id': 'gf', 'name': '구문분석·빈칸채우기', 'pages': pdf_pages(gf, f'{book}-gf', K_ST)})
    ak = glob.glob(f'{DL}/{book}/grammarmap/Grammar Map AK_*.pdf')
    if ak: teacher['books'][book] = [{'id': 'gmak', 'name': 'Grammar Map 정답', 'pages': pdf_pages(ak[0], f'{book}-gmak', K_TE)}]
    plist = [passages[k] for k in sorted(passages)]
    catalog['books'].append({'id': book, 'title': title, 'passages': plist, 'wordsets': wsets, 'extras': extras})
    print(book, 'passages', len(plist), 'rn', sum(len(p['rn']) for p in plist), 'sx', sum(len(p['sx']) for p in plist),
          'sent', len(sents), 'nosx', [p['n'] for p in plist if not p['sx']][:10], flush=True)

cat_name = put('catalog-' + hashlib.sha256(json.dumps(catalog, sort_keys=True).encode()).hexdigest()[:12],
               json.dumps(catalog, ensure_ascii=False, separators=(',', ':')).encode(), K_ST)
te_name = put('teacher-' + hashlib.sha256(json.dumps(teacher, sort_keys=True).encode()).hexdigest()[:12],
              json.dumps(teacher, ensure_ascii=False, separators=(',', ':')).encode(), K_TE)
lock = {
    'student': wrap(PW_STUDENT, json.dumps({'k': K_ST.hex(), 'cat': cat_name}).encode()),
    'teacher': wrap(PW_TEACHER, json.dumps({'k': K_ST.hex(), 'cat': cat_name, 'tk': K_TE.hex(), 'tcat': te_name}).encode()),
}
json.dump(lock, open(f'{OUT}/lock.json', 'w'))
# 이번 빌드에 쓰이지 않는 옛 파일은 지운다
for f in os.listdir(f'{OUT}/c'):
    if f not in written: os.remove(f'{OUT}/c/{f}')
print('files', len(written))
