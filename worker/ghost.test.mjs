// 고스트 배틀·반 대항전 워커 확인. 실행: node worker/ghost.test.mjs
import assert from 'node:assert/strict';
import worker from './hello-world.js';
const store = new Map();
store.set('s1', { kind: 'student', id: 's1', data: { name: '김하윤', 담당반: 'Jinny반' }, deleted: false });
store.set('s2', { kind: 'student', id: 's2', data: { name: '이서아' }, deleted: false });
globalThis.fetch = async (url, init = {}) => {
  const ok = d => ({ ok: true, json: async () => d, text: async () => '' });
  const u = new URL(url);
  if (init.method === 'POST' && u.pathname.endsWith('/records')) { for (const r of JSON.parse(init.body)) store.set(r.id, r); return ok([]); }
  if (u.pathname.endsWith('/records')) {
    let rows = [...store.values()];
    for (const [k, v] of u.searchParams) {
      if (k === 'kind') rows = rows.filter(r => r.kind === v.slice(3));
      if (k === 'id') rows = rows.filter(r => r.id === v.slice(3));
      if (k === 'deleted') rows = rows.filter(r => !r.deleted);
      if (k.startsWith('data->>')) { const f = k.slice(7); if (v.startsWith('eq.')) rows = rows.filter(r => String(r.data[f]) === v.slice(3)); if (v.startsWith('in.(')) { const set = v.slice(4, -1).split(','); rows = rows.filter(r => set.includes(String(r.data[f]))); } }
    }
    return ok(rows.map(r => ({ id: r.id, data: r.data })));
  }
  throw new Error('unexpected ' + url);
};
const env = { SUPABASE_SERVICE_KEY: 'k', SUPABASE_URL: 'https://x.supabase.co' };
const call = async (path, body) => (await worker.fetch(new Request('https://w' + path, { method: 'POST', body: JSON.stringify(body) }), env)).json();
// 코드 만들기 (W 코드)
const codes = {};
for (const sid of ['s1', 's2']) { const r = await call('/api/voca/login', {}); }
// cloudCode는 내부 함수라 같은 계산을 다시 한다
const cc = id => { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let h = 2166136261; for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; let c = 'W'; for (let i = 0; i < 7; i++) { c += chars[h % 32]; h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; } return c; };
const A = cc('s1'), B = cc('s2');
let r = await call('/api/ghost/save', { code: A, level: 'lv1240', dayId: 'lv1240-V1U1D1', score: 900, acc: 80, ms: 60000, tl: [[3000, 1], [7000, 0]] });
assert.equal(r.success, true); assert.equal(r.cls, 'jinny');
r = await call('/api/ghost/list', { code: B, cls: 'binny', level: 'lv1240', dayId: 'lv1240-V1U1D1' });
assert.equal(r.ghosts.length, 1); assert.equal(r.ghosts[0].name, '김O윤'); assert.equal(r.ghosts[0].cls, 'jinny'); assert.equal(r.me.cls, 'binny');
r = await call('/api/ghost/save', { code: B, cls: 'binny', level: 'lv1240', dayId: 'lv1240-V1U1D1', score: 500, win: false, vs: r.ghosts[0].gid, tl: [[1, 1]] });
assert.equal(r.success, true);
assert.equal(store.get('gh-' + A + '-lv1240-V1U1D1').data.defends, 1);
r = await call('/api/clan/add', { code: A, level: 'lv1240', pts: 999 });
assert.equal(r.teams.jinny.pts, 60);
r = await call('/api/clan/add', { code: B, cls: 'binny', level: 'lv1240', pts: 25 });
assert.equal(r.teams.binny.pts, 25); assert.equal(r.me.pts, 25);
for (let i = 0; i < 6; i++) await call('/api/clan/add', { code: A, pts: 60 });
r = await call('/api/clan/board', { code: A });
assert.equal(r.teams.jinny.pts, 300, 'daily cap'); assert.equal(r.me.cls, 'jinny');
r = await call('/api/clan/add', { code: B, pts: 10 }); // 반을 안 보내도 기록된 반은 없음 → 점수 없음(이서아 명부엔 반 없음)
assert.equal(r.teams.binny.pts, 25);
console.log('고스트·반 대항전: 모두 통과');

