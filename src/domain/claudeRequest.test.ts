import { describe, expect, it } from 'vitest';
import { claudeBadge, claudeNoteText, readClaudeRequest } from './claudeRequest';
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

describe('Claude 요청 결과 글 (10-19 - 바꾼 것 없음의 까닭)', () => {
  const req = (state: 'nochange' | 'deployed' | 'failed', note: string) => ({ state, issue: 7, url: null, note });

  it('까닭을 그대로 보인다', () => {
    expect(claudeNoteText(req('nochange', '고치지 않았습니다. 이미 있습니다.\n다시 요청해 주세요.'))).toBe('고치지 않았습니다. 이미 있습니다.\n다시 요청해 주세요.');
    expect(claudeNoteText(req('nochange', ''))).toBe('');
  });

  it('주소와 합쳤습니다 머리 줄은 뺀다 (예전 댓글 모양도)', () => {
    expect(claudeNoteText(req('deployed', '합쳤습니다 - 화면 배포는 몇 분 뒤. https://github.com/a/b/pull/9\n\n글자를 키웠습니다.'))).toBe('글자를 키웠습니다.');
    expect(claudeNoteText(req('deployed', '글자를 키웠습니다.\n\n합쳤습니다 - 화면 배포는 몇 분 뒤. https://github.com/a/b/pull/9'))).toBe('글자를 키웠습니다.');
    expect(claudeNoteText(req('failed', '고치지 못했습니다(확인 실패 또는 오류) - 실행 기록 https://github.com/a/b/actions/runs/1'))).toBe(
      '고치지 못했습니다(확인 실패 또는 오류)',
    );
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
