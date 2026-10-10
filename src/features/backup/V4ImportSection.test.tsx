import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useSession } from '../../data/session';
import type { ImportCounts } from '../../import/v4/plan';
import { resetImportRun, useImportRun } from '../../import/v4/run';
import V4ImportSection from './V4ImportSection';

// 진짜 Firebase 앱을 띄우지 않는다 (PLAN 5장 'P3-1 테스트와 Firebase')
vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));
// 가져오기는 서버를 부른다 - 흉내만 (진행 store는 진짜)
const runImport = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));
const loadImportRecord = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../../import/v4/run', async (orig) => ({ ...(await orig<typeof import('../../import/v4/run')>()), runImport, loadImportRecord }));

const q = (s: string) => document.querySelector<HTMLElement>(s)!;
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];
const renderSection = () => render(<V4ImportSection />);

describe('백업 창 가져오기 탭 - V4 자료 가져오기', () => {
  beforeEach(() => {
    useSession.setState({ loading: false, user: { uid: 'me', email: 'me@x', displayName: '', photoURL: '' } });
    resetImportRun();
    runImport.mockClear();
  });

  it('기록을 읽고, 단추를 누르면 가져온다 (가져온 적이 있으면 다시 가져오기)', async () => {
    renderSection();
    expect(loadImportRecord).toHaveBeenCalledWith('me');
    expect(q('[data-import-run]').textContent).toContain('V4 자료 가져오기');
    await act(async () => {
      useImportRun.setState({ record: { at: new Date(2026, 9, 8, 14, 5).getTime() } });
    });
    expect(q('[data-import-run]').textContent).toContain('다시 가져오기');
    expect(q('[data-import-last]').textContent).toContain('2026-10-08 14:05');
    await act(async () => {
      fireEvent.click(q('[data-import-run]'));
    });
    expect(runImport).toHaveBeenCalledWith('me');
  });

  it('도는 동안 진행 칸, 끝나면 결과 표 (종류마다·학년도별)', async () => {
    renderSection();
    await act(async () => {
      useImportRun.setState({ state: 'running', step: '적는 중…', done: 1, total: 4 });
    });
    expect(q('[data-import-progress]').dataset.importProgress).toBe('25');
    expect(q('[data-import-run]')).toBeDisabled();
    expect(document.querySelector('[data-import-result]')).toBeNull();
    const c = (o: Partial<ImportCounts>): ImportCounts => ({ added: 0, changed: 0, same: 0, kept: 0, removed: 0, ...o });
    await act(async () => {
      useImportRun.setState({
        state: 'done',
        counts: { 'labels.event': c({ added: 5, years: { '2025': 1, '2026': 2 } }), settings: c({ changed: 2, kept: 1 }), 'nope.kind': c({ added: 3 }) },
      });
    });
    expect(document.querySelector('[data-import-progress]')).toBeNull();
    // 표의 줄은 IMPORT_KINDS 차례·그 표에 있는 종류만
    expect(qa('[data-import-row]').map((r) => r.dataset.importRow)).toEqual(['labels.event', 'settings']);
    expect(q('[data-import-row="labels.event"] [data-import-count="added"]').textContent).toBe('5');
    expect(q('[data-import-row="settings"] [data-import-count="kept"]').textContent).toBe('1');
    expect(q('[data-import-row="labels.event"] [data-import-years]').textContent).toBe('2026학년도 2 · 2025학년도 1');
  });

  it('실패하면 다시 누르라고', async () => {
    renderSection();
    await act(async () => {
      useImportRun.setState({ state: 'failed' });
    });
    expect(q('[data-import-failed]')).toBeVisible();
  });
});
