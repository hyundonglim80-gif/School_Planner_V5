import { describe, expect, it } from 'vitest';
import { boolField, customField, intField, oneOfField, type SettingsSpec } from './settings';
import {
  LOCAL_PREFS,
  readSnapshot,
  resolveResetValues,
  saveIntoSnapshot,
  snapshotDoc,
  type CurrentValues,
  type Fields,
  type LocalPrefs,
  type SnapshotSpecs,
} from './settingsSnapshot';
import { readSettings } from './settings';

// 기기·계정 칸 표 흉내 (진짜 표 app/prefs와 칸 이름은 같게 - 묶음에 드는 칸 + 빠지는 칸 하나씩)
const isObj = (v: unknown): v is Fields => !!v && typeof v === 'object' && !Array.isArray(v);
const specs: SnapshotSpecs = {
  device: {
    fontSizes: customField<Fields>({}, (v) => (isObj(v) ? v : undefined)),
    popupStyle: oneOfField('side', ['side', 'center', 'popup']),
    showWeekend: boolField(true),
    shortcutOverrides: customField<Fields>({}, (v) => (isObj(v) ? v : undefined)),
    // 빠지는 칸 - 학기 칩은 때를 따른다
    semesterFilter: oneOfField<string | number>('all', ['all', 1, 2]),
  } as SettingsSpec<Fields>,
  common: {
    forwardDays: intField(14, 1, 60),
    palette: customField('cobalt', (v) => (typeof v === 'string' ? v : undefined)),
    // 빠지는 칸 - 사람마다 다른 자료
    teaching: customField<unknown>(null, (v) => (isObj(v) ? v : undefined)),
  } as SettingsSpec<Fields>,
};

const LOCAL_DEFAULT: LocalPrefs = readSettings(LOCAL_PREFS, {});

const now = (over: { device?: Fields; common?: Fields; local?: Partial<LocalPrefs> } = {}): CurrentValues => ({
  device: { fontSizes: {}, popupStyle: 'side', showWeekend: true, shortcutOverrides: {}, semesterFilter: 'all', ...over.device },
  common: { forwardDays: 14, palette: 'cobalt', teaching: null, ...over.common },
  local: { ...LOCAL_DEFAULT, ...over.local },
});

describe('saveIntoSnapshot - 지금 값을 묶음에', () => {
  it('묶음에 드는 칸만, 기본과 다른 것만 (학기 칩·교사 유형은 빠진다)', () => {
    const s = saveIntoSnapshot(
      null,
      'pc',
      specs,
      now({
        device: { fontSizes: { day: 110 }, showWeekend: false, semesterFilter: 2 },
        common: { forwardDays: 30, teaching: { kind: 'subject' } },
        local: { boardMain: 40, theme: 'light' },
      }),
      1000,
    );
    expect(s).toEqual({
      common: { forwardDays: 30 },
      at: 1000,
      pc: { prefs: { fontSizes: { day: 110 }, showWeekend: false }, local: { boardMain: 40, theme: 'light' }, at: 1000 },
    });
    expect(s.mobile).toBeUndefined();
  });

  it('PC에서 저장하면 PC 몫 + 계정 몫만 바뀌고 휴대폰 몫은 그대로', () => {
    const first = saveIntoSnapshot(null, 'mobile', specs, now({ device: { popupStyle: 'center' }, common: { forwardDays: 7 } }), 1);
    const second = saveIntoSnapshot(first, 'pc', specs, now({ device: { popupStyle: 'popup' }, common: { forwardDays: 20 } }), 2);
    expect(second.mobile).toEqual(first.mobile);
    expect(second.pc?.prefs).toEqual({ popupStyle: 'popup' });
    expect(second.common).toEqual({ forwardDays: 20 });
    expect(second.at).toBe(2);
  });

  it('지금 값에 틀린 값이 섞여 있으면 기본으로 (묶음에 적지 않는다)', () => {
    const s = saveIntoSnapshot(null, 'pc', specs, now({ device: { popupStyle: 'weird' }, local: { boardDay: 120 as never } }), 1);
    expect(s.pc).toEqual({ prefs: {}, local: {}, at: 1 });
  });
});

