import { describe, expect, it } from 'vitest';
import { changesForNewUrls, collectStorageFiles, isStorageUrl, nameFromUrl } from './attachCollect';

const S = 'https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/users%2Fu%2F1712345678901_%EC%82%AC%EC%A7%84.png?alt=media&token=t';

describe('첨부 모으기', () => {
  it('Storage 주소만 알아본다', () => {
    expect(isStorageUrl(S)).toBe(true);
    expect(isStorageUrl('https://x.firebasestorage.app/o/a.png')).toBe(true);
    expect(isStorageUrl('https://drive.google.com/thumbnail?id=1')).toBe(false);
    expect(isStorageUrl(3)).toBe(false);
  });
  it('파일 이름 = 주소 끝 (앞 타임스탬프는 뗀다)', () => {
    expect(nameFromUrl(S)).toBe('사진.png');
  });
  it('어떤 모양이든 찾아낸다 - 첨부 목록·수업 칸 안', () => {
    const item = { text: 'x', attachments: [{ name: 'a', url: S }, { name: 'b', url: 'https://drive.google.com/x' }] };
    expect(collectStorageFiles(item)).toEqual([{ path: ['attachments', 0, 'url'], url: S, name: '사진.png' }]);
    const day = { periods: { 3: { memo: 'm', attachments: [{ url: S }] } } };
    expect(collectStorageFiles(day).map((f) => f.path)).toEqual([['periods', '3', 'attachments', 0, 'url']]);
  });
  it('바꾼 칸 = 맨 위 칸 통째로 · url 칸이면 driveId도 · 원본은 그대로', () => {
    const item = { text: 'x', attachments: [{ name: 'a', url: S }, { name: 'b', url: 'keep' }] };
    const ch = changesForNewUrls(item, [{ path: ['attachments', 0, 'url'], url: 'NEW', driveId: 'D1' }]);
    expect(ch).toEqual({ attachments: [{ name: 'a', url: 'NEW', driveId: 'D1' }, { name: 'b', url: 'keep' }] });
    expect(item.attachments[0].url).toBe(S);
    const day = { periods: { 3: { memo: 'm', attachments: [{ url: S }] }, 4: { memo: 'n' } } };
    expect(changesForNewUrls(day, [{ path: ['periods', '3', 'attachments', 0, 'url'], url: 'NEW', driveId: 'D' }], 2)).toEqual({
      'periods.3': { memo: 'm', attachments: [{ url: 'NEW', driveId: 'D' }] },
    });
  });
});
