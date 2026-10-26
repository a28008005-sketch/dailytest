// 가짜 노션으로 워커의 보카 로그인을 확인한다.  실행: node worker/hello-world.test.mjs
import assert from 'node:assert/strict';
import worker from './hello-world.js';

const rt = s => ({ type: 'rich_text', rich_text: s ? [{ plain_text: s }] : [] });
const student = (id, name, parent, code = '', status = '등록생', grade = '3학년') => ({
  id, properties: {
    이름: { type: 'title', title: [{ plain_text: name }] },
    학년: { type: 'select', select: { name: grade } },
    상태: { type: 'select', select: { name: status } },
    단어장코드: rt(code),
    '학부모 연락처': { type: 'phone_number', phone_number: parent },
    '학생 연락처': { type: 'phone_number', phone_number: '010-9999-1234' },
  },
});
const roster = [
  student('p1', '김하윤', '010-1234-5678', 'GR2831'),
  student('p2', '김하준', '01012345678', '', '등록생', '1학년'),            // 형제, 코드 없음
  student('p3', '이서아', '010-2222-4321'),                                 // 코드 없음
  student('p4', '박도윤', '010-3333-9090', 'PD2345', '퇴원생'),
];
const progress = { 이서아: { levelId: 'phonics', dayIdx: 4, blob: '{"dayIdx":4}' } };
const writes = [];

globalThis.fetch = async (url, init) => {
  const body = init.body ? JSON.parse(init.body) : {};
  const ok = data => ({ ok: true, json: async () => data, text: async () => '' });
  if (url.includes('/databases/3bc7e934731849f893208973a5ea9650/query')) {
    const f = body.filter;
    if (f && f.property === '단어장코드') {
      return ok({ results: roster.filter(p => (p.properties.단어장코드.rich_text[0] || {}).plain_text === f.rich_text.equals), has_more: false });
    }
    return ok({ results: roster, has_more: false });
  }
  if (url.includes('/databases/b157655521584b14a64158358b440fe7/query')) {
    const p = progress[body.filter.title.equals];
    return ok({ results: p ? [{ id: 'g', properties: { 레벨: rt(p.levelId), 일차: { number: p.dayIdx }, 진도: rt(p.blob) } }] : [], has_more: false });
  }
  if (url.includes('/pages')) {
    writes.push([init.method, url, body]);
    if (init.method === 'PATCH' && body.properties.단어장코드) {
      const page = roster.find(p => url.endsWith(p.id));
      page.properties.단어장코드 = rt(body.properties.단어장코드.rich_text[0].text.content);
    }
    return ok({});
  }
  throw new Error('예상 못한 요청 ' + url);
};

const env = { NOTION_API_KEY: 'x' };
const call = async (path, payload) => {
  const r = await worker.fetch(new Request('https://w.test' + path, { method: 'POST', body: JSON.stringify(payload) }), env);
  return r.json();
};

// 1) 형제: 이름 고르기
let r = await call('/api/voca/login', { code: '5678', phone4: '5678' });
assert.equal(r.success, false);
assert.deepEqual(r.choices.map(c => c.name), ['김하윤', '김하준']);

// 2) 형 이름을 고르면 기존 코드 그대로
r = await call('/api/voca/login', { code: '5678', phone4: '5678', name: '김하윤', studentId: 'p1' });
assert.equal(r.success, true); assert.equal(r.code, 'GR2831');

// 3) 코드 없는 동생은 처음 들어올 때 코드가 생기고 명부에 적힌다
r = await call('/api/voca/login', { code: '5678', phone4: '5678', name: '김하준', studentId: 'p2' });
assert.equal(r.success, true); assert.match(r.code, /^[A-Z]{2}\d{4}$/);
assert.equal(roster[1].properties.단어장코드.rich_text[0].plain_text, r.code);
const siblingCode = r.code;
// 다시 들어와도 같은 코드
r = await call('/api/voca/login', { phone4: '5678', studentId: 'p2' });
assert.equal(r.code, siblingCode);

