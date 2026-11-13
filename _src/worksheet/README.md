# 데일리 워크시트 만들기 (print/)

원본 데일리테스트 QR 데이터(`test/index.html`의 dayData)를 기준으로 워크시트 PDF를 다시 만든다.

- 항목·개수·순서·번호: 원본 QR 그대로 (단어 먼저 → 문장, 번호는 1번부터 이어서)
- 한글 뜻: 기존 워크시트 → 원본 QR(띄어쓰기만 정리) → 보카앱 순
- 그림·부정문 X표시: 기존 워크시트(그림 있음)에 있던 것을 그대로 쓴다
- QR: `https://a28008005-sketch.github.io/dailytest/?d=<Day 키>` (기존과 같은 주소)

```
W=작업폴더; mkdir -p $W/orig
for f in $(git ls-tree --name-only <기존 커밋> print/ | grep '_vol[1-6].*\.pdf$'); do git show <기존 커밋>:$f > $W/orig/$(basename $f); done
python3 extract_ws.py $W $W/orig     # 기존 워크시트에서 한글·그림 위치 읽기 → ws.json
python3 build_data.py $W $W/orig     # 원본 QR 기준으로 조립 → days.json, img/, report.json
cp fit.js $W/ && python3 make_html.py $W   # 권별 HTML
node render.js $W                    # Chromium으로 PDF 출력
python3 finish.py $W                 # 순서 검증, 전체본 합치기, print/index.html 쪽 정보 갱신
```

필요: pymupdf, pillow, segno, opencv-python-headless, playwright