describe('readSnapshot - 문서를 묶음으로', () => {
  it('모르는 칸·틀린 값은 버린다', () => {
    const s = readSnapshot(
      {
        common: { forwardDays: 99, palette: 5, teaching: { kind: 'x' }, later: 1 },
        at: 5,
        pc: { prefs: { popupStyle: 'popup', semesterFilter: 2, nope: true }, local: { theme: 'blue', dim: true, boardMain: 3 }, at: 'x' },
        mobile: 'not a part',
        updatedAt: { seconds: 1 },
      },
      specs,
    );
    // 이월 99일은 60으로 맞춘다(intField) · 모르는 칸·빠지는 칸은 없다
    expect(s).toEqual({ common: { forwardDays: 60 }, at: 5, pc: { prefs: { popupStyle: 'popup' }, local: { dim: true }, at: 0 } });
  });

  it('묶음 모양이 아니면 null (계정 몫이 없다)', () => {
    expect(readSnapshot(null, specs)).toBeNull();
    expect(readSnapshot({ pc: { prefs: {} } }, specs)).toBeNull();
    expect(readSnapshot([], specs)).toBeNull();
  });

  it('적은 문서를 다시 읽으면 같은 묶음', () => {
    const s = saveIntoSnapshot(null, 'pc', specs, now({ device: { fontSizes: { day: 90 } }, local: { memoView: 'list', rightPanelWidth: 520 } }), 7);
    expect(readSnapshot(JSON.parse(JSON.stringify(snapshotDoc(s))), specs)).toEqual(s);
  });
});

describe('resolveResetValues - 초기화가 가는 값 (내 것 → 관리자 → 앱 기본)', () => {
  const mine = saveIntoSnapshot(null, 'pc', specs, now({ device: { popupStyle: 'popup' }, common: { forwardDays: 3 }, local: { theme: 'light' } }), 1);
  const admin = saveIntoSnapshot(
    saveIntoSnapshot(null, 'pc', specs, now({ device: { showWeekend: false }, common: { palette: 'forest' }, local: { boardMain: 30 } }), 1),
    'mobile',
    specs,
    // 계정 몫은 마지막 저장이 통째로 바꾼다 - 같은 테마로
    now({ device: { popupStyle: 'center' }, common: { palette: 'forest' } }),
    2,
  );

  it('내 것이 있으면 내 것 (모든 칸이 찬 값)', () => {
    const r = resolveResetValues('pc', specs, mine, admin);
    expect(r.deviceFrom).toBe('mine');
    expect(r.commonFrom).toBe('mine');
    expect(r.device).toEqual({ fontSizes: {}, popupStyle: 'popup', showWeekend: true, shortcutOverrides: {} });
    expect(r.common).toEqual({ forwardDays: 3, palette: 'cobalt' });
    expect(r.local).toEqual({ ...LOCAL_DEFAULT, theme: 'light' });
  });

  it('몫마다 고른다 - 내 것에 빠진 칸(= 앱 기본)을 관리자 값으로 채우지 않는다', () => {
    const r = resolveResetValues('pc', specs, mine, admin);
    // 관리자는 주말 숨김·한눈에 30%지만 내 묶음은 둘 다 기본
    expect(r.device.showWeekend).toBe(true);
    expect(r.local.boardMain).toBeNull();
  });

  it('그 기기 종류 몫이 내 것에 없으면 기기 몫은 관리자 것, 계정 몫은 내 것', () => {
    const r = resolveResetValues('mobile', specs, mine, admin);
    expect(r.deviceFrom).toBe('admin');
    expect(r.device.popupStyle).toBe('center');
    expect(r.commonFrom).toBe('mine');
    expect(r.common.forwardDays).toBe(3);
  });

  it('내 것이 없으면 관리자 것, 둘 다 없으면 앱 기본', () => {
    const a = resolveResetValues('pc', specs, null, admin);
    expect([a.deviceFrom, a.commonFrom]).toEqual(['admin', 'admin']);
    expect(a.device.showWeekend).toBe(false);
    expect(a.common.palette).toBe('forest');
    expect(a.local.boardMain).toBe(30);
    const none = resolveResetValues('pc', specs, null, null);
    expect([none.deviceFrom, none.commonFrom]).toEqual(['app', 'app']);
    expect(none.device).toEqual({ fontSizes: {}, popupStyle: 'side', showWeekend: true, shortcutOverrides: {} });
    expect(none.local).toEqual(LOCAL_DEFAULT);
    expect(none.local.theme).toBe('dark'); // 정하지 않은 밝기 = 어둡게 (#113)
  });
});
