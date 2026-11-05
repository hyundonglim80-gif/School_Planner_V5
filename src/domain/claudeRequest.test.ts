import { describe, expect, it } from 'vitest';
import {
  claudeAnsweredNow,
  claudeBadge,
  claudeBusy,
  claudeFinished,
  claudeNewAnswerAt,
  claudeNoteText,
  claudeParamOf,
  claudeTurnBadge,
  readClaudeRequest,
  readClaudeTurn,
  stripClaudeParam,
  turnsForView,
  type ClaudeRequest,
  type ClaudeRequestState,
  type ClaudeTurn,
} from './claudeRequest';
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

describe('메모 안 대화 - 턴 (P23)', () => {
  const req = { state: 'deployed' as const, issue: 7, url: null, note: '고쳤습니다.' };
  const turn = (n: number, askAt: number | null, state: ClaudeTurn['state'] = 'deployed'): ClaudeTurn => ({ n, askText: `글 ${n}`, askAt, state, issue: n, url: null, note: '' });

  it('턴 문서를 읽는다 - 번호·상태가 틀리면 null, ⚠ 턴도 읽는다', () => {
    expect(readClaudeTurn({ n: 2, askText: '더 작게', askAt: 5, state: 'working', issue: 9, url: 'https://github.com/a/b/issues/9', note: '' })).toEqual({
      n: 2,
      askText: '더 작게',
      askAt: 5,
      state: 'working',
      issue: 9,
      url: 'https://github.com/a/b/issues/9',
      note: '',
    });
    expect(readClaudeTurn({ n: 3, state: 'dropped' })).toMatchObject({ state: 'dropped', askText: '', askAt: null });
    expect(readClaudeTurn({ n: 1, state: 'odd' })).toBeNull();
    expect(readClaudeTurn({ state: 'sent' })).toBeNull();
    expect(readClaudeTurn({ n: 1, state: 'sent', url: 'javascript:alert(1)' })?.url).toBeNull();
    expect(readClaudeTurn(null)).toBeNull();
  });

  it('턴을 받는 중이면 아무것도 그리지 않는다 (턴이 많은 메모가 깜빡이지 않게)', () => {
    expect(turnsForView(null, req, {})).toEqual([]);
  });

  it('턴이 없는 옛 문서는 부모로 한 턴', () => {
    expect(turnsForView([], req, {})).toEqual([{ n: 1, askText: '', askAt: null, ...req }]);
  });

  it('요청 표시가 없으면 대화도 없다', () => {
    expect(turnsForView([], null, {})).toEqual([]);
  });

  it('턴은 번호 차례로', () => {
    expect(turnsForView([turn(2, 20), turn(1, 10)], req, {}).map((t) => t.n)).toEqual([1, 2]);
  });

  it("아직 턴이 없는 이어 쓴 글은 '보내는 중' 턴 하나", () => {
    const view = turnsForView([turn(1, 10)], req, { claudeAskAt: 20, claudeFollow: { at: 20, text: '더 작게' } });
    expect(view).toHaveLength(2);
    expect(view[1]).toMatchObject({ n: 2, askText: '더 작게', askAt: 20, state: 'asking' });
  });

  it('번호는 ⚠ 턴까지 센 다음 번호', () => {
    const view = turnsForView([turn(1, 10), turn(3, 15, 'dropped')], req, { claudeAskAt: 20, claudeFollow: { at: 20, text: '더' } });
    expect(view.at(-1)?.n).toBe(4);
  });

  it('서버 턴이 생기면 보내는 중을 빼고, 짝이 안 맞는 지난 글도 보이지 않는다', () => {
    expect(turnsForView([turn(1, 10), turn(2, 20, 'queued')], req, { claudeAskAt: 20, claudeFollow: { at: 20, text: '더' } }).map((t) => t.state)).toEqual(['deployed', 'queued']);
    expect(turnsForView([turn(1, 10)], req, { claudeAskAt: 30, claudeFollow: { at: 20, text: '지난 글' } })).toHaveLength(1);
  });

  it('턴 표시 - 바꾼 것 없음은 실패 색이 아니다 (되물음·답일 수 있다), ⚠·보내는 중', () => {
    expect(claudeTurnBadge(turn(1, 1, 'nochange'))).toMatchObject({ text: '🤖 바꾼 것 없음', tone: 'wait' });
    expect(claudeTurnBadge(turn(1, 1, 'failed'))).toMatchObject({ text: '❌ 실패', tone: 'bad' });
    expect(claudeTurnBadge(turn(1, 1, 'deployed'))).toMatchObject({ text: '✅ 배포됨', tone: 'ok' });
    expect(claudeTurnBadge(turn(2, 1, 'dropped'))).toMatchObject({ text: '⚠ 보내지 못함', tone: 'bad' });
    expect(claudeTurnBadge(turn(2, 1, 'asking'))).toMatchObject({ text: '🤖 보내는 중', tone: 'wait' });
  });

  it('끝난 요청 - 배포됨·바꾼 것 없음·실패만, 배포 중은 아직이다 (함수가 받지 않는다)', () => {
    expect(['deployed', 'nochange', 'failed'].every((s) => claudeFinished(s as ClaudeRequestState))).toBe(true);
    expect(['queued', 'sending', 'sent', 'working', 'merged'].some((s) => claudeFinished(s as ClaudeRequestState))).toBe(false);
  });

  it('보낼 수 있나 - 끝났고 보내는 중인 턴이 없고 턴을 받았을 때', () => {
    const done = turnsForView([turn(1, 10)], req, {});
    expect(claudeBusy(req, [turn(1, 10)], done)).toBe(false);
    expect(claudeBusy({ ...req, state: 'merged' }, [turn(1, 10)], done)).toBe(true);
    expect(claudeBusy(req, null, [])).toBe(true);
    expect(claudeBusy(req, [turn(1, 10)], turnsForView([turn(1, 10)], req, { claudeAskAt: 20, claudeFollow: { at: 20, text: '더' } }))).toBe(true);
  });
});

