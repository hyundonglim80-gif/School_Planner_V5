// 휴지통 목록 - 종류·탭·지운 때 차례, 자동 비우기 기간, 드라이브 첨부 정리(V5에서 올린 것만·남는 항목이 쓰면 남김)
import { describe, expect, it, vi } from 'vitest';
import { driveFilesToClean, expiredOf, tabOf, trashEntries } from './trashList';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));

const ts = (ms: number) => ({ toMillis: () => ms });
const DAY = 86_400_000;
const NOW = 100 * DAY;

describe('휴지통 목록', () => {
  const entries = trashEntries({
    items: {
      a: { id: 'a', kind: 'event', date: '2026-10-07', endDate: '2026-10-09', text: '기간 일정', deletedAt: ts(NOW - DAY) },
      b: { id: 'b', kind: 'note', date: '2026-10-07', text: '기록', deletedAt: ts(NOW - 10 * DAY), deletedBy: 'v4-import' },
      c: { id: 'c', kind: 'note', date: null, text: '', deletedAt: ts(NOW - 2 * DAY), attachments: [{ name: '사진.png' }] },
      live: { id: 'live', kind: 'event', date: '2026-10-07', text: '살아 있음', deletedAt: null },
    },
    labels: { l1: { id: 'l1', name: '회의', kind: 'note', deletedAt: ts(NOW - 3 * DAY) } },
    ddays: [{ id: 'd1', title: '수능', date: '2026-11-19', deletedAt: NOW - 4 * DAY }, { id: 'd2', title: '살아 있음', date: '2026-12-01' }],
    clips: [{ id: 'k1', kind: 'image', deletedAt: NOW - 5 * DAY }],
    now: NOW,
  });

  it('지운 것만, 지운 때 차례 (최근 먼저)', () => {
    expect(entries.map((e) => e.key)).toEqual(['event:a', 'memo:c', 'label:l1', 'dday:d1', 'clip:k1', 'journal:b']);
    expect(entries[0]).toMatchObject({ when: '2026-10-07 ~ 10.9', text: '기간 일정' });
    expect(entries[1].text).toBe('📎 사진.png');
    expect(entries.find((e) => e.id === 'b')?.byV4).toBe(true);
    expect(entries.find((e) => e.id === 'k1')?.text).toBe('🖼️ 그림');
  });

  it('탭: 라벨·D-Day는 기타', () => {
    expect(entries.map((e) => tabOf(e.kind))).toEqual(['event', 'memo', 'etc', 'etc', 'clip', 'journal']);
  });

  it('자동 비우기: 기간보다 먼저 지운 것만, 0은 끄기', () => {
    expect(expiredOf(entries, 7, NOW).map((e) => e.id)).toEqual(['b']);
    expect(expiredOf(entries, 0, NOW)).toEqual([]);
  });

  it('드라이브 정리: V5에서 올린 것만, 남는 항목이 쓰면 남긴다', () => {
    const purged = [
      { id: 'p1', kind: 'note', attachments: [{ name: 'a', driveId: 'F1' }, { name: 'b', url: 'https://drive.google.com/uc?export=download&id=F2' }, { name: 'c', driveId: 'F3' }] },
      { id: 'p2', kind: 'note', src: { path: 'x' }, attachments: [{ name: 'd', driveId: 'F4' }] },
    ];
    const rest = [{ id: 'r', kind: 'note', attachments: [{ name: 'c', driveId: 'F3' }] }];
    expect(driveFilesToClean(purged, rest)).toEqual(['F1', 'F2']);
  });
});
