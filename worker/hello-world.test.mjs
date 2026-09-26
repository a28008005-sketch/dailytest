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
