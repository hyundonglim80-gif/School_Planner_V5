import { describe, expect, it } from 'vitest';
import {
  CHAT_LIMITS,
  CHAT_RUN_MS,
  chatCountLabel,
  chatExpireAt,
  chatParamOf,
  chatPreview,
  chatRows,
  chatSections,
  chatSendDocs,
  chatTextError,
  dmOtherOf,
  dmPairId,
  isRoomUnread,
  mergeMsgs,
  msgsPath,
  myReadOf,
  parseRoomKey,
  readChatMsg,
  readChatRoom,
  refOf,
  roomKey,
  roomPath,
  roomPreview,
  sortRooms,
  stripChatParam,
  unreadRoomKeys,
  unseenByOther,
  type ChatMsg,
  type ChatRoom,
} from './chat';

const ts = (ms: number) => ({ toMillis: () => ms });
const room = (over: Partial<ChatRoom> = {}): ChatRoom => ({
  key: 'g_G~all', kind: 'all', sid: 'g_G', name: '', members: [], names: {}, lastId: 'm1', lastAt: 1000, lastFrom: 'b', lastFromName: 'B', lastText: '안녕', muted: [], reads: {}, ...over,
});
const msg = (over: Partial<ChatMsg> = {}): ChatMsg => ({ id: 'm', from: 'a', fromName: 'A', text: 't', attachments: [], at: 1000, deleted: false, ...over });

describe('대화 방 키·1:1 id', () => {
  it('그룹 방 키 = sid~roomId, 1:1 = pairId · 되읽기', () => {
    expect(roomKey({ kind: 'all', sid: 'g_G', roomId: 'all' })).toBe('g_G~all');
    expect(roomKey({ kind: 'room', sid: 'g_G', roomId: 'r_X1' })).toBe('g_G~r_X1');
    expect(roomKey({ kind: 'dm', pairId: 'd_a_b' })).toBe('d_a_b');
    expect(parseRoomKey('g_G~all')).toEqual({ kind: 'all', sid: 'g_G', roomId: 'all' });
    expect(parseRoomKey('g_G~r_X1')).toEqual({ kind: 'room', sid: 'g_G', roomId: 'r_X1' });
    expect(parseRoomKey('d_a_b')).toEqual({ kind: 'dm', pairId: 'd_a_b' });
  });

  it('모양이 아닌 키는 null - 다른 상자·순서가 거꾸로인 1:1·세 사람', () => {
    for (const k of ['', 'g_G', 'g_G~x', 'g_G~r_', 'u_me~all', 'g_G/x~all', 'd_b_a', 'd_a_b_c', 'd_a', 'g_G~all~x']) expect(parseRoomKey(k)).toBeNull();
  });

  it('1:1 id는 작은 uid가 앞 (규칙이 글자로 견준다) · 상대 찾기', () => {
    expect(dmPairId('zed', 'Abc')).toBe('d_Abc_zed'); // 대문자가 작다 - 규칙 string < 와 같은 차례
    expect(dmPairId('Abc', 'zed')).toBe('d_Abc_zed');
    expect(dmOtherOf('d_Abc_zed', 'zed')).toBe('Abc');
    expect(dmOtherOf('d_Abc_zed', 'Abc')).toBe('zed');
    expect(dmOtherOf('d_Abc_zed', 'other')).toBeNull();
  });

  it('경로 - 방 문서와 그 아래 chatMsgs', () => {
    const all = refOf({ kind: 'all', sid: 'g_G' });
    expect(roomPath(all)).toEqual(['v5Chat', 'g_G', 'chatRooms', 'all']);
    expect(msgsPath(all)).toEqual(['v5Chat', 'g_G', 'chatRooms', 'all', 'chatMsgs']);
    const dm = refOf({ kind: 'dm', pairId: 'd_a_b', other: 'b', sid: 'g_G' });
    expect(roomPath(dm)).toEqual(['v5Dm', 'd_a_b']);
    expect(msgsPath(dm)).toEqual(['v5Dm', 'd_a_b', 'chatMsgs']);
    expect(refOf({ kind: 'room', sid: 'g_G', roomId: 'r_1' })).toEqual({ kind: 'room', sid: 'g_G', roomId: 'r_1' });
  });
});

