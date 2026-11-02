import { describe, expect, it } from 'vitest';
import {
  joinNames,
  mailDocs,
  mailExpireAt,
  mailParamOf,
  mailPreview,
  mailTextError,
  mailWhen,
  MAIL_KEEP_DAYS,
  MAIL_LIMITS,
  newMailNotice,
  readMailIn,
  readMailSent,
  recipientsOf,
  replyQuote,
  stripMailParam,
  unreadLabel,
} from './mail';

describe('쪽지 셈', () => {
  it('글 확인 - 빈 글·2000자 넘음 (글자 칸 수 = 규칙과 같게)', () => {
    expect(mailTextError('  \n ')).toMatch(/적어/);
    expect(mailTextError('가'.repeat(MAIL_LIMITS.text))).toBeNull();
    expect(mailTextError('가'.repeat(MAIL_LIMITS.text + 1))).toMatch(/2000자/);
    // 이모지는 두 칸 - 규칙 size()도 그렇게 센다(P15-1 ■0)
    expect(mailTextError('😀'.repeat(1001))).toMatch(/2002자/);
  });

  it('받는 사람 - 겹침·나 빼기, 지금 구성원만 (나간 사람은 gone)', () => {
    const members = { me: 'owner', b: 'member', c: 'member' };
    expect(recipientsOf(['b', 'me', 'b', 'c', 'x'], 'me', members)).toEqual({ to: ['b', 'c'], gone: ['x'] });
    expect(recipientsOf([], 'me', members)).toEqual({ to: [], gone: [] });
  });

  it('받는 사람 이름 한 줄 - 없으면 이름 없음, 600자에서 자른다', () => {
    expect(joinNames(['b', 'c'], { b: '김선생', c: ' ' })).toBe('김선생, 이름 없음');
    const many = Array.from({ length: 50 }, (_, i) => `u${i}`);
    const names = Object.fromEntries(many.map((u) => [u, '아주 긴 이름의 선생님']));
    const line = joinNames(many, names);
    expect(line.length).toBe(MAIL_LIMITS.toNames);
    expect(line.endsWith('…')).toBe(true);
  });

  it('문서 둘 - 받는 쪽(from·읽음 null)과 사본, 같은 칸은 같게', () => {
    const { inbox, sent } = mailDocs(
      { from: 'a', fromName: '', sid: 'g_x', groupName: '아주 긴 그룹 이름'.repeat(10), to: ['b'], names: { b: '이선생' }, text: '안녕하세요' },
      'AT',
      'EXP',
    );
    expect(inbox).toEqual({
      from: 'a', fromName: '이름 없음', sid: 'g_x', groupName: '아주 긴 그룹 이름'.repeat(10), to: ['b'], toNames: '이선생',
      text: '안녕하세요', at: 'AT', readAt: null, replyTo: null, expireAt: 'EXP', v: 1,
    });
    expect(Object.keys(sent).sort()).toEqual(['at', 'expireAt', 'groupName', 'replyTo', 'sid', 'text', 'to', 'toNames', 'v']);
    // 규칙 hasOnly 칸 수 (mailIn 12 · mailSent 9)
    expect(Object.keys(inbox)).toHaveLength(12);
    expect(mailDocs({ from: 'a', fromName: 'x'.repeat(50), sid: 'g', groupName: '', to: [], names: {}, text: '', replyTo: 'r1' }, 0, 0).inbox).toMatchObject({
      fromName: `${'x'.repeat(39)}…`,
      replyTo: 'r1',
    });
  });

  it('지울 날 = 365일 뒤 (규칙 370일 안)', () => {
    expect(mailExpireAt(0)).toBe(MAIL_KEEP_DAYS * 86_400_000);
    expect(MAIL_KEEP_DAYS).toBeLessThan(370);
  });

  it('서버 문서 읽기 - Timestamp·빠진 칸', () => {
    const ts = (ms: number) => ({ toMillis: () => ms });
    expect(readMailIn('m1', { from: 'a', fromName: '김', sid: 'g_x', groupName: 'G', to: ['b', 3], toNames: '이', text: 't', at: ts(5), readAt: null, replyTo: null })).toEqual({
      id: 'm1', from: 'a', fromName: '김', sid: 'g_x', groupName: 'G', to: ['b'], toNames: '이', text: 't', at: 5, readAt: null, replyTo: null,
    });
    // 막 보내 서버 시각이 아직 없는 사본
    expect(readMailSent('m2', { to: ['b'], at: null, replyTo: 'm1' })).toMatchObject({ at: null, replyTo: 'm1', text: '' });
  });

  it('머리줄 숫자 - 100(센 끝)이면 99+', () => {
    expect(unreadLabel(3)).toBe('3');
    expect(unreadLabel(99)).toBe('99');
    expect(unreadLabel(100)).toBe('99+');
  });

  it('안내 글·답장 머리', () => {
    expect(newMailNotice({ fromName: '김', groupName: '4학년' })).toBe('✉ 김 선생님의 쪽지 (4학년)');
    expect(replyQuote('\n  첫 줄입니다  \n둘째')).toBe('첫 줄입니다');
    expect(replyQuote('가'.repeat(50), 10)).toBe(`${'가'.repeat(9)}…`);
  });

  it('쪽지 창 줄 - 시각(오늘·올해·그 전·보내는 중)과 첫 줄', () => {
    const now = new Date(2026, 10, 2, 15, 0).getTime();
    const time = (d: Date) => d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
    const today = new Date(2026, 10, 2, 9, 5);
    expect(mailWhen(today.getTime(), now)).toBe(time(today));
    const before = new Date(2026, 9, 30, 9, 5);
    expect(mailWhen(before.getTime(), now)).toBe(`10/30 ${time(before)}`);
    expect(mailWhen(new Date(2025, 10, 2).getTime(), now)).toBe('2025/11/2');
    expect(mailWhen(null, now)).toBe('보내는 중…');
    expect(mailPreview('\n\n  안녕하세요  \n둘째')).toBe('안녕하세요');
    expect(mailPreview('')).toBe('');
  });

  it('?mail= 주소 - 읽기·지우기 (다른 값과 # 뒤는 둔다)', () => {
    expect(mailParamOf('?as=2&mail=Ab12')).toBe('Ab12');
    expect(mailParamOf('?mail=../x')).toBeNull();
    expect(mailParamOf('')).toBeNull();
    expect(stripMailParam('http://x.test/?as=2&mail=Ab12#/day/2026-11-02')).toBe('/?as=2#/day/2026-11-02');
    expect(stripMailParam('http://x.test/?mail=Ab12')).toBe('/');
  });
});
