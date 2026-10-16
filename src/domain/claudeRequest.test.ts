import { describe, expect, it } from 'vitest';
import { claudeBadge, readClaudeRequest } from './claudeRequest';
import { compareOrder, orderBetween } from './order';

describe('Claude 요청 표시', () => {
  it('서버 문서를 읽는다 - 모양이 틀리면 null, GitHub 주소만', () => {
    expect(readClaudeRequest({ state: 'working', issue: 3, url: 'https://github.com/a/b/issues/3', note: '' })).toEqual({
      state: 'working',
      issue: 3,
      url: 'https://github.com/a/b/issues/3',
      note: '',
    });
    expect(readClaudeRequest({ state: 'odd' })).toBeNull();
    expect(readClaudeRequest(null)).toBeNull();
    expect(readClaudeRequest({ state: 'sent', url: 'javascript:alert(1)' })?.url).toBeNull();
  });

  it('상태마다 글과 색', () => {
    const base = { issue: 7, url: null, note: '' };
    expect(claudeBadge({ ...base, state: 'queued', issue: null })).toMatchObject({ text: '🤖 차례 기다림', tone: 'wait', title: 'Claude 요청' });
    expect(claudeBadge({ ...base, state: 'sent' })).toMatchObject({ text: '🤖 보냄', tone: 'wait' });
    expect(claudeBadge({ ...base, state: 'deployed' })).toMatchObject({ text: '✅ 배포됨', tone: 'ok' });
    expect(claudeBadge({ ...base, state: 'failed', note: '테스트 실패' })).toMatchObject({
      text: '❌ 실패',
      tone: 'bad',
      title: 'Claude 요청 #7 - 테스트 실패',
    });
  });
});

describe('서버가 만드는 라벨 차례 (functions/claudePlan orderAfterLast = 맨 값 + 글자 하나)', () => {
  it('맞는 차례 값이고 맨 뒤에 선다', () => {
    for (const last of ['a0', 'a2', 'a1V', 'b0Z']) {
      const after = `${last}V`;
      expect(() => orderBetween(after, null)).not.toThrow();
      expect(() => orderBetween(last, after)).not.toThrow();
      expect(compareOrder({ order: last, id: 'a' }, { order: after, id: 'b' })).toBeLessThan(0);
    }
  });
});
