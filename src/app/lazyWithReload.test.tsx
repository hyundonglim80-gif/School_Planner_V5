import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { lazyWithReload, useChunkRetry } from './lazyWithReload';
import { OFFLINE_WINDOW_MESSAGE, OfflineWindow } from './OfflineChunk';
import { showToast } from './toast';

vi.mock('./toast', () => ({ showToast: vi.fn() }));

const stale = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/NotePanel-x.js'));
const setOnline = (v: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => v });

function Offline() {
  const { retry } = useChunkRetry();
  return (
    <button type="button" onClick={retry}>
      끊김 안내
    </button>
  );
}

afterEach(() => {
  setOnline(true);
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('lazyWithReload - 끊겨서 받지 못한 조각 (10-29 휴대폰)', () => {
  it('끊겼으면 새로고침하지 않고 대신 그림 → 이어진 뒤 다시 그리면 새로 받는다', async () => {
    setOnline(false);
    let fail = true;
    const load = vi.fn(() => (fail ? stale() : Promise.resolve({ default: () => <p>메모 칸</p> })));
    const Chunk = lazyWithReload(load, Offline);
    render(
      <Suspense fallback={null}>
        <Chunk />
      </Suspense>,
    );
    const retry = await screen.findByText('끊김 안내');
    expect(sessionStorage.getItem('sp5-chunk-reloaded')).toBeNull();

    fail = false;
    setOnline(true);
    act(() => retry.click());
    expect(await screen.findByText('메모 칸')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('끊긴 동안 떠났다가 이어진 뒤 돌아오면 새로 받는다 (online 사건)', async () => {
    setOnline(false);
    let fail = true;
    const load = vi.fn(() => (fail ? stale() : Promise.resolve({ default: () => <p>주간</p> })));
    const Chunk = lazyWithReload(load, Offline);
    const view = render(
      <Suspense fallback={null}>
        <Chunk />
      </Suspense>,
    );
    await screen.findByText('끊김 안내');
    view.unmount();
    fail = false;
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    render(
      <Suspense fallback={null}>
        <Chunk />
      </Suspense>,
    );
    expect(await screen.findByText('주간')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('onLine이어도 서버에 닿지 않으면(와이파이는 붙었는데 인터넷 없음) 끊김으로 본다', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const Chunk = lazyWithReload(stale, Offline);
    render(
      <Suspense fallback={null}>
        <Chunk />
      </Suspense>,
    );
    expect(await screen.findByText('끊김 안내')).toBeInTheDocument();
  });

  it('서버에 닿으면(배포 뒤 옛 파일 이름) 옛 갈래 그대로 - 표시를 남기고 새로고침', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))));
    const Chunk = lazyWithReload(stale, Offline);
    render(
      <Suspense fallback={<p>불러오는 중</p>}>
        <Chunk />
      </Suspense>,
    );
    await vi.waitFor(() => expect(sessionStorage.getItem('sp5-chunk-reloaded')).toBe('1'));
    expect(screen.queryByText('끊김 안내')).toBeNull();
  });

  it('창의 대신 그림은 안내하고 그 창을 닫는다', () => {
    const close = vi.fn();
    render(<OfflineWindow params={{}} close={close} raise={0} setParams={() => {}} />);
    expect(close).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(OFFLINE_WINDOW_MESSAGE, 5000, 'error');
  });
});
