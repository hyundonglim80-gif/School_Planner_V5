// node --test functions/mailPlan.test.js (npm run test:functions) - 쪽지 푸시 셈 (P15-1 ■3)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAIL_TO_MAX, NAME_MAX, chunks, isDeadMailToken, isReservedDataKey, mailPushData, mailRecipients } from './mailPlan.js';

test('받는 사람 - 글자 uid만, 겹침·보낸 사람 빼고 50명까지', () => {
  assert.deepEqual(mailRecipients(['b', 'a', 'b', 3, '', 'c'], 'a'), ['b', 'c']);
  assert.deepEqual(mailRecipients(undefined, 'a'), []);
  const many = Array.from({ length: 60 }, (_, i) => `u${i}`);
  assert.equal(mailRecipients(many, 'a').length, MAIL_TO_MAX);
});

test('푸시 값 - 글자만, 금지 키 없음, 쪽지 글 없음, 4KB 한참 아래', () => {
  const d = mailPushData({ id: 'm1', sid: 'g_x', senderName: '김'.repeat(100), groupName: '4학년 협의회' });
  assert.deepEqual(Object.keys(d), ['type', 'id', 'sid', 'sender', 'group']);
  assert.equal(d.type, 'mail');
  assert.equal(d.sender.length, NAME_MAX);
  assert.ok(d.sender.endsWith('…'));
  for (const [k, v] of Object.entries(d)) {
    assert.equal(typeof v, 'string');
    assert.equal(isReservedDataKey(k), false, k);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(d)) < 1024);
  assert.equal(mailPushData({ id: 'm2' }).sender, '이름 없음');
  assert.equal(mailPushData({ id: 'm2' }).group, '');
});

test('금지 키', () => {
  for (const k of ['from', 'notification', 'message_type', 'google.x', 'gcm.n.e']) assert.equal(isReservedDataKey(k), true, k);
  assert.equal(isReservedDataKey('sender'), false);
});

test('쪽지 길에서 지울 토큰 오류 - invalid-argument는 뺀다', () => {
  assert.equal(isDeadMailToken('messaging/registration-token-not-registered'), true);
  assert.equal(isDeadMailToken('messaging/invalid-registration-token'), true);
  assert.equal(isDeadMailToken('messaging/invalid-argument'), false);
  assert.equal(isDeadMailToken(undefined), false);
});

test('500개씩', () => {
  assert.deepEqual(chunks([1, 2, 3], 2), [[1, 2], [3]]);
  assert.equal(chunks(Array.from({ length: 1001 })).length, 3);
  assert.deepEqual(chunks([]), []);
});
