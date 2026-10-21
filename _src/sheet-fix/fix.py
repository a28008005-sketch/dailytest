import json,sys,os,glob,math,io
import pymupdf as fitz
from PIL import Image,ImageDraw
S=sys.argv[1]; lv=sys.argv[2]; W=f'{S}/w{lv}'; OUT=sys.argv[3]
R=json.load(open(W+'/rows.json')); order=json.load(open(W+'/order.json'))
os.makedirs(W+'/new',exist_ok=True)
def fe(name):
    f=sorted(glob.glob(f'{S}/fe/assets/{name}/3D/*.png')+glob.glob(f'{S}/fe/assets/{name}/Default/3D/*.png'))[0]
    im=Image.open(f).convert('RGBA'); bg=Image.new('RGBA',(320,240),'white')
    im.thumbnail((200,200),Image.LANCZOS); bg.alpha_composite(im,((320-im.width)//2,(240-im.height)//2)); return bg.convert('RGB')
def clock(h,m):
    im=Image.new('RGB',(960,720),'white'); d=ImageDraw.Draw(im); cx,cy,r=480,360,300
    d.ellipse([cx-r,cy-r,cx+r,cy+r],fill='white',outline='#333',width=22)
    for i in range(60):
        a=math.radians(i*6); L=40 if i%5==0 else 16; w=10 if i%5==0 else 4
        d.line([cx+(r-30)*math.sin(a),cy-(r-30)*math.cos(a),cx+(r-30-L)*math.sin(a),cy-(r-30-L)*math.cos(a)],fill='#333',width=w)
    from PIL import ImageFont
    F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',52)
    for n in range(1,13):
        a=math.radians(n*30); x=cx+(r-115)*math.sin(a); y=cy-(r-115)*math.cos(a)
        d.text((x,y),str(n),fill='#222',font=F,anchor='mm')
    ah=math.radians((h%12)*30+m*0.5); am=math.radians(m*6)
    d.line([cx,cy,cx+150*math.sin(ah),cy-150*math.cos(ah)],fill='#222',width=26)
    d.line([cx,cy,cx+230*math.sin(am),cy-230*math.cos(am)],fill='#222',width=16)
    d.ellipse([cx-22,cy-22,cx+22,cy+22],fill='#d33')
    return im.resize((320,240),Image.LANCZOS)
def src(spec):
    k,v=spec.split(':',1)
    if k=='set': return Image.open(f'{W}/img/{order[int(v)]}.png').convert('RGB')
    if k=='fe': return fe(v)
    if k=='clock': h,m=v.split(':'); return clock(int(h),int(m))
    if k=='num':
        from PIL import ImageFont
        im=Image.new('RGB',(960,720),'white'); d=ImageDraw.Draw(im)
        F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',420 if len(v)<3 else 320)
        cols=[(46,134,222),(240,120,40),(60,170,90)]
        w=sum(d.textlength(c,font=F) for c in v); x=(960-w)/2
        for i,c in enumerate(v):
            d.text((x,360),c,font=F,fill=cols[i%3],anchor='lm',stroke_width=10,stroke_fill=(30,40,60)); x+=d.textlength(c,font=F)
        return im.resize((320,240),Image.LANCZOS)
    if k=='arrow':
        parts=v.split(':'); im=Image.open(f'{W}/img/{order[int(parts[0])]}.png').convert('RGB').resize((960,720),Image.LANCZOS)
        d=ImageDraw.Draw(im)
        if len(parts)>2:
            x0,y0,x1,y1=[int(t)*3 for t in parts[3].split(',')]; d.rectangle([x0,y0,x1,y1],fill='white')
        tx,ty,hx,hy=[int(t)*3 for t in parts[1].split(',')]
        L=math.hypot(hx-tx,hy-ty); ux,uy=(hx-tx)/L,(hy-ty)/L; px,py=-uy,ux
        sw,hw,hl=15,39,54; bx,by=hx-ux*hl,hy-uy*hl
        poly=[(tx+px*sw,ty+py*sw),(bx+px*sw,by+py*sw),(bx+px*hw,by+py*hw),(hx,hy),(bx-px*hw,by-py*hw),(bx-px*sw,by-py*sw),(tx-px*sw,ty-py*sw)]
        d.polygon(poly,fill=(224,49,49))
        return im.resize((320,240),Image.LANCZOS)
grp={}; miss={}; ov={}
for line in open(W+'/map.txt',encoding='utf8'):
    line=line.rstrip('\n')
    if not line.strip() or line.startswith('#'): continue
    if line.startswith('miss:') or line.startswith('en:'):
        body=line.split(':',1)[1]
        for kind in ('set:','fe:','clock:','arrow:','num:'):
            i=body.rfind(' '+kind)
            if i>0: (miss if line.startswith('miss:') else ov)[body[:i]]=body[i+1:]; break
    else:
        a,b=line.split(' ',1); grp[order[int(a)]]=b.split(' #')[0].strip()
if os.path.exists(W+'/miss.txt'):
    for l in open(W+'/miss.txt',encoding='utf8'):
        if '|' in l: en,sp=l.rstrip('\n').rsplit('|',1); miss[en]=sp
idx={h:i for i,h in enumerate(order)}
def auto(en):
    for x in R:
        if x['en']==en and 'img' in x and x['en'] not in ov: return grp.get(x['img'],'set:%d'%idx[x['img']])
cache={}
def jpg(spec):
    if spec not in cache:
        fn=f'{W}/new/{len(cache):03d}.jpg'; src(spec).save(fn,quality=88); cache[spec]=fn
    return cache[spec]
def rounded(spec,wpt,hpt):
    im=Image.open(jpg(spec)).convert('RGBA'); mask=Image.new('L',im.size,0)
    rad=int(im.width*4/40); ImageDraw.Draw(mask).rounded_rectangle([0,0,im.width-1,im.height-1],rad,fill=255); im.putalpha(mask)
    b=io.BytesIO(); im.save(b,'PNG'); return b.getvalue()
log=[]; placed={}
def setjpg(doc,xref,fn):
    data=open(fn,'rb').read(); w,h=Image.open(fn).size
    doc.update_stream(xref,data,compress=False)
    for k,val in (('Filter','/DCTDecode'),('Width',str(w)),('Height',str(h)),('ColorSpace','/DeviceRGB'),('BitsPerComponent','8'),('SMask','null'),('DecodeParms','null'),('Mask','null'),('Decode','null')):
        doc.xref_set_key(xref,k,val)
for v in range(1,7):
    fn=f'{S}/orig{lv}/{lv}_vol{v}_pic.pdf'; d=fitz.open(fn); done=set()
    for r in [r for r in R if r['vol']==v]:
        p=d[r['page']]
        if 'img' in r and r['en'] in ov:
            rc=fitz.Rect(r['bbox']); p.insert_image(rc,stream=rounded(ov[r['en']],0,0))
            log.append(('교체',r['vol'],r['title'],r['no'],r['en'],ov[r['en']]))
        elif 'img' in r and r['img'] in grp:
            if r['xref'] not in done:
                setjpg(d,r['xref'],jpg(grp[r['img']])); done.add(r['xref'])
            log.append(('교체',r['vol'],r['title'],r['no'],r['en'],grp[r['img']]))
        elif 'img' not in r:
            spec=miss.get(r['en']) or ov.get(r['en']) or auto(r['en'])
            if not spec or spec=='set:-': log.append(('빈칸그대로',r['vol'],r['title'],r['no'],r['en'],'')); continue
            refs=[x for x in R if x['vol']==v and x['page']==r['page'] and 'bbox' in x] or [x for x in R if x['vol']==v and 'bbox' in x]
            ref=refs[0]['bbox']
            w=ref[2]-ref[0]; h=ref[3]-ref[1]; yc=r['yc']+0.35
            rc=fitz.Rect(ref[0],yc-h/2,ref[2],yc+h/2); p.insert_image(rc,stream=rounded(spec,w,h)); placed[(v,r['page'],r['no'])]=list(rc)
            log.append(('채움',r['vol'],r['title'],r['no'],r['en'],spec))
    import re as _re
    for r in [r for r in R if r['vol']==v and _re.search(r"n't|n’t|\bnot\b|cannot",r['en'],_re.I) and r['en'].strip().lower()!='not']:
        p=d[r['page']]; bb=r.get('bbox') or placed.get((v,r['page'],r['no']))
        if not bb: continue
        has=any(dr.get('fill') and abs(dr['fill'][0]-0.878)<0.01 and abs(dr['fill'][1]-0.192)<0.01 and dr['rect'].x0<100 and abs((dr['rect'].y0+dr['rect'].y1)/2-r['yc'])<20 for dr in p.get_drawings())
        if has: continue
        cx,cy=bb[2]-2.95,bb[3]-3.7
        p.draw_circle(fitz.Point(cx,cy),6.12,color=(1,1,1),fill=(0.8784,0.1922,0.1922),width=0.9)
        for a,b in [((-2.45,-2.45),(2.45,2.45)),((-2.45,2.45),(2.45,-2.45))]:
            p.draw_line(fitz.Point(cx+a[0],cy+a[1]),fitz.Point(cx+b[0],cy+b[1]),color=(1,1,1),width=1.2,lineCap=1)
        log.append(('X추가',r['vol'],r['title'],r['no'],r['en'],''))
    d.save(f'{OUT}/{lv}_vol{v}_pic.pdf',garbage=4,deflate=True)
json.dump(log,open(W+'/log.json','w'),ensure_ascii=False,indent=0)
allp=fitz.open(); 
for v in range(1,7): allp.insert_pdf(fitz.open(f'{OUT}/{lv}_vol{v}_pic.pdf'))
allp.set_metadata(fitz.open(f'{S}/orig{lv}/{lv}_all_pic.pdf').metadata)
allp.save(f'{OUT}/{lv}_all_pic.pdf',garbage=4,deflate=True)
import collections; print(collections.Counter(x[0] for x in log)); print(len(grp),'groups',len(miss),'miss specs')