describe('새 답 (P23-3)', () => {
  const ask = (state: ClaudeRequestState, more = {}) => readClaudeRequest({ state, issue: 1, url: null, note: '', ...more }) ?? undefined;

  it('서버 문서의 시각을 읽는다 - 없거나 숫자가 아니면 칸이 없다', () => {
    expect(ask('deployed', { answeredAt: 100, seenAt: 50 })).toMatchObject({ answeredAt: 100, seenAt: 50 });
    expect(ask('deployed', { answeredAt: 'x' })).not.toHaveProperty('answeredAt');
    expect(ask('deployed')).not.toHaveProperty('seenAt');
  });

  it('끝 상태 셋 모두 아직 안 봤으면 그 시각', () => {
    for (const state of ['deployed', 'nochange', 'failed'] as const) expect(claudeNewAnswerAt(ask(state, { answeredAt: 100 }))).toBe(100);
  });

  it('본 답이면 없음 - 본 값을 그대로 적으므로 기기 시계가 달라도 같다', () => {
    expect(claudeNewAnswerAt(ask('deployed', { answeredAt: 100, seenAt: 100 }))).toBeNull();
  });

  it('전에 본 답 뒤에 온 답은 새 답', () => {
    expect(claudeNewAnswerAt(ask('deployed', { answeredAt: 200, seenAt: 100 }))).toBe(200);
  });

  it('옛 문서(시각 없음)·없는 문서는 없음', () => {
    expect(claudeNewAnswerAt(ask('deployed'))).toBeNull();
    expect(claudeNewAnswerAt(undefined)).toBeNull();
  });

  it('이어 보내 도는 동안은 없음 - 앞 답을 보지 않았어도 지금 답이 아니다', () => {
    for (const state of ['queued', 'sending', 'sent', 'working', 'merged'] as const) expect(claudeNewAnswerAt(ask(state, { answeredAt: 100 }))).toBeNull();
  });
});

describe('답 알림 (P23-3)', () => {
  const req = (state: ClaudeRequestState, more: Partial<ClaudeRequest> = {}): ClaudeRequest => ({ state, issue: 1, url: null, note: '', ...more });

  it('답이 새로 온 메모만 - 도는 요청이 끝났을 때', () => {
    expect(claudeAnsweredNow({ a: req('working') }, { a: req('deployed', { answeredAt: 100 }) })).toEqual(['a']);
    expect(claudeAnsweredNow({ a: req('merged', { answeredAt: 50, seenAt: 50 }) }, { a: req('deployed', { answeredAt: 100, seenAt: 50 }) })).toEqual(['a']);
  });

  it('앱을 열 때 처음 받은 것은 안내하지 않는다 - 카드 새 답이 알린다', () => {
    expect(claudeAnsweredNow({}, { a: req('deployed', { answeredAt: 100 }) })).toEqual([]);
  });

  it('같은 답이 다시 와도(다른 칸이 바뀌어도) 한 번만', () => {
    expect(claudeAnsweredNow({ a: req('deployed', { answeredAt: 100 }) }, { a: req('deployed', { answeredAt: 100, note: '바뀜' }) })).toEqual([]);
  });

  it('다른 기기에서 이미 봤으면 없다', () => {
    expect(claudeAnsweredNow({ a: req('working') }, { a: req('deployed', { answeredAt: 100, seenAt: 100 }) })).toEqual([]);
  });

  it('주소의 ?claude= - 메모 id 모양만', () => {
    expect(claudeParamOf('?claude=abcDEF123')).toBe('abcDEF123');
    expect(claudeParamOf('?as=5&claude=abc')).toBe('abc');
    expect(claudeParamOf('')).toBeNull();
    expect(claudeParamOf('?claude=../x')).toBeNull();
    expect(claudeParamOf(`?claude=${'a'.repeat(41)}`)).toBeNull();
  });

  it('주소에서 ?claude=만 지운다 - 다른 값과 # 뒤는 둔다', () => {
    expect(stripClaudeParam('https://x.web.app/?claude=abc#/memo')).toBe('/#/memo');
    expect(stripClaudeParam('https://x.web.app/?as=5&claude=abc#/day/2026-11-05')).toBe('/?as=5#/day/2026-11-05');
  });
});