// 4) 한 명이면 바로 들어가고 진도가 돌아온다
r = await call('/api/voca/login', { code: '4321', phone4: '4321' });
assert.equal(r.success, true); assert.equal(r.name, '이서아');
assert.equal(r.levelId, 'phonics'); assert.equal(r.dayIdx, 4); assert.deepEqual(r.progress, { dayIdx: 4 });

// 5) 학생 본인 번호, 퇴원생, 없는 번호는 안 된다
assert.match((await call('/api/voca/login', { phone4: '1234' })).error, /등록된 학생이 없/);
assert.match((await call('/api/voca/login', { phone4: '9090' })).error, /등록된 학생이 없/);
assert.match((await call('/api/voca/login', { phone4: '0000' })).error, /등록된 학생이 없/);

// 6) 예전 학습코드로도 그대로 들어온다
r = await call('/api/voca/login', { code: 'gr2831' });
assert.equal(r.success, true); assert.equal(r.name, '김하윤'); assert.equal(r.code, 'GR2831');

// 7) 돌려준 코드로 진도 저장이 된다 (저장 창구는 손대지 않았다)
r = await call('/api/voca/save', { code: siblingCode, levelId: 'phonics', dayIdx: 2, progress: { dayIdx: 2 } });
assert.equal(r.success, true);
assert.ok(writes.some(w => w[0] === 'POST' && w[2].properties.학생명.title[0].text.content === '김하준'));

// 8) 대시보드 화면과 그 안의 스크립트가 깨지지 않았다
const html = await (await worker.fetch(new Request('https://w.test/'), env)).text();
assert.match(html, /부모님 휴대폰 뒤 4자리로 보카 앱에 들어갑니다/);
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
new Function(script); // 문법 오류가 있으면 여기서 멈춘다

// 9) 학생 목록에 번호가 보인다
r = await (await worker.fetch(new Request('https://w.test/api/students'), env)).json();
assert.equal(r.data.find(s => s.name === '이서아').phone4, '4321');

console.log('워커 보카 로그인: 모두 통과');

// 10) 성적 보고가 원생관리 클라우드(Supabase)에도 들어간다
const cloudRows = [
  { id: 's-ha', data: { name: '김하윤 ' } },
  { id: 's-a', data: { name: '이서아' } },
  { id: 's-a2', data: { name: '이서아' } },   // 동명이인
];
const cloudCalls = [];
const cloudVocab = {};
let cloudFail = false;
const notionFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (url.startsWith('https://olzyfwiurfgaxctdemxa.supabase.co/rest/v1/records')) {
    cloudCalls.push([init.method || 'GET', url, init.headers, init.body ? JSON.parse(init.body) : null]);
    if (cloudFail) return { ok: false, status: 500, json: async () => ({}), text: async () => 'boom' };
    if (!init.method) {
      const vid = (url.match(/kind=eq\.vocab&id=eq\.([^&]+)/) || [])[1];
      const rows = vid ? (cloudVocab[decodeURIComponent(vid)] ? [{ data: cloudVocab[decodeURIComponent(vid)] }] : []) : cloudRows;
      return { ok: true, json: async () => rows, text: async () => '' };
    }
    JSON.parse(init.body).forEach(row => { cloudVocab[row.id] = row.data; });
    return { ok: true, status: 201, json: async () => ({}), text: async () => '' };
  }
  if (url.includes('/databases/934da1ef')) {
    return { ok: true, json: async () => ({ results: [], has_more: false }), text: async () => '' };
  }
  return notionFetch(url, init);
};
const report = { student: '김하윤', level: 'Phonics 1', day: 3, correct: 18, total: 20, durationSec: 312.4, dayLabel: 'Day 3' };

// 키가 없으면 노션만 넣고 클라우드는 건너뛴다
r = await call('/api/voca/report', report);
assert.equal(r.success, true); assert.equal(r.cloud, 'not-configured'); assert.equal(cloudCalls.length, 0);
assert.equal(r.checked, undefined);

