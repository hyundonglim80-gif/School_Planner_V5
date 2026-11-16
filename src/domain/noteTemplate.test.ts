import { describe, expect, it } from 'vitest';
import {
  MAX_NOTE_TEMPLATES,
  applyTemplate,
  cleanTemplateName,
  nextTemplateOrder,
  readNoteTemplates,
  resolveTemplateLabels,
  templateFromForm,
  templateLimitError,
  templateMove,
  templateNameOf,
  templateRemove,
  templateRename,
  templateWrite,
  uncheckAll,
  type NoteTemplate,
  type TemplateLabelTree,
} from './noteTemplate';
import type { EntryTable } from '../data/types';

/** 라벨 트리: 업무(위) › 회의(아래) · 수업 · 다른 공간에도 같은 이름이 있는지 보려고 둘 */
function treeOf(labels: { id: string; name: string; parent?: string }[]): TemplateLabelTree {
  const list = labels.map(({ id, name }) => ({ id, name }));
  return {
    list,
    byId: new Map(list.map((l) => [l.id, l])),
    parents: Object.fromEntries(labels.filter((l) => l.parent).map((l) => [l.id, l.parent as string])),
  };
}
const MINE = treeOf([
  { id: 'w', name: '업무' },
  { id: 'm', name: '회의', parent: 'w' },
  { id: 's', name: '수업' },
]);
const GROUP = treeOf([
  { id: 'gw', name: '업무' },
  { id: 'gm', name: '회의', parent: 'gw' },
  { id: 'gx', name: '회의' }, // 상위가 없는 같은 이름
]);

const table = (id: string): EntryTable => ({ id, rows: [{ cells: [{ v: '가' }, { v: '나' }] }], createdAt: 1 }) as unknown as EntryTable;

const tpl = (over: Partial<NoteTemplate> = {}): NoteTemplate => ({
  id: 'a',
  name: '회의록',
  text: '회의록\n☐ 안건',
  labels: [{ id: 'm', name: '회의', parent: '업무' }],
  sid: 'u_me',
  tables: [],
  order: 0,
  at: 10,
  ...over,
});

describe('읽기', () => {
  it('틀마다 칸 t.<id> → 차례대로, 모양이 틀리거나 빈 틀은 건너뛴다', () => {
    const list = readNoteTemplates({
      t: {
        b: { name: '둘째', text: 'B', order: 1, at: 1, sid: 'u_me', labels: [] },
        a: { name: '첫째', text: 'A', order: 0, at: 2, sid: 'u_me', labels: [{ id: 'm', name: '회의', parent: '업무' }, { id: 'x' }] },
        c: 'abc',
        d: { name: '빈 틀', text: '  ' },
        e: { text: '이름 없는 틀\n둘째 줄', order: 2 },
      },
      updatedAt: 1,
    });
    expect(list.map((t) => t.id)).toEqual(['a', 'b', 'e']);
    expect(list[0].labels).toEqual([{ id: 'm', name: '회의', parent: '업무' }]);
    expect(list[2].name).toBe('이름 없는 틀');
    expect(list[2].tables).toEqual([]);
  });
  it('문서가 없거나 틀이 없으면 빈 목록', () => {
    expect(readNoteTemplates(null)).toEqual([]);
    expect(readNoteTemplates({ updatedAt: 1 })).toEqual([]);
  });
  it('표만 있는 틀도 읽는다', () => {
    expect(readNoteTemplates({ t: { a: { name: '표', text: '', tables: [table('x'), 3] } } })[0].tables).toHaveLength(1);
  });
});

describe('글', () => {
  it('체크 줄은 모두 ☐ (들여쓰기 그대로, 줄 가운데 ☑는 그대로)', () => {
    expect(uncheckAll('할 일\n☑ 우유\n  ☑ 빵\n☐ 쌀\n글 ☑ 가운데')).toBe('할 일\n☐ 우유\n  ☐ 빵\n☐ 쌀\n글 ☑ 가운데');
  });
  it('이름 = 첫 줄(체크 글자는 떼고, 길면 자른다), 없으면 틀 n', () => {
    expect(templateNameOf('\n  학부모 상담 \n내용', [])).toBe('학부모 상담');
    expect(templateNameOf('☐ 준비물', [])).toBe('준비물');
    expect(templateNameOf('가'.repeat(60), [])).toHaveLength(40);
    expect(templateNameOf('', [tpl({ name: '틀 2' })])).toBe('틀 3');
    expect(templateNameOf('  ', [tpl({ name: '틀 2' }), tpl({ id: 'b', name: '틀 3' })])).toBe('틀 4');
  });
  it('이름 다듬기 - 빈 이름은 null', () => {
    expect(cleanTemplateName('  주간   계획 ')).toBe('주간 계획');
    expect(cleanTemplateName('   ')).toBeNull();
  });
});

describe('메모 칸 → 틀', () => {
  it('글(체크 ☐·앞뒤 빈칸 다듬기)·라벨(id + 이름 + 상위)·새 라벨 이름·표', () => {
    const t = templateFromForm(
      { text: '  회의록\n☑ 안건\n', labelIds: ['m', 'gone'], newLabels: ['새것'], tables: [table('t1')] },
      MINE,
      { id: 'n', sid: 'u_me', name: '회의록', order: 3, now: 99 },
    );
    expect(t).toMatchObject({ id: 'n', sid: 'u_me', name: '회의록', order: 3, at: 99, text: '회의록\n☐ 안건' });
    expect(t.labels).toEqual([
      { id: 'm', name: '회의', parent: '업무' },
      { id: '', name: '새것' },
    ]);
    expect(t.tables).toHaveLength(1);
  });
});

