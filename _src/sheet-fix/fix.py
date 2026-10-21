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
grp={}; miss={}
for line in open(W+'/map.txt',encoding='utf8'):
    line=line.split('#',1)[0].rstrip() if not line.startswith('miss:') else line.rstrip()
    if not line.strip(): continue
    if line.startswith('miss:'):
        a,b=line[5:].rsplit(' ',1) if False else (None,None)
        for kind in ('set:','fe:','clock:'):
            i=line.find(' '+kind)
            if i>0: miss[line[5:i]]=line[i+1:]; break
    else:
        a,b=line.split(' ',1); grp[order[int(a)]]=b
cache={}
def jpg(spec):
    if spec not in cache:
        fn=f'{W}/new/{len(cache):03d}.jpg'; src(spec).save(fn,quality=88); cache[spec]=fn
    return cache[spec]
def rounded(spec,wpt,hpt):
    im=Image.open(jpg(spec)).convert('RGBA'); mask=Image.new('L',im.size,0)
    rad=int(im.width*4/40); ImageDraw.Draw(mask).rounded_rectangle([0,0,im.width-1,im.height-1],rad,fill=255); im.putalpha(mask)
    b=io.BytesIO(); im.save(b,'PNG'); return b.getvalue()
log=[]
for v in range(1,7):
    fn=f'/home/user/dailytest/print/{lv}_vol{v}_pic.pdf'; d=fitz.open(fn); done=set()
    for r in [r for r in R if r['vol']==v]:
        p=d[r['page']]
        if 'img' in r and r['img'] in grp:
            if r['xref'] not in done:
                p.replace_image(r['xref'],filename=jpg(grp[r['img']])); done.add(r['xref'])
            log.append(('교체',r['vol'],r['title'],r['no'],r['en'],grp[r['img']]))
        elif 'img' not in r:
            spec=miss.get(r['en'])
            if not spec: log.append(('빈칸그대로',r['vol'],r['title'],r['no'],r['en'],'')); continue
            ref=[x for x in R if x['vol']==v and x['page']==r['page'] and 'bbox' in x][0]['bbox']
            w=ref[2]-ref[0]; h=ref[3]-ref[1]; yc=r['yc']+0.35
            p.insert_image(fitz.Rect(ref[0],yc-h/2,ref[2],yc+h/2),stream=rounded(spec,w,h))
            log.append(('채움',r['vol'],r['title'],r['no'],r['en'],spec))
    d.save(f'{OUT}/{lv}_vol{v}_pic.pdf',garbage=4,deflate=True)
json.dump(log,open(W+'/log.json','w'),ensure_ascii=False,indent=0)
allp=fitz.open(); 
for v in range(1,7): allp.insert_pdf(fitz.open(f'{OUT}/{lv}_vol{v}_pic.pdf'))
allp.set_metadata(fitz.open(f'/home/user/dailytest/print/{lv}_all_pic.pdf').metadata)
allp.save(f'{OUT}/{lv}_all_pic.pdf',garbage=4,deflate=True)
import collections; print(collections.Counter(x[0] for x in log)); print(len(grp),'groups',len(miss),'miss specs')
