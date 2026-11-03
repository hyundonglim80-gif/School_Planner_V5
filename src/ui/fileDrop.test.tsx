// 끌어다 놓아 첨부 (P21-1) - 'Files'만 받는다 · 자식을 지나도 덮개가 깜빡이지 않는다 · 폴더 빼기 · 앱 안 끌기는 받지 않는다 · 칸 밖 지킴(보이는 파일 칸은 그대로)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, createEvent, fireEvent, render } from '@testing-library/react';
import { droppedFiles, guardWindowFileDrop, useFileDrop } from './fileDrop';

vi.mock('../app/toast', () => ({ showToast: vi.fn() }));
import { showToast } from '../app/toast';

/** jsdom에는 DataTransfer가 없다 */
const item = (file: File | null, directory = false) => ({
  kind: file || directory ? 'file' : 'string',
  getAsFile: () => file,
  webkitGetAsEntry: () => (file || directory ? { isDirectory: directory } : null),
});
const transfer = (items: ReturnType<typeof item>[], types = ['Files']) => ({ types, items, dropEffect: 'none' }) as unknown as DataTransfer;
const fileA = new File(['a'], 'a.txt');
const fileB = new File(['b'], 'b.txt');

function Zone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const { over, dropProps } = useFileDrop(onFiles, { disabled });
  return (
    <div data-zone {...dropProps}>
      <span data-child onDragStart={(e) => e.stopPropagation()} />
      {over && <i data-over />}
    </div>
  );
}
const zone = () => document.querySelector('[data-zone]')!;
const child = () => document.querySelector('[data-child]')!;
const covered = () => document.querySelector('[data-over]') !== null;

/** 보낸 놓기 이벤트 - 받았는지(defaultPrevented) 보려고 */
function fire(target: Element, type: 'dragOver' | 'drop', dataTransfer: DataTransfer) {
  const e = createEvent[type](target, { dataTransfer });
  fireEvent(target, e);
  return e;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useFileDrop', () => {
  it('파일을 끌면 덮개, 놓으면 파일을 건네고 덮개를 걷는다', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    const dt = transfer([item(fileA), item(fileB)]);
    fireEvent.dragEnter(zone(), { dataTransfer: dt });
    expect(covered()).toBe(true);
    expect(fire(zone(), 'dragOver', dt).defaultPrevented).toBe(true);
    expect(dt.dropEffect).toBe('copy');
    expect(fire(zone(), 'drop', dt).defaultPrevented).toBe(true);
    expect(onFiles).toHaveBeenCalledWith([fileA, fileB]);
    expect(covered()).toBe(false);
  });

  it('파일이 아닌 끌기(일정·글 고르기)는 받지 않는다', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    const dt = transfer([item(null)], ['text/plain']);
    fireEvent.dragEnter(zone(), { dataTransfer: dt });
    expect(covered()).toBe(false);
    expect(fire(zone(), 'dragOver', dt).defaultPrevented).toBe(false);
    expect(fire(zone(), 'drop', dt).defaultPrevented).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('자식 위로 옮겨 가도 덮개가 그대로, 정말 나가면 걷는다', () => {
    render(<Zone onFiles={vi.fn()} />);
    const dt = transfer([item(fileA)]);
    fireEvent.dragEnter(zone(), { dataTransfer: dt });
    fireEvent.dragEnter(child(), { dataTransfer: dt });
    fireEvent.dragLeave(zone(), { dataTransfer: dt });
    expect(covered()).toBe(true);
    fireEvent.dragLeave(child(), { dataTransfer: dt });
    expect(covered()).toBe(false);
  });

  it('disabled = 받지 않고 덮개도 없다 - 끄는 도중에 풀려도 수가 어긋나지 않는다', () => {
    const onFiles = vi.fn();
    const view = render(<Zone onFiles={onFiles} />);
    const dt = transfer([item(fileA)]);
    fireEvent.dragEnter(zone(), { dataTransfer: dt });
    view.rerender(<Zone onFiles={onFiles} disabled />);
    expect(covered()).toBe(false);
    expect(fire(zone(), 'dragOver', dt).defaultPrevented).toBe(false);
    fireEvent.dragLeave(zone(), { dataTransfer: dt });
    view.rerender(<Zone onFiles={onFiles} />);
    expect(covered()).toBe(false);
    view.rerender(<Zone onFiles={onFiles} disabled />);
    fire(zone(), 'drop', dt);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('폴더는 빼고 알린다 - 파일이 함께 있으면 파일은 건넨다', () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    fire(zone(), 'drop', transfer([item(null, true), item(fileA)]));
    expect(onFiles).toHaveBeenCalledWith([fileA]);
    expect(showToast).toHaveBeenCalledWith('폴더는 첨부할 수 없습니다.');
    onFiles.mockClear();
    fire(zone(), 'drop', transfer([item(null, true)]));
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('앱 안에서 시작한 끌기(화면의 그림)는 받지 않는다 - 카드처럼 전파를 막아도 · 놓은 뒤 윈도우 파일은 다시 받는다', async () => {
    const stop = guardWindowFileDrop();
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);
    const dt = transfer([item(fileA)]);
    fireEvent.dragStart(child());
    fireEvent.dragEnter(zone(), { dataTransfer: dt });
    expect(covered()).toBe(false);
    // 끌던 것이 사라져 dragend가 오지 않아도 drop에서 푼다
    fire(zone(), 'drop', dt);
    expect(onFiles).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise((r) => setTimeout(r));
    });
    fireEvent.dragEnter(zone(), { dataTransfer: dt });
    expect(covered()).toBe(true);
    stop();
  });
});

describe('droppedFiles', () => {
  it('흉내 놓기처럼 entry가 없으면 파일로 본다 · 글자 항목은 뺀다', () => {
    const noEntry = { kind: 'file', getAsFile: () => fileA, webkitGetAsEntry: () => null };
    const dt = { items: [noEntry, item(null)] } as unknown as DataTransfer;
    expect(droppedFiles(dt)).toEqual({ files: [fileA], folders: 0 });
  });
});

describe('guardWindowFileDrop', () => {
  function drag(target: Element, type: 'dragOver' | 'drop', types = ['Files']) {
    return fire(target, type, transfer([], types));
  }

  it('칸 밖에 놓은 파일은 브라우저가 열지 않는다 - 파일이 아닌 끌기는 건드리지 않는다', () => {
    const stop = guardWindowFileDrop();
    render(<p data-outside />);
    const outside = document.querySelector('[data-outside]')!;
    expect(drag(outside, 'dragOver').defaultPrevented).toBe(true);
    expect(drag(outside, 'drop').defaultPrevented).toBe(true);
    expect(drag(outside, 'dragOver', ['text/plain']).defaultPrevented).toBe(false);
    expect(drag(outside, 'drop', ['text/plain']).defaultPrevented).toBe(false);
    stop();
  });

  it('보이는 파일 칸(백업 복원)은 브라우저가 받는 그대로', () => {
    const stop = guardWindowFileDrop();
    render(<input type="file" data-file />);
    const input = document.querySelector('[data-file]')!;
    expect(drag(input, 'dragOver').defaultPrevented).toBe(false);
    expect(drag(input, 'drop').defaultPrevented).toBe(false);
    stop();
  });

  it('놓는 칸이 받은 끌기의 마우스 모양(복사)을 덮지 않는다', () => {
    const stop = guardWindowFileDrop();
    render(<Zone onFiles={vi.fn()} />);
    const dt = transfer([item(fileA)]);
    act(() => {
      fire(zone(), 'dragOver', dt);
    });
    expect(dt.dropEffect).toBe('copy');
    stop();
  });
});
