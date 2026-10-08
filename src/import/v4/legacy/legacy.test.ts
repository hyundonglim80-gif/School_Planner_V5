import { describe, expect, it } from 'vitest';
import { eventContentOf, parseV3EventText, readEventList } from './eventText';
import { readEvalList } from './evalList';
import { normalizeEventLabel, resolveEventLabelNames, V4_DEFAULT_EVENT_LABELS } from './eventLabels';
import { entryJournalId, mergeEntryLabels, mergeEntryTrees } from './entryLabels';
import { readLabelTree, sanitizeParents } from './labelTree';

// V4 테스트째 옮겼다 (lib/eventText·evalList·eventLabels·entryLabels·labelTree.test, hooks/useLabels.test). 쓰는 쪽 테스트는 뺐다.

describe('eventContentOf', () => {
  it('content를 먼저, 없으면 text, 앞뒤 빈칸을 뗀다', () => {
    expect(eventContentOf({ content: '회의' })).toBe('회의');
    expect(eventContentOf({ text: '회의' })).toBe('회의');
    expect(eventContentOf({ content: '회의', text: '다른값' })).toBe('회의');
    expect(eventContentOf({ content: '  회의  ' })).toBe('회의');
    expect(eventContentOf({})).toBe('');
    expect(eventContentOf(null)).toBe('');
  });
});

describe('parseV3EventText', () => {
  it('완료 표시와 라벨을 나눈다', () => {
    const [e] = parseV3EventText('[v] [이월] 학년 협의회');
    expect(e).toMatchObject({ completed: true, label: '이월', content: '학년 협의회' });
  });

  it('라벨이 없으면 label이 비고, 빈 줄은 건너뛴다', () => {
    expect(parseV3EventText('부장 회의')[0]).toMatchObject({ label: undefined, completed: false, content: '부장 회의' });
    expect(parseV3EventText('회의\n\n\n안전점검')).toHaveLength(2);
    expect(parseV3EventText('')).toEqual([]);
    expect(parseV3EventText('   ')).toEqual([]);
  });
});

describe('readEventList', () => {
  it('eventList가 있으면 그것, 비었으면 옛 eventText, eventList 칸이 없는 V3 문서도', () => {
    expect(readEventList({ eventList: [{ id: '1', content: '회의' }], eventText: '옛날 내용' }).map((e) => e.content)).toEqual(['회의']);
    expect(readEventList({ eventList: [], eventText: '회의\n안전점검' })).toHaveLength(2);
    expect(readEventList({ eventText: '회의' })).toHaveLength(1);
    expect(readEventList({})).toEqual([]);
    expect(readEventList(null)).toEqual([]);
  });

  it('V3가 id 없이 쓴 항목에는 V4 화면과 같은 ev_차례 id를 붙인다', () => {
    const list = readEventList({
      eventList: [{ content: '회의', completed: false }, { id: 'ev_x', content: '청소' }, { content: '숙제', labelIds: ['a'] }],
    });
    expect(list.map((e) => e.id)).toEqual(['ev_0', 'ev_x', 'ev_2']);
    expect(list[2]).toEqual({ id: 'ev_2', content: '숙제', labelIds: ['a'] });
  });

  it('id가 있는 항목은 같은 객체를 그대로 돌려준다', () => {
    const item = { id: 'ev_a', content: '회의', forwardChainId: 'c1' };
    expect(readEventList({ eventList: [item] })[0]).toBe(item);
  });
});

