import { describe, expect, it } from 'vitest';
import type { LabelTree } from '../../data/select';
import type { ItemDoc } from '../events/eventOps';
import { createNoteData, hasContent, newNoteForm, noteEditChanges, noteFormOf, placeChanges, sameNoteForm, savePlanOf } from './noteForm';

const label = (id: string, name: string) => ({ id, name, color: 'blue', kind: 'note', parentId: null, order: 'a0' });
const tree = {
  list: [label('L1', '학급'), label('L2', '상담')],
  byId: new Map([
    ['L1', label('L1', '학급')],
    ['L2', label('L2', '상담')],
  ]),
  parents: {},
  rows: [],
  defaultId: 'L1',
} as unknown as LabelTree;
const item = (more: Partial<ItemDoc> = {}): ItemDoc =>
  ({ id: 'n1', kind: 'note', date: '2026-10-08', text: '회의', labelIds: ['L1'], order: 'a0', ...more }) as unknown as ItemDoc;

describe('새 칸', () => {
  it('미리 고른 라벨이 없으면 맨 위 라벨, 날짜 없음 = 메모', () => {
    expect(newNoteForm('2026-10-08', tree)).toMatchObject({ date: '2026-10-08', labelIds: ['L1'], text: '' });
    expect(newNoteForm(null, tree).date).toBe('');
    expect(newNoteForm(null, tree, ['L2', 'gone']).labelIds).toEqual(['L2']);
    expect(newNoteForm(null, tree, [], '공유받은 글').text).toBe('공유받은 글');
  });

  it('새 문서: 날짜 없으면 메모(null), 켠 완료·즐겨찾기·첨부·표만', () => {
    const form = { ...newNoteForm(null, tree), done: true, favorite: true };
    expect(createNoteData(form, '글', ['L1'], 'a5', 7)).toEqual({
      kind: 'note',
      date: null,
      text: '글',
      labelIds: ['L1'],
      order: 'a5',
      done: true,
      doneAt: 7,
      favorite: true,
    });
    expect(createNoteData(newNoteForm('2026-10-08', tree), '글', [], 'a0')).toEqual({ kind: 'note', date: '2026-10-08', text: '글', labelIds: [], order: 'a0' });
  });

  it('저장할 것이 있나 = 글·첨부·표 가운데 하나', () => {
    expect(hasContent({ text: '  ', attachments: [], tables: [] })).toBe(false);
    expect(hasContent({ text: '', attachments: [{ name: 'a', url: 'u', type: 'file' }], tables: [] })).toBe(true);
  });
});

describe('#라벨·새 라벨', () => {
  it('첫·마지막 줄 #이름은 떼고 이름을 모은다 (새 라벨이 먼저, 겹치면 하나)', () => {
    const form = { ...newNoteForm(null, tree), text: '#회의\n오늘 할 일\n#학급 #새것', newLabels: ['새것', '따로'] };
    expect(savePlanOf(form)).toEqual({ text: '오늘 할 일', names: ['새것', '따로', '회의', '학급'] });
  });
  it('#줄이 없으면 글은 앞뒤 빈칸만 다듬는다', () => {
    expect(savePlanOf({ ...newNoteForm(null, tree), text: '  글 #가운데 \n' })).toEqual({ text: '글 #가운데', names: [] });
  });
});

describe('고치기 = 바뀐 칸만', () => {
  it('글·라벨만 바뀌면 그것만, 완료·즐겨찾기는 견주지 않는다', () => {
    const it0 = item({ done: true });
    const form = { ...noteFormOf(it0), done: false };
    expect(noteEditChanges(it0, form, '회의', ['L1'])).toEqual({});
    expect(noteEditChanges(it0, form, '회의 끝', ['L1', 'L2'])).toEqual({ text: '회의 끝', labelIds: ['L1', 'L2'] });
    expect(sameNoteForm(noteFormOf(it0), form, false)).toBe(true);
    expect(sameNoteForm(noteFormOf(it0), form, true)).toBe(false);
  });

  it('첨부·표를 모두 빼면 칸을 지운다', () => {
    const it0 = item({ attachments: [{ name: 'a', url: 'u', type: 'file' }] });
    expect(noteEditChanges(it0, { ...noteFormOf(it0), attachments: [] }, '회의', ['L1'])).toEqual({ attachments: undefined });
  });

  it('자리: 기록 → 메모는 fromDate를 남기고, 메모 → 기록은 걷고, 기록 → 다른 날은 date만', () => {
    expect(placeChanges({ date: '2026-10-08' }, null)).toEqual({ date: null, fromDate: '2026-10-08' });
    expect(placeChanges({ date: null, fromDate: '2026-10-06' }, '2026-10-09')).toEqual({ date: '2026-10-09', fromDate: undefined });
    expect(placeChanges({ date: '2026-10-08' }, '2026-10-09')).toEqual({ date: '2026-10-09' });
    expect(placeChanges({ date: '2026-10-08' }, '2026-10-08')).toEqual({});
    const it0 = item();
    expect(noteEditChanges(it0, { ...noteFormOf(it0), date: '' }, '회의', ['L1'])).toEqual({ date: null, fromDate: '2026-10-08' });
  });
});
