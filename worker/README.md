# 학원 워커 (hello-world.a28008005.workers.dev)

`hello-world.js` 는 클라우드플레어에 올라가 있는 학원 워커의 전체 코드입니다.
대시보드 화면, 노션 읽기·쓰기, 웨일리 보카 앱의 로그인·진도 저장·성적 기록을 맡습니다.

## 보카 로그인 — 부모님 휴대폰 뒤 4자리

- 아이가 4자리를 누르면 노션 학생 명부의 **학부모 연락처 뒤 4자리**로 학생을 찾습니다.
  칸 이름에 학부모·부모·보호자가 들어간 전화번호(또는 글자) 칸을 읽습니다.
- 형제처럼 여러 명이 찾아지면 이름 목록을 돌려주고, 앱이 이름을 고르게 합니다.
- 로그인되면 그 학생의 **단어장코드**를 돌려줍니다. 앱은 이 코드로 진도를 저장합니다.
  코드가 없는 학생은 처음 들어올 때 자동으로 만들어 명부에 적습니다.
- 예전 단어장코드로 들어오는 것도 그대로 됩니다.

## 보카 성적 → 원생관리 '단어 학습' 화면

- 아이가 하루치를 끝내면 성적이 이 워커로 옵니다. 워커는 그 성적을
  ① 노션(이 대시보드의 과제 탭)과 ② 원생관리 홈페이지의 학원 클라우드(Supabase) 두 곳에 넣습니다.
- 원생관리 쪽은 **학생 이름이 똑같아야** 이어집니다. (앞뒤 빈칸은 무시, 동명이인이면 넣지 않음)
- 같은 학생이 같은 레벨·일차를 다시 풀면 새 줄이 아니라 덮어씁니다.
- 한쪽이 고장 나도 다른 쪽은 그대로 들어갑니다. 결과의 `cloud` 값으로 확인할 수 있습니다:
  `ok`(넣음) · `not-configured`(키 없음) · `no-student`(원생관리에 그 이름 없음) · `same-name`(동명이인) · `error: …`

### 처음 한 번 — 클라우드 키 넣기

1. supabase.com → 원생관리 프로젝트 → Project Settings → API Keys
   → **secret 키**(또는 Legacy 탭의 `service_role` 키)를 복사합니다.
2. dash.cloudflare.com → Workers & Pages → hello-world → Settings → Variables and Secrets
   → Add → 종류 **Secret**, 이름 `SUPABASE_SERVICE_KEY`, 값에 붙여 넣고 Deploy.
3. `https://hello-world.a28008005.workers.dev/api/health` 에서 `"hasStaffCloud":true` 가 보이면 끝입니다.

이 키는 학원 클라우드 전체를 열 수 있는 키입니다. 워커 비밀값에만 넣고, 앱 코드·카톡·문서에는 절대 붙이지 마세요.

## 바꾸는 법

1. dash.cloudflare.com → Workers & Pages → hello-world → Edit code
2. 코드를 모두 지우고 `hello-world.js` 내용을 붙여 넣은 뒤 **Deploy**

확인: `node worker/hello-world.test.mjs` (가짜 노션·가짜 클라우드로 로그인·진도·대시보드·성적 전달을 확인합니다)
