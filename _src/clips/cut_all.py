"""모든 레벨(파닉스·240·520·860·1240·1680) 데일리 듣기 하루치 음원을 문장·단어 조각으로 자른다.
하루 음원은 '문장들 → 단어들' 순서로 한 번씩 읽고 사이에 쉼이 있다. 쉼으로 나눈 조각 수가
그날 문장+단어 수와 똑같은 날만 자르고, 안 맞는 날은 건너뛴다(앱에서 기기 음성으로 대신).
실행: python3 _src/clips/cut_all.py  (저장소 루트) → clips/<키>.mp3 + clips/map.js (글자 → 키)"""
import json, re, subprocess, hashlib, os
from concurrent.futures import ThreadPoolExecutor
db = json.loads(re.search(r'<script type="application/json" id="db">(.*?)</script>', open('voca/index.html', encoding='utf-8').read(), re.S).group(1))
os.makedirs('clips', exist_ok=True)
sha = lambda t: hashlib.sha1(t.encode()).hexdigest()[:16]
def dur(f): return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout)
def segs(f, T, db_, d):
    out = subprocess.run(['ffmpeg','-hide_banner','-i',f,'-af',f'silencedetect=noise={db_}dB:d={d}','-f','null','-'],capture_output=True,text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    cur = 0.0; res = []
    for a, b in zip(st, en + [T] * (len(st) - len(en))):
        if a - cur > 0.15: res.append((cur, a))
        cur = b
    if T - cur > 0.15: res.append((cur, T))
    return res
def work(day):
    f = f'audio/{day["id"]}.mp3'
    if not os.path.exists(f): return day['id'], None
    texts = [i['en'] for i in day['items'] if i['kind'] == 'sent'] + [i['en'] for i in day['items'] if i['kind'] == 'word']
    texts = list(dict.fromkeys(texts))  # 같은 문장은 음원에서 한 번만 읽는다
    T = dur(f)
    for d_ in (-35, -32, -38, -30, -40):
        for dd in (0.35, 0.3, 0.45, 0.25):
            sg = segs(f, T, d_, dd)
            if len(sg) == len(texts):
                res = {}
                for t, (a, b) in zip(texts, sg):
                    k = sha(t); o = f'clips/{k}.mp3'; res[t] = k
                    if not os.path.exists(o):
                        a0 = max(0, a - .08)
                        subprocess.run(['ffmpeg','-v','quiet','-y','-ss',f'{a0:.3f}','-t',f'{b - a0 + .15:.3f}','-i',f,'-ac','1','-ar','22050','-b:a','40k','-af','afade=t=in:d=0.02,areverse,afade=t=in:d=0.06,areverse',o])
                return day['id'], res
    return day['id'], None
days = [d for L in db['levels'] for d in L['days']]
amap, bad = {}, []
if True:
    for did, res in map(work, days):
        if res is None: bad.append(did)
        else:
            for t, k in res.items(): amap.setdefault(t, k)
open('clips/map.js', 'w', encoding='utf-8').write('window.CLIP_MAP=' + json.dumps(amap, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('days', len(days), 'ok', len(days) - len(bad), 'skip', len(bad), bad[:30], 'clips', len(amap))
