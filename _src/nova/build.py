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

def sentences_sn(book):
    wb = openpyxl.load_workbook(f'{DL}/{book}/haeseok.xlsx', read_only=True, data_only=True)
    pick = {'SN1': ('1~62(의역)', 2, 3), 'SN2': ('의역', 2, 3), 'SN3': ('파트3', 5, 4), 'SN4': ('종합', 2, 5)}[book]
    ws = wb[pick[0]]
    out = []
    for r in list(ws.iter_rows(values_only=True))[1:]:
        if not r or r[0] is None or r[1] is None: continue
        try: no, ps = int(str(r[0]).strip()), int(str(r[1]).strip())
        except ValueError: continue
        en = cell(r[pick[1]]) if len(r) > pick[1] else ''
        if not en and book == 'SN3': en = clean_en(cell(r[2]))
        ko = cell(r[pick[2]]) if len(r) > pick[2] else ''
        if ps <= 0 and out: ps = out[-1]['p']  # 엑셀에 지문 번호가 0으로 잘못 적힌 줄
        out.append({'no': no, 'p': ps, 'en': clean_en(en), 'ko': ko})
    return out

def sentences_snp(book):
    out, no = [], 0
    for f in sorted(glob.glob(f'{DL}/{book}/sentences/*.xlsx')):
        ps = int(re.findall(r'\d+', os.path.basename(f))[-1])
        ws = openpyxl.load_workbook(f, read_only=True, data_only=True).worksheets[0]
        for r in ws.iter_rows(values_only=True):
            if not r or not cell(r[0]): continue
            no += 1
            out.append({'no': no, 'p': ps, 'en': cell(r[0]), 'ko': cell(r[1]) if len(r) > 1 else ''})
    return out

def words_sn(book):
    wb = openpyxl.load_workbook(f'{DL}/{book}/words.xlsx', read_only=True, data_only=True)
    sets = []
    for i, s in enumerate(wb.sheetnames):
        ws = [[cell(r[0]), cell(r[1]) if len(r) > 1 else ''] for r in wb[s].iter_rows(values_only=True) if r and cell(r[0])]
        if ws: sets.append({'name': f'단어 {i + 1}', 'words': ws})
    return sets

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
        return passages.setdefault(n, {'n': n, 'rn': [], 'sx': [], 'sent': [], 'words': []})
    for s in sents:
        P(s['p'])['sent'].append([s['no'], s['en'], s['ko']])
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
    extras = []
    gm = glob.glob(f'{DL}/{book}/grammarmap/Grammar Map_*.pdf')
    if gm: extras.append({'id': 'gm', 'name': 'Grammar Map', 'pages': pdf_pages(gm[0], f'{book}-gm', K_ST)})
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
