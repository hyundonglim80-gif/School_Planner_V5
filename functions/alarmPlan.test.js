// node --test functions/alarmPlan.test.js (npm run test:functions) - V4 alarmPlan.test.js를 항목 하나 단위로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALARM_WINDOW_MS, alarmAtMs, alarmOf, isDeadTokenError, planItemAlarm, pushData, recipientsOf, touchesAlarm } from './alarmPlan.js';

const ev = (over = {}) => ({ kind: 'event', date: '2026-10-08', time: '09:30', text: '협의회', ...over });
const AT = Date.UTC(2026, 9, 8, 0, 30); // 한국 09:30 = UTC 00:30

test('한국 시각 → ms, 모양이 틀리면 null', () => {
  assert.equal(alarmAtMs('2026-10-08', '09:30'), AT);
  assert.equal(alarmAtMs('2026-10-08', '9:30'), null);
  assert.equal(alarmAtMs('2026-10-08', '25:00'), null);
  assert.equal(alarmAtMs('', '09:30'), null);
});

test('알림을 걸 일정: 끝냄·지움·메모·시각 없음·기간 첫날 끝냄은 아니다', () => {
  assert.deepEqual(alarmOf(ev()), { time: '2026-10-08T09:30', atMs: AT });
  assert.equal(alarmOf(ev({ done: true })), null);
  assert.equal(alarmOf(ev({ deletedAt: { seconds: 1 } })), null);
  assert.equal(alarmOf(ev({ kind: 'note' })), null);
  assert.equal(alarmOf(ev({ time: '' })), null);
  assert.equal(alarmOf(ev({ endDate: '2026-10-10', doneDates: ['2026-10-08'] })), null);
  assert.ok(alarmOf(ev({ endDate: '2026-10-10', doneDates: ['2026-10-09'] })));
});

test('받는 사람: 개인 = 그 사람, 그룹 = 쓴 사람(없으면 구성원)', () => {
  assert.deepEqual(recipientsOf('u_abc', ev(), null), ['abc']);
  assert.deepEqual(recipientsOf('g_1', ev({ authorId: 'x' }), { y: 'member' }), ['x']);
  assert.deepEqual(recipientsOf('g_1', ev(), { y: 'owner', x: 'member' }), ['x', 'y']);
  assert.deepEqual(recipientsOf('g_1', ev(), ['b', 'a', 'a']), ['a', 'b']);
});

test('새 알림 = 보낼 칸 · 같은 시각이면 다시 보내지 않고 글만 고친다 · 시각을 바꾸면 새로', () => {
  const now = AT - 60_000;
  const first = planItemAlarm({ sid: 'u_a', itemId: 'i1', item: ev(), existing: null, recipients: ['a'], nowMs: now });
  assert.deepEqual(first.set, { sid: 'u_a', itemId: 'i1', time: '2026-10-08T09:30', atMs: AT, content: '협의회', recipients: ['a'], sent: false, pendingAt: AT });
  const sent = { ...first.set, sent: true, pendingAt: null };
  assert.equal(planItemAlarm({ sid: 'u_a', itemId: 'i1', item: ev(), existing: sent, recipients: ['a'], nowMs: now }), null);
  const renamed = planItemAlarm({ sid: 'u_a', itemId: 'i1', item: ev({ text: '회의' }), existing: sent, recipients: ['a'], nowMs: now });
  assert.equal(renamed.set.content, '회의');
  assert.equal(renamed.set.sent, true);
  assert.equal(renamed.set.pendingAt, null);
  const moved = planItemAlarm({ sid: 'u_a', itemId: 'i1', item: ev({ time: '10:00' }), existing: sent, recipients: ['a'], nowMs: now });
  assert.equal(moved.set.sent, false);
  assert.equal(moved.set.pendingAt, AT + 30 * 60_000);
});

test('지난 지 1시간 넘은 시각은 보내지 않는다 · 알림을 끄면 칸을 지운다', () => {
  const late = planItemAlarm({ sid: 'u_a', itemId: 'i1', item: ev(), existing: null, recipients: ['a'], nowMs: AT + ALARM_WINDOW_MS + 1 });
  assert.equal(late.set.sent, true);
  assert.equal(late.set.pendingAt, null);
  assert.deepEqual(planItemAlarm({ sid: 'u_a', itemId: 'i1', item: ev({ time: '' }), existing: { time: 'x' }, recipients: [], nowMs: 0 }), { remove: true });
  assert.equal(planItemAlarm({ sid: 'u_a', itemId: 'i1', item: ev({ time: '' }), existing: null, recipients: [], nowMs: 0 }), null);
});

test('알림에 닿은 쓰기만 본다 (순서·라벨만 바꾼 저장은 건너뛴다)', () => {
  assert.equal(touchesAlarm(ev({ order: 'a' }), ev({ order: 'b' })), false);
  assert.equal(touchesAlarm(null, ev({ time: '' })), false);
  assert.equal(touchesAlarm(ev(), ev({ done: true })), true);
  assert.equal(touchesAlarm(ev({ time: '' }), ev()), true);
  assert.equal(touchesAlarm(ev(), null), true);
});

test('푸시 값은 글자만 · 죽은 토큰 오류', () => {
  assert.deepEqual(pushData({ itemId: 'i1', sid: 'u_a', content: '협의회', time: '2026-10-08T09:30' }), { type: 'event-alarm', id: 'i1', sid: 'u_a', content: '협의회', time: '2026-10-08T09:30' });
  assert.equal(isDeadTokenError('messaging/registration-token-not-registered'), true);
  assert.equal(isDeadTokenError('messaging/internal-error'), false);
});
