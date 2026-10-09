import { afterEach, describe, expect, it } from 'vitest';
import { clearPrintRoot, preparePrint, PRINT_ROOT_ID } from './print';

afterEach(() => {
  clearPrintRoot();
  document.body.innerHTML = '';
});

describe('preparePrint', () => {
  it('복제해 제목·부제 아래 넣고, 단추(data-print-hide)는 빼고, 입력 칸은 적힌 값 글로', () => {
    const node = document.createElement('div');
    node.innerHTML = '<button data-print-hide>🖨️</button><input value="국어"><input type="checkbox" checked><select><option>가</option><option selected>나</option></select><p>본문</p>';
    document.body.appendChild(node);
    const root = preparePrint(node, { title: '주간', subtitle: '인쇄 2026-10-09', landscape: true, marginMm: 10 });
    expect(root.id).toBe(PRINT_ROOT_ID);
    expect(root.querySelector('.sp5-print-title')?.textContent).toBe('주간');
    expect(root.querySelector('.sp5-print-subtitle')?.textContent).toBe('인쇄 2026-10-09');
    expect(root.querySelector('[data-print-hide]')).toBeNull();
    expect([...root.querySelectorAll('.sp5-print-field')].map((e) => e.textContent)).toEqual(['국어', '☑', '나']);
    expect(document.getElementById(`${PRINT_ROOT_ID}-page`)?.textContent).toContain('A4 landscape');
    expect(document.body.hasAttribute('data-printing')).toBe(true);
    // 원본은 그대로
    expect(node.querySelector('[data-print-hide]')).not.toBeNull();
  });

  it('두 번 부르면 앞 것을 치우고, 치우면 다 없어진다', () => {
    const node = document.createElement('div');
    document.body.appendChild(node);
    preparePrint(node);
    preparePrint(node);
    expect(document.querySelectorAll(`#${PRINT_ROOT_ID}`)).toHaveLength(1);
    expect(document.getElementById(`${PRINT_ROOT_ID}-page`)?.textContent).toContain('portrait');
    clearPrintRoot();
    expect(document.getElementById(PRINT_ROOT_ID)).toBeNull();
    expect(document.body.hasAttribute('data-printing')).toBe(false);
  });
});
