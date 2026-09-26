/**
 * 웨일리 보카 로그인 — 부모님 휴대폰 번호 뒤 4자리
 *
 * 학원 워커(hello-world.a28008005.workers.dev)의 POST /api/voca/login 이
 * 학습코드 대신 이 규칙으로 학생을 찾도록 바꿀 때 쓰는 코드입니다.
 * 나중에 만들 출결 앱도 같은 last4() 를 쓰면 번호 규칙이 하나로 맞춰집니다.
 *
 * 앱이 보내는 값:   { code: "1234", phone4: "1234" }
 *                   형제가 이름을 고른 뒤에는 { ..., name: "김하윤", studentId?: "..." }
 *
 * 워커가 돌려줄 값:
 *   한 명이면    { success: true, name, code, levelId, progress }
 *                code 는 그 학생만의 고유 코드(기존 학습코드)입니다. 앱은 이 값으로 진도를 저장합니다.
 *                형제는 4자리가 같으므로 4자리를 그대로 저장 열쇠로 쓰면 진도가 섞입니다.
 *   여러 명이면  { success: false, choices: [{ name, grade, id }] }
 *                앱이 이름 고르기 화면을 띄우고, 고른 이름을 붙여 다시 보냅니다.
 *   없으면       { success: false, error: "…" }  (한국어 문장은 앱이 그대로 보여 줍니다)
 */

/** 전화번호에서 숫자만 남겨 뒤 4자리. 4자리가 안 되면 빈 문자열 */
export function last4(phone) {
  var d = String(phone || '').replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : '';
}

/**
 * @param {Array<{id?:string,name:string,code?:string,parentPhone?:string,grade?:string,active?:boolean}>} roster
 *        학원 명부. 워커가 지금 학습코드를 찾을 때 쓰는 목록을 그대로 넘기면 됩니다.
 *        parentPhone 에 번호가 여러 개면(아버지·어머니) 쉼표나 / 로 이어 적어도 됩니다.
 * @param {{code?:string, phone4?:string, name?:string, studentId?:string}} body 앱이 보낸 값
 * @returns {{student?:object, choices?:Array, error?:string}}
 */
export function findStudentByPhone4(roster, body) {
  var p4 = String((body && (body.phone4 || body.code)) || '').replace(/\D/g, '');
  if (!/^\d{4}$/.test(p4)) return { error: '부모님 휴대폰 번호 뒤 4자리를 눌러 주세요' };

  var list = (roster || []).filter(function (s) {
    if (!s || s.active === false) return false;
    return String(s.parentPhone || '').split(/[,/·;]|\s{2,}/).some(function (ph) { return last4(ph) === p4; });
  });
  if (!list.length) return { error: '이 번호로 등록된 학생이 없어요. 선생님께 알려 주세요' };

  if (body.studentId) list = list.filter(function (s) { return String(s.id) === String(body.studentId); });
  else if (body.name) list = list.filter(function (s) { return s.name === body.name; });
  if (!list.length) return { error: '이름을 다시 골라 주세요' };

  if (list.length > 1) {
    return {
      choices: list.map(function (s) { return { name: s.name, grade: s.grade || '', id: s.id }; })
    };
  }
  return { student: list[0] };
}

/*
 * 워커에 붙이는 예시 — 지금 /api/voca/login 에서 학습코드로 학생을 찾는 부분을 바꿉니다.
 *
 *   const body = await request.json();
 *   const roster = await loadRoster(env);            // 지금 워커가 쓰는 명부 읽기 그대로
 *   const hit = findStudentByPhone4(roster, body);
 *   if (hit.error)   return json({ success: false, error: hit.error });
 *   if (hit.choices) return json({ success: false, choices: hit.choices });
 *   const s = hit.student;
 *   const code = s.code || ('S-' + s.id);            // 진도 저장 열쇠 — 기존 학습코드를 그대로 쓰면 진도가 이어집니다
 *   const saved = await loadProgress(env, code);     // 지금 워커가 진도 읽는 방법 그대로
 *   return json({ success: true, name: s.name, code, levelId: saved?.levelId || s.levelId || '', progress: saved?.progress || null });
 */
