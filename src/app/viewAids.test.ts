import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data/firebase', () => ({ db: {}, auth: {} }));

import { useCommonSettings } from './prefs';
import { CONTRAST_KEY, CVD_KEY, DIM_KEY, readContrast, readDim, setContrast, setCvd, setDim, VIEW_AIDS_CHANGED_EVENT, watchViewAids } from './viewAids';

const html = document.documentElement;

describe('보기 쉽게 (P20-2)', () => {
  let stop: () => void;

  beforeEach(() => {
    localStorage.clear();
    html.className = '';
    useCommonSettings.setState({ cvd: false });
    stop = watchViewAids();
  });
  afterEach(() => stop());

  it('고대비·어둡게를 부드럽게는 이 기기 저장소와 html 클래스 - 끄면 키를 지운다', () => {
    setContrast(true);
    setDim(true);
    expect(localStorage.getItem(CONTRAST_KEY)).toBe('1');
    expect(html.classList.contains('hc')).toBe(true);
    expect(html.classList.contains('dim')).toBe(true);
    expect(readContrast() && readDim()).toBe(true);
    setContrast(false);
    expect(localStorage.getItem(CONTRAST_KEY)).toBeNull();
    expect(html.classList.contains('hc')).toBe(false);
  });

  it('바꾸면 알린다 (열린 보기 탭이 따라온다)', () => {
    const heard = vi.fn();
    window.addEventListener(VIEW_AIDS_CHANGED_EVENT, heard);
    setDim(true);
    window.removeEventListener(VIEW_AIDS_CHANGED_EVENT, heard);
    expect(heard).toHaveBeenCalledOnce();
  });

  it('색약 배려는 계정 값을 따라 사본과 화면을 바꾼다 (다른 기기에서 바꿔 받아도)', () => {
    setCvd(true);
    expect(useCommonSettings.getState().cvd).toBe(true);
    expect(localStorage.getItem(CVD_KEY)).toBe('1');
    expect(html.classList.contains('cvd')).toBe(true);
    useCommonSettings.setState({ cvd: false });
    expect(localStorage.getItem(CVD_KEY)).toBeNull();
    expect(html.classList.contains('cvd')).toBe(false);
  });

  it('다른 창(↗ 새 창)이 바꾸면 이 창도 맞춘다 - 색약 배려는 계정 store까지', () => {
    localStorage.setItem(DIM_KEY, '1');
    window.dispatchEvent(new StorageEvent('storage', { key: DIM_KEY }));
    expect(html.classList.contains('dim')).toBe(true);
    localStorage.setItem(CVD_KEY, '1');
    window.dispatchEvent(new StorageEvent('storage', { key: CVD_KEY }));
    expect(html.classList.contains('cvd')).toBe(true);
    expect(useCommonSettings.getState().cvd).toBe(true);
  });

  it('상관없는 키는 지나간다', () => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'sp5_theme' }));
    expect(html.className).toBe('');
  });
});
