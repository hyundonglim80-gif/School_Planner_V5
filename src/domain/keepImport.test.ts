import { describe, expect, it } from 'vitest';
import {
  assetKey,
  fileLooksLikeKeep,
  findExistingMemo,
  keepIdOf,
  memoNeedsUpdate,
  parseKeepFile,
  parseKeepNote,
  planKeepNote,
  selectNotesToImport,
  toMemoDraft,
  type ExistingMemo,
  type KeepImportOptions,
  type KeepNote,
} from './keepImport';

// V4 lib/keepImport.test.ts 그대로 (이미 있는 메모의 모양만 V5)
const OPTS: KeepImportOptions = { includeArchived: false, keepLabels: true };

describe('Keep 메모 읽기', () => {
  it('제목과 본문을 한 덩이로 붙인다', () => {
    expect(parseKeepNote({ title: '학부모 상담', textContent: '3시 김OO' })?.content).toBe('학부모 상담\n3시 김OO');
  });
  it('목록 메모는 체크 표시를 글자로 남긴다', () => {
    const note = parseKeepNote({ title: '준비물', listContent: [{ text: '색종이', isChecked: true }, { text: '풀', isChecked: false }] });
    expect(note?.content).toBe('준비물\n☑ 색종이\n☐ 풀');
  });
  it('라벨을 가져온다', () => {
    expect(parseKeepNote({ textContent: '메모', labels: [{ name: '업무' }, { name: '긴급' }] })?.labels).toEqual(['업무', '긴급']);
  });
  it('만든 때는 마이크로초라 밀리초로 (밀리초도 받는다)', () => {
    const ms = Date.UTC(2026, 2, 1);
    expect(parseKeepNote({ textContent: '메모', createdTimestampUsec: ms * 1000 })?.createdAt).toBe(ms);
    expect(parseKeepNote({ textContent: '메모', createdTimestampUsec: ms })?.createdAt).toBe(ms);
  });
  it('보관·휴지통·고정 표시를 읽는다', () => {
    expect(parseKeepNote({ textContent: '메모', isArchived: true, isTrashed: true, isPinned: true })).toMatchObject({ archived: true, trashed: true, pinned: true });
  });
  it('내용도 파일도 없으면 메모로 치지 않는다, 파일만 딸린 메모는 살린다', () => {
    expect(parseKeepNote({ title: '', textContent: '' })).toBeNull();
    expect(parseKeepNote(null)).toBeNull();
    expect(parseKeepNote({ attachments: [{ filePath: 'a.jpg' }] })?.attachmentNames).toEqual(['a.jpg']);
  });
});

describe('Keep 파일 읽기', () => {
  it('메모 하나 · 배열 · JSON이 아니면 조용히 []', () => {
    const one = parseKeepFile(JSON.stringify({ textContent: '하나' }), 'a.json');
    expect(one).toHaveLength(1);
    expect(one[0].sourceName).toBe('a.json');
    expect(parseKeepFile(JSON.stringify([{ textContent: '하나' }, { textContent: '둘' }])).map((n) => n.content)).toEqual(['하나', '둘']);
    expect(parseKeepFile('<html>메모</html>')).toEqual([]);
  });
});

const note = (over: Partial<KeepNote> = {}): KeepNote => ({
  content: '운동회 준비',
  labels: [],
  createdAt: 1772323200000,
  archived: false,
  trashed: false,
  pinned: false,
  attachmentNames: [],
  ...over,
});
const memo = (over: Partial<ExistingMemo> = {}): ExistingMemo => ({ id: 'a', text: '운동회 준비', labels: [], attachmentNames: [], ...over });

describe('가져올 것 고르기 · 메모로 바꾸기', () => {
  const notes = [note({ content: '보통' }), note({ content: '보관', archived: true }), note({ content: '휴지통', trashed: true })];
  it('휴지통은 언제나 빼고, 보관은 골랐을 때만', () => {
    expect(selectNotesToImport(notes, { includeArchived: true, keepLabels: true }).map((n) => n.content)).toEqual(['보통', '보관']);
    expect(selectNotesToImport(notes, OPTS).map((n) => n.content)).toEqual(['보통']);
  });
  it('붙어 있던 파일 이름을 본문 끝에 남기고, 라벨을 안 가져오기로 하면 비운다', () => {
    const n = parseKeepNote({ textContent: '사진 메모', attachments: [{ filePath: 'a.jpg' }], labels: [{ name: '업무' }] })!;
    expect(toMemoDraft(n, OPTS).content).toBe('사진 메모\n📎 Keep에 붙어 있던 파일: a.jpg');
    expect(toMemoDraft(n, { includeArchived: false, keepLabels: false }).labels).toEqual([]);
  });
});

