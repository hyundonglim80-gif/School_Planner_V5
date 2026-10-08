// 클립보드 목록 - 맨 위에 쌓기·같은 것은 위로·넘치면 버리기·지우기 = 이 기기 휴지통·되살리기·오래된 것 비우기·
// 계정마다 따로·다시 읽어도 남는다(IndexedDB)·로그아웃하면 지운다·Ctrl+C 한 글자는 '본 것'(다시 담지 않는다)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addClipText,
  addCopiedText,
  clearClips,
  loadClipboard,
  MAX_ITEMS,
  purgeClipTrash,
  readSystemClipboard,
  removeClip,
  resetClipboardForTest,
  restoreClipFromTrash,
  useClipboard,
  wipeClipboard,
} from './clipboard';

const texts = () => useClipboard.getState().items.map((i) => i.text);

beforeEach(async () => {
  resetClipboardForTest();
  await wipeClipboard('me');
  await wipeClipboard('other');
  localStorage.clear();
  await loadClipboard('me');
});

describe('클립보드 목록', () => {
  it('최신 것이 위, 같은 것을 다시 복사하면 맨 위로 (새로 쌓지 않는다), 빈 글은 담지 않는다', async () => {
    await addClipText('하나');
    await addClipText('둘');
    await addClipText('  ');
    expect(texts()).toEqual(['둘', '하나']);
    await addClipText('하나');
    expect(texts()).toEqual(['하나', '둘']);
  });

  it(`${MAX_ITEMS}개를 넘으면 오래된 것부터 버린다`, async () => {
    for (let i = 0; i < MAX_ITEMS + 3; i++) await addClipText(`글 ${i}`);
    expect(useClipboard.getState().items).toHaveLength(MAX_ITEMS);
    expect(texts()[0]).toBe(`글 ${MAX_ITEMS + 2}`);
    expect(texts().includes('글 0')).toBe(false);
  });

  it('지우기 = 이 기기 휴지통, 되살리기 = 제자리, 모두 지우기, 오래된 휴지통 비우기', async () => {
    await addClipText('가');
    await addClipText('나');
    const ga = useClipboard.getState().items.find((i) => i.text === '가')!;
    await removeClip(ga.id);
    expect(texts()).toEqual(['나']);
    expect(useClipboard.getState().trash.map((t) => t.text)).toEqual(['가']);
    await restoreClipFromTrash(ga.id);
    expect(texts()).toEqual(['나', '가']);
    await clearClips();
    expect(texts()).toEqual([]);
    expect(useClipboard.getState().trash).toHaveLength(2);
    expect(await purgeClipTrash(Date.now() + 1)).toBe(2);
    expect(useClipboard.getState().trash).toEqual([]);
  });

  it('IndexedDB에 남아 다시 읽어도 그대로, 계정마다 따로, 로그아웃(wipe)하면 지운다', async () => {
    await addClipText('남는 글');
    resetClipboardForTest();
    await loadClipboard('me');
    expect(texts()).toEqual(['남는 글']);
    await loadClipboard('other');
    expect(texts()).toEqual([]);
    await addClipText('다른 계정 글');
    await loadClipboard('me');
    expect(texts()).toEqual(['남는 글']);
    await wipeClipboard('me');
    expect(useClipboard.getState().uid).toBeNull();
    resetClipboardForTest();
    await loadClipboard('me');
    expect(texts()).toEqual([]);
  });

  it('로그인 전(주인 없음)에는 담지 않는다', async () => {
    resetClipboardForTest();
    await addClipText('누구 것?');
    expect(texts()).toEqual([]);
  });
});

describe('시스템 클립보드 읽기', () => {
  function fakeClipboard(text: string, granted: boolean) {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: vi.fn(async () => text) } });
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: vi.fn(async () => ({ state: granted ? 'granted' : 'prompt' })) } });
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  }

  it('허락 전에는 스스로 읽지 않고, 가져오기(누름)는 담는다', async () => {
    fakeClipboard('밖에서 복사', false);
    expect(await readSystemClipboard(false)).toBe('skipped');
    expect(await readSystemClipboard(true)).toBe('ok');
    expect(texts()).toEqual(['밖에서 복사']);
  });

  it('스스로 읽을 때는 달라졌을 때만 - 지운 것을 도로 담지 않는다, 앱 안 Ctrl+C 글자도 본 것', async () => {
    fakeClipboard('같은 글', true);
    await readSystemClipboard(false);
    expect(texts()).toEqual(['같은 글']);
    await clearClips();
    await readSystemClipboard(false);
    expect(texts()).toEqual([]);
    await addCopiedText('앱에서 복사');
    fakeClipboard('앱에서 복사', true);
    await clearClips();
    await readSystemClipboard(false);
    expect(texts()).toEqual([]);
  });
});
