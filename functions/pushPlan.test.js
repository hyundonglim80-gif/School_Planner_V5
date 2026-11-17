// node --test functions/pushPlan.test.js (npm run test:functions) - 대화·Claude 답 푸시가 함께 쓰는 셈 (P41-3 - mailPlan.test.js에서)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunks, isDeadPushToken, isReservedDataKey } from './pushPlan.js';

test('금지 키', () => {
  for (const k of ['from', 'notification', 'message_type', 'google.x', 'gcm.n.e']) assert.equal(isReservedDataKey(k), true, k);
  assert.equal(isReservedDataKey('sender'), false);
});

test('지울 토큰 오류 - invalid-argument는 뺀다', () => {
  assert.equal(isDeadPushToken('messaging/registration-token-not-registered'), true);
  assert.equal(isDeadPushToken('messaging/invalid-registration-token'), true);
  assert.equal(isDeadPushToken('messaging/invalid-argument'), false);
  assert.equal(isDeadPushToken(undefined), false);
});

test('500개씩', () => {
  assert.deepEqual(chunks([1, 2, 3], 2), [[1, 2], [3]]);
  assert.equal(chunks(Array.from({ length: 1001 })).length, 3);
  assert.deepEqual(chunks([]), []);
});
