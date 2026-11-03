import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { paletteThemeColor } from '../domain/palette';
import { applyPalette, setPalette, watchPalette } from './palette';
import { useCommonSettings } from './prefs';
import { applyTheme, PALETTE_KEY, readPaletteId } from './theme';

// 계정 설정 맞추기는 서버를 부른다 - 여기서는 store만
vi.mock('../data/settingsSync', () => ({ settingsPort: () => ({}), startSettingsSync: () => () => {} }));

const html = document.documentElement;
const themeColor = () => document.querySelector('meta[name="theme-color"]')!.getAttribute('content');
let stop: (() => void) | null = null;

beforeEach(() => {
  localStorage.clear();
  html.removeAttribute('data-palette');
  html.classList.remove('dark');
  document.head.innerHTML = '<meta name="theme-color" content="#2563eb" />';
  useCommonSettings.setState({ palette: 'default' });
});
afterEach(() => {
  stop?.();
  stop = null;
});

describe('색 테마 입히기 (P20-1 app/palette)', () => {
  it('기본은 data-palette를 붙이지 않고 이 기기 사본도 비운다', () => {
    applyPalette('forest');
    expect(html.getAttribute('data-palette')).toBe('forest');
    expect(localStorage.getItem(PALETTE_KEY)).toBe('forest');
    expect(readPaletteId()).toBe('forest');
    applyPalette('default');
    expect(html.hasAttribute('data-palette')).toBe(false);
    expect(localStorage.getItem(PALETTE_KEY)).toBeNull();
  });

  it('모르는 id는 기본으로 그린다', () => {
    applyPalette('aurora');
    expect(html.hasAttribute('data-palette')).toBe(false);
    localStorage.setItem(PALETTE_KEY, 'aurora');
    expect(readPaletteId()).toBe('default');
  });

  it('상태 표시줄 빛깔 = 지금 밝기·테마 (밝기를 바꿔도 테마를 따른다)', () => {
    applyPalette('forest');
    expect(themeColor()).toBe(paletteThemeColor('forest', false));
    localStorage.setItem('sp5_theme', 'dark');
    applyTheme();
    expect(themeColor()).toBe(paletteThemeColor('forest', true));
    applyPalette('default');
    expect(themeColor()).toBe('#0f1522');
  });

  it('계정 값을 따른다 - 고르기·서버에서 받기 모두', () => {
    useCommonSettings.setState({ palette: 'forest' });
    stop = watchPalette();
    expect(html.getAttribute('data-palette')).toBe('forest');
    setPalette('default');
    expect(useCommonSettings.getState().palette).toBe('default');
    expect(html.hasAttribute('data-palette')).toBe(false);
    useCommonSettings.setState({ palette: 'forest' }); // 서버에서 받은 것처럼
    expect(localStorage.getItem(PALETTE_KEY)).toBe('forest');
  });

  it('다른 창(↗ 새 창)이 바꾸면 storage 이벤트로 이 창도 - 이 창의 계정 store도 맞춘다', () => {
    stop = watchPalette();
    localStorage.setItem(PALETTE_KEY, 'forest');
    window.dispatchEvent(new StorageEvent('storage', { key: PALETTE_KEY }));
    expect(html.getAttribute('data-palette')).toBe('forest');
    expect(useCommonSettings.getState().palette).toBe('forest');
  });
});
