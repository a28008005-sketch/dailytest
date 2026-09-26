import assert from 'node:assert/strict';
import { last4, findStudentByPhone4 } from './voca-login.js';

const roster = [
  { id: 'a', name: '김하윤', code: 'GR2831', parentPhone: '010-1234-5678', grade: '3학년' },
  { id: 'b', name: '김하준', code: 'GR7710', parentPhone: '01012345678', grade: '1학년' },   // 형제
  { id: 'c', name: '이서아', code: 'LS0042', parentPhone: '010-9999-0001 / 010-2222-4321' }, // 번호 두 개
  { id: 'd', name: '박도윤', code: 'PD1111', parentPhone: '010-3333-9090', active: false }  // 퇴원
];

assert.equal(last4('010-1234-5678'), '5678');
assert.equal(last4('12'), '');

assert.match(findStudentByPhone4(roster, { code: '12' }).error, /4자리/);
assert.match(findStudentByPhone4(roster, { code: '0000' }).error, /등록된 학생이 없/);
assert.match(findStudentByPhone4(roster, { code: '9090' }).error, /등록된 학생이 없/); // 퇴원생은 안 들어감

const sib = findStudentByPhone4(roster, { code: '5678', phone4: '5678' });
assert.deepEqual(sib.choices.map(c => c.name), ['김하윤', '김하준']);
assert.equal(findStudentByPhone4(roster, { phone4: '5678', name: '김하준' }).student.code, 'GR7710');
assert.equal(findStudentByPhone4(roster, { phone4: '5678', studentId: 'a' }).student.code, 'GR2831');
assert.match(findStudentByPhone4(roster, { phone4: '5678', name: '없는이름' }).error, /이름/);

assert.equal(findStudentByPhone4(roster, { code: '4321' }).student.name, '이서아');
assert.equal(findStudentByPhone4(roster, { code: '0001' }).student.name, '이서아');
console.log('voca-login: all passed');
