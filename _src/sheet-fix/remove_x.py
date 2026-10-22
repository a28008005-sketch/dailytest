# 본사 원본에 이미 그려져 있던 X(빨간 동그라미) 하나를 지운다.
# 사용: python3 remove_x.py <pdf> <쪽(0부터)> <X 중심 y(pt)>
import sys,re,pymupdf as fitz
fn,page,ty=sys.argv[1],int(sys.argv[2]),float(sys.argv[3])
def badges(p): return [dr['rect'] for dr in p.get_drawings() if dr.get('fill') and abs(dr['fill'][0]-0.878)<0.01 and abs(dr['fill'][1]-0.192)<0.01 and dr['rect'].x0<100]
d=fitz.open(fn); p=d[page]; txt=p.get_text()
for x in p.get_contents():
    s=d.xref_stream(x).decode('latin1')
    for m in re.finditer(r'q\n[\d.]+ [\d.]+ [\d.]+ [\d.]+ re\nW\* n\nq\n[\d.]+ 0 0 [\d.]+ [\d.]+ [\d.]+ cm\n\.8784 \.1922 \.1922 RG',s):
        i=m.start(); depth=0
        for t in re.finditer(r'(?<![A-Za-z/])([qQ])(?![A-Za-z])',s[i:]):
            depth+=1 if t.group(1)=='q' else -1
            if depth==0: j=i+t.end(); break
        before=badges(p); d.update_stream(x,(s[:i]+s[j:]).encode('latin1'))
        gone=[b for b in before if b not in badges(d[page])]
        if gone and abs((gone[0].y0+gone[0].y1)/2-ty)<5 and d[page].get_text()==txt:
            d.save(fn+'.tmp',garbage=3,deflate=True); print('removed',gone[0]); sys.exit(0)
        d.update_stream(x,s.encode('latin1'))
sys.exit('not found')