describe('readEvalList', () => {
  const A = { id: 'a', title: 'V4가 만든 조사' };
  const B = { id: 'b', title: 'V3에서 더한 조사' };

  it('한 이름만 있으면 그것 (V3는 evalList만, 9/14 전 V4는 list만)', () => {
    expect(readEvalList({ evalList: [B] })).toEqual([B]);
    expect(readEvalList({ list: [A] })).toEqual([A]);
    expect(readEvalList({})).toEqual([]);
    expect(readEvalList(null)).toEqual([]);
  });

  it('둘 다 있으면 evalList가 최신 - V3에서 더한 것·지운 것', () => {
    expect(readEvalList({ list: [A], evalList: [A, B] })).toEqual([A, B]);
    expect(readEvalList({ list: [A, B], evalList: [B] })).toEqual([B]);
    expect(readEvalList({ list: [A], evalList: [] })).toEqual([]);
  });

  it('겹치는 항목이 없으면 따로 만든 두 목록이라 합친다', () => {
    expect(readEvalList({ list: [A], evalList: [B] })).toEqual([B, A]);
  });
});

describe('normalizeEventLabel - V3·V4 두 이름', () => {
  const shared = (l: Record<string, unknown>) => ({
    ...l,
    showInCalendar: l.calendar,
    isSkip: l.skip,
    isForward: l.forward,
    isPeriod: l.period,
    isRecur: l.recur,
  });

  it('V4가 두 이름으로 쓴 것은 그대로', () => {
    const l = normalizeEventLabel(shared({ id: 'ev_3', name: '이월', color: 'green', calendar: false, forward: true, skip: false, period: false, recur: false }), 0);
    expect(l).toMatchObject({ forward: true, calendar: false, skip: false });
  });

  it('V3에서 속성을 끄면(V3 이름만 바뀜) 꺼진 것으로 읽는다', () => {
    const saved = shared({ id: 'ev_3', name: '이월', color: 'green', calendar: false, forward: true, skip: true, period: true, recur: true });
    Object.assign(saved, { isForward: false, isSkip: false, isPeriod: false, isRecur: false, showInCalendar: true });
    expect(normalizeEventLabel(saved, 0)).toMatchObject({ forward: false, skip: false, period: false, recur: false, calendar: true });
  });

  it('한쪽 이름만 있으면 그것, 없으면 달력만 켜짐', () => {
    expect(normalizeEventLabel({ id: 'a', name: 'V3', isForward: true, showInCalendar: false }, 0)).toMatchObject({ forward: true, calendar: false });
    expect(normalizeEventLabel({ id: 'b', name: 'V4', forward: true, calendar: false }, 0)).toMatchObject({ forward: true, calendar: false });
    expect(normalizeEventLabel({ id: 'c', name: '없음' }, 0)).toMatchObject({ forward: false, calendar: true, color: 'blue' });
  });

  it('id가 없으면 ev_차례_이름', () => {
    expect(normalizeEventLabel({ name: '회의' }, 3).id).toBe('ev_3_회의');
  });

  it('V4 기본 라벨 다섯', () => {
    expect(V4_DEFAULT_EVENT_LABELS.map((l) => l.name)).toEqual(['달력', '수업X', '이월', '기간', '반복']);
  });
});

describe('resolveEventLabelNames', () => {
  const labels = [
    { id: 'ev_1', name: '회의' },
    { id: 'ev_2', name: '완료' },
  ];

  it('label(콤마로 이은 것·id)·labelIds(이름·id)·본문 앞 [이름]', () => {
    expect(resolveEventLabelNames({ label: '회의', content: '교직원 회의' }, labels)).toEqual(['회의']);
    expect(resolveEventLabelNames({ label: '회의,완료' }, labels)).toEqual(['회의', '완료']);
    expect(resolveEventLabelNames({ label: 'ev_1' }, labels)).toEqual(['회의']);
    expect(resolveEventLabelNames({ labelIds: ['ev_2'] }, labels)).toEqual(['완료']);
    expect(resolveEventLabelNames({ labelIds: ['완료'] }, labels)).toEqual(['완료']);
    expect(resolveEventLabelNames({ content: '[회의] 교직원 회의' }, labels)).toEqual(['회의']);
    expect(resolveEventLabelNames({ text: '[완료] 보고서' }, labels)).toEqual(['완료']);
  });

  it('등록되지 않은 라벨은 빼고, 여러 자리에 있어도 한 번만', () => {
    expect(resolveEventLabelNames({ label: '지워진라벨' }, labels)).toEqual([]);
    expect(resolveEventLabelNames({ label: '회의', labelIds: ['ev_1', '회의'], content: '[회의] 회의' }, labels)).toEqual(['회의']);
    expect(resolveEventLabelNames({ content: '그냥 일정' }, labels)).toEqual([]);
    expect(resolveEventLabelNames({}, labels)).toEqual([]);
  });
});

