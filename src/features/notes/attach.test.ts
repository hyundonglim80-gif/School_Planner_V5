// 붙이기 - 표 먼저(한 칸이면 글자로, 너무 크면 안내), 그림 파일 고르기, 올리기(원본·이름·일부만 올라가면 올라간 것만)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractImageFiles, pastedTable, tablePastedText, uploadAttachments } from './attach';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, GOOGLE_SCOPES: [] }));
const drive = vi.hoisted(() => ({ calls: [] as { name: string; type: string }[], failAt: -1 }));
vi.mock('../../data/google/drive', async (orig) => {
  const real = await orig<typeof import('../../data/google/drive')>();
  return {
    ...real,
    uploadToDrive: vi.fn(async (file: Blob, name: string) => {
      if (drive.calls.length === drive.failAt) throw new Error('구글 드라이브 저장 공간이 가득 찼습니다.');
      drive.calls.push({ name, type: file.type });
      const id = `D${drive.calls.length}`;
      return { id, name, downloadLink: `https://drive.google.com/uc?export=download&id=${id}` };
    }),
  };
});

/** DataTransfer 흉내 (jsdom에는 없다) */
function transfer(html: string, files: File[] = []): DataTransfer {
  const items = files.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f }));
  return { getData: (t: string) => (t === 'text/html' ? html : ''), items: Object.assign(items, { length: items.length }) } as unknown as DataTransfer;
}
const TABLE = '<table><tr><td>가</td><td>나</td></tr><tr><td>1</td><td>2</td></tr></table>';

beforeEach(() => {
  drive.calls = [];
  drive.failAt = -1;
  document.body.innerHTML = '';
});

describe('붙여넣은 표', () => {
  it('표는 표로, 한 칸이면 글자로, 표가 없으면 null', () => {
    const t = pastedTable(transfer(TABLE));
    expect(t && typeof t === 'object' && 'rows' in t && t.rows.length).toBe(2);
    expect(tablePastedText(t as never)).toBe('▦ 표를 붙였습니다 (2행 × 2열)');
    expect(pastedTable(transfer('<table><tr><td>하나</td></tr></table>'))).toBe('text');
    expect(pastedTable(transfer('<p>글</p>'))).toBeNull();
    expect(pastedTable(null)).toBeNull();
  });

  it('너무 큰 표는 안내', () => {
    const row = `<tr>${'<td>x</td>'.repeat(60)}</tr>`;
    const big = pastedTable(transfer(`<table>${row.repeat(60)}</table>`));
    expect(big).toMatchObject({ error: expect.stringContaining('3000칸') });
  });

  it('그림 파일만 고른다', () => {
    const png = new File(['x'], 'image.png', { type: 'image/png' });
    const txt = new File(['x'], 'a.txt', { type: 'text/plain' });
    expect(extractImageFiles(transfer('', [png, txt]))).toEqual([png]);
  });
});

describe('드라이브에 올리기', () => {
  it('파일은 제 이름·MIME 그대로, 그림 주소는 thumbnail·파일은 내려받기 주소', async () => {
    const out = await uploadAttachments([new File(['a'], '통신문.hwp', { type: '' }), new File(['b'], '사진.png', { type: 'image/png' })]);
    expect(drive.calls.map((c) => c.name)).toEqual(['통신문.hwp', '사진.png']);
    expect(out[0]).toMatchObject({ name: '통신문.hwp', type: 'application/octet-stream', url: 'https://drive.google.com/uc?export=download&id=D1', driveId: 'D1' });
    expect(out[1]).toMatchObject({ name: '사진.png', type: 'image/png', url: 'https://drive.google.com/thumbnail?id=D2&sz=w1000', driveId: 'D2' });
  });

  it("캡처는 '붙여넣은_이미지_…' 이름으로", async () => {
    const out = await uploadAttachments([new File(['a'], 'image.png', { type: 'image/png' }), new File(['b'], 'image.png', { type: 'image/png' })], true);
    expect(out.map((a) => a.name)).toEqual([expect.stringMatching(/^붙여넣은_이미지_\d{8}_\d{6}\.png$/), expect.stringMatching(/_2\.png$/)]);
    expect(drive.calls[0].type).toBe('image/png');
  });

  it('중간에 실패하면 올라간 것만 돌려주고 까닭을 안내한다', async () => {
    drive.failAt = 1;
    const out = await uploadAttachments([new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf'), new File(['c'], 'c.pdf')]);
    expect(out.map((a) => a.name)).toEqual(['a.pdf']);
    expect(document.querySelector('[data-toast]')?.textContent).toContain('3개 중 1개만');
    expect(document.querySelector('[data-toast]')?.textContent).toContain('저장 공간이 가득');
  });
});
