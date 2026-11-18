"""웨일리 원정대 데이터: index.html의 lv1240·lv1680 Day 데이터를 expedition/data.js로.
실행: python3 _src/expedition/build_data.py (저장소 루트)"""
import re, json
s = open('index.html', encoding='utf-8').read()
out = []
for k, v in re.findall(r'"(lv(?:1240|1680)-V\d+U\d+D\d+)":(\{"L":.*?\]\]\})', s):
    o = json.loads(v)
    m = re.match(r'lv\d+-V(\d+)U(\d+)D(\d+)', k)
    out.append({'id': k, 'L': o['L'], 'v': int(m[1]), 'u': int(m[2]), 'd': int(m[3]),
                'w': [[a, b] for a, b, t in o['items'] if t == 'word'],
                's': [[a, b] for a, b, t in o['items'] if t == 'sent']})
out.sort(key=lambda x: (x['L'], x['v'], x['u'], x['d']))
open('expedition/data.js', 'w', encoding='utf-8').write('window.EXP_DAYS=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(out), 'days')
