"""슈퍼노바 PPT를 슬라이드 그림으로 바꾼다.

슬라이드마다 그림 두 장을 만든다.
  full : 모든 내용이 보이는 모습 (선생님이 끝까지 클릭한 상태)
  base : 클릭해야 나타나는 내용(정답·해설)을 숨긴 모습
아이들은 base로 먼저 생각해 보고, 화면을 눌러 full(정답)을 본다.

사용법: python3 -I convert.py <dl폴더> <work폴더>
"""
import glob, os, re, shutil, subprocess, sys, zipfile, json
from PIL import Image

DL, WORK = sys.argv[1], sys.argv[2]
WIDTH = 1280

def decks():
    for book in ['SN1', 'SN2', 'SN3', 'SN4', 'SNP1', 'SNP2']:
        for kind in ['reading_note', 'syntax_ppt']:
            for f in sorted(glob.glob(f'{DL}/{book}/{kind}/*.pp*')):
                yield book, kind, f

def deck_id(book, kind, path):
    name = os.path.splitext(os.path.basename(path))[0]
    nums = re.findall(r'\d+', name)
    if kind == 'reading_note':
        return f'{book}-rn-{int(nums[-1]):03d}', {'passage': int(nums[-1])}
    # 문장 번호 범위: '001-003', '001~003', 'SPL_1_03 (001-019)'
    a, b = int(nums[-2]), int(nums[-1])
    return f'{book}-sx-{a:03d}-{b:03d}', {'from': a, 'to': b}

SHAPE_TAGS = ('p:sp', 'p:grpSp', 'p:pic', 'p:cxnSp', 'p:graphicFrame')

def strip_entrance(xml):
    """등장(클릭) 애니메이션이 걸린 도형을 지운다. 문단 단위 애니메이션은 글이 사라지지 않게 그대로 둔다."""
    ids = set()
    for m in re.finditer(r'<p:par>(?:(?!<p:par>).)*?presetClass="entr"(?:(?!<p:par>).)*?</p:par>', xml, re.S):
        pass
    # 등장 효과(cTn presetClass="entr") 안에 있는 대상 도형 번호를 모은다
    for m in re.finditer(r'<p:cTn [^>]*presetClass="entr"[^>]*>(.*?)</p:cTn>\s*</p:par>', xml, re.S):
        for t in re.finditer(r'<p:spTgt spid="(\d+)"\s*(/?)>', m.group(1)):
            body = m.group(1)[t.end():t.end() + 40]
            if t.group(2) == '' and body.lstrip().startswith('<p:txEl'):
                continue
            ids.add(t.group(1))
    if not ids:
        return xml, 0
    removed = 0
    for sid in ids:
        # 해당 id를 가진 도형 요소 전체를 지운다 (중첩 포함, 가장 안쪽부터)
        for tag in SHAPE_TAGS:
            pat = re.compile(r'<%s>(?:(?!<%s>).)*?<p:cNvPr id="%s"[ >/].*?</%s>' % (tag, tag, sid, tag), re.S)
            new, n = pat.subn('', xml, count=1)
            if n:
                xml, removed = new, removed + 1
                break
    xml = re.sub(r'<p:timing>.*?</p:timing>', '', xml, flags=re.S)
    return xml, removed

def make_base(src, dst):
    zin = zipfile.ZipFile(src)
    zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
    total = 0
    for item in zin.infolist():
        data = zin.read(item.filename)
        if re.match(r'ppt/slides/slide\d+\.xml$', item.filename):
            xml, n = strip_entrance(data.decode('utf-8'))
            total += n
            data = xml.encode('utf-8')
        zout.writestr(item, data)
    zout.close()
    return total

def soffice(files, outdir):
    for i in range(0, len(files), 40):
        subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', outdir] + files[i:i + 40],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1800)

def main():
    stage = f'{WORK}/stage'; pdf = f'{WORK}/pdf'; img = f'{WORK}/img'
    for d in (stage, pdf, img):
        os.makedirs(d, exist_ok=True)
    manifest = {}
    todo = []
    for book, kind, path in decks():
        did, meta = deck_id(book, kind, path)
        manifest[did] = dict(book=book, kind=kind, src=os.path.basename(path), **meta)
        if os.path.exists(f'{pdf}/{did}.full.pdf'):
            continue
        ext = os.path.splitext(path)[1]
        if ext == '.pps':  # 옛 형식은 먼저 새 형식으로 바꾼다
            subprocess.run(['soffice', '--headless', '--convert-to', 'pptx', '--outdir', stage, path],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600)
            conv = os.path.join(stage, os.path.splitext(os.path.basename(path))[0] + '.pptx')
            shutil.move(conv, f'{stage}/{did}.full.pptx')
        else:
            shutil.copy(path, f'{stage}/{did}.full.pptx')
        manifest[did]['hidden'] = make_base(f'{stage}/{did}.full.pptx', f'{stage}/{did}.base.pptx')
        todo += [f'{stage}/{did}.full.pptx', f'{stage}/{did}.base.pptx']
    print('convert', len(todo), flush=True)
    soffice(todo, pdf)
    for did, m in manifest.items():
        pages = []
        for v in ('full', 'base'):
            p = f'{pdf}/{did}.{v}.pdf'
            if not os.path.exists(p):
                print('MISSING', did, v, flush=True); continue
            outp = f'{img}/{did}.{v}'
            if not glob.glob(outp + '-*.webp'):
                subprocess.run(['pdftoppm', '-png', '-scale-to-x', str(WIDTH), '-scale-to-y', '-1', p, outp], check=True)
                for png in glob.glob(outp + '-*.png'):
                    Image.open(png).convert('RGB').save(png[:-4] + '.webp', 'WEBP', quality=72, method=6)
                    os.remove(png)
            pages.append(len(glob.glob(outp + '-*.webp')))
        m['pages'] = pages[0] if pages else 0
    json.dump(manifest, open(f'{WORK}/manifest.json', 'w'), ensure_ascii=False, indent=1)
    print('done', len(manifest), flush=True)

main()