describe('틀 라벨 → 이 공간의 라벨', () => {
  it('같은 공간이고 라벨이 있으면 id 그대로', () => {
    expect(resolveTemplateLabels(tpl(), MINE, 'u_me')).toEqual({ labelIds: ['m'], newLabels: [] });
  });
  it('다른 공간(그룹)이면 이름과 상위 이름이 같은 라벨', () => {
    expect(resolveTemplateLabels(tpl(), GROUP, 'g_1')).toEqual({ labelIds: ['gm'], newLabels: [] });
  });
  it('상위가 없는 틀 라벨은 상위가 없는 같은 이름부터', () => {
    expect(resolveTemplateLabels(tpl({ labels: [{ id: 'x', name: '회의' }] }), GROUP, 'g_1').labelIds).toEqual(['gx']);
  });
  it('같은 공간인데 그 라벨을 지웠으면 이름으로 찾는다', () => {
    const renamed = treeOf([{ id: 'w2', name: '업무' }, { id: 'm2', name: '회의', parent: 'w2' }]);
    expect(resolveTemplateLabels(tpl(), renamed, 'u_me').labelIds).toEqual(['m2']);
  });
  it('없으면 새 라벨 이름 (하위는 상위-하위)', () => {
    expect(resolveTemplateLabels(tpl({ labels: [{ id: 'm', name: '회의', parent: '업무' }, { id: '', name: '새것' }] }), treeOf([]), 'g_1')).toEqual({
      labelIds: [],
      newLabels: ['업무-회의', '새것'],
    });
  });
});

describe('채우기', () => {
  const form = { text: '', labelIds: ['s'], newLabels: [], tables: [], dates: ['2027-03-02'], done: true };
  it('글·표·라벨만 틀 것으로 - 날짜·완료는 그대로, 표는 새 id', () => {
    let n = 0;
    const out = applyTemplate(form, tpl({ tables: [table('t1')] }), MINE, 'u_me', () => `new${++n}`, 5);
    expect(out.text).toBe('회의록\n☐ 안건');
    expect(out.labelIds).toEqual(['m']);
    expect(out.dates).toEqual(['2027-03-02']);
    expect(out.done).toBe(true);
    expect(out.tables[0]).toMatchObject({ id: 'new1', createdAt: 5 });
  });
  it('틀에 라벨이 없으면 칸의 라벨 그대로', () => {
    expect(applyTemplate(form, tpl({ labels: [] }), MINE, 'u_me', () => 'x').labelIds).toEqual(['s']);
  });
});

describe('쓰기 칸', () => {
  it('새 틀 = 칸 t.<id> 하나 (빈 표 칸은 없다)', () => {
    expect(templateWrite(tpl(), false)).toEqual({
      't.a': { name: '회의록', text: '회의록\n☐ 안건', labels: [{ id: 'm', name: '회의', parent: '업무' }], sid: 'u_me', order: 0, at: 10 },
    });
  });
  it('있는 틀 = 그 틀의 칸마다 (빈 표는 칸 지우기)', () => {
    expect(templateWrite(tpl(), true)).toEqual({
      't.a.name': '회의록',
      't.a.text': '회의록\n☐ 안건',
      't.a.labels': [{ id: 'm', name: '회의', parent: '업무' }],
      't.a.sid': 'u_me',
      't.a.tables': undefined,
      't.a.order': 0,
      't.a.at': 10,
    });
    expect(Object.hasOwn(templateWrite(tpl(), true), 't.a.tables')).toBe(true);
  });
  it('지우기·이름 바꾸기', () => {
    expect(templateRemove('a')).toEqual({ 't.a': undefined });
    expect(templateRename('a', '새 이름')).toEqual({ 't.a.name': '새 이름' });
  });
  it('새 차례 = 맨 아래', () => {
    expect(nextTemplateOrder([])).toBe(0);
    expect(nextTemplateOrder([tpl({ order: 4 }), tpl({ id: 'b', order: 1 })])).toBe(5);
  });
  it('▲▼ = 옮긴 차례로 0, 1, 2 … 바뀐 것만 · 끝이면 null', () => {
    const list = [tpl({ id: 'a', order: 0 }), tpl({ id: 'b', order: 1 }), tpl({ id: 'c', order: 2 })];
    expect(templateMove(list, 'c', -1)).toEqual({ 't.c.order': 1, 't.b.order': 2 });
    expect(templateMove(list, 'a', -1)).toBeNull();
    expect(templateMove(list, 'c', 1)).toBeNull();
    // 차례가 같은 옛 틀도 다시 매긴다 (b는 이미 0)
    const same = [tpl({ id: 'a', order: 0 }), tpl({ id: 'b', order: 0 })];
    expect(templateMove(same, 'a', 1)).toEqual({ 't.a.order': 1 });
    expect(readNoteTemplates({ t: { a: { ...tpl(), order: 1 }, b: { ...tpl({ id: 'b' }), order: 0 } } }).map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('한도', () => {
  it(`${MAX_NOTE_TEMPLATES}개까지 - 있는 틀을 바꾸는 것은 된다`, () => {
    const list = Array.from({ length: MAX_NOTE_TEMPLATES }, (_, i) => tpl({ id: `t${i}`, order: i }));
    expect(templateLimitError(list, tpl({ id: 'new' }))).toMatch(/30개/);
    expect(templateLimitError(list, tpl({ id: 't3', text: '바꿈' }))).toBeNull();
  });
  it('문서가 너무 크면(큰 표) 안내', () => {
    const big = tpl({ text: '가'.repeat(320_000) });
    expect(templateLimitError([], big)).toMatch(/너무 큽니다/);
    expect(templateLimitError([], tpl())).toBeNull();
  });
});
