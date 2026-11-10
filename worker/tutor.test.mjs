// 가짜 노션·가짜 AI로 AI 튜터 창구(/api/tutor/turn)를 확인한다.  실행: node worker/tutor.test.mjs
import assert from 'node:assert/strict';
import worker from './hello-world.js';

const sent = [];
let aiReply = { result: 'almost', reply_ko: '거의 맞았어요! a를 빼먹었어요.', hint_en: 'a pen' };
let aiStop = 'end_turn';

globalThis.fetch = async (url, init) => {
  const body = init && init.body ? JSON.parse(init.body) : {};
  const ok = data => ({ ok: true, status: 200, json: async () => data, text: async () => '' });
  if (url.includes('/databases/') && url.endsWith('/query')) {
    const code = body.filter && body.filter.rich_text && body.filter.rich_text.equals;
    const results = code === 'GR2831'
      ? [{ id: 'p1', properties: { 이름: { type: 'title', title: [{ plain_text: '김하윤' }] }, 상태: { type: 'select', select: { name: '등록생' } } } }]
      : [];
    return ok({ results, has_more: false });
  }
  if (url === 'https://api.anthropic.com/v1/messages') {
    sent.push({ headers: init.headers, body });
    return ok({ stop_reason: aiStop, content: [{ type: 'text', text: JSON.stringify(aiReply) }] });
  }
  throw new Error('예상 못한 요청 ' + url);
};

const call = async (env, payload) => {
  const r = await worker.fetch(new Request('https://w.test/api/tutor/turn', { method: 'POST', body: JSON.stringify(payload) }), env);
  return r.json();
};
const env = { NOTION_API_KEY: 'x', ANTHROPIC_API_KEY: 'test-key' };
const card = { level: '240', q: 'What is it?', qLang: 'en', a: "It's a pen.", ko: '그것은 펜이야.' };

// 1) AI 열쇠가 없으면 AI를 부르지 않는다
let r = await call({ NOTION_API_KEY: 'x' }, { code: 'GR2831', said: 'it is pen', card });
assert.equal(r.success, false); assert.match(r.error, /ANTHROPIC_API_KEY/);
assert.equal(sent.length, 0);

// 2) 원생 코드가 틀리면 AI를 부르지 않는다 (사용료 보호)
r = await call(env, { code: 'ZZ9999', said: 'it is pen', card });
assert.equal(r.success, false); assert.match(r.error, /찾을 수 없/);
assert.equal(sent.length, 0);

// 3) 원생이면 AI가 채점하고, 짧은 한국어 답과 힌트가 돌아온다
r = await call(env, { code: 'gr2831', said: 'it is pen', tries: 1, card });
assert.deepEqual(r, { success: true, result: 'almost', reply: '거의 맞았어요! a를 빼먹었어요.', hint: 'a pen' });
assert.equal(sent.length, 1);
const req = sent[0];
assert.equal(req.headers['x-api-key'], 'test-key');
assert.equal(req.body.model, 'claude-haiku-5-5');
assert.equal(req.body.output_config.effort, 'low');
assert.equal(req.body.fallbacks, undefined); // Haiku에는 다른 모델로 넘기는 기능이 없다
assert.equal(req.body.output_config.format.type, 'json_schema');
assert.match(req.body.messages[0].content, /목표 문장: It's a pen\./);
assert.match(req.body.messages[0].content, /아이가 말한 것\(음성 인식\): "it is pen"/);

// 4) 아이가 보낸 긴 글은 잘라서 보낸다
await call(env, { code: 'GR2831', said: 'x'.repeat(5000), card });
assert.ok(sent[1].body.messages[0].content.length < 1200);

// 5) AI가 거절하거나 이상한 답을 주면 실패로 알려 앱이 기기 채점으로 넘어가게 한다
aiStop = 'refusal';
r = await call(env, { code: 'GR2831', said: 'hello', card });
assert.equal(r.success, false);
aiStop = 'end_turn'; aiReply = { result: 'great', reply_ko: '', hint_en: '' };
r = await call(env, { code: 'GR2831', said: 'hello', card });
assert.equal(r.success, false);

// 6) 카드가 없으면 거절
r = await call(env, { code: 'GR2831', said: 'hello', card: {} });
assert.equal(r.success, false);

console.log('AI 튜터: 모두 통과');