describe('대화 보내기 문서', () => {
  const m = { from: 'a', fromName: '  김선생  ', text: '첫 줄\n둘째 줄' };

  it('글 확인 - 빈 글·2000자·첨부 10개 (쪽지와 같다)', () => {
    expect(chatTextError(' \n')).toMatch(/적거나/);
    expect(chatTextError('', 1)).toBeNull();
    expect(chatTextError('가'.repeat(CHAT_LIMITS.text))).toBeNull();
    expect(chatTextError('가'.repeat(CHAT_LIMITS.text + 1))).toMatch(/2000자/);
    expect(chatTextError('글', CHAT_LIMITS.attachments + 1)).toMatch(/10개까지/);
  });

  it('미리 보기 = 빈 줄을 건너뛴 첫 줄 80자, 글이 없으면 📎 n', () => {
    expect(chatPreview('\n  \n  안녕  \n다음')).toBe('안녕');
    expect(chatPreview('가'.repeat(100))).toHaveLength(CHAT_LIMITS.lastText);
    expect(chatPreview('가'.repeat(100)).endsWith('…')).toBe(true);
    expect(chatPreview('', 3)).toBe('📎 3');
    expect(chatPreview('', 0)).toBe('');
  });

  it('그룹 전체 = 늘 같은 모양 (만들기·고치기 - 둘이 함께 첫 글), 🔕 없음', () => {
    const { msg, room, merge } = chatSendDocs({ kind: 'all', sid: 'g_G' }, m, 'M1', 'AT', 'EXP');
    expect(merge).toBe(true);
    expect(msg).toEqual({ from: 'a', fromName: '김선생', text: '첫 줄\n둘째 줄', at: 'AT', expireAt: 'EXP', v: 1 });
    expect(room).toEqual({ kind: 'all', lastId: 'M1', lastAt: 'AT', lastFrom: 'a', lastFromName: '김선생', lastText: '첫 줄', expireAt: 'EXP', v: 1 });
    expect('muted' in room).toBe(false);
  });

  it('1:1 = 늘 같은 모양, names는 내 칸만 · 함께 든 그룹 sid', () => {
    const { room, merge } = chatSendDocs({ kind: 'dm', pairId: 'd_a_b', other: 'b', sid: 'g_G' }, m, 'M1', 'AT', 'EXP');
    expect(merge).toBe(true);
    expect(room).toMatchObject({ kind: 'dm', members: { a: true, b: true }, sid: 'g_G', names: { a: '김선생' }, lastId: 'M1', v: 1 });
  });

  it('고른 사람 방 - 만들 때만 이름·사람(나 더하기·겹침 빼기, 통째로), 뒤로는 last*만', () => {
    const made = chatSendDocs({ kind: 'room', sid: 'g_G', roomId: 'r_1', create: { name: '  학년 부장  ', members: ['b', 'c', 'b'] } }, m, 'M1', 'AT', 'EXP');
    expect(made.merge).toBe(false);
    expect(made.room).toMatchObject({ kind: 'room', name: '학년 부장', members: { a: true, b: true, c: true }, lastId: 'M1', v: 1 });
    const next = chatSendDocs({ kind: 'room', sid: 'g_G', roomId: 'r_1' }, m, 'M2', 'AT', 'EXP');
    expect(next.merge).toBe(true);
    expect(Object.keys(next.room).sort()).toEqual(['expireAt', 'lastAt', 'lastFrom', 'lastFromName', 'lastId', 'lastText']);
  });

  it('첨부는 있을 때만 칸째 · 아는 칸만 · 미리 보기 📎 n', () => {
    const a = { id: 'f', name: '캡처.png', url: 'https://x', type: 'image/png', size: undefined, driveId: 'D1' };
    const { msg, room } = chatSendDocs({ kind: 'all', sid: 'g_G' }, { ...m, text: '', attachments: [a, a] }, 'M1', 'AT', 'EXP');
    expect(msg.attachments).toEqual([{ id: 'f', name: '캡처.png', url: 'https://x', type: 'image/png', driveId: 'D1' }, { id: 'f', name: '캡처.png', url: 'https://x', type: 'image/png', driveId: 'D1' }]);
    expect(room.lastText).toBe('📎 2');
    expect('attachments' in chatSendDocs({ kind: 'all', sid: 'g_G' }, { ...m, attachments: [] }, 'M1', 'AT', 'EXP').msg).toBe(false);
  });

  it('이름 40자로 자르기 · 빈 이름 = 이름 없음 · 지울 날 1년', () => {
    expect(chatSendDocs({ kind: 'all', sid: 'g_G' }, { ...m, fromName: '가'.repeat(50) }, 'M', 1, 2).msg.fromName).toHaveLength(CHAT_LIMITS.fromName);
    expect(chatSendDocs({ kind: 'all', sid: 'g_G' }, { ...m, fromName: ' ' }, 'M', 1, 2).msg.fromName).toBe('이름 없음');
    expect(chatExpireAt(0)).toBe(365 * 86_400_000);
  });
});

