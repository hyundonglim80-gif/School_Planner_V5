import { describe, expect, it } from 'vitest';
import { isCustomShortcutId } from './shortcuts';
import { buttonName, isItemBoundValue, isPressShortcutId, isUsableAttr, needsParams, pressIdOf, prunePressTargets, readPressTargets } from './pressTarget';

describe('단추 대신 누르기 - 적는 모양 (P28-3)', () => {
  it('같은 자리·찾기면 같은 id, 하나라도 다르면 다른 id · 이름은 셈에 넣지 않는다 · id 모양은 내가 만든 키', () => {
    const a = pressIdOf({ screen: 'memo', attr: 'data-memo-view-toggle' });
    expect(a).toBe(pressIdOf({ screen: 'memo', attr: 'data-memo-view-toggle' }));
    expect(isPressShortcutId(a)).toBe(true);
    expect(isCustomShortcutId(a)).toBe(true);
    expect(pressIdOf({ screen: 'day', attr: 'data-memo-view-toggle' })).not.toBe(a);
    expect(pressIdOf({ screen: 'memo', attr: 'data-memo-view-toggle', value: 'card' })).not.toBe(a);
    // 창 안 단추는 화면을 셈에 넣지 않는다 (어느 화면에서 골랐든 같은 단추)
    expect(pressIdOf({ win: 'settings', tab: 'view', screen: 'day', attr: 'data-x' })).toBe(pressIdOf({ win: 'settings', tab: 'view', screen: 'memo', attr: 'data-x' }));
    expect(pressIdOf({ win: 'settings', tab: 'view', attr: 'data-x' })).not.toBe(pressIdOf({ win: 'settings', tab: 'app', attr: 'data-x' }));
  });

  it('날짜·항목 id가 든 값 = 항목마다 다르다', () => {
    expect(isItemBoundValue('2027-03-05')).toBe(true);
    expect(isItemBoundValue('2027-03')).toBe(true);
    expect(isItemBoundValue('AbCdEfGhIjKlMnOpQrSt')).toBe(true);
    expect(isItemBoundValue('event:AbCdEfGhIjKlMnOpQrSt')).toBe(true);
    expect(isItemBoundValue('u_Q1w2E3r4T5y6U7i8O9p0A1s2D3f4')).toBe(true);
    expect(isItemBoundValue('card')).toBe(false);
    expect(isItemBoundValue('dflt_n1')).toBe(false);
    expect(isItemBoundValue('popupStyle:popup')).toBe(false);
    expect(isItemBoundValue('2027')).toBe(false);
  });

  it('쓸 수 있는 표시 · 단추 이름 · 탭 말고 값이 있는 창', () => {
    expect(isUsableAttr('data-note-attach')).toBe(true);
    expect(isUsableAttr('data-shortcut-target')).toBe(false);
    expect(isUsableAttr('data-window-key')).toBe(false);
    expect(isUsableAttr('aria-label')).toBe(false);
    expect(isUsableAttr('data-x"]')).toBe(false);
    expect(buttonName('  📎\n  첨부  ')).toBe('📎 첨부');
    expect(buttonName('가'.repeat(30))).toHaveLength(24);
    expect(needsParams(undefined)).toBe(false);
    expect(needsParams({ tab: 'view', focus: 'x' })).toBe(false);
    expect(needsParams({ classId: 'c1' })).toBe(true);
    expect(needsParams({ id: 'n1', tab: 'x' })).toBe(true);
  });

  it('계정 문서 읽기 - 모양이 틀린 것은 뺀다 · 창 안 단추는 화면을 버린다 · 서버에는 키 있는 것만', () => {
    const ok = pressIdOf({ win: 'settings', attr: 'data-x' });
    const got = readPressTargets({
      [ok]: { win: 'settings', tab: 'view', screen: 'day', attr: 'data-x', label: '환경설정 → 보기 → 가', only: true, junk: 1 },
      'press.bad.id': { attr: 'data-x', label: 'x' },
      'press.nolabel': { attr: 'data-x' },
      'press.badattr': { attr: 'onclick', label: 'x' },
      'opt.contrast': { attr: 'data-x', label: 'x' },
    });
    expect(got).toEqual({ [ok]: { win: 'settings', tab: 'view', attr: 'data-x', label: '환경설정 → 보기 → 가', only: true } });
    expect(readPressTargets([])).toBeUndefined();
    expect(readPressTargets('x')).toBeUndefined();
    const other = pressIdOf({ screen: 'memo', attr: 'data-y' });
    const all = { ...got, [other]: { screen: 'memo', attr: 'data-y', label: '메모 → 나' } };
    expect(Object.keys(prunePressTargets(all, { [other]: { key: 'K' } }))).toEqual([other]);
  });
});
