import json,sys,os,pymupdf as fitz
from PIL import Image
S,lv=sys.argv[1],sys.argv[2]; W=f'{S}/w{lv}'; out=f'{W}/chk'; os.makedirs(out,exist_ok=True)
for f in os.listdir(out): os.remove(f'{out}/{f}')
R=json.load(open(W+'/rows.json')); log=json.load(open(W+'/log.json'))
docs={v:fitz.open(f'{S}/out{lv}/{lv}_vol{v}_pic.pdf') for v in range(1,7)}
seen=set(); strips=[]
for kind,v,title,no,en,spec in log:
    if kind=='빈칸그대로': continue
    r=[x for x in R if x['vol']==v and x['title']==title and x['no']==no and x['en']==en][0]
    key=(v,r['page'],no)
    if key in seen: continue
    seen.add(key)
    pix=docs[v][r['page']].get_pixmap(dpi=80,clip=fitz.Rect(30,r['yc']-20,360,r['yc']+20))
    strips.append(Image.frombytes('RGB',(pix.width,pix.height),pix.samples))
C,per=3,48
for i in range(0,len(strips),per):
    ch=strips[i:i+per]; w,h=ch[0].width,ch[0].height; rows=(len(ch)+C-1)//C
    im=Image.new('RGB',(C*(w+6),rows*(h+3)),'#777')
    for k,s in enumerate(ch): im.paste(s,((k%C)*(w+6),(k//C)*(h+3)))
    im.save(f'{out}/c{i//per:02d}.png')
print(len(strips),'rows', (len(strips)+per-1)//per,'sheets')
