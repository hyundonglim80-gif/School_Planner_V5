import { describe, expect, it } from 'vitest';
import { readRecord, recordData, recordPath } from './record';

describe('가져오기 기록', () => {
  it('자리는 그 공간의 settings/import', () => {
    expect(recordPath('u_me')).toEqual({ sid: 'u_me', coll: 'settings', id: 'import' });
  });

  it('없거나 틀린 문서는 빈 기록', () => {
    expect(readRecord(undefined)).toEqual({});
    expect(readRecord([])).toEqual({});
    expect(readRecord({ at: 'x', dismissed: 'yes', counts: 3 })).toEqual({});
  });

  it('칸을 읽고 틀린 값은 버린다', () => {
    const r = readRecord({
      at: 10,
      counts: { 'labels.event': { added: 2, same: 'x', years: { '2026': 3, bad: 'y' } }, broken: 1 },
      labelMap: { event: { ev_1: 'abc', bad: 3 }, note: null },
      settings: { pc: { fontScale: 'lg' }, mobile: 'x' },
      dismissed: true,
      updatedAt: { seconds: 1 },
    });
    expect(r).toEqual({
      at: 10,
      counts: { 'labels.event': { added: 2, changed: 0, same: 0, kept: 0, removed: 0, years: { '2026': 3, bad: 0 } } },
      labelMap: { event: { ev_1: 'abc' }, note: {} },
      settings: { pc: { fontScale: 'lg' } },
      dismissed: true,
    });
  });

  it('적을 때 빈 칸은 뺀다', () => {
    expect(recordData({ at: 1, counts: undefined, dismissed: true })).toEqual({ at: 1, dismissed: true });
  });
});
