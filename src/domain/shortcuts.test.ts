import { describe, it, expect } from 'vitest';
import {
  SHORTCUT_ACTIONS,
  FIXED_SHORTCUTS,
  fixedShortcutIssue,
  isFixedShortcut,
  eventKeyOf,
  bindingFromEvent,
  matchesEvent,
  formatBinding,
  formatActionBinding,
  resolveBindings,
  findConflicts,
  isModifierOnly,
  assignBinding,
  recordKeyIssue,
  worksWhileTyping,
  isShortcutId,
  overridesFromBindings,
  readTabBindings,
  compactTabBindings,
  tabBindingsKey,
  isTabShortcutId,
  allBindings,
  bindingOf,
  formatAnyBinding,
  isCustomShortcutId,
  isExtraShortcutId,
  readCustomBindings,
  splitExtraBindings,
  type Binding,
  type TabShortcutId,
} from './shortcuts';

const ev = (over: Partial<KeyboardEvent> = {}) =>
  ({ key: '', code: '', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...over }) as KeyboardEvent;

const bind = (key: string, mods: Partial<Omit<Binding, 'key'>> = {}): Binding => ({
  ctrl: false,
  alt: false,
  shift: false,
  ...mods,
  key,
});

describe('eventKeyOf - 눌린 키의 이름', () => {
  it('자리(code)를 먼저 본다. Shift+1이 자판에 따라 !로 오기 때문이다', () => {
    expect(eventKeyOf(ev({ key: '!', code: 'Digit1' }))).toBe('1');
  });

  it('한글 입력 상태에서도 글자 키를 알아본다', () => {
    // 한글 상태에서 F 자리를 누르면 e.key 는 'ㄹ' 로 온다
    expect(eventKeyOf(ev({ key: 'ㄹ', code: 'KeyF' }))).toBe('F');
  });

  it('대소문자를 가리지 않는다', () => {
    expect(eventKeyOf(ev({ key: 'f', code: 'KeyF' }))).toBe('F');
  });

  it('화살표와 Space는 이름을 그대로 쓴다', () => {
    expect(eventKeyOf(ev({ key: 'ArrowUp', code: 'ArrowUp' }))).toBe('ArrowUp');
    expect(eventKeyOf(ev({ key: ' ', code: 'Space' }))).toBe('Space');
  });

  it('자리를 알 수 없는 기호도 받는다', () => {
    expect(eventKeyOf(ev({ key: '/', code: 'Slash' }))).toBe('/');
  });
});

describe('matchesEvent', () => {
  it('수식키가 하나라도 다르면 맞지 않다', () => {
    const b = bind('F', { ctrl: true });
    expect(matchesEvent(b, ev({ key: 'f', code: 'KeyF', ctrlKey: true }))).toBe(true);
    expect(matchesEvent(b, ev({ key: 'f', code: 'KeyF' }))).toBe(false);
    expect(matchesEvent(b, ev({ key: 'f', code: 'KeyF', ctrlKey: true, shiftKey: true }))).toBe(false);
  });

  it('맥의 Cmd는 Ctrl로 본다', () => {
    expect(matchesEvent(bind('F', { ctrl: true }), ev({ key: 'f', code: 'KeyF', metaKey: true }))).toBe(true);
  });

  it('켜고 끄는 기능은 ↑와 ↓를 같이 받는다', () => {
    const action = SHORTCUT_ACTIONS.find((a) => a.id === 'toggleEvents')!;
    const b = bind('ArrowUp', { ctrl: true });
    expect(matchesEvent(b, ev({ key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true }), action)).toBe(true);
    expect(matchesEvent(b, ev({ key: 'ArrowDown', code: 'ArrowDown', ctrlKey: true }), action)).toBe(true);
  });

  it('짝으로 보지 않는 기능은 방향을 구분한다', () => {
    const action = SHORTCUT_ACTIONS.find((a) => a.id === 'datePrev')!;
    const b = bind('ArrowLeft', { ctrl: true });
    expect(matchesEvent(b, ev({ key: 'ArrowRight', code: 'ArrowRight', ctrlKey: true }), action)).toBe(false);
  });

  it('화살표가 아닌 키로 바꾸면 짝 규칙은 적용되지 않는다', () => {
    const action = SHORTCUT_ACTIONS.find((a) => a.id === 'toggleEvents')!;
    const b = bind('E', { ctrl: true });
    expect(matchesEvent(b, ev({ key: 'e', code: 'KeyE', ctrlKey: true }), action)).toBe(true);
    expect(matchesEvent(b, ev({ key: 'ArrowDown', code: 'ArrowDown', ctrlKey: true }), action)).toBe(false);
  });
});

