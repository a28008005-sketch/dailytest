# 사용: python3 extract_ws.py <작업폴더> <기존PDF폴더>
# 기존 워크시트 PDF에서 Day별 항목(번호, 구역, 영어, 한글, 그림 xref)을 뽑는다
import pymupdf as fitz, json, re, sys
P=sys.argv[2]  # 기존 워크시트 PDF 폴더
LV=['phonics','240','520','860','1240','1680']
out={}
for lv in LV:
  for kind in ['pic','plain']:
    for v in range(1,7):
      f=f'{P}/{lv}_vol{v}{"_pic" if kind=="pic" else ""}.pdf'
      d=fitz.open(f); cur=None; sec=None
      for pi,p in enumerate(d):
        lines=[]
        for b in p.get_text('dict')['blocks']:
          if b['type']: continue
          for l in b['lines']:
            for sp in l['spans']:
              s=sp['text'].strip()
              if s: lines.append((sp['bbox'],s,sp['font'],sp['size']))
        for bb,s,fo,sz in lines:
          m=re.match(r'V(\d) · Unit (\d+) · Day (\d+)',s)
          if m and bb[1]<60:
            key=f"{'phonics' if lv=='phonics' else 'lv'+lv}-V{m[1]}U{m[2]}D{m[3]}"
            cur=out.setdefault(kind,{}).setdefault(key,{'pages':[],'items':[]})
        cur['pages'].append(pi+1)
        top=170 if any(re.match(r'V\d · Unit',t) for _,t,_,_ in lines) else 20
        xs=[(dr['rect'].x1-2.95,dr['rect'].y1-3.7) for dr in p.get_drawings() if dr.get('fill') and abs(dr['fill'][0]-0.878)<0.01 and abs(dr['fill'][1]-0.192)<0.01 and dr['rect'].x0<100 and dr['rect'].width<14]
        ims=p.get_image_info(xrefs=True)
        marks=[(bb[1],s) for bb,s,fo,sz in lines if s in('문장','단어') and bb[0]<35]
        nums=[(bb,s) for bb,s,fo,sz in lines if bb[0]<50 and s.isdigit() and bb[1]>top and 'ExtraBold' in fo]
        for bb,s in nums:
          yc=(bb[1]+bb[3])/2
          sec_=[m for m in marks if m[0]<yc]
          if sec_: sec=sec_[-1][1]
          rowlines=[(b2,t) for b2,t,fo,sz in lines if sz>10.2 and b2[1]>top]
          # 같은 행: 번호 중심에서 위아래 30pt 안, 다음 번호 전
          ys=sorted(((n[0][1]+n[0][3])/2) for n in nums)
          i=ys.index(yc); lo=(ys[i-1]+yc)/2 if i else yc-40; hi=(ys[i+1]+yc)/2 if i+1<len(ys) else yc+40
          en=' '.join(t for b2,t in rowlines if 46<b2[0]<360 and lo<(b2[1]+b2[3])/2<hi)
          ko=' '.join(t for b2,t in rowlines if b2[0]>=360 and lo<(b2[1]+b2[3])/2<hi)
          im=[x for x in ims if lo<(x['bbox'][1]+x['bbox'][3])/2<hi and x['bbox'][0]<100]
          cur['items'].append({'no':int(s),'sec':sec,'en':en,'ko':ko,'vol':v,'page':pi,'img':im[0]['xref'] if im else None,'bbox':list(im[0]['bbox']) if im else None,'yc':yc,'x':any(lo<y<hi for _,y in xs)})
json.dump(out,open(sys.argv[1]+'/ws.json','w'),ensure_ascii=False)
print({k:len(v) for k,v in out.items()})
