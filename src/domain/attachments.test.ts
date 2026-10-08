// 붙임 가려내기 - V4 기록('image')·메모(MIME)·드라이브 주소(이름의 확장자)·파일 종류·크기·붙여넣은 이름·새 붙임 모양
import { describe, expect, it } from 'vitest';
import { fileIcon, formatFileSize, isImageAttachment, makeAttachment, pastedImageName } from './attachments';

describe('붙임', () => {
  it('그림인가: type image·MIME·주소나 이름의 확장자', () => {
    expect(isImageAttachment({ type: 'image', url: 'x', name: 'a' })).toBe(true);
    expect(isImageAttachment({ type: 'image/png', url: 'x', name: 'a' })).toBe(true);
    expect(isImageAttachment({ type: '', url: 'https://drive.google.com/file/d/abc/view', name: '사진.JPG' })).toBe(true);
    expect(isImageAttachment({ type: 'file', url: 'https://x/a.pdf', name: 'a.pdf' })).toBe(false);
    expect(isImageAttachment(null)).toBe(false);
  });

  it('파일 종류 그림과 크기', () => {
    expect(fileIcon({ name: '가정통신문.hwp', type: 'file' })).toBe('📝');
    expect(fileIcon({ name: 'a.pdf', type: '' })).toBe('📄');
    expect(fileIcon({ name: '성적.xlsx' })).toBe('📊');
    expect(fileIcon({ name: 'a.zip' })).toBe('🗜️');
    expect(fileIcon({ name: 'a.bin' })).toBe('📁');
    expect(formatFileSize(undefined)).toBe('');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('붙여넣은 그림 이름 - 때·차례·확장자', () => {
    const now = new Date(2026, 9, 8, 14, 5, 9);
    expect(pastedImageName(0, 'image/png', now)).toBe('붙여넣은_이미지_20261008_140509.png');
    expect(pastedImageName(1, 'image/jpeg', now)).toBe('붙여넣은_이미지_20261008_140509_2.jpg');
    expect(pastedImageName(0, 'image/x-unknown', now)).toBe('붙여넣은_이미지_20261008_140509.png');
  });

  it('새 붙임은 값이 있는 칸만 (undefined 칸이 없다)', () => {
    const a = makeAttachment({ name: 'a.hwp', type: '' }, 'https://d/a', undefined, 2, 100);
    expect(a).toEqual({ id: 'file_100_2', name: 'a.hwp', url: 'https://d/a', type: 'application/octet-stream' });
    expect(Object.values(a).includes(undefined)).toBe(false);
    expect(makeAttachment({ name: 'p.png', type: 'image/png', size: 10 }, 'u', 'D1', 0, 1)).toEqual({ id: 'file_1_0', name: 'p.png', url: 'u', type: 'image/png', size: 10, driveId: 'D1' });
  });
});
