"""pdf/ 결과를 검증하고, 레벨 전체본을 합치고, print/index.html의 쪽 정보를 갱신한다.
사용: python3 finish.py <작업폴더>   → print/ 폴더의 PDF와 index.html을 덮어쓴다
"""
import json, re, sys, os, shutil, datetime
import pymupdf as fitz
W = sys.argv[1]; R = os.path.dirname(os.path.abspath(__file__)) + '/../..'; P = R + '/print'
D = json.load(open(W + '/days.json'))
NAME = {'phonics': 'Phonics', 'lv240': '240', 'lv520': '520', 'lv860': '860', 'lv1240': '1240', 'lv1680': '1680'}
FILE = {v: (k if k == 'phonics' else v) for k, v in NAME.items()}
def n(x): return re.sub(r'\s+', ' ', x).strip()
html = open(P + '/index.html').read()
m = re.search(r'const SITE = (\{.*?\});\n', html); SITE = json.loads(m.group(1))
bad = 0
for lv, nm in NAME.items():
    fn_ = FILE[nm]
    for kind, suf in (('plain', ''), ('pic', '_pic')):
        allp = fitz.open()
        for v in range(1, 7):
            f = f'{W}/pdf/{nm}_vol{v}{suf}.pdf'; d = fitz.open(f)
            days = []; cur = None
            for i, p in enumerate(d):
                t = p.get_text()
                mm = re.search(r'V(\d) · Unit (\d) · Day (\d)', t)
                if mm:
                    cur = {'u': int(mm[2]), 'd': int(mm[3]), 'from': i + 1, 'to': i + 1}; days.append(cur)
                    key = f'{lv}-V{mm[1]}U{mm[2]}D{mm[3]}'
                else: cur['to'] = i + 1
            # 검증: 각 Day의 영어 항목 순서가 원본과 같은지
            for dd in days:
                key = f'{lv}-V{v}U{dd["u"]}D{dd["d"]}'
                txt = n(' '.join(d[i].get_text() for i in range(dd['from'] - 1, dd['to'])))
                pos = -1
                for it in D[key]['items']:
                    q = n(f'{it["en"]}')
                    j = txt.find(q, pos + 1) if q else pos
                    if j < 0 and ' ' in q:  # 줄바꿈된 문장
                        j = txt.replace(' ', '').find(q.replace(' ', ''), 0)
                        j = pos + 1 if j >= 0 else -1
                    if j < 0: bad += 1; print('확인 필요', key, it['no'], it['en']); break
                    pos = j
            assert len(days) == 20, (f, len(days))
            d.set_metadata({'title': f'{nm} Vol.{v} Daily Test 학생용', 'creator': '고래영어', 'producer': '고래영어'})
            out = f'{P}/{fn_}_vol{v}{suf}.pdf'
            d.save(out, garbage=4, deflate=True)
            mb = round(os.path.getsize(out) / 1048576, 1)
            SITE['data'][nm]['vols'][str(v)][kind] = {'file': f'{fn_}_vol{v}{suf}.pdf', 'pages': len(d), 'mb': mb, 'days': days}
            allp.insert_pdf(d)
        allp.set_metadata({'title': f'{nm} Daily Test 학생용', 'creator': '고래영어', 'producer': '고래영어'})
        out = f'{P}/{fn_}_all{suf}.pdf'; allp.save(out, garbage=4, deflate=True)
        SITE['data'][nm]['all'][kind] = {'file': f'{fn_}_all{suf}.pdf', 'pages': len(allp), 'mb': round(os.path.getsize(out) / 1048576, 1)}
        print(nm, kind, len(allp), '쪽')
SITE['stamp'] = datetime.date.today().isoformat()
html = html[:m.start(1)] + json.dumps(SITE, ensure_ascii=False, separators=(',', ':')) + html[m.end(1):]
open(P + '/index.html', 'w').write(html)
print('검증 실패', bad)
