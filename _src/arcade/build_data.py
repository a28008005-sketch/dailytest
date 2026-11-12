"""웨일리 아케이드 데이터 만들기: 데일리 듣기(index.html)의 lv520·lv860 Day 데이터를 arcade/data.js로 뽑는다.
실행: python3 _src/arcade/build_data.py  (저장소 루트에서)"""
import re, json
s = open('index.html', encoding='utf-8').read()
out = []
for k, v in re.findall(r'"(lv(?:520|860)-V\d+U\d+D\d+)":(\{"L":.*?\]\]\})', s):
    o = json.loads(v)
    m = re.match(r'lv\d+-V(\d+)U(\d+)D(\d+)', k)
    out.append({'id': k, 'L': o['L'], 'v': int(m[1]), 'u': int(m[2]), 'd': int(m[3]),
                'w': [[a, b] for a, b, t in o['items'] if t == 'word'],
                's': [[a, b] for a, b, t in o['items'] if t == 'sent']})
out.sort(key=lambda x: (x['L'], x['v'], x['u'], x['d']))
open('arcade/data.js', 'w', encoding='utf-8').write('window.ARCADE_DAYS=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(out), 'days')