describe('bindingFromEvent - 입력칸에서 키를 잡을 때', () => {
  it('누른 대로 수식키까지 담는다', () => {
    expect(bindingFromEvent(ev({ key: 'm', code: 'KeyM', ctrlKey: true, shiftKey: true }))).toEqual({
      ctrl: true,
      alt: false,
      shift: true,
      key: 'M',
    });
  });

  it('수식키만 눌린 것은 걸러낸다', () => {
    expect(isModifierOnly(ev({ key: 'Control' }))).toBe(true);
    expect(isModifierOnly(ev({ key: 'A' }))).toBe(false);
  });
});

describe('보여주는 이름', () => {
  it('누르는 순서대로 적는다', () => {
    expect(formatBinding(bind('F', { ctrl: true, shift: true }))).toBe('Ctrl + Shift + F');
    expect(formatBinding(bind('ArrowLeft', { ctrl: true }))).toBe('Ctrl + ←');
  });

  it('짝으로 동작하는 기능은 ↑ / ↓ 로 적는다', () => {
    const action = SHORTCUT_ACTIONS.find((a) => a.id === 'toggleClass')!;
    expect(formatActionBinding(action, bind('ArrowUp', { alt: true }))).toBe('Alt + ↑ / ↓');
  });
});

describe('resolveBindings', () => {
  it('바꾼 것이 없으면 기본값이다', () => {
    const resolved = resolveBindings();
    expect(resolved.toggleEvents).toEqual(bind('ArrowUp', { ctrl: true }));
    expect(Object.keys(resolved)).toHaveLength(SHORTCUT_ACTIONS.length);
  });

  it('바꾼 것만 덮어쓴다', () => {
    const resolved = resolveBindings({ scopeMemo: bind('K', { ctrl: true }) });
    expect(resolved.scopeMemo).toEqual(bind('K', { ctrl: true }));
    expect(resolved.datePrev).toEqual(bind('ArrowLeft', { ctrl: true }));
  });

  it('고정 단축키(#149 - 검색·인쇄·되돌리기)는 예전에 바꿔 둔 키가 있어도 기본 키다', () => {
    const resolved = resolveBindings({ search: bind('K', { ctrl: true }), print: bind(''), undo: bind('U', { alt: true }) });
    expect(resolved.search).toEqual(bind('F', { ctrl: true }));
    expect(resolved.print).toEqual(bind('P', { ctrl: true }));
    expect(resolved.undo).toEqual(bind('Z', { ctrl: true }));
    // 저장할 때도 고정 단축키는 적지 않는다
    expect(overridesFromBindings({ ...resolveBindings(), search: bind('K', { ctrl: true }) })).toEqual({});
  });
});

describe('findConflicts - 겹치는 조합 찾기', () => {
  it('기본값끼리는 겹치지 않는다', () => {
    expect(findConflicts(resolveBindings())).toEqual([]);
  });

  it('같은 조합을 두 기능이 쓰면 잡아낸다', () => {
    const conflicts = findConflicts(resolveBindings({ help: bind('ArrowLeft', { ctrl: true }) }));
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain('help');
    expect(conflicts[0]).toContain('datePrev');
  });

  it('↑와 ↓는 짝이라 서로 겹치는 것으로 본다', () => {
    // 주말이 Shift+↑ 인데 일정을 Shift+↓ 로 두면, 둘 다 양쪽 화살표를 받으므로 겹친다
    const conflicts = findConflicts(resolveBindings({ toggleEvents: bind('ArrowDown', { shift: true }) }));
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain('toggleWeekend');
    expect(conflicts[0]).toContain('toggleEvents');
  });
});