describe('대화 문서 읽기', () => {
  it('방 - 종류마다 쓰는 칸만 · Timestamp → ms · muted·members = true인 것만', () => {
    const d = { kind: 'dm', members: { a: true, b: true, c: false }, sid: 'g_G', names: { a: 'A', b: 3 }, lastId: 'm', lastAt: ts(5), lastFrom: 'a', lastFromName: '', lastText: 'x', muted: { b: true }, reads: { a: ts(4), b: null } };
    const r = readChatRoom({ kind: 'dm', pairId: 'd_a_b' }, d);
    expect(r).toEqual({ key: 'd_a_b', kind: 'dm', sid: 'g_G', name: '', members: ['a', 'b'], names: { a: 'A' }, lastId: 'm', lastAt: 5, lastFrom: 'a', lastFromName: '이름 없음', lastText: 'x', muted: ['b'], reads: { a: 4 } });
    const all = readChatRoom({ kind: 'all', sid: 'g_G', roomId: 'all' }, { ...d, name: '꾸밈' });
    expect(all).toMatchObject({ key: 'g_G~all', kind: 'all', sid: 'g_G', name: '', members: [], names: {}, reads: {} });
    expect(readChatRoom({ kind: 'room', sid: 'g_G', roomId: 'r_1' }, { name: '부장', members: { a: true } })).toMatchObject({ name: '부장', members: ['a'], lastAt: null, lastId: null });
  });

  it('글 - 붙임은 https만 · 지운 글은 글·붙임을 비운다 (서버 시각을 기다리는 null도)', () => {
    const ok = { name: 'a.png', url: 'https://x' };
    expect(readChatMsg('m', { from: 'a', fromName: 'A', text: 't', at: ts(9), attachments: [ok, { name: 'b', url: 'javascript:x' }] })).toEqual({
      id: 'm', from: 'a', fromName: 'A', text: 't', attachments: [{ name: 'a.png', url: 'https://x', type: 'application/octet-stream' }], at: 9, deleted: false,
    });
    expect(readChatMsg('m', { from: 'a', text: '남은 글', attachments: [ok], at: ts(9), deletedAt: null })).toMatchObject({ text: '', attachments: [], deleted: true, fromName: '이름 없음' });
    expect(readChatMsg('m', { from: 'a', text: '', at: null, deletedAt: ts(10) }).deleted).toBe(true);
    expect(readChatMsg('m', { from: 'a', text: 'x' }).at).toBeNull();
  });
});