describe('mergeEntryLabels', () => {
  const J = [
    { id: 'j_1', name: '학급활동', color: 'green' },
    { id: 'j_2', name: '업무', color: 'blue', v3Extra: 1 },
  ];

  it('차례: 기록 라벨 → 메모에만 있는 것, 같은 이름은 하나(기록 id·색)', () => {
    const list = mergeEntryLabels(['긴급', '업무', ' 기타 '], J);
    expect(list.map((l) => l.name)).toEqual(['학급활동', '업무', '긴급', '기타']);
    expect(list[1]).toMatchObject({ id: 'j_2', color: 'blue', inJournal: true });
    expect(list[2]).toMatchObject({ id: entryJournalId('긴급'), inJournal: false });
    expect(entryJournalId(' 긴급 ')).toBe('jm_긴급');
  });

  it('같은 이름의 색이 다르면 기록 쪽 색, 메모 객체 색은 메모에만 있을 때', () => {
    const list = mergeEntryLabels([{ name: '업무', color: 'red' }, { name: '개인', color: 'pink' }], J);
    expect(list.find((l) => l.name === '업무')!.color).toBe('blue');
    expect(list.find((l) => l.name === '개인')!.color).toBe('pink');
  });

  it('대소문자·가운데 띄어쓰기가 다르면 다른 라벨, 빈 이름은 뺀다', () => {
    const list = mergeEntryLabels(['Work', 'work', '학급 활동', ''], J);
    expect(list.map((l) => l.name)).toEqual(['학급활동', '업무', 'Work', 'work', '학급 활동']);
  });

  it('트리 합치기: 같은 하위의 상위가 다르면 기록 쪽, 달랐던 하위를 알린다', () => {
    const { entry, conflicts } = mergeEntryTrees({ A초: '학교', 숙제: '할일' }, { A초: '학교', 숙제: '수업' });
    expect(entry).toEqual({ A초: '학교', 숙제: '수업' });
    expect(conflicts).toEqual(['숙제']);
  });
});

describe('readLabelTree', () => {
  it('저장된 트리를 다듬는다: 자기 자신·없는 라벨·3단계는 버린다', () => {
    const raw = { A초: '학교', 학교: '기관', 자기: '자기', 없는: '학교', B초: 7 };
    expect(sanitizeParents(raw, ['A초', '학교', '기관', '자기', 'B초'])).toEqual({ 학교: '기관' });
    expect(sanitizeParents(null)).toEqual({});
  });

  it('entry가 있으면 그것', () => {
    expect(readLabelTree({ entry: { A초: '학교' }, memo: { 숙제: '할일' }, journal: {} })).toEqual({ entry: { A초: '학교' }, conflicts: [] });
  });

  it('entry가 없으면 memo·journal을 합치고 상위가 다른 하위는 기록 쪽 + 알림', () => {
    const t = readLabelTree({ memo: { 숙제: '할일', B초: '학교' }, journal: { 숙제: '수업' } });
    expect(t.entry).toEqual({ 숙제: '수업', B초: '학교' });
    expect(t.conflicts).toEqual(['숙제']);
  });

  it('합쳐서 3단계가 되면 끊는다, 문서가 없으면 빈 트리', () => {
    expect(Object.keys(readLabelTree({ memo: { 학교: '기관' }, journal: { A초: '학교' } }).entry)).toHaveLength(1);
    expect(readLabelTree(undefined)).toEqual({ entry: {}, conflicts: [] });
  });
});