describe('목록 자체', () => {
  it('id가 겹치지 않는다', () => {
    const ids = SHORTCUT_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('V5 새 id (MENU.md 3-8) - 인쇄 Ctrl+P, 되돌리기 Ctrl+Z, 새로 만들기 셋은 비어 있다', () => {
    const def = (id: string) => SHORTCUT_ACTIONS.find((a) => a.id === id)?.def;
    expect(def('print')).toEqual(bind('P', { ctrl: true }));
    expect(def('undo')).toEqual(bind('Z', { ctrl: true }));
    for (const id of ['newEvent', 'newNote', 'newMemo']) expect(def(id)?.key).toBe('');
  });

  it('ESC는 고정 목록에 있고 바꿀 수 있는 목록에는 없다', () => {
    expect(FIXED_SHORTCUTS.some((f) => f.keys === 'ESC')).toBe(true);
    expect(SHORTCUT_ACTIONS.some((a) => a.def.key === 'Escape')).toBe(false);
  });

  it('고정 단축키 (#149) = ESC · Ctrl + S · 검색 Ctrl + F · 인쇄 Ctrl + P · 되돌리기 Ctrl + Z - 까닭과 함께', () => {
    expect(FIXED_SHORTCUTS.map((f) => f.keys)).toEqual(['ESC', 'Ctrl + S', 'Ctrl + F', 'Ctrl + P', 'Ctrl + Z']);
    expect(FIXED_SHORTCUTS.filter((f) => f.id).map((f) => f.id)).toEqual(['search', 'print', 'undo']);
    for (const f of FIXED_SHORTCUTS) expect(f.why.length).toBeGreaterThan(0);
    expect(isFixedShortcut('search')).toBe(true);
    expect(isFixedShortcut('timetable')).toBe(false);
    expect(isFixedShortcut('settings:notify')).toBe(false);
  });

  it('모든 기능에 이름과 묶음이 있다', () => {
    for (const action of SHORTCUT_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
      expect(action.group.length).toBeGreaterThan(0);
    }
  });

  // #149 - 사용자 업무 계정 키를 모든 계정 기본값으로: 메뉴 열기 가운데 이 여섯만 기본 키가 있다
  const MENU_WITH_KEY = ['popOut', 'toggleTheme', 'toggleHeader', 'fontSmaller', 'fontLarger', 'fontReset'];

  it("'메뉴 열기'는 기본값이 비어 있고(#149의 여섯 빼고) 나머지는 채워져 있다", () => {
    for (const action of SHORTCUT_ACTIONS) {
      if (action.group === '메뉴 열기' && !MENU_WITH_KEY.includes(action.id)) {
        // 자주 쓰는 조합을 미리 차지해 두면 오히려 걸리적거린다. 쓸 사람이 직접 정한다.
        expect(action.def.key, `${action.id} 는 기본값이 없어야 한다`).toBe('');
      } else {
        expect(action.def.key, `${action.id} 의 기본 키가 비어 있다`).toBeTruthy();
      }
    }
  });

  it('#149 기본 키 = 사용자 업무 계정 PC 키 (화면 이동 숫자 · 한눈에 Space · 칸 닫기 Alt + S · 체크리스트 Ctrl + L · 키패드 + − * 0 · 백틱 · 역슬래시)', () => {
    const def = (id: string) => formatBinding(SHORTCUT_ACTIONS.find((a) => a.id === id)!.def);
    expect(['scopeDay', 'scopeWeek', 'scopeMonth', 'scopeYear', 'scopeMemo', 'scopeClass'].map(def)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(def('scopeBoard')).toBe('Space');
    expect(def('closePanel')).toBe('Alt + S');
    expect(def('checklist')).toBe('Ctrl + L');
    expect(MENU_WITH_KEY.map(def)).toEqual(['`', '*', '\\', '-', '+', '0']);
    for (const id of MENU_WITH_KEY) expect(SHORTCUT_ACTIONS.find((a) => a.id === id)!.group).toBe('메뉴 열기');
  });

  it('키를 정하지 않은 기능은 아무 키에도 걸리지 않는다', () => {
    const none = SHORTCUT_ACTIONS.find((a) => a.group === '메뉴 열기')!;
    expect(matchesEvent(none.def, ev({ key: 'a', code: 'KeyA' }), none)).toBe(false);
    expect(matchesEvent(none.def, ev({ key: 'Enter', code: 'Enter' }), none)).toBe(false);
  });

  it("정하지 않은 조합은 '없음'으로 보여준다", () => {
    const none = SHORTCUT_ACTIONS.find((a) => a.group === '메뉴 열기')!;
    expect(formatActionBinding(none, none.def)).toBe('없음');
  });

  it('키를 정하지 않은 기능끼리는 겹치지 않는다', () => {
    // 비어 있는 것이 여럿이므로, 그것들을 겹침으로 세면 저장이 영영 막힌다
    expect(findConflicts(resolveBindings())).toEqual([]);
  });
});

describe('지운 기능의 저장된 키 (19번 U4 명령 창)', () => {
  it("계정에 남은 'commandPalette' 키는 읽을 때 버린다 - Ctrl+K가 아무 기능에도 묶이지 않는다", () => {
    const bindings = resolveBindings({ commandPalette: { key: 'K', ctrl: true } } as never);
    expect(Object.keys(bindings)).not.toContain('commandPalette');
    expect(Object.values(bindings).some((b) => b.key === 'K' && b.ctrl && !b.shift && !b.alt)).toBe(false);
  });
});

describe('눌러서 정하기 (P18)', () => {
  const key = (k: string, mods: Partial<Binding> = {}): Binding => ({ ctrl: false, alt: false, shift: false, ...mods, key: k });

  it('키가 없던 기능에 키를 준다 - 겹친 것이 없으면 다른 기능은 그대로', () => {
    const { bindings, cleared } = assignBinding(resolveBindings(), 'timetable', key('T', { ctrl: true, alt: true }));
    expect(bindings.timetable).toEqual(key('T', { ctrl: true, alt: true }));
    expect(cleared).toEqual([]);
    expect(overridesFromBindings(bindings)).toEqual({ timetable: key('T', { ctrl: true, alt: true }) });
  });

  it('다른 기능이 쓰던 키면 그 기능에서 뺀다 (기본값이 있던 것은 없음으로 남는다)', () => {
    const { bindings, cleared } = assignBinding(resolveBindings(), 'timetable', key('5'));
    expect(cleared).toEqual(['scopeMemo']);
    expect(bindings.scopeMemo.key).toBe('');
    expect(findConflicts(bindings)).toEqual([]);
    expect(overridesFromBindings(bindings)).toEqual({ timetable: key('5'), scopeMemo: key('') });
  });

  it('고정 단축키(#149)는 바꾸지도 빼지도 않는다', () => {
    const own = assignBinding(resolveBindings(), 'search', key('K', { ctrl: true }));
    expect(own.bindings.search).toEqual(key('F', { ctrl: true }));
    expect(own.cleared).toEqual([]);
    expect(assignBinding(resolveBindings(), 'undo', key('')).bindings.undo).toEqual(key('Z', { ctrl: true }));
    // 그 키를 다른 것에 주는 것은 recordKeyIssue가 막는다 - 여기까지 와도 고정 단축키에서 빼지 않는다
    const other = assignBinding(resolveBindings(), 'timetable', key('P', { ctrl: true }));
    expect(other.cleared).toEqual([]);
    expect(other.bindings.print).toEqual(key('P', { ctrl: true }));
  });

  it('↑/↓ 짝 기능: Shift+↓를 다른 기능에 주면 Shift+↑ 주말 토글에서 뺀다', () => {
    const { cleared } = assignBinding(resolveBindings(), 'trash', key('ArrowUp', { shift: true }));
    expect(cleared).toEqual(['toggleWeekend']);
    const pair = assignBinding(resolveBindings(), 'toggleEvents', key('ArrowDown', { shift: true }));
    expect(pair.cleared).toEqual(['toggleWeekend']);
  });

  it('제 키를 다시 주면 아무것도 빼지 않는다 · 빈 키 = 그 기능 단축키 지우기', () => {
    expect(assignBinding(resolveBindings(), 'scopeMemo', key('5', { shift: true })).cleared).toEqual([]);
    const { bindings, cleared } = assignBinding(resolveBindings(), 'scopeMemo', key(''));
    expect(cleared).toEqual([]);
    expect(bindings.scopeMemo.key).toBe('');
  });

  it('Ctrl+S·ESC는 받지 않는다, 나머지는 받는다', () => {
    expect(recordKeyIssue(key('S', { ctrl: true }))).toMatch(/저장/);
    expect(recordKeyIssue(key('Escape'))).toMatch(/ESC/);
    expect(recordKeyIssue(key('S', { ctrl: true, shift: true }))).toBeNull();
    expect(recordKeyIssue(key('T', { alt: true }))).toBeNull();
  });

  it('글 칸 키·브라우저가 가져가는 키는 까닭과 함께 막는다 (P22-5 ■4)', () => {
    for (const k of ['C', 'V', 'X', 'A', 'Z']) expect(recordKeyIssue(key(k, { ctrl: true }))).toMatch(/글 칸/);
    for (const k of ['W', 'T', 'N']) expect(recordKeyIssue(key(k, { ctrl: true }))).toMatch(/브라우저/);
    expect(recordKeyIssue(key('C', { ctrl: true, shift: true }))).toBeNull();
    expect(recordKeyIssue(key('W', { alt: true }))).toBeNull();
    expect(recordKeyIssue(key('C'))).toBeNull();
  });

  it('그 기능의 기본 키는 받는다', () => {
    expect(recordKeyIssue(key('5', { shift: true }), 'scopeMemo')).toBeNull();
    expect(recordKeyIssue(key('Z', { ctrl: true }), 'timetable')).toMatch(/글 칸/);
  });

  it('고정 단축키(#149): 그 기능은 바꿀 수 없고(빈 키도) · 그 키는 다른 것에 줄 수 없다', () => {
    expect(recordKeyIssue(key('K', { ctrl: true }), 'search')).toBe("'검색 열기'는 고정 단축키(Ctrl + F)라 바꿀 수 없습니다.");
    expect(recordKeyIssue(key('F', { ctrl: true }), 'search')).toMatch(/고정/);
    expect(recordKeyIssue(key(''), 'undo')).toMatch(/고정/);
    expect(recordKeyIssue(key('F', { ctrl: true }), 'timetable')).toBe('Ctrl + F는 고정 단축키(검색 열기)라 쓸 수 없습니다.');
    expect(recordKeyIssue(key('P', { ctrl: true }), 'settings:notify')).toMatch(/고정 단축키\(이 화면 인쇄\)/);
    expect(recordKeyIssue(key('P', { ctrl: true }))).toMatch(/고정/);
    // 수식키가 다르면 다른 키다
    expect(recordKeyIssue(key('F', { ctrl: true, alt: true }), 'timetable')).toBeNull();
    expect(fixedShortcutIssue('print')).toMatch(/Ctrl \+ P/);
    expect(fixedShortcutIssue('timetable')).toBeNull();
  });

  it('Ctrl·Alt 없는 키는 글 칸 안에서 듣지 않는다고 알린다', () => {
    expect(worksWhileTyping(key('T'))).toBe(false);
    expect(worksWhileTyping(key('T', { shift: true }))).toBe(false);
    expect(worksWhileTyping(key('T', { alt: true }))).toBe(true);
    expect(worksWhileTyping(key(''))).toBe(true);
  });

  it('↑/↓ 짝 토글과 다른 기능의 같은 화살표는 겹침이다 (목록 탭도 막는다 - 먼저 적힌 토글이 키를 가져간다)', () => {
    const bindings = { ...resolveBindings(), trash: key('ArrowDown', { shift: true }) };
    expect(findConflicts(bindings)).toEqual([['toggleWeekend', 'trash']]);
  });

  it('isShortcutId - 목록에 있는 id만', () => {
    expect(isShortcutId('timetable')).toBe(true);
    expect(isShortcutId('commandPalette')).toBe(false);
  });
});

describe('창 안 탭 키 (P18-2)', () => {
  const key = (k: string, mods: Partial<Binding> = {}): Binding => ({ ctrl: false, alt: false, shift: false, ...mods, key: k });
  const known = (id: TabShortcutId) => id === 'settings:notify' || id === 'backup:import';

  it("'창:탭' id는 단축키 id와 갈린다", () => {
    expect(isTabShortcutId('settings:notify')).toBe(true);
    expect(isTabShortcutId('settings')).toBe(false);
    expect(isTabShortcutId('a:b:c')).toBe(false);
    expect(SHORTCUT_ACTIONS.some((a) => isTabShortcutId(a.id))).toBe(false);
  });

  it('읽을 때 모르는 탭·빈 키·틀린 모양은 버린다, 통째로 틀리면 undefined', () => {
    expect(
      readTabBindings(
        {
          'settings:notify': key('N', { ctrl: true, alt: true }),
          'backup:import': key(''),
          'trash:all': key('T', { alt: true }),
          help: key('H', { alt: true }),
          'backup:tidy': { key: 'X' },
        },
        known,
      ),
    ).toEqual({ 'settings:notify': key('N', { ctrl: true, alt: true }) });
    expect(readTabBindings([], known)).toBeUndefined();
    expect(readTabBindings('x', known)).toBeUndefined();
  });

  it('빈 키는 빠지고, 견줄 때 적힌 차례는 상관없다', () => {
    const a = { 'settings:notify': key('N', { alt: true }), 'backup:import': key('') };
    expect(compactTabBindings(a)).toEqual({ 'settings:notify': key('N', { alt: true }) });
    const b = { 'backup:import': key('I', { alt: true }), 'settings:notify': key('N', { alt: true }) };
    const c = { 'settings:notify': key('N', { alt: true }), 'backup:import': key('I', { alt: true }) };
    expect(tabBindingsKey(b)).toBe(tabBindingsKey(c));
    expect(tabBindingsKey(a)).not.toBe(tabBindingsKey(c));
  });

  it('기능 다음에 탭 - 기능이 먼저 키를 가져간다(키 처리 차례)', () => {
    const all = allBindings(resolveBindings(), { 'settings:notify': key('N', { alt: true }) });
    expect(all.at(-1)).toEqual({ id: 'settings:notify', binding: key('N', { alt: true }) });
    expect(all.slice(0, SHORTCUT_ACTIONS.length).map((x) => x.id)).toEqual(SHORTCUT_ACTIONS.map((a) => a.id));
  });

  it('기능과 탭이 같은 조합이면 겹침이다', () => {
    expect(findConflicts(resolveBindings(), { 'settings:notify': key('F', { ctrl: true }) })).toEqual([['search', 'settings:notify']]);
    expect(findConflicts(resolveBindings(), { 'settings:notify': key('N', { alt: true }), 'backup:import': key('N', { alt: true }) })).toEqual([
      ['backup:import', 'settings:notify'],
    ]);
    expect(findConflicts(resolveBindings(), { 'settings:notify': key('N', { alt: true }) })).toEqual([]);
  });

  it('탭에 키를 주면 그 키를 쓰던 기능·탭에서 뺀다', () => {
    const tabs = { 'backup:import': key('N', { alt: true }) };
    const r = assignBinding(resolveBindings(), 'settings:notify', key('N', { alt: true }), tabs);
    expect(r.extra).toEqual({ 'settings:notify': key('N', { alt: true }) });
    expect(r.cleared).toEqual(['backup:import']);
    const r2 = assignBinding(resolveBindings(), 'settings:notify', key('5'));
    expect(r2.cleared).toEqual(['scopeMemo']);
    expect(r2.bindings.scopeMemo.key).toBe('');
    // 넘긴 것은 고치지 않는다
    expect(tabs).toEqual({ 'backup:import': key('N', { alt: true }) });
  });

  it('기능에 키를 주면 그 키를 쓰던 탭은 빠진다 · 탭에 빈 키 = 빠짐', () => {
    const r = assignBinding(resolveBindings(), 'timetable', key('N', { alt: true }), { 'settings:notify': key('N', { alt: true }) });
    expect(r.extra).toEqual({});
    expect(r.cleared).toEqual(['settings:notify']);
    expect(r.bindings.timetable).toEqual(key('N', { alt: true }));
    const gone = assignBinding(resolveBindings(), 'settings:notify', key(''), { 'settings:notify': key('N', { alt: true }) });
    expect(gone.extra).toEqual({});
    expect(gone.cleared).toEqual([]);
  });

  it('지금 키 · 보이는 글', () => {
    expect(bindingOf('settings:notify', resolveBindings())).toEqual(key(''));
    expect(bindingOf('settings:notify', resolveBindings(), { 'settings:notify': key('N', { alt: true }) })).toEqual(key('N', { alt: true }));
    expect(bindingOf('search', resolveBindings())).toEqual(key('F', { ctrl: true }));
    expect(formatAnyBinding('settings:notify', key('N', { ctrl: true, alt: true }))).toBe('Ctrl + Alt + N');
    expect(formatAnyBinding('toggleWeekend', key('ArrowUp', { shift: true }))).toBe('Shift + ↑ / ↓');
  });
});

describe('내가 만든 키 - 환경설정 값 (P28-2)', () => {
  const key = (k: string, mods: Partial<Omit<Binding, 'key'>> = {}): Binding => bind(k, mods);

  it('id 모양: opt.<이름>.<값> · opt.<이름>(켜기/끄기) · press.<…> - 창 안 탭·기능과 갈린다', () => {
    for (const id of ['opt.popupStyle.popup', 'opt.contrast', 'opt.alarmSound.-1', 'opt.autoBackupKeep.8', 'press.ab12']) {
      expect(isCustomShortcutId(id)).toBe(true);
      expect(isExtraShortcutId(id)).toBe(true);
      expect(isTabShortcutId(id)).toBe(false);
    }
    for (const id of ['opt', 'opt.', 'settings:notify', 'search', 'other.x', 'opt.a.b.c', 'opt.a b']) expect(isCustomShortcutId(id)).toBe(false);
    expect(isExtraShortcutId('settings:notify')).toBe(true);
    expect(isExtraShortcutId('search')).toBe(false);
  });

  it('계정 칸 읽기: 모양이 맞으면 모르는 id도 남긴다(나중 판의 값) · 빈 키·틀린 모양은 뺀다', () => {
    expect(
      readCustomBindings({
        'opt.popupStyle.popup': key('P', { alt: true }),
        'opt.someFutureThing.x': key('Q', { alt: true }),
        'opt.contrast': key(''),
        'settings:notify': key('N', { alt: true }),
        'opt.bad': { key: 'X' },
      }),
    ).toEqual({ 'opt.popupStyle.popup': key('P', { alt: true }), 'opt.someFutureThing.x': key('Q', { alt: true }) });
    expect(readCustomBindings([])).toBeUndefined();
    expect(readCustomBindings(null)).toBeUndefined();
  });

  it('한 목록 → 칸 둘 (창 안 탭 · 내가 만든 것), 빈 키는 뺀다', () => {
    expect(
      splitExtraBindings({ 'settings:notify': key('N', { alt: true }), 'opt.contrast': key('H', { alt: true }), 'opt.dim': key('') }),
    ).toEqual({ tabs: { 'settings:notify': key('N', { alt: true }) }, custom: { 'opt.contrast': key('H', { alt: true }) } });
  });

  it('값 키도 한 목록으로 겹침을 본다 - 주면 그 키를 쓰던 기능·탭에서 빼고, 기능에 주면 값 키가 빠진다', () => {
    const extra = { 'settings:notify': key('N', { alt: true }) };
    const r = assignBinding(resolveBindings(), 'opt.popupStyle.popup', key('N', { alt: true }), extra);
    expect(r.extra).toEqual({ 'opt.popupStyle.popup': key('N', { alt: true }) });
    expect(r.cleared).toEqual(['settings:notify']);
    const r2 = assignBinding(resolveBindings(), 'timetable', key('H', { alt: true }), { 'opt.contrast': key('H', { alt: true }) });
    expect(r2.extra).toEqual({});
    expect(r2.cleared).toEqual(['opt.contrast']);
    expect(findConflicts(resolveBindings(), { 'opt.contrast': key('F', { ctrl: true }) })).toEqual([['search', 'opt.contrast']]);
    expect(allBindings(resolveBindings(), { 'opt.contrast': key('H', { alt: true }) }).at(-1)).toEqual({ id: 'opt.contrast', binding: key('H', { alt: true }) });
    expect(bindingOf('opt.contrast', resolveBindings())).toEqual(key(''));
    expect(formatAnyBinding('opt.contrast', key('H', { alt: true }))).toBe('Alt + H');
  });
});