// 새 형식 키: apikey 머리말만, 이름 앞뒤 공백은 무시하고 찾는다
env.SUPABASE_SERVICE_KEY = 'sb_secret_test';
r = await call('/api/voca/report', report);
assert.equal(r.success, true); assert.equal(r.cloud, 'ok');
let [get, put] = cloudCalls.splice(0);
assert.equal(get[2].apikey, 'sb_secret_test'); assert.equal(get[2].Authorization, undefined);
assert.equal(put[0], 'POST'); assert.match(put[2].Prefer, /merge-duplicates/);
const row = put[3][0];
assert.equal(row.kind, 'vocab'); assert.equal(row.deleted, false);
assert.equal(row.id, 'voc-whaley-s-ha-Phonics1-3'); assert.equal(row.data.id, row.id);
assert.equal(row.data.studentId, 's-ha'); assert.equal(row.data.setName, 'Phonics 1 Day 3 · 완료');
assert.equal(row.data.status, 'done');
assert.equal(row.data.correct, 18); assert.equal(row.data.total, 20); assert.equal(row.data.durationSec, 312);
assert.match(row.data.date, /^\d{4}-\d{2}-\d{2}$/); assert.equal(row.data.source, 'whaley-voca');

// 예전 service_role 키(JWT)는 Bearer 머리말도 붙는다. 같은 일차는 같은 id로 덮어쓴다
env.SUPABASE_SERVICE_KEY = 'eyJhbGciOi.test';
r = await call('/api/voca/report', { ...report, durationSec: 'x', dayLabel: '' });
assert.equal(r.cloud, 'ok');
[get, put] = cloudCalls.splice(0);
assert.equal(get[2].Authorization, 'Bearer eyJhbGciOi.test');
assert.equal(put[3][0].id, 'voc-whaley-s-ha-Phonics1-3');
assert.equal(put[3][0].data.durationSec, undefined); assert.equal(put[3][0].data.setName, 'Phonics 1 3일차 · 완료');

// 동명이인이면 엉뚱한 학생에게 넣지 않는다
r = await call('/api/voca/report', { ...report, student: '이서아' });
assert.equal(r.cloud, 'same-name'); assert.equal(cloudCalls.splice(0).length, 1);

// 원생관리에 없는 이름은 건너뛴다 (노션은 그대로 들어간다)
r = await call('/api/voca/report', { ...report, student: '김하준' });
assert.equal(r.success, true); assert.equal(r.cloud, 'no-student'); assert.equal(cloudCalls.splice(0).length, 1);

// 클라우드가 고장 나도 노션 저장은 성공으로 남는다
cloudFail = true;
r = await call('/api/voca/report', report);
assert.equal(r.success, true); assert.match(r.cloud, /^error: 학원 클라우드 응답 500/);
cloudFail = false; cloudCalls.length = 0;

// 잘못된 값은 어디에도 넣지 않는다
r = await call('/api/voca/report', { ...report, correct: 30 });
assert.equal(r.success, false); assert.equal(r.cloud, 'invalid'); assert.equal(cloudCalls.length, 0);

// 11) 공부하는 동안의 진행 보고: 노션에는 안 넣고 원생관리 줄만 '학습 중'으로 바꾼다
const notionWrites = writes.length;
delete cloudVocab['voc-whaley-s-ha-Phonics1-4'];
const live = { ...report, day: 4, dayLabel: 'Day 4', correct: 5, total: 7, status: 'in-progress', step: 'STEP 1 오늘의 진도', wrongLeft: 2 };
r = await call('/api/voca/report', live);
assert.equal(r.success, true); assert.equal(r.cloud, 'ok'); assert.equal(writes.length, notionWrites);
let v = cloudVocab['voc-whaley-s-ha-Phonics1-4'];
assert.equal(v.status, 'in-progress'); assert.equal(v.setName, 'Phonics 1 Day 4 · 학습 중 · STEP 1 오늘의 진도');
assert.equal(v.correct, 5); assert.equal(v.wrongLeft, 2);
// 중간에 나가면 '중간에 멈춤'
r = await call('/api/voca/report', { ...live, status: 'stopped' });
assert.equal(cloudVocab['voc-whaley-s-ha-Phonics1-4'].setName, 'Phonics 1 Day 4 · 중간에 멈춤 · STEP 1 오늘의 진도');
// 끝내면 같은 줄이 '완료'로 바뀌고 노션에도 들어간다 (80%로 끝내서 오답이 남은 경우)
r = await call('/api/voca/report', { ...live, correct: 40, total: 48, status: 'done', clearPct: 85, wrongLeft: 3 });
assert.equal(r.success, true); assert.ok(writes.length > notionWrites);
v = cloudVocab['voc-whaley-s-ha-Phonics1-4'];
assert.equal(v.status, 'done'); assert.equal(v.clearPct, 85); assert.equal(v.setName, 'Phonics 1 Day 4 · 완료 · 오늘 정답률 85% (남은 오답 3개)');
// 늦게 도착한 '학습 중' 보고는 오늘 끝난 기록을 덮지 않는다
r = await call('/api/voca/report', live);
assert.equal(r.cloud, 'already-done'); assert.equal(cloudVocab['voc-whaley-s-ha-Phonics1-4'].status, 'done');
cloudCalls.length = 0;

