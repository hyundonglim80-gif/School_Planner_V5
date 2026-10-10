import { describe, expect, it, vi } from 'vitest';
import type { WriteOp } from '../../data/repo/ops';
import { changedTotal } from './plan';
import { periodsFromV4, planSettings, termsFromV4, v4SettingsDocs } from './settings';

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

describe('수업 설정 (P6-4)', () => {
  it('교시: 이름(currentNames) + 시각(v4_periodTimes), 시각만 있으면 기본 이름', () => {
    expect(periodsFromV4({ currentNames: ['1교시', '2교시', '점심 뒤'] }, { times: { '1': { start: '09:00', end: '09:40' } } })).toEqual([
      { n: 1, name: '1교시', start: '09:00', end: '09:40' },
      { n: 2, name: '2교시', start: '', end: '' },
      { n: 3, name: '점심 뒤', start: '', end: '' },
    ]);
    expect(periodsFromV4(undefined, { times: { '2': { start: '09:50', end: '10:30' } } })).toEqual([
      { n: 1, name: '1교시', start: '', end: '' },
      { n: 2, name: '2교시', start: '09:50', end: '10:30' },
    ]);
    expect(periodsFromV4(undefined, undefined)).toBeUndefined();
  });

  it('방학: 한 벌 → 여름 방학이 든 학년도', () => {
    expect(termsFromV4({ semesterConfig: { summerStart: '2026-07-25', summerEnd: '2026-08-16', winterStart: '2027-01-09', winterEnd: '2027-02-28' } })).toEqual({
      '2026': { summer: { from: '2026-07-25', to: '2026-08-16' }, winter: { from: '2027-01-09', to: '2027-02-28' } },
    });
    expect(termsFromV4({})).toBeUndefined();
  });

  it('교사 유형·수업 종·우리 학교는 모양 그대로 common에', () => {
    const teaching = { unit: 'class', hasHomeroom: false, homeroomClass: '', subjects: ['과학'], classes: ['5-1'], classColors: {}, updatedAt: 1 };
    const classBell = { enabled: true, start: { on: true, amount: 1, unit: 'min', when: 'before' }, end: { on: false, amount: 0, unit: 'min', when: 'after' }, weekdaysOnly: true, updatedAt: 1 };
    const school = { officeCode: 'B10', schoolCode: '7091375', officeName: '서울', name: '점검초', kind: '초등학교', grade: 3, updatedAt: 1 };
    const { ops } = planSettings(SID, { teaching, classBell, school }, {});
    const common = putOf(ops, 'common') as Record<string, unknown>;
    expect(common.teaching).toMatchObject({ unit: 'class', subjects: ['과학'], classes: ['5-1'] });
    expect(common.classBell).toEqual({ enabled: true, start: { on: true, amount: 1, unit: 'min', when: 'before' }, end: { on: false, amount: 0, unit: 'min', when: 'after' }, weekdaysOnly: true });
    expect(common.school).toEqual({ officeCode: 'B10', schoolCode: '7091375', officeName: '서울', name: '점검초', kind: '초등학교', grade: 3 });
  });

  it('관찰 문구는 v4_observationPhrases.phrases → common.phrases (P7-5)', () => {
    const { ops } = planSettings(SID, { phrases: { phrases: ['발표를 잘함', ' ', '발표를 잘함', '친구를 도움'] } }, {});
    expect((putOf(ops, 'common') as Record<string, unknown>).phrases).toEqual(['발표를 잘함', '친구를 도움']);
  });

  it('드라이브 자동 백업은 켜기·주기·남길 개수만 (마지막 백업 시각은 V4 것) - P8-3', () => {
    const { ops } = planSettings(SID, { autoBackup: { enabled: false, intervalDays: 14, keep: 4, lastAt: 5, lastName: 'SP4_자동백업_2026-10-01.json' } }, {});
    expect((putOf(ops, 'common') as Record<string, unknown>).autoBackup).toEqual({ enabled: false, intervalDays: 14, keep: 4 });
    // V4가 기본값 그대로면 칸을 적지 않는다
    expect(planSettings(SID, { autoBackup: { lastAt: 5 } }, {}).ops.length).toBe(0);
  });
});
