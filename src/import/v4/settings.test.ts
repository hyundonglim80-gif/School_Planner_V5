import { describe, expect, it, vi } from 'vitest';
import type { WriteOp } from '../../data/repo/ops';
import { changedTotal } from './plan';
import { planSettings, v4SettingsDocs } from './settings';

// 진짜 Firebase 앱을 띄우지 않는다 - 띄우면 시험이 끝난 뒤 Firebase가 IndexedDB를 열다 jsdom이 걷혀 '처리하지 않은 오류'가 가끔 남는다(PLAN 5장 'P3-1 테스트와 Firebase')
vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

const SID = 'u_me';
const keys = { search: { key: 'k', ctrl: true, alt: false, shift: false } };

const putOf = (ops: WriteOp[], id: string) => {
  const op = ops.find((o) => o.at.id === id);
  return op?.type === 'put' ? op.data : undefined;
};

describe('V4 설정 문서 → V5 문서마다', () => {
  it('기기별 문서가 없으면 옛 한 벌, 이월 기간은 PC 값 먼저', () => {
    const docs = v4SettingsDocs({ legacy: { fontScale: 'lg', forwardLookbackDays: 7 }, mobile: { fontScale: 'xl', forwardLookbackDays: 3 } });
    expect(docs.pc).toEqual({ fontScale: 'lg', forwardLookbackDays: 7 });
    expect(docs.mobile).toEqual({ fontScale: 'xl', forwardLookbackDays: 3 });
    expect(docs.common).toEqual({ forwardDays: 7 });
    expect(v4SettingsDocs({})).toEqual({ pc: null, mobile: null, common: null });
  });

  it('D-Day는 V3·V4가 함께 쓰는 preferences에서, 개인 공휴일은 V3 holidays 표에서 (P5-3)', () => {
    const list = [{ id: 'dday_1', title: '수능', date: '2026-11-19' }];
    const docs = v4SettingsDocs({ shared: { dDayList: list, selectedDDayId: 'dday_1' }, holidays: { map: { '2026-10-05': '추석' } } });
    expect(docs.common).toEqual({ ddays: list, ddayPick: 'dday_1', myHolidays: { '2026-10-05': '추석' } });
    const { ops } = planSettings(SID, { shared: { dDayList: list, selectedDDayId: 'dday_1' }, holidays: { map: { '2026-10-05': '추석' } } }, {});
    expect(putOf(ops, 'common')).toEqual({ ddays: list, ddayPick: 'dday_1', myHolidays: { '2026-10-05': '추석' } });
  });
});

describe('planSettings - 처음 가져오기', () => {
  it('기본값과 다른 칸만, 틀린 값은 기본값으로 (적지 않는다)', () => {
    const { ops, counts, written } = planSettings(
      SID,
      { pc: { fontScale: 'lg', popupStyle: 'center', showWeekend: false, shortcutOverrides: keys, startupScope: 'nope', forwardLookbackDays: 30 } },
      {},
    );
    expect(putOf(ops, 'pc')).toEqual({ fontScale: 'lg', popupStyle: 'center', showWeekend: false, shortcutOverrides: keys });
    expect(putOf(ops, 'common')).toEqual({ forwardDays: 30 });
    expect(putOf(ops, 'mobile')).toBeUndefined();
    expect(ops.every((o) => o.at.coll === 'settings' && o.at.sid === SID)).toBe(true);
    expect(counts.changed).toBe(5);
    expect(written.pc).toEqual({ fontScale: 'lg', popupStyle: 'center', showWeekend: false, shortcutOverrides: keys });
  });

  it('V5에서 이미 바꾼 칸은 둔다 (가져온 적이 없는데 기본값이 아니다)', () => {
    const { ops, counts, written } = planSettings(SID, { pc: { fontScale: 'lg', showWeekend: false } }, { pc: { fontScale: 'sm' } });
    expect(putOf(ops, 'pc')).toEqual({ fontScale: 'sm', showWeekend: false });
    expect(counts).toMatchObject({ kept: 1, changed: 1 });
    expect(written.pc).toEqual({ showWeekend: false });
  });

  it('V4가 기본값이고 V5도 그대로면 문서를 쓰지 않는다', () => {
    expect(planSettings(SID, { pc: { fontScale: 'md' } }, {}).ops).toEqual([]);
  });
});

describe('planSettings - 다시 가져오기', () => {
  const v4 = { pc: { fontScale: 'lg', showWeekend: false, forwardLookbackDays: 30 } };
  const first = planSettings(SID, v4, {});
  const current = { pc: putOf(first.ops, 'pc')!, common: putOf(first.ops, 'common')! };

  it('그대로면 바뀐 것 0', () => {
    const again = planSettings(SID, v4, current, first.written);
    expect(again.ops).toEqual([]);
    expect(changedTotal(again.counts)).toBe(0);
    expect(again.written).toEqual(first.written);
  });

  it('V4에서 바꾼 칸은 따라가고, 기본값으로 되돌린 칸은 뺀다', () => {
    const again = planSettings(SID, { pc: { fontScale: 'xl', forwardLookbackDays: 30 } }, current, first.written);
    expect(putOf(again.ops, 'pc')).toEqual({ fontScale: 'xl' });
    expect(again.counts.changed).toBe(2);
  });

  it('V5에서 바꾼 칸은 계속 둔다 (V5에서 기본값으로 되돌린 것도)', () => {
    const edited = { ...current, pc: { showWeekend: false } }; // 글자 크기를 V5에서 기본값으로
    const again = planSettings(SID, { pc: { fontScale: 'xl', showWeekend: true, forwardLookbackDays: 30 } }, edited, first.written);
    // 글자 크기는 V5 것(기본값)을 두고, 주말은 V4를 따라 기본값(칸 빠짐)
    expect(putOf(again.ops, 'pc')).toEqual({});
    expect(again.counts).toMatchObject({ kept: 1, changed: 1 });
    expect(again.written.pc).toEqual({ fontScale: 'lg' });
    // 그다음에도 글자 크기는 V5에서 바꾼 칸
    const third = planSettings(SID, { pc: { fontScale: 'xl', forwardLookbackDays: 30 } }, { ...edited, pc: {} }, again.written);
    expect(putOf(third.ops, 'pc')).toBeUndefined();
  });
});
