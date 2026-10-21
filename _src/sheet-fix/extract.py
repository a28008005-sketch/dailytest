import pymupdf as fitz, json, hashlib, sys, os
S=sys.argv[1]; lv=sys.argv[2]; out=S+f'/w{lv}'
rows=[]; seen={}
for v in range(1,7):
    d=fitz.open(f'{S}/orig{lv}/{lv}_vol{v}_pic.pdf')
    for pi,p in enumerate(d):
        lines=[]; title=''
        for b in p.get_text('dict')['blocks']:
            if b['type']: continue
            for l in b['lines']:
                s=''.join(sp['text'] for sp in l['spans']).strip(); x0,y0,x1,y1=l['bbox']
                if 'Unit' in s and y0<60: title=s
                lines.append((x0,y0,x1,y1,s,l['spans'][0]['font']))
        ims=p.get_image_info(xrefs=True)
        nums=[L for L in lines if L[0]<50 and L[4].isdigit() and L[1]>190 and 'ExtraBold' in L[5]]
        for n in nums:
            yc=(n[1]+n[3])/2
            en=' '.join(L[4] for L in lines if 100<L[0]<360 and abs((L[1]+L[3])/2-yc)<12)
            ko=' '.join(L[4] for L in lines if L[0]>=360 and abs((L[1]+L[3])/2-yc)<12)
            im=[i for i in ims if abs((i['bbox'][1]+i['bbox'][3])/2-yc)<15]
            r=dict(vol=v,page=pi,title=title,no=int(n[4]),en=en,ko=ko,yc=yc)
            if im:
                i=im[0]; r['bbox']=list(i['bbox']); r['xref']=i['xref']
                key=(v,i['xref'])
                if key not in seen:
                    pix=fitz.Pixmap(d,i['xref']); 
                    if pix.n>4: pix=fitz.Pixmap(fitz.csRGB,pix)
                    h=hashlib.md5(pix.samples).hexdigest()[:12]; seen[key]=h
                    fn=f'{out}/img/{h}.png'
                    if not os.path.exists(fn): pix.save(fn)
                r['img']=seen[key]; r['nimg']=len(im)
            rows.append(r)
json.dump(rows,open(out+'/rows.json','w'),ensure_ascii=False,indent=0)
print(len(rows),'rows', sum(1 for r in rows if 'img' not in r),'no image', len(set(r.get('img') for r in rows)),'unique imgs')
