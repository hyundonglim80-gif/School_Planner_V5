// 화면마다 글자 크기와 단축키 (메모 요청 #145)
import { describe, it, expect, beforeEach } from 'vitest';
import { SHORTCUT_ACTIONS } from '../domain/shortcuts';
import { fontPageLabel, stepFontSizeByKey } from './fontSize';
import { canRun, handleAppKeyDown, runShortcut, setShortcutOverrides } from './keys';
import { currentFontPage, FONT_PAGES, setFontSizes, useLayoutPrefs } from './layoutPrefs';
import { useNav } from './nav';

const scale = () => document.documentElement.style.getPropertyValue('--font-scale');
const toasts = () => [...document.querySelectorAll('[data-toast]')].map((el) => el.textContent);

beforeEach(() => {
  setShortcutOverrides({});
  useNav.setState({ scope: 'day' });
  setFontSizes({});
  document.getElementById('sp5-toast-container')?.remove();
});

describe('화면마다 글자 크기', () => {
  it('자리는 화면 일곱 + 팝업창, 큰 창은 지금 보는 화면', () => {
    expect(FONT_PAGES).toEqual(['board', 'day', 'week', 'month', 'year', 'memo', 'class', 'popout']);
    expect(currentFontPage()).toBe('day');
    useNav.setState({ scope: 'memo' });
    expect(currentFontPage()).toBe('memo');
    expect(fontPageLabel('memo')).toBe('메모');
    expect(fontPageLabel('popout')).toBe('팝업창');
  });

  it('화면을 옮기면 그 화면이 기억한 크기로 (다른 화면은 100%)', () => {
    setFontSizes({ week: 80 });
    expect(scale()).toBe('');
    useNav.setState({ scope: 'week' });
    expect(scale()).toBe('0.8');
    useNav.setState({ scope: 'month' });
    expect(scale()).toBe('');
  });
});

describe("단축키 '글자 작게 / 크게 / 초기화'", () => {
  it('기본 키는 없다 - 단축키 설정에서 정한다', () => {
    for (const id of ['fontSmaller', 'fontLarger', 'fontReset'] as const) {
      expect(SHORTCUT_ACTIONS.find((a) => a.id === id)?.def.key).toBe('');
      expect(canRun(id)).toBe(true);
    }
  });

  it('정한 키를 여러 번 누르면 쌓여서 계속 작아진다 - 지금 화면만, 안내는 하나만 남는다', () => {
    setShortcutOverrides({ fontSmaller: { ctrl: true, alt: true, shift: false, key: '-' } });
    const press = () => {
      const e = new KeyboardEvent('keydown', { key: '-', code: 'Minus', ctrlKey: true, altKey: true, cancelable: true });
      handleAppKeyDown(e);
      return e.defaultPrevented;
    };
    for (let i = 0; i < 4; i++) expect(press()).toBe(true);
    expect(useLayoutPrefs.getState().fontSizes).toEqual({ day: 80 });
    expect(scale()).toBe('0.8');
    expect(toasts()).toEqual(['🔤 글자 크기 (하루): 80%']);
  });

  it('크게 · 초기화 (runShortcut - 단추·메뉴가 부르는 길)', () => {
    useNav.setState({ scope: 'board' });
    expect(runShortcut('fontLarger')).toBe(true);
    runShortcut('fontLarger');
    expect(useLayoutPrefs.getState().fontSizes).toEqual({ board: 110 });
    expect(scale()).toBe('1.1');
    runShortcut('fontReset');
    expect(useLayoutPrefs.getState().fontSizes).toEqual({});
    expect(scale()).toBe('');
  });

  it('끝(50%)에서 멈춘다', () => {
    for (let i = 0; i < 20; i++) stepFontSizeByKey(-1);
    expect(useLayoutPrefs.getState().fontSizes).toEqual({ day: 50 });
  });
});
