# 고래영어 Sentence Bank 말하기 카드 (태블릿용)

> 이 폴더는 보관용 사본입니다. 작업 원본은 `C:/Users/WooJin/Desktop/sentece bank card/app/` 이고,
> 빌드 결과(`site/`)는 이 저장소의 `cards/` 로 배포됩니다. 웨일리 보카의 "문장 만들기"는 `voca/index.html` 안에 있습니다.

Practice book 뒤의 Sentence Bank 카드를 인쇄·코팅하지 않고 태블릿에서 바로 여는 앱입니다.
카드 사진이 나오고, 선생님 목소리가 질문하고, 학생이 대답할 시간을 준 뒤 카드가 뒤집히며 정답을 읽어 줍니다.

## 모드

| 모드 | 흐름 | 쓰는 곳 |
| --- | --- | --- |
| 질문 · 대답 | 사진 → 선생님 질문(음성) → "Your turn!" 카운트다운 → 카드 뒤집힘 + 정답 음성 | 수업 |
| 듣고 따라 말하기 | 정답을 두 번 들려주고 그때마다 따라 말할 시간 | 숙제 · 저학년 |
| 카드 넘기기 | 코팅 카드처럼 직접 넘기고 눌러서 뒤집기, 🔊 버튼 | 선생님이 진행 |
| 영상 촬영 | 제목 화면(학생 이름) → 질문·대답 → 칭찬 엔딩, 화면 버튼 숨김, 학생 얼굴 동그라미(선택) | 가정용 리포트 · 홍보 영상 |

옵션: 생각 시간 3/5/8초 · 목소리 보통/천천히 · 차례대로/섞기 · 학생 얼굴(카메라) · 학생 이름.

단원 묶음은 교재와 같습니다. 레벨마다 6권 × 4단원이고, 단원마다 240=10장, 520=12장, 860=14장, 1240=16장, 1680=18장입니다
(해답지의 날짜별 문장과 대조해 확인했습니다).

## 폴더

```
site/            올리는 것 전부 (index.html, cards.js, logo.png, img/, audio/)
tools/extract.mjs  카드 PDF → work/img/<레벨>/<번호>.webp + work/text_<레벨>.json
tools/build.mjs    work/ → site/ (데이터 · 그림 복사 · 음원)
tools/serve.mjs    site/ 를 http://localhost:5190 으로 띄움
work/            중간 결과
```

## 다시 만들기

```bash
cd tools
npm install
node extract.mjs "../../고래영어SentenceCard/고래영어SentenceCard_240.pdf" 240 ../work
# 520 · 860 · 1240 · 1680 도 같은 방식
node build.mjs
```

앞면 한글은 `node extract_front.mjs <pdf> <레벨> ../work` 로 뽑습니다(빌드 전에 레벨마다 한 번).

## 웨일리 보카 '문장 만들기'가 쓰는 데이터

`cards.js` 의 카드마다 `ko`(카드 앞면 한글)와 `p`(문장 성분 덩어리)가 들어 있습니다.
웨일리 보카(`공개용/voca/`)가 이 파일과 `img/`·`audio/` 를 그대로 불러 씁니다.

- `tools/analyze.mjs` — compromise 품사 + 학교 문법 규칙으로 W 의문사 · S 주어 · V 동사 · O 목적어 · C 보어 · M 수식어 · J 접속사 · X 기타 로 나눔
- `tools/parse_fixes.json` — 규칙이 틀리는 문장을 손으로 바로잡은 목록(현재 45문장). 키는 정답 문장 그대로
- `tools/fixes.json` — 카드 뒷면 인쇄 오류 교정

성분을 고치면 `node build.mjs` 뒤 `site/cards.js` 를 `공개용/cards/` 로 복사해 올립니다.

음원은 고래 보카에서 받아 둔 조각(`daily test/음원/_조각`)을 먼저 쓰고, 없는 문장만 새로 받습니다.
한글 질문(예: "그것은 무엇이니?")은 한국어 음성으로 읽습니다.