// 상태 확인 창구가 키 연결 여부를 알려준다
r = await (await worker.fetch(new Request('https://w.test/api/health'), env)).json();
assert.equal(r.hasStaffCloud, true);

console.log('보카 성적 → 원생관리 클라우드: 모두 통과');

// 11) 원생관리 홈페이지에 등록한 학생도 학부모 연락처 뒤 4자리로 들어온다
cloudRows[0].data.parentPhone = '010-1234-5678';                       // 노션에도 있는 학생 (코드 GR2831)
cloudRows.push(
  { id: 'stu-mj', data: { name: '정민준', status: '등록생', grade: '2학년', parentPhone: '010-7777-2468' } },
  { id: 'stu-he', data: { name: '김하은', status: '등록생', grade: '5학년', parentPhone: '010-5555-0001, 01012345678' } },
  { id: 'stu-out', data: { name: '최퇴원', status: '퇴원생', parentPhone: '010-8888-1357' } },
);

// 원생관리에만 있는 학생: 명부를 고치지 않고 늘 같은 코드(W…)로 들어온다
r = await call('/api/voca/login', { phone4: '2468' });
assert.equal(r.success, true); assert.equal(r.name, '정민준'); assert.match(r.code, /^W[A-Z2-9]{7}$/);
const mjCode = r.code;
assert.equal((await call('/api/voca/login', { phone4: '2468' })).code, mjCode);
assert.ok(cloudCalls.every(c => c[0] === 'GET'));
// 그 코드로 진도 저장·다시 들어오기가 된다
const before = writes.length;
r = await call('/api/voca/save', { code: mjCode, levelId: '240', dayIdx: 2, progress: { dayIdx: 2 } });
assert.equal(r.success, true); assert.ok(writes.length > before);
r = await call('/api/voca/login', { code: mjCode });
assert.equal(r.success, true); assert.equal(r.name, '정민준');

// 형제: 원생관리(김하윤·김하은) + 노션에만 있는 김하준이 한 목록에 나온다
r = await call('/api/voca/login', { phone4: '5678' });
assert.deepEqual(r.choices.map(c => c.name).sort(), ['김하윤', '김하은', '김하준'].sort());
// 노션에 코드가 있는 학생은 그 코드를 그대로 써서 예전 진도가 이어진다
r = await call('/api/voca/login', { phone4: '5678', studentId: 's-ha' });
assert.equal(r.success, true); assert.equal(r.code, 'GR2831');
r = await call('/api/voca/login', { phone4: '5678', name: '김하은' });
assert.equal(r.name, '김하은'); assert.match(r.code, /^W/);

// 퇴원생은 못 들어온다
assert.match((await call('/api/voca/login', { phone4: '1357' })).error, /등록된 학생이 없/);

// 원생관리 클라우드가 고장 나도 노션 명부로는 들어온다
cloudFail = true;
r = await call('/api/voca/login', { phone4: '4321' });
assert.equal(r.success, true); assert.equal(r.name, '이서아');
cloudFail = false;

console.log('원생관리 명부로 보카 로그인: 모두 통과');
