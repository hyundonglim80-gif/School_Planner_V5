import { describe, expect, it } from 'vitest';
import { claudeBadge, readClaudeRequest } from './claudeRequest';

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
    expect(claudeBadge({ ...base, state: 'sent' })).toMatchObject({ text: '🤖 보냄', tone: 'wait' });
    expect(claudeBadge({ ...base, state: 'deployed' })).toMatchObject({ text: '✅ 배포됨', tone: 'ok' });
    expect(claudeBadge({ ...base, state: 'failed', note: '테스트 실패' })).toMatchObject({
      text: '❌ 실패',
      tone: 'bad',
      title: 'Claude 요청 #7 - 테스트 실패',
    });
  });
});
