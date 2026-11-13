import { describe, expect, it } from 'vitest';
import type { LabelTree } from '../../data/select';
import type { ItemDoc } from '../events/eventOps';
import { createNoteData, hasContent, newNoteForm, noteEditChanges, noteEditedKeys, noteFormAfterSave, noteFormOf, noteTextClash, sameNoteForm, savePlanOf } from './noteForm';

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

describe('저장이 끝난 뒤 칸 (P22-2)', () => {
  const sent = { ...newNoteForm('2026-10-08', tree), text: '글\n#상담', newLabels: ['새 라벨'] };
  const saved = { ...sent, text: '글', labelIds: ['L1', 'L2', 'L9'], newLabels: [] };

  it('그새 손대지 않았으면 저장된 모습 그대로', () => {
    expect(noteFormAfterSave(sent, sent, saved)).toEqual(saved);
  });

  it('그새 고친 칸은 고친 그대로, 나머지 칸은 저장된 모습으로', () => {
    const now = { ...sent, text: '글\n#상담\n더 친 글' };
    expect(noteFormAfterSave(now, sent, saved)).toEqual({ ...saved, text: '글\n#상담\n더 친 글' });
  });

  it('그새 붙인 첨부도 남는다', () => {
    const file = { name: 'a.png', url: 'https://d/a' } as unknown as (typeof sent.attachments)[number];
    const now = { ...sent, attachments: [file] };
    expect(noteFormAfterSave(now, sent, saved).attachments).toEqual([file]);
  });
});

describe('새 칸', () => {
  it('미리 고른 라벨이 없으면 맨 위 라벨, 연 날 = 날짜 링크 하나 (없으면 날짜 없는 메모)', () => {
    expect(newNoteForm('2026-10-08', tree)).toMatchObject({ dates: ['2026-10-08'], labelIds: ['L1'], text: '' });
    expect(newNoteForm(null, tree).dates).toEqual([]);
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
    const two = { ...newNoteForm('2026-10-08', tree), dates: ['2026-10-09', '2026-10-08'] };
    expect(createNoteData(two, '글', [], 'a0')).toMatchObject({ date: '2026-10-08', dates: ['2026-10-08', '2026-10-09'] });
  });

  it('저장할 것이 있나 = 글·첨부·표 가운데 하나 (제목 칸은 없다 - P35)', () => {
    expect(hasContent({ text: '  ', attachments: [], tables: [] })).toBe(false);
    expect(hasContent({ text: '연수', attachments: [], tables: [] })).toBe(true);
    expect(hasContent({ text: '', attachments: [{ name: 'a', url: 'u', type: 'file' }], tables: [] })).toBe(true);
  });
});

describe('#라벨·새 라벨', () => {
  it('첫·마지막 줄 #이름은 떼고 이름을 모은다 (새 라벨이 먼저, 겹치면 하나)', () => {
    const form = { ...newNoteForm(null, tree), text: '#회의\n오늘 할 일\n#학급 #새것', newLabels: ['새것', '따로'] };
    expect(savePlanOf(form)).toEqual({ text: '오늘 할 일', names: ['새것', '따로', '회의', '학급'] });
  });
  it('첨부·표가 있으면 글이 #줄 하나뿐이어도 라벨로 (10-19 #업무-출장)', () => {
    const base = { ...newNoteForm(null, tree), text: '#업무-출장' };
    expect(savePlanOf({ ...base, attachments: [{ name: 'a', url: 'u', type: 'file' }] })).toEqual({ text: '', names: ['업무-출장'] });
    // 글뿐이면 그대로 둔다 (지우면 빈 메모가 된다)
    expect(savePlanOf(base)).toEqual({ text: '#업무-출장', names: [] });
  });
  it('#줄이 없으면 글은 앞뒤 빈칸만 다듬는다', () => {
    expect(savePlanOf({ ...newNoteForm(null, tree), text: '  글 #가운데 \n' })).toEqual({ text: '글 #가운데', names: [] });
  });
});

describe('제목 칸 없음 = 첫 줄이 제목 (P35)', () => {
  it('새 칸·새 문서에 제목 칸이 없다', () => {
    expect('title' in newNoteForm(null, tree)).toBe(false);
    expect(createNoteData(newNoteForm(null, tree), '회의\n내용', [], 'a0')).not.toHaveProperty('title');
  });

  it('예전 제목은 칸을 열 때 글 첫 줄로 - 손대지 않으면 쓰지 않는다', () => {
    const old = item({ title: '연수', text: '내용' });
    const form = noteFormOf(old);
    expect(form.text).toBe('연수\n내용');
    expect(noteEditChanges(old, form, '연수\n내용', ['L1'])).toEqual({});
    // 라벨만 바꾸면 제목·글 그대로
    expect(noteEditChanges(old, form, '연수\n내용', ['L2'])).toEqual({ labelIds: ['L2'] });
  });

  it('글을 고쳐 저장하면 글에 담고 제목 칸은 지운다 (첫 줄을 지워도)', () => {
    const old = item({ title: '연수', text: '내용' });
    expect(noteEditChanges(old, noteFormOf(old), '연수 안내\n내용', ['L1'])).toEqual({ text: '연수 안내\n내용', title: undefined });
    expect(noteEditChanges(old, noteFormOf(old), '내용', ['L1'])).toEqual({ text: '내용', title: undefined });
    // 제목이 없던 메모는 글만
    const plain = item({ text: '회의' });
    expect(noteEditChanges(plain, noteFormOf(plain), '회의 끝', ['L1'])).toEqual({ text: '회의 끝' });
  });

  it('두 기기: 글을 고치면 제목 칸도 이 기기가 바꾼 칸 · 겹침은 글로만 본다', () => {
    const old = item({ title: '연수', text: '내용' });
    const base = noteFormOf(old);
    const next = { ...base, text: '연수\n내용 더' };
    const edited = noteEditedKeys(base, next);
    expect([...edited].sort()).toEqual(['text', 'title']);
    expect(noteEditChanges(old, next, next.text, ['L1'], edited)).toEqual({ text: '연수\n내용 더', title: undefined });
    expect(noteEditedKeys(base, { ...base, labelIds: ['L2'] }).has('title')).toBe(false);
    // 다른 기기가 예전 제목을 바꿨으면 글이 다르다 = 묻는다
    expect(noteTextClash(base, noteFormOf(item({ title: '연수 2', text: '내용' })), edited)).toBe(true);
    expect(noteTextClash(base, noteFormOf(old), edited)).toBe(false);
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

  it('날짜 링크: 더하면 dates, 다 빼면 date null (옛 fromDate는 적지 않는다), 같은 날짜들이면 바뀐 것 없음', () => {
    const it0 = item();
    expect(noteEditChanges(it0, { ...noteFormOf(it0), dates: ['2026-10-08', '2026-10-10'] }, '회의', ['L1'])).toEqual({ dates: ['2026-10-08', '2026-10-10'] });
    expect(noteEditChanges(it0, { ...noteFormOf(it0), dates: [] }, '회의', ['L1'])).toEqual({ date: null });
    const two = item({ dates: ['2026-10-08', '2026-10-10'] });
    expect(noteEditChanges(two, { ...noteFormOf(two), dates: ['2026-10-10', '2026-10-08'] }, '회의', ['L1'])).toEqual({});
    expect(noteEditChanges(two, { ...noteFormOf(two), dates: ['2026-10-10'] }, '회의', ['L1'])).toEqual({ date: '2026-10-10', dates: undefined });
  });
});
