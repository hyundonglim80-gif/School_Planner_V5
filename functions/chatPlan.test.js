// node --test functions/chatPlan.test.js (npm run test:functions) - 대화 푸시 셈 (P19-1 ■3)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatPushData, chatRecipients, chatTitle, isLastMsg } from './chatPlan.js';
import { NAME_MAX, isReservedDataKey } from './mailPlan.js';

const space = { a: 'owner', b: 'member', c: 'member', d: 'left' };

test('그룹 전체 - 지금 구성원 모두, 보낸 사람·🔕 빼고', () => {
  assert.deepEqual(chatRecipients({ kind: 'all', spaceMembers: space, muted: { c: true, b: false }, from: 'a' }), ['b']);
  assert.deepEqual(chatRecipients({ kind: 'all', spaceMembers: undefined, from: 'a' }), []);
});

test('고른 사람 방 - 방 사람 중 지금 그룹 구성원만 (나간 사람·true가 아닌 칸 빼고)', () => {
  const roomMembers = { a: true, b: true, d: true, e: true, c: false };
  assert.deepEqual(chatRecipients({ kind: 'room', spaceMembers: space, roomMembers, from: 'a' }), ['b']);
  assert.deepEqual(chatRecipients({ kind: 'room', spaceMembers: space, roomMembers, muted: { b: true }, from: 'a' }), []);
});

test('1:1 - 상대만, 🔕면 없음 · 모르는 종류는 없음', () => {
  assert.deepEqual(chatRecipients({ kind: 'dm', roomMembers: { a: true, b: true }, from: 'a' }), ['b']);
  assert.deepEqual(chatRecipients({ kind: 'dm', roomMembers: { a: true, b: true }, muted: { b: true }, from: 'a' }), []);
  assert.deepEqual(chatRecipients({ kind: 'x', spaceMembers: space, from: 'a' }), []);
});

test('제목 - 그룹 전체 = 그룹 이름, 방 = 방 이름(없으면 그룹), 1:1 = 없음, 40자', () => {
  assert.equal(chatTitle({ kind: 'all', groupName: ' 4학년 ', roomName: '무시' }), '4학년');
  assert.equal(chatTitle({ kind: 'room', groupName: '4학년', roomName: '부장 셋' }), '부장 셋');
  assert.equal(chatTitle({ kind: 'room', groupName: '4학년', roomName: '  ' }), '4학년');
  assert.equal(chatTitle({ kind: 'dm', groupName: '4학년' }), '');
  assert.equal(chatTitle({ kind: 'all', groupName: '가'.repeat(60) }).length, NAME_MAX);
});

test('푸시 값 - 글자만, 금지 키 없음, 글 없음, 4KB 한참 아래', () => {
  const d = chatPushData({ room: 'g_x~all', senderName: '김'.repeat(100), title: '4학년' });
  assert.deepEqual(Object.keys(d), ['type', 'room', 'sender', 'title']);
  assert.equal(d.type, 'chat');
  assert.equal(d.sender.length, NAME_MAX);
  for (const [k, v] of Object.entries(d)) {
    assert.equal(typeof v, 'string');
    assert.equal(isReservedDataKey(k), false, k);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(d)) < 1024);
  assert.deepEqual(chatPushData({ room: 'd_a_b' }), { type: 'chat', room: 'd_a_b', sender: '이름 없음', title: '' });
});

test('마지막 글만 알린다 - 뒤 글이 왔으면 뒤 글이', () => {
  assert.equal(isLastMsg({ lastId: 'm2' }, 'm2'), true);
  assert.equal(isLastMsg({ lastId: 'm2' }, 'm1'), false);
  assert.equal(isLastMsg(undefined, 'm1'), false);
});
