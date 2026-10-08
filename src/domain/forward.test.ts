import { describe, expect, it } from 'vitest';
import { carriedOf, carriedSince, forwardOn, forwardWindowStart, isCarried, type ForwardItem, type LabelForward } from './forward';

const labels: LabelForward = new Map([
  ['fwd', true],
  ['cal', false],
]);
const TODAY = '2026-10-08';
const ev = (over: Partial<ForwardItem> = {}): ForwardItem => ({ kind: 'event', date: '2026-10-05', text: '공문', labelIds: ['fwd'], ...over });

describe('forwardOn - 이월 판단', () => {
  it('붙은 라벨 하나라도 이월이면 켬', () => {
    expect(forwardOn(ev(), labels)).toBe(true);
    expect(forwardOn(ev({ labelIds: ['cal', 'fwd'] }), labels)).toBe(true);
    expect(forwardOn(ev({ labelIds: ['cal'] }), labels)).toBe(false);
  });
  it('이 일정만 정한 값이 라벨을 이긴다', () => {
    expect(forwardOn(ev({ props: { forward: false } }), labels)).toBe(false);
    expect(forwardOn(ev({ labelIds: ['cal'], props: { forward: true } }), labels)).toBe(true);
  });
  it('아는 라벨이 없으면 흔적(carrying)을 믿는다 - 라벨이 하나라도 풀리면 라벨이 정답', () => {
    expect(forwardOn(ev({ labelIds: ['gone'] }), labels)).toBe(false);
    expect(forwardOn(ev({ labelIds: ['gone'], carrying: true }), labels)).toBe(true);
    expect(forwardOn(ev({ labelIds: [], carrying: true }), labels)).toBe(true);
    expect(forwardOn(ev({ labelIds: ['cal', 'gone'], carrying: true }), labels)).toBe(false);
  });
});

describe('isCarried - 오늘로 따라오나', () => {
  it('끝내지 않은 지난 이월 일정', () => {
    expect(isCarried(ev(), labels, TODAY, 14)).toBe(true);
  });
  it('오늘·앞날·끝낸 것·지운 것·메모·빈 글은 아니다', () => {
    expect(isCarried(ev({ date: TODAY }), labels, TODAY, 14)).toBe(false);
    expect(isCarried(ev({ date: '2026-10-09' }), labels, TODAY, 14)).toBe(false);
    expect(isCarried(ev({ done: true }), labels, TODAY, 14)).toBe(false);
    expect(isCarried(ev({ deletedAt: { seconds: 1 } }), labels, TODAY, 14)).toBe(false);
    expect(isCarried(ev({ kind: 'note' }), labels, TODAY, 14)).toBe(false);
    expect(isCarried(ev({ text: '  ' }), labels, TODAY, 14)).toBe(false);
    expect(isCarried(ev({ date: null }), labels, TODAY, 14)).toBe(false);
  });
  it('기간 일정은 따라오지 않는다', () => {
    expect(isCarried(ev({ date: '2026-10-01', endDate: '2026-10-03' }), labels, TODAY, 14)).toBe(false);
  });
  it('이월 기간 안이면 따라오고, 밖이면 이미 따라오던 것(carrying)만', () => {
    expect(forwardWindowStart(TODAY, 14)).toBe('2026-09-24');
    expect(isCarried(ev({ date: '2026-09-24' }), labels, TODAY, 14)).toBe(true);
    expect(isCarried(ev({ date: '2026-09-23' }), labels, TODAY, 14)).toBe(false);
    expect(isCarried(ev({ date: '2026-09-23', carrying: true }), labels, TODAY, 14)).toBe(true);
    expect(isCarried(ev({ date: '2026-03-02', carrying: true }), labels, TODAY, 1)).toBe(true);
  });
  it('carrying이어도 이월을 끈 일정은 따라오지 않는다', () => {
    expect(isCarried(ev({ carrying: true, props: { forward: false } }), labels, TODAY, 14)).toBe(false);
    expect(isCarried(ev({ carrying: true, labelIds: ['cal'] }), labels, TODAY, 14)).toBe(false);
  });
  it('carriedOf는 주어진 차례 그대로 고른다', () => {
    const list = [ev({ text: 'a' }), ev({ text: 'b', done: true }), ev({ text: 'c', date: '2026-10-07' })];
    expect(carriedOf(list, labels, TODAY, 14).map((d) => d.text)).toEqual(['a', 'c']);
  });
});

describe('carriedSince', () => {
  it('처음 날 = carriedFrom → 없으면 date', () => {
    expect(carriedSince(ev())).toBe('2026-10-05');
    expect(carriedSince(ev({ date: '2026-10-07', carriedFrom: '2026-10-01' }))).toBe('2026-10-01');
  });
});
