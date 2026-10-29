import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Broken(): never {
  throw new Error('그리기 실패');
}

describe('ErrorBoundary', () => {
  it('아래가 그리다 깨지면 흰 화면 대신 안내와 [새로고침]·판 이름', () => {
    // React가 잡은 오류를 콘솔에 한 번 더 적는다 - 시험 출력만 조용히
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    quiet.mockRestore();
    expect(document.querySelector('[data-app-crashed]')).toBeInTheDocument();
    expect(screen.getByText('화면을 그리다 문제가 생겼습니다')).toBeInTheDocument();
    expect(document.querySelector('[data-app-reload]')).toHaveTextContent('새로고침');
    expect(screen.getByText(/판 test/)).toBeInTheDocument();
  });

  it('깨지지 않으면 그대로', () => {
    render(
      <ErrorBoundary>
        <p data-ok>괜찮음</p>
      </ErrorBoundary>,
    );
    expect(document.querySelector('[data-ok]')).toBeInTheDocument();
    expect(document.querySelector('[data-app-crashed]')).toBeNull();
  });
});
