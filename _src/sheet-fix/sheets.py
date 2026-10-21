import json,sys,collections,textwrap
from PIL import Image,ImageDraw,ImageFont
S=sys.argv[1]; lv=sys.argv[2]; W=S+f'/w{lv}'
R=json.load(open(W+'/rows.json'))
g=collections.OrderedDict()
for r in R:
    if 'img' in r: g.setdefault(r['img'],[]).append(r)
keys=list(g); json.dump(keys,open(W+'/order.json','w'))
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
C,RW,CW,CH=6,6,210,215
import os; os.makedirs(W+'/sheets',exist_ok=True)
for s in range(0,len(keys),C*RW):
    im=Image.new('RGB',(C*CW,RW*CH),'white'); d=ImageDraw.Draw(im)
    for k,h in enumerate(keys[s:s+C*RW]):
        x=(k%C)*CW; y=(k//C)*CH
        p=Image.open(f'{W}/img/{h}.png').convert('RGB'); p.thumbnail((200,150)); im.paste(p,(x+5,y+18))
        d.rectangle([x+5,y+18,x+205,y+168],outline='#bbb')
        d.text((x+5,y+2),f'#{s+k}',fill='red',font=F)
        ws=[]; 
        for r in g[h]:
            if r['en'] not in ws: ws.append(r['en'])
        t=' | '.join(ws); lines=textwrap.wrap(t,28)[:3]
        for i,l in enumerate(lines): d.text((x+5,y+170+i*14),l,fill='black',font=F)
    im.save(f'{W}/sheets/s{s//(C*RW):02d}.png')
print(len(keys))