describe('안 읽은 방·1:1 읽음', () => {
  it('마지막 글이 남의 것이고 내 읽음 뒤 · 읽음 칸이 없으면 안 읽음 · 내 글·보내는 중·빈 방은 읽음', () => {
    expect(isRoomUnread(room(), 'a', 999)).toBe(true);
    expect(isRoomUnread(room(), 'a', 1000)).toBe(false);
    expect(isRoomUnread(room(), 'a', null)).toBe(true);
    expect(isRoomUnread(room({ lastFrom: 'a' }), 'a', null)).toBe(false);
    expect(isRoomUnread(room({ lastAt: null }), 'a', null)).toBe(false);
    expect(isRoomUnread(room({ lastFrom: '' }), 'a', null)).toBe(false);
  });

  it('내 읽음 - 1:1은 방 reads, 그룹 방은 내 읽음 문서 · 안 읽은 방 키', () => {
    const dm = room({ key: 'd_a_b', kind: 'dm', reads: { a: 2000 } });
    const g = room({ key: 'g_G~all' });
    const r = room({ key: 'g_G~r_1', kind: 'room' });
    expect(myReadOf(dm, 'a', { 'd_a_b': 1 })).toBe(2000);
    expect(myReadOf(g, 'a', { 'g_G~all': 500 })).toBe(500);
    expect(myReadOf(r, 'a', {})).toBeNull();
    expect(unreadRoomKeys([dm, g, r], 'a', { 'g_G~all': 1500 })).toEqual(['g_G~r_1']);
  });

  it('방 목록 차례 - 최근 글부터, 보내는 중(null)은 맨 위', () => {
    const rs = [room({ key: 'x', lastAt: 1 }), room({ key: 'y', lastAt: null }), room({ key: 'z', lastAt: 3 })];
    expect(sortRooms(rs).map((r) => r.key)).toEqual(['y', 'z', 'x']);
  });

  it("1:1 내 글 '1' - 상대 읽음 전·보내는 중, 그룹 방·남의 글·지운 글은 없음", () => {
    const dm = room({ key: 'd_a_b', kind: 'dm', reads: { b: 1500 } });
    expect(unseenByOther(dm, 'a', msg({ at: 2000 }))).toBe(true);
    expect(unseenByOther(dm, 'a', msg({ at: 1500 }))).toBe(false);
    expect(unseenByOther(dm, 'a', msg({ at: null }))).toBe(true);
    expect(unseenByOther(room({ key: 'd_a_b', kind: 'dm' }), 'a', msg())).toBe(true);
    expect(unseenByOther(dm, 'a', msg({ from: 'b', at: 2000 }))).toBe(false);
    expect(unseenByOther(dm, 'a', msg({ at: 2000, deleted: true }))).toBe(false);
    expect(unseenByOther(room(), 'a', msg({ at: 2000 }))).toBe(false);
  });

  it('수 표시 99+', () => {
    expect(chatCountLabel(99)).toBe('99');
    expect(chatCountLabel(100)).toBe('99+');
  });
});

describe('글 줄 - 날짜 나눔·잇단 글', () => {
  const day1 = new Date(2026, 10, 3, 9, 0).getTime();
  const day2 = new Date(2026, 10, 4, 9, 0).getTime();

  it('그날 첫 글에 날짜 줄 · 같은 사람이 5분 안에 잇달아 쓰면 이름 한 번', () => {
    const rows = chatRows([
      msg({ id: '1', from: 'a', at: day1 }),
      msg({ id: '2', from: 'a', at: day1 + 60_000 }),
      msg({ id: '3', from: 'b', at: day1 + 120_000 }),
      msg({ id: '4', from: 'b', at: day1 + 120_000 + CHAT_RUN_MS + 1 }),
      msg({ id: '5', from: 'b', at: day2 }),
    ]);
    expect(rows.map((r) => [r.msg.id, !!r.day, r.head])).toEqual([
      ['1', true, true],
      ['2', false, false],
      ['3', false, true],
      ['4', false, true],
      ['5', true, true],
    ]);
    expect(rows[0].day).toContain('11월 3일');
  });

  it('보내는 중(at null)은 앞 글과 같은 날·잇단 글, 맨 앞이면 지금', () => {
    const rows = chatRows([msg({ id: '1', at: day1 }), msg({ id: '2', at: null })], day2);
    expect(rows[1]).toMatchObject({ day: null, head: false });
    expect(chatRows([msg({ at: null })], day2)[0].day).toContain('11월 4일');
  });

  it('시각은 잇단 글의 같은 분 마지막 글에만 - 다른 사람·다른 분·보내는 중은 따로', () => {
    const rows = chatRows([
      msg({ id: '1', from: 'a', at: day1 }),
      msg({ id: '2', from: 'a', at: day1 + 10_000 }),
      msg({ id: '3', from: 'a', at: day1 + 70_000 }),
      msg({ id: '4', from: 'b', at: day1 + 71_000 }),
      msg({ id: '5', from: 'b', at: day1 + 72_000 }),
      msg({ id: '6', from: 'b', at: null }),
    ]);
    expect(rows.map((r) => r.time)).toEqual([false, true, true, false, true, true]);
  });
});

