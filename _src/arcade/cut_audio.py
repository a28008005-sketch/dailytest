"""데일리 듣기 하루치 음원(audio/<day>.mp3)을 문장·단어 조각으로 자른다.
하루 음원은 '문장들 → 단어들' 순서로 한 번씩 읽고 사이에 쉼이 있다(파닉스·240 조각으로 확인).
쉼으로 나눈 조각 수가 문장+단어 수와 똑같은 날만 자르고, 안 맞는 날은 건너뛴다(게임에서 기기 음성으로 대신).
실행: python3 _src/arcade/cut_audio.py  (저장소 루트에서) → arcade/audio/<키>.mp3 + arcade/audio.js"""
import json, re, subprocess, hashlib, os, sys
days = json.loads(re.search(r'=(\[.*\]);', open('arcade/data.js', encoding='utf-8').read(), re.S).group(1))
os.makedirs('arcade/audio', exist_ok=True)
sha = lambda t: hashlib.sha1(t.encode()).hexdigest()[:16]
def dur(f): return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout)
def segs(f, db, d):
    out = subprocess.run(['ffmpeg','-hide_banner','-i',f,'-af',f'silencedetect=noise={db}dB:d={d}','-f','null','-'],capture_output=True,text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    T = dur(f); cur = 0.0; res = []
    for a, b in zip(st, en + [T] * (len(st) - len(en))):
        if a - cur > 0.15: res.append((cur, a))
        cur = b
    if T - cur > 0.15: res.append((cur, T))
    return res
amap, ok, bad = {}, 0, []
for d in days:
    f = f'audio/{d["id"]}.mp3'
    if not os.path.exists(f): bad.append(d['id']); continue
    texts = [s[0] for s in d['s']] + [w[0] for w in d['w']]
    got = None
    for db in (-35, -32, -38, -30, -40):
        for dd in (0.35, 0.3, 0.45, 0.25):
            sg = segs(f, db, dd)
            if len(sg) == len(texts): got = sg; break
        if got: break
    if not got: bad.append(d['id']); continue
    ok += 1
    for t, (a, b) in zip(texts, got):
        k = sha(t); amap[t] = k; o = f'arcade/audio/{k}.mp3'
        if not os.path.exists(o):
            a0 = max(0, a - .08)
            subprocess.run(['ffmpeg','-v','quiet','-y','-ss',f'{a0:.3f}','-t',f'{b - a0 + .15:.3f}','-i',f,'-ac','1','-ar','22050','-b:a','48k','-af','afade=t=in:d=0.02,areverse,afade=t=in:d=0.06,areverse',o])
open('arcade/audio.js','w',encoding='utf-8').write('window.ARCADE_AUD=' + json.dumps(amap, ensure_ascii=False, separators=(',',':')) + ';\n')
print('days ok', ok, 'skip', len(bad), bad[:20], 'clips', len(amap))