describe('이미 있는 메모 알아보기', () => {
  it('만든 때로 열쇠 (고쳐도 같다), 모르면 내용으로', () => {
    expect(keepIdOf(note())).toBe('keep_1772323200000');
    expect(keepIdOf(note({ content: '내용을 고쳤다' }))).toBe('keep_1772323200000');
    expect(keepIdOf(note({ createdAt: 0 }))).toBe(keepIdOf(note({ createdAt: 0 })));
    expect(keepIdOf(note({ createdAt: 0 }))).not.toBe(keepIdOf(note({ createdAt: 0, content: '다른 메모' })));
  });
  it('열쇠로 먼저 찾고, 없으면 열쇠 없는 메모 중 같은 내용', () => {
    expect(findExistingMemo(note(), [memo({ text: '아무거나', keepId: 'keep_1772323200000' })], '운동회 준비')?.id).toBe('a');
    expect(findExistingMemo(note(), [memo({ id: 'b' })], '운동회 준비')?.id).toBe('b');
    expect(findExistingMemo(note(), [memo({ id: 'c', keepId: 'keep_9' })], '운동회 준비')).toBeUndefined();
  });
  it('글·라벨·붙은 파일 중 하나라도 달라지면 고쳐 쓴다 (라벨 차례·파일 대소문자는 같은 것)', () => {
    const m = memo({ labels: ['학교행사', '가'], attachmentNames: ['사진.JPG'] });
    const same = { content: '운동회 준비', labels: ['가', '학교행사'], attachmentNames: ['사진.jpg'] };
    expect(memoNeedsUpdate(same, m)).toBe(false);
    expect(memoNeedsUpdate({ ...same, content: '고침' }, m)).toBe(true);
    expect(memoNeedsUpdate({ ...same, labels: [] }, m)).toBe(true);
    expect(memoNeedsUpdate({ ...same, attachmentNames: [] }, m)).toBe(true);
  });
  it('계획: 짝을 찾은 파일만 붙이고, 못 찾은 것은 이름으로 · 새로/고쳐 씀/건너뜀', () => {
    const n = note({ attachmentNames: ['Photos/a.jpg', 'b.png'] });
    const p = planKeepNote(n, OPTS, true, new Set(['a.jpg']), []);
    expect(p.action).toBe('add');
    expect(p.attachNames).toEqual(['Photos/a.jpg']);
    expect(p.draft.content).toBe('운동회 준비\n📎 Keep에 붙어 있던 파일: b.png');
    const existing = memo({ keepId: 'keep_1772323200000', text: p.draft.content, attachmentNames: ['a.jpg'] });
    expect(planKeepNote(n, OPTS, true, new Set(['a.jpg']), [existing]).action).toBe('skip');
    expect(planKeepNote(n, OPTS, false, new Set(['a.jpg']), [existing]).action).toBe('update');
  });
  it('라벨을 가져오지 않기로 하면 지금 붙은 라벨 때문에 고쳐 쓰지 않는다', () => {
    const n = note({ labels: ['업무'] });
    const existing = memo({ keepId: 'keep_1772323200000', labels: ['내 라벨'] });
    expect(planKeepNote(n, OPTS, true, new Set(), [existing]).action).toBe('update');
    expect(planKeepNote(n, { includeArchived: false, keepLabels: false }, true, new Set(), [existing]).action).toBe('skip');
  });
  it('assetKey = 파일 이름만 소문자로', () => {
    expect(assetKey('Takeout/Keep/IMG_1.JPG')).toBe('img_1.jpg');
  });
});

describe('Keep 파일과 백업 파일 가려내기', () => {
  it('Keep 메모는 Keep, V4·V5 백업과 JSON이 아닌 것은 아니다', () => {
    expect(fileLooksLikeKeep(JSON.stringify({ textContent: '메모', isTrashed: false }))).toBe(true);
    expect(fileLooksLikeKeep(JSON.stringify({ listContent: [{ text: '항목' }] }))).toBe(true);
    expect(fileLooksLikeKeep(JSON.stringify({ events: {}, tasks: { m1: {} } }))).toBe(false);
    expect(fileLooksLikeKeep(JSON.stringify({ tasks: { m1: { text: '메모' } } }))).toBe(false);
    expect(fileLooksLikeKeep(JSON.stringify({ version: 'SP5-BACKUP', colls: {} }))).toBe(false);
    expect(fileLooksLikeKeep('<html>')).toBe(false);
  });
});