describe('대화 창 목록', () => {
  const me = 'a';
  it('1:1 묶음 + 그룹마다(이름 차례) - 그룹 전체는 글이 없어도 한 줄, 나간 그룹 방은 빠진다', () => {
    const all = room({ key: 'g_B~all', sid: 'g_B', lastAt: 5 });
    const r1 = room({ key: 'g_B~r_1', kind: 'room', sid: 'g_B', name: '방', lastAt: 9 });
    const old = room({ key: 'g_Z~all', sid: 'g_Z' });
    const d1 = room({ key: 'd_a_b', kind: 'dm', sid: 'g_B', lastAt: 3 });
    const d2 = room({ key: 'd_a_c', kind: 'dm', sid: 'g_Q', lastAt: 7 });
    const s = chatSections([all, r1, old, d1, d2], [
      { id: 'g_B', name: '나 그룹' },
      { id: 'g_A', name: '가 그룹' },
    ]);
    expect(s.dms.map((r) => r.key)).toEqual(['d_a_c', 'd_a_b']);
    expect(s.groups.map((g) => [g.sid, g.all?.key ?? null, g.rooms.map((r) => r.key)])).toEqual([
      ['g_A', null, []],
      ['g_B', 'g_B~all', ['g_B~r_1']],
    ]);
  });

  it("마지막 글 - 그룹 방 '이름: 글' · 내 글 '나: ' · 지운 글 · 글 없음", () => {
    expect(roomPreview(room({ lastFromName: '이점검', lastText: '안녕' }), me)).toBe('이점검: 안녕');
    expect(roomPreview(room({ kind: 'dm', key: 'd_a_b', lastText: '안녕' }), me)).toBe('안녕');
    expect(roomPreview(room({ lastFrom: me, lastText: '📎 2' }), me)).toBe('나: 📎 2');
    expect(roomPreview(room({ lastText: '' }), me)).toBe('B: 지운 글');
    expect(roomPreview(room({ lastId: null, lastText: '' }), me)).toBe('');
  });

  it('받은 글 잇기 - 같은 id는 새 것, 시각 차례, 보내는 중은 맨 뒤', () => {
    const merged = mergeMsgs([msg({ id: 'x', at: 2 }), msg({ id: 'y', at: 1 })], [msg({ id: 'p', at: null }), msg({ id: 'x', at: 3, text: '새' }), msg({ id: 'z', at: 0 })]);
    expect(merged.map((m) => m.id)).toEqual(['z', 'y', 'x', 'p']);
    expect(merged.find((m) => m.id === 'x')?.text).toBe('새');
  });
});

describe('?chat= 주소', () => {
  it('방 키 모양만 받는다', () => {
    expect(chatParamOf('?chat=g_G~all')).toBe('g_G~all');
    expect(chatParamOf('?chat=d_a_b&x=1')).toBe('d_a_b');
    expect(chatParamOf('?chat=d_b_a')).toBeNull();
    expect(chatParamOf('?chat=../x')).toBeNull();
    expect(chatParamOf('?mail=x')).toBeNull();
  });

  it('지우기 - 다른 값과 # 뒤는 둔다', () => {
    expect(stripChatParam('https://a.test/?chat=g_G~all&as=1#/day/2026-11-03')).toBe('/?as=1#/day/2026-11-03');
    expect(stripChatParam('https://a.test/?chat=d_a_b')).toBe('/');
  });
});
