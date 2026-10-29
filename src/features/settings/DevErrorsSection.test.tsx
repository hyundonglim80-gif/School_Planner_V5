import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import type { ErrorReportDoc } from '../../domain/errorReport';
import DevErrorsSection from './DevErrorsSection';

const server = vi.hoisted(() => ({ docs: [] as ErrorReportDoc[], fail: null as Error | null }));
const deleteErrorReports = vi.hoisted(() => vi.fn(async (ids: readonly string[]) => {
  server.docs = server.docs.filter((d) => !ids.includes(d.id));
}));
vi.mock('../../data/errorReport', () => ({
  loadErrorReports: vi.fn(async () => {
    if (server.fail) throw server.fail;
    return server.docs;
  }),
  deleteErrorReports,
}));

const report = (id: string, message: string, at: number, extra: Partial<ErrorReportDoc> = {}): ErrorReportDoc => ({
  id,
  kind: 'error',
  message,
  stack: `at f (A.tsx:${at}:1)`,
  note: '',
  build: 'b1',
  scope: 'day',
  device: 'pc',
  standalone: false,
  ua: 'Chrome/141',
  at,
  ...extra,
});

const q = (s: string) => document.querySelector<HTMLElement>(s)!;
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];

beforeEach(() => {
  server.fail = null;
  deleteErrorReports.mockClear();
  server.docs = [
    report('a', 'TypeError: x is undefined', Date.parse('2026-10-29T09:00:00')),
    report('b', '메모를 저장하지 못했습니다.', Date.parse('2026-10-29T10:30:00'), { kind: 'toast', device: 'mobile', standalone: true }),
    report('c', 'TypeError: x is undefined', Date.parse('2026-10-29T11:05:00'), { build: 'b2', note: 'at DayView' }),
  ];
});

describe('개발자 탭 오류 기록', () => {
  it('같은 문장끼리 묶어 건수·마지막 시각·판·기기 - 늦은 묶음부터', async () => {
    render(<DevErrorsSection />);
    await waitFor(() => expect(qa('[data-error-group]')).toHaveLength(2));
    expect(qa('[data-error-group]').map((li) => li.dataset.errorGroup)).toEqual(['TypeError: x is undefined', '메모를 저장하지 못했습니다.']);
    const first = qa('[data-error-group]')[0];
    expect(first.querySelector('[data-error-count]')).toHaveTextContent('2');
    expect(first).toHaveTextContent('10/29 11:05');
    expect(first).toHaveTextContent('판 b2, b1');
    expect(qa('[data-error-group]')[1]).toHaveTextContent('안내 · 10/29 10:30 · 판 b1 · mobile·앱');
    expect(q('[data-errors-total]').dataset.errorsTotal).toBe('3');
  });

  it('누르면 가장 나중 것의 스택·컴포넌트, 다시 누르면 접힌다', async () => {
    render(<DevErrorsSection />);
    await waitFor(() => expect(qa('[data-error-group]')).toHaveLength(2));
    fireEvent.click(qa('[data-error-toggle]')[0]);
    expect(q('[data-error-stack]')).toHaveTextContent(`at f (A.tsx:${Date.parse('2026-10-29T11:05:00')}:1)`);
    expect(q('[data-error-detail]')).toHaveTextContent('at DayView');
    fireEvent.click(qa('[data-error-toggle]')[0]);
    expect(document.querySelector('[data-error-detail]')).toBeNull();
  });

  it('모두 지우기 - 묻고, 읽어 온 것을 모두 지운 뒤 다시 읽는다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<DevErrorsSection />);
    await waitFor(() => expect(qa('[data-error-group]')).toHaveLength(2));
    fireEvent.click(q('[data-errors-clear]'));
    expect(deleteErrorReports).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(q('[data-errors-clear]'));
    });
    expect(confirm).toHaveBeenLastCalledWith('오류 기록 3건을 지울까요?');
    expect([...deleteErrorReports.mock.calls[0][0]].sort()).toEqual(['a', 'b', 'c']);
    await waitFor(() => expect(document.querySelector('[data-errors-empty]')).toBeInTheDocument());
    expect(q('[data-errors-clear]')).toBeDisabled();
    confirm.mockRestore();
  });

  it('읽지 못하면 까닭을 보인다 (개발자가 아니면 규칙이 막는다)', async () => {
    server.fail = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    render(<DevErrorsSection />);
    await waitFor(() => expect(document.querySelector('[data-errors-failed]')).toHaveTextContent('permission-denied'));
  });
});