// 꾸미기 자랑 · 계단 같이 오르기
r = await call('/api/look/save', { code: A, level: 'phonics', wear: { skin: 'skin_gold', head: 'crown', bad: 'x', face: '<script>' } });
assert.equal(r.success, true);
assert.deepEqual(store.get('lk-' + A).data.wear, { skin: 'skin_gold', head: 'crown' });
r = await call('/api/look/like', { code: B, cls: 'binny', id: 'lk-' + A }); assert.equal(r.hearts, 1);
r = await call('/api/look/like', { code: B, cls: 'binny', id: 'lk-' + A }); assert.equal(r.hearts, 1, '하트는 한 번만');
r = await call('/api/look/list', { code: B, level: 'phonics' }); assert.equal(r.looks.length, 1); assert.equal(r.looks[0].liked, true);
r = await call('/api/stairs/save', { code: A, level: 'lv520', floors: 37, tl: [900, 1800], wear: { head: 'cap' } }); assert.equal(r.best, 37);
r = await call('/api/stairs/save', { code: A, level: 'lv520', floors: 12, tl: [1] }); assert.equal(r.best, 37, '최고 기록 유지');
r = await call('/api/stairs/list', { code: B, level: 'lv520' }); assert.equal(r.friends.length, 1); assert.equal(r.friends[0].floors, 37); assert.deepEqual(r.friends[0].wear, { head: 'cap' });
console.log('꾸미기·계단: 모두 통과');

// 선생님 화면 · 학부모 리포트 · 칭찬 · 챌린지 · 배틀 스위치
{
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  store.set('voc1', { kind: 'vocab', id: 'voc1', data: { studentId: 's1', date: today, durationSec: 840, correct: 18, total: 20, status: 'done' }, deleted: false });
  await call('/api/game/score', { code: A, game: 'stairs', level: 'lv520', score: 30, amount: 30, sec: 360, wrong: ['apple', 'banana', 'apple'] });
  const env2 = Object.assign({}, env, { DASHBOARD_PASSWORD: '고래' });
  const tcall = async (path, body, pw) => (await worker.fetch(new Request('https://w' + path, { method: 'POST', headers: pw ? { 'X-Dashboard-Password': encodeURIComponent(pw) } : {}, body: JSON.stringify(body) }), env2)).json();
  let t = await tcall('/api/teacher/overview', { range: 'week' }, '틀림'); assert.equal(t.success, false);
  t = await tcall('/api/teacher/overview', { range: 'week' }, '고래');
  const ha = t.students.find(x => x.name === '김하윤');
  assert.equal(ha.learnMin, 14); assert.equal(ha.gameMin, 6); assert.equal(ha.learnPct, 70); assert.equal(ha.acc, 90); assert.equal(ha.cls, 'jinny');
  assert.equal(ha.wrong[0].w, 'apple'); assert.equal(ha.wrong[0].n, 2);
  t = await tcall('/api/teacher/battle', { open: false }, '고래'); assert.equal(t.battle.open, false);
  t = await call('/api/battle/status', {}); assert.equal(t.open, false);
  t = await tcall('/api/teacher/praise', { sid: A, text: '오늘 문장 최고!' }, '고래'); assert.equal(t.success, true);
  t = await call('/api/praise/send', { code: A, text: '사랑해 우리 딸', fromName: '엄마' }); assert.equal(t.success, true);
  t = await call('/api/challenge/set', { code: A, goal: 5, reward: '주말 아이스크림' }); assert.equal(t.success, true);
  t = await call('/api/family/report', { code: A });
  assert.equal(t.success, true); assert.equal(t.week.learnMin, 14); assert.equal(t.praise.length, 2); assert.equal(t.challenge.goal, 5); assert.equal(t.challenge.doneDays, 1);
  assert.equal(t.daily.length, 7);
  t = await call('/api/praise/inbox', { code: A, markRead: true }); assert.equal(t.praise.length, 2); assert.equal(t.challenge.reward, '주말 아이스크림'); assert.equal(t.battleOpen, false);
  t = await call('/api/praise/inbox', { code: A }); assert.equal(t.praise.every(p => p.read), true);
  console.log('선생님·학부모·칭찬·챌린지·배틀 스위치: 모두 통과');
}
