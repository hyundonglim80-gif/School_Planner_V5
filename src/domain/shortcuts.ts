// 단축키 정의 한 곳 (V4 lib/shortcuts.ts에서 id째 옮김 + V5 새 id - MENU.md 3-8).
//
// 예전에는 키 처리와 사용 설명서의 목록이 따로 적혀 있어서, 키를 하나 바꾸면 설명서가 그대로 남아 실제와 달라졌다
// (일정 토글은 설명서에도 단추 툴팁에도 없었다). 여기 적힌 것을 키 처리(app/keys)도 툴팁도 설명서도 본다.
// id는 V4와 같다 - 사용자가 V4에서 바꾼 키를 그대로 가져온다(P2-4). 창을 여는 id는 창 목록(app/windows)의 id와 같다.

/** 누르는 조합 하나 */
export interface Binding {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** 'F' 'A' '1' '/' 같은 한 글자, 또는 'ArrowUp' 'Space' 'Enter' 같은 이름 */
  key: string;
}

export type ShortcutId =
  | 'search'
  | 'scopeDay'
  | 'scopeWeek'
  | 'scopeMonth'
  | 'scopeYear'
  | 'scopeBoard'
  | 'scopeMemo'
  | 'scopeClass'
  | 'scopePrev'
  | 'scopeNext'
  | 'datePrev'
  | 'dateNext'
  | 'dateToday'
  | 'toggleWeekend'
  | 'toggleEvents'
  | 'toggleClass'
  | 'toggleHeader'
  | 'fontSmaller'
  | 'fontLarger'
  | 'fontReset'
  | 'lastYear'
  | 'clipboard'
  | 'multiSelect'
  | 'calendar'
  | 'dday'
  | 'trash'
  | 'labels'
  | 'recurring'
  | 'forwarding'
  | 'roster'
  | 'notices'
  | 'attendance'
  | 'subjectAttendance'
  | 'studentRecord'
  | 'seating'
  | 'drawStudent'
  | 'evalOverview'
  | 'weeklyGuide'
  | 'group'
  | 'timetable'
  | 'progress'
  | 'backup'
  | 'help'
  | 'settings'
  | 'teachingMode'
  | 'newCourse'
  | 'toggleTheme'
  | 'checklist'
  // V5 새 id (MENU.md 3-8)
  | 'newEvent'
  | 'newNote'
  | 'newMemo'
  | 'print'
  | 'undo'
  | 'closePanel'
  | 'popOut'
  | 'mail'
  | 'chat';

/**
 * 창 안의 탭 (P18-2): '<창 id>:<탭 id>' (예 'settings:notify' = 환경설정 알림 탭). 단축키 id에는 ':'가 없어 갈린다.
 * 어떤 탭이 있는지는 app/tabShortcuts(창의 탭 타입으로 적는다) - 여기는 키 다루기만.
 */
export type TabShortcutId = `${string}:${string}`;
/**
 * 내가 만든 그 밖의 단축키 (P28 - 기기 칸 customShortcuts, 창 안 탭과 칸을 나눈다):
 *   'opt.<이름>.<값>' = 환경설정 값 고르기(켜기/끄기는 'opt.<이름>' - P28-2, app/optionShortcuts) · 'press.<…>' = 단추 대신 누르기(P28-3).
 * 하는 일은 app/customShortcuts에 단 것이 안다 - 여기는 키 다루기만. ':'가 없어 창 안 탭과 갈린다.
 */
export type CustomShortcutId = `opt.${string}` | `press.${string}`;
/** 기능 목록 밖에서 키를 준 것 = 창 안 탭 + 내가 만든 것 (기본값이 없다 - 키를 준 것만 적는다) */
export type ExtraShortcutId = TabShortcutId | CustomShortcutId;
/** 키를 줄 수 있는 것 = 기능(단축키 목록) + 창 안 탭 + 내가 만든 것 */
export type AnyShortcutId = ShortcutId | ExtraShortcutId;
/** 창 안 탭 키 - 키를 준 탭만 적는다(기본값이 없다) */
export type TabBindings = Partial<Record<TabShortcutId, Binding>>;
/** 내가 만든 것의 키 - 키를 준 것만 */
export type CustomBindings = Partial<Record<CustomShortcutId, Binding>>;
/** 창 안 탭 + 내가 만든 것의 키 (키 처리·겹침은 한 목록으로 본다, 저장은 칸 둘 - splitExtraBindings) */
export type ExtraBindings = Partial<Record<ExtraShortcutId, Binding>>;

export const isTabShortcutId = (id: string): id is TabShortcutId => /^[A-Za-z]+:[A-Za-z]+$/.test(id);
export const isCustomShortcutId = (id: string): id is CustomShortcutId => /^(opt|press)\.[A-Za-z0-9]+(\.[A-Za-z0-9-]+)?$/.test(id);
/** 기능 목록 밖의 것인가 (창 안 탭·내가 만든 것) */
export const isExtraShortcutId = (id: string): id is ExtraShortcutId => isTabShortcutId(id) || isCustomShortcutId(id);

export interface ShortcutAction {
  id: ShortcutId;
  label: string;
  group: string;
  def: Binding;
  /**
   * 화살표 위/아래를 짝으로 본다.
   * 켜고 끄는 기능이라 어느 쪽을 눌러도 같은 동작이고, 예전부터 그렇게 써 왔다.
   * 화살표가 아닌 키로 바꾸면 이 규칙은 적용되지 않는다.
   */
  pairArrows?: boolean;
  /**
   * 고정 단축키 (메모 요청 #149 - 다른 프로그램에서도 같은 뜻으로 써서 키만 보고 기능을 알 수 있는 것): 바꾸거나 해제할 수 없다.
   * 값 = 바꾸지 않는 까닭(단축키 탭·설명서의 '고정' 묶음에 보인다). 계정에 남은 옛 키는 resolveBindings가 보지 않는다.
   */
  fixed?: string;
}

const b = (key: string, mods: Partial<Omit<Binding, 'key'>> = {}): Binding => ({
  ctrl: false,
  alt: false,
  shift: false,
  ...mods,
  key,
});

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  // 검색·인쇄·되돌리기는 고정 (메모 요청 #149 - 거의 모든 프로그램이 같은 키를 같은 뜻으로 쓴다)
  { id: 'search', label: '검색 열기', group: '열기', def: b('F', { ctrl: true }), fixed: '거의 모든 프로그램에서 Ctrl + F가 찾기라 바꾸지 않습니다.' },
  // 이 화면 인쇄 (V5 - 주간·년간의 🖨️ 단추 대신, MENU.md 4장). 인쇄할 수 없는 화면에서는 브라우저 인쇄
  { id: 'print', label: '이 화면 인쇄', group: '열기', def: b('P', { ctrl: true }), fixed: '거의 모든 프로그램에서 Ctrl + P가 인쇄라 바꾸지 않습니다.' },
  // 되돌리기 (V5 - 지우기·옮기기·완료 등). 글 칸 안에서는 글 되돌리기(브라우저)가 먼저라 글 칸 밖에서만 받는다
  {
    id: 'undo',
    label: '되돌리기 (글 칸 밖에서)',
    group: '쓰는 칸',
    def: b('Z', { ctrl: true }),
    fixed: '거의 모든 프로그램에서 Ctrl + Z가 되돌리기라 바꾸지 않습니다. 글 칸 안에서는 글 되돌리기가 먼저입니다.',
  },
  // ── 기본 키 (11-11 메모 요청 #149 '이 계정 단축키를 모든 계정 초기화 값으로' - 사용자 업무 계정의 PC 키를 그대로 옮겼다.
  //    전에는 화면 이동 Shift + 1~7 · 칸 닫기 Alt + W · 체크리스트 Ctrl + Shift + L, 메뉴 열기 묶음은 모두 비어 있었다.
  //    + · * 는 숫자 키패드 키다(본 자판의 + · * 는 Shift가 함께 눌려 다른 조합). 계정에 남은 '바꾼 것'은 그대로 이긴다) ──
  // 쓰는 칸(메모·기록) 글 칸에서 커서가 있는 줄 앞에 ☐ (19번 U9). 커서가 글 칸에 있을 때만 동작한다 - 글 칸 밖에서는 브라우저 Ctrl + L(주소 칸)
  { id: 'checklist', label: '체크리스트 (쓰는 칸 줄 앞에 ☐)', group: '쓰는 칸', def: b('L', { ctrl: true }) },
  // 보고 있는 칸 하나만 닫기 (10-26 사용자 요청 - 탭의 ×와 같다, ESC는 모두). Ctrl+W는 브라우저가 탭을 닫아 처음엔 Alt+W, #149부터 Alt+S. 글 칸 안에서도 된다(Alt)
  { id: 'closePanel', label: '보고 있는 칸 닫기 (오른쪽 칸의 탭 하나)', group: '쓰는 칸', def: b('S', { alt: true }) },

  { id: 'scopeDay', label: '하루 화면', group: '화면 이동', def: b('1') },
  { id: 'scopeWeek', label: '주간 화면', group: '화면 이동', def: b('2') },
  { id: 'scopeMonth', label: '월간 화면', group: '화면 이동', def: b('3') },
  { id: 'scopeYear', label: '년간 화면', group: '화면 이동', def: b('4') },
  { id: 'scopeMemo', label: '메모 화면', group: '화면 이동', def: b('5') },
  { id: 'scopeClass', label: '학급 화면', group: '화면 이동', def: b('6') },
  // 한눈에(P24-3, V5) - 처음엔 Shift+7, #149부터 Space(수식키 없는 Space·Enter는 단추·카드에 초점이 있으면 그것을 누르기가 먼저 - app/keys)
  { id: 'scopeBoard', label: '한눈에 화면', group: '화면 이동', def: b('Space') },
  { id: 'scopePrev', label: '이전 화면으로', group: '화면 이동', def: b('ArrowLeft', { shift: true }) },
  { id: 'scopeNext', label: '다음 화면으로', group: '화면 이동', def: b('ArrowRight', { shift: true }) },

  { id: 'datePrev', label: '이전 날짜', group: '날짜 이동', def: b('ArrowLeft', { ctrl: true }) },
  { id: 'dateNext', label: '다음 날짜', group: '날짜 이동', def: b('ArrowRight', { ctrl: true }) },
  { id: 'dateToday', label: '오늘 날짜로', group: '날짜 이동', def: b('Space', { ctrl: true }) },

  { id: 'toggleWeekend', label: '주말 보이기 / 숨기기', group: '화면 표시', def: b('ArrowUp', { shift: true }), pairArrows: true },
  { id: 'toggleEvents', label: '일정 보이기 / 숨기기', group: '화면 표시', def: b('ArrowUp', { ctrl: true }), pairArrows: true },
  { id: 'toggleClass', label: '수업 보이기 / 숨기기', group: '화면 표시', def: b('ArrowUp', { alt: true }), pairArrows: true },

  // 아래는 기본값이 비어 있다. 쓰고 싶은 사람이 직접 정한다 - 새 창으로 빼기·밝기·머리줄 접기·글자 크기만 #149부터 기본 키가 있다.
  // 자주 쓰는 조합을 미리 차지해 두면 오히려 걸리적거린다.
  // 새로 만들기 (V5 - 머리줄 '＋ 새로'와 같다)
  { id: 'newEvent', label: '새 일정', group: '메뉴 열기', def: b('') },
  { id: 'newNote', label: '그날 새 메모', group: '메뉴 열기', def: b('') },
  { id: 'newMemo', label: '날짜 없는 새 메모', group: '메뉴 열기', def: b('') },
  { id: 'multiSelect', label: '여러 개 고르기', group: '메뉴 열기', def: b('') },
  // 주간 화면의 '작년 이맘때' (ROADMAP 7). 다른 화면에서 누르면 주간으로 가서 켠다.
  { id: 'lastYear', label: '작년 이맘때 보이기 / 숨기기 (주간)', group: '메뉴 열기', def: b('') },
  { id: 'clipboard', label: '클립보드 칸 열기 / 닫기', group: '메뉴 열기', def: b('') },
  { id: 'calendar', label: '구글 캘린더로 보내기 (백업 · 가져오기 · 보내기)', group: '메뉴 열기', def: b('') },
  { id: 'dday', label: 'D-Day 관리', group: '메뉴 열기', def: b('') },
  // 보고 있는 칸을 새 창으로 빼기 (#125 - 칸 머리 ↗와 같다)
  { id: 'popOut', label: '보고 있는 칸 새 창으로 빼기 (오른쪽 칸의 탭 하나)', group: '메뉴 열기', def: b('`') },
  { id: 'trash', label: '휴지통 열기 / 닫기', group: '메뉴 열기', def: b('') },
  { id: 'labels', label: '라벨 관리', group: '메뉴 열기', def: b('') },
  { id: 'recurring', label: '반복 일정 (새 일정 칸, 반복을 펴고)', group: '메뉴 열기', def: b('') },
  { id: 'forwarding', label: '지난 일정 오늘로 가져오기 (오늘 화면의 줄)', group: '메뉴 열기', def: b('') },
  { id: 'roster', label: '명렬표 (학급 화면)', group: '메뉴 열기', def: b('') },
  { id: 'notices', label: '알림장 모아 보기', group: '메뉴 열기', def: b('') },
  { id: 'attendance', label: '출석부', group: '메뉴 열기', def: b('') },
  { id: 'subjectAttendance', label: '교과 출결 누계', group: '메뉴 열기', def: b('') },
  { id: 'studentRecord', label: '학생 기록(누가기록)', group: '메뉴 열기', def: b('') },
  { id: 'seating', label: '자리표', group: '메뉴 열기', def: b('') },
  { id: 'drawStudent', label: '발표자 뽑기 (자리표)', group: '메뉴 열기', def: b('') },
  { id: 'evalOverview', label: '조사표 모아 보기', group: '메뉴 열기', def: b('') },
  { id: 'group', label: '공유 그룹 (계정 칸)', group: '메뉴 열기', def: b('') },
  // ✉ 쪽지 (P15-2 - 머리줄 ✉와 같다)
  { id: 'mail', label: '쪽지 (같은 그룹 선생님)', group: '메뉴 열기', def: b('') },
  // 💬 대화 (P19-2 - 머리줄 💬와 같다)
  { id: 'chat', label: '대화 (같은 그룹 선생님)', group: '메뉴 열기', def: b('') },
  { id: 'timetable', label: '시간표', group: '메뉴 열기', def: b('') },
  { id: 'progress', label: '진도 관리', group: '메뉴 열기', def: b('') },
  { id: 'weeklyGuide', label: '주간학습안내', group: '메뉴 열기', def: b('') },
  { id: 'backup', label: '백업 · 가져오기 · 보내기', group: '메뉴 열기', def: b('') },
  { id: 'help', label: '사용 설명서', group: '메뉴 열기', def: b('') },
  { id: 'settings', label: '환경설정', group: '메뉴 열기', def: b('') },
  { id: 'teachingMode', label: '교사 유형 바꾸기', group: '메뉴 열기', def: b('') },
  { id: 'newCourse', label: '진도 만들기 (여러 반)', group: '메뉴 열기', def: b('') },
  // 화면 밝기 (ROADMAP 17) - 어둡게 ↔ 밝게
  { id: 'toggleTheme', label: '어둡게 / 밝게 보기', group: '메뉴 열기', def: b('*') },
  // 머리줄 접기 / 펴기 (메모 요청 #142 - 내용만 크게 보기. 머리줄 아래 가운데 ▲ · 접은 뒤 화면 위 가운데 ▼와 같다)
  { id: 'toggleHeader', label: '머리줄 접기 / 펴기 (내용만 크게 보기)', group: '메뉴 열기', def: b('\\') },
  // 글자 크기 (메모 요청 #145 - 환경설정 보기 탭 − / 초기화 / +와 같다). 지금 보는 화면만, 누를 때마다 5%씩 쌓인다
  { id: 'fontSmaller', label: '글자 작게 (지금 화면 −5%)', group: '메뉴 열기', def: b('-') },
  { id: 'fontLarger', label: '글자 크게 (지금 화면 +5%)', group: '메뉴 열기', def: b('+') },
  { id: 'fontReset', label: '글자 크기 초기화 (지금 화면 100%)', group: '메뉴 열기', def: b('0') },
];

// ── 키 이름 ────────────────────────────────────────────────────────────

const KEY_LABEL: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Space',
  Enter: 'Enter',
};

/** 화면에 보여줄 이름 ('Ctrl + ↑') */
export function formatBinding(binding: Binding): string {
  if (!binding.key) return '없음';
  const parts: string[] = [];
  if (binding.ctrl) parts.push('Ctrl');
  if (binding.alt) parts.push('Alt');
  if (binding.shift) parts.push('Shift');
  parts.push(KEY_LABEL[binding.key] || binding.key);
  return parts.join(' + ');
}

// ── 고정 단축키 ────────────────────────────────────────────────────────

/** 바꾸지 않는 단축키. 목록에는 보여주되 고칠 수 없다. */
export interface FixedShortcut {
  /** 기능 목록에 있는 고정 단축키면 그 id (ESC·Ctrl+S는 없음) */
  id?: ShortcutId;
  label: string;
  keys: string;
  why: string;
}

/** 고정 단축키인 기능 (메모 요청 #149) - 단축키 탭·설명서는 기능 묶음이 아니라 '고정'에 보인다 */
export const isFixedShortcut = (id: string): boolean => SHORTCUT_ACTIONS.some((a) => a.id === id && !!a.fixed);

/** ESC·Ctrl+S(키 처리가 따로) 다음 기능 목록의 고정 단축키(검색·인쇄·되돌리기) - 키 글은 기본 키에서 */
export const FIXED_SHORTCUTS: FixedShortcut[] = [
  {
    label: '오른쪽 칸(창·쓰는 칸) 모두 닫기 - 저장하지 않은 글이 있으면 먼저 묻습니다',
    keys: 'ESC',
    why: '거의 모든 프로그램이 같은 뜻으로 쓰는 키라 바꾸지 않습니다.',
  },
  {
    label: '저장 (일정·메모·알림장·출석부 칸, 조사표, 그리고 저장 단추가 있는 모든 팝업)',
    keys: 'Ctrl + S',
    why: '글을 쓰던 칸·팝업 안에서 동작하는 키라 화면 전체 단축키와 따로 움직입니다.',
  },
  ...SHORTCUT_ACTIONS.filter((a) => a.fixed).map((a) => ({ id: a.id, label: a.label, keys: formatBinding(a.def), why: a.fixed! })),
];

/** 화살표 위/아래를 짝으로 보는 기능은 '↑ / ↓' 로 보여준다 */
export function formatActionBinding(action: ShortcutAction, binding: Binding): string {
  if (!binding.key) return '없음';
  if (action.pairArrows && (binding.key === 'ArrowUp' || binding.key === 'ArrowDown')) {
    const head = formatBinding({ ...binding, key: 'ArrowUp' }).replace(' + ↑', '');
    return `${head} + ↑ / ↓`;
  }
  return formatBinding(binding);
}

/**
 * 눌린 키를 우리가 쓰는 이름으로 바꾼다.
 *
 * e.key 만 보면 안 된다. Shift+1 은 자판에 따라 e.key 가 '!' 로 오고,
 * 한글 상태에서는 글자 키가 'ㅁ' 처럼 온다. 그래서 자리(e.code)를 먼저 본다.
 */
export function eventKeyOf(e: Pick<KeyboardEvent, 'key' | 'code'>): string {
  const digit = /^Digit([0-9])$/.exec(e.code || '');
  if (digit) return digit[1];
  const letter = /^Key([A-Z])$/.exec(e.code || '');
  if (letter) return letter[1];
  if (e.code === 'Space' || e.key === ' ') return 'Space';
  if (e.key in KEY_LABEL) return e.key;
  if (e.key && e.key.length === 1) return e.key.toUpperCase();
  return e.key;
}

/** 눌린 키를 그대로 조합으로 만든다 (단축키 입력칸에서 쓴다) */
export function bindingFromEvent(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): Binding {
  return {
    ctrl: e.ctrlKey || e.metaKey,
    alt: e.altKey,
    shift: e.shiftKey,
    key: eventKeyOf(e),
  };
}

/** 수식키(Ctrl/Alt/Shift)만 눌린 상태인지 */
export function isModifierOnly(e: Pick<KeyboardEvent, 'key'>): boolean {
  return ['Control', 'Alt', 'Shift', 'Meta', 'CapsLock'].includes(e.key);
}

/** 이 조합이 눌렸는가 */
export function matchesEvent(
  binding: Binding,
  e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>,
  action?: ShortcutAction
): boolean {
  // 키를 정하지 않은 기능은 아무 키에도 걸리지 않는다 (기본값이 비어 있는 것들)
  if (!binding.key) return false;
  if (binding.ctrl !== (e.ctrlKey || e.metaKey)) return false;
  if (binding.alt !== e.altKey) return false;
  if (binding.shift !== e.shiftKey) return false;

  const pressed = eventKeyOf(e);
  if (pressed === binding.key) return true;

  // 켜고 끄는 기능은 ↑ 와 ↓ 를 같이 받는다
  if (action?.pairArrows && (binding.key === 'ArrowUp' || binding.key === 'ArrowDown')) {
    return pressed === 'ArrowUp' || pressed === 'ArrowDown';
  }
  return false;
}

// ── 저장된 값 다루기 ───────────────────────────────────────────────────

export type ShortcutOverrides = Partial<Record<ShortcutId, Binding>>;

/** 기본값 위에 사용자가 바꾼 것을 덮는다 - 고정 단축키(#149)는 늘 기본 키(예전에 바꿔 둔 키는 보지 않는다) */
export function resolveBindings(overrides: ShortcutOverrides = {}): Record<ShortcutId, Binding> {
  const out = {} as Record<ShortcutId, Binding>;
  for (const action of SHORTCUT_ACTIONS) {
    out[action.id] = (!action.fixed && overrides[action.id]) || action.def;
  }
  return out;
}

/** 고른 키 전부 → 기본값과 다른 것만 (나중에 기본값을 고치면 그대로 따라온다, V4). 고정 단축키는 적지 않는다 */
export function overridesFromBindings(bindings: Record<ShortcutId, Binding>): ShortcutOverrides {
  const out: ShortcutOverrides = {};
  for (const action of SHORTCUT_ACTIONS) {
    if (action.fixed) continue;
    const cur = bindings[action.id];
    const def = action.def;
    if (cur.ctrl !== def.ctrl || cur.alt !== def.alt || cur.shift !== def.shift || cur.key !== def.key) out[action.id] = cur;
  }
  return out;
}

/**
 * 계정 설정 문서에서 읽은 바꾼 키 → 믿을 만한 것만 (V4 sanitizePreferences).
 * 모르는 id(나중 판이 더한 것·없어진 것)와 모양이 틀린 키는 뺀다. 통째로 틀리면 undefined.
 */
export function readShortcutOverrides(v: unknown): ShortcutOverrides | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const known = new Set<string>(SHORTCUT_ACTIONS.map((a) => a.id));
  const out: ShortcutOverrides = {};
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    const k = readBinding(raw);
    if (known.has(id) && k) out[id as ShortcutId] = k;
  }
  return out;
}

function readBinding(raw: unknown): Binding | null {
  const k = raw as Record<string, unknown> | null;
  if (!k || typeof k !== 'object' || typeof k.key !== 'string' || typeof k.ctrl !== 'boolean' || typeof k.alt !== 'boolean' || typeof k.shift !== 'boolean') return null;
  return { ctrl: k.ctrl, alt: k.alt, shift: k.shift, key: k.key };
}

/** 계정 설정 문서의 창 안 탭 키(P18-2) → 믿을 만한 것만. known = 지금 있는 탭인가(없어진 탭·모양이 틀린 키·빈 키는 뺀다). 통째로 틀리면 undefined. */
export function readTabBindings(v: unknown, known: (id: TabShortcutId) => boolean): TabBindings | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: TabBindings = {};
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    const k = readBinding(raw);
    if (k && k.key && isTabShortcutId(id) && known(id)) out[id] = k;
  }
  return out;
}

/**
 * 계정 설정 문서의 내가 만든 키(P28 customShortcuts) → 믿을 만한 것만. 모양이 맞는 id면 이 판이 모르는 것도 남긴다
 * (나중 판이 더한 값·단추 키를 옛 판이 걸러 다시 쓰면 지워진다 - 그래서 창 안 탭과 칸을 나눴다). 빈 키는 뺀다. 통째로 틀리면 undefined.
 */
export function readCustomBindings(v: unknown): CustomBindings | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: CustomBindings = {};
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    const k = readBinding(raw);
    if (k && k.key && isCustomShortcutId(id)) out[id] = k;
  }
  return out;
}

/** 한 목록(키 처리·겹침) → 저장하는 칸 둘 (창 안 탭 tabShortcuts · 내가 만든 것 customShortcuts) */
export function splitExtraBindings(extra: ExtraBindings): { tabs: TabBindings; custom: CustomBindings } {
  const tabs: TabBindings = {};
  const custom: CustomBindings = {};
  for (const [id, k] of Object.entries(extra) as Array<[ExtraShortcutId, Binding | undefined]>) {
    if (!k?.key) continue;
    if (isTabShortcutId(id)) tabs[id] = k;
    else if (isCustomShortcutId(id)) custom[id] = k;
  }
  return { tabs, custom };
}

/** 빈 키를 뺀다 (목록에서 비운 탭 = 빠짐) */
export function compactTabBindings(tabs: TabBindings): TabBindings {
  const out: TabBindings = {};
  for (const [id, k] of Object.entries(tabs) as Array<[TabShortcutId, Binding | undefined]>) if (k?.key) out[id] = k;
  return out;
}

/** 견주기용 - 적힌 차례와 빈 키에 상관없이 같으면 같은 글 */
export function tabBindingsKey(tabs: TabBindings): string {
  const c = compactTabBindings(tabs);
  return JSON.stringify((Object.keys(c) as TabShortcutId[]).sort().map((id) => [id, c[id]]));
}

/**
 * 이 조합이 차지하는 자리들 ('CA|T'). 키가 없으면 없음.
 * ↑ 와 ↓ 를 같이 받는 기능은 두 방향을 모두 차지한다 - Shift+↑ 주말 토글이 있으면 다른 기능의 Shift+↓도 겹친다(먼저 적힌 토글이 키를 가져간다).
 */
function slotsOf(action: ShortcutAction | undefined, binding: Binding | undefined): string[] {
  if (!binding || !binding.key) return [];
  const mods = `${binding.ctrl ? 'C' : ''}${binding.alt ? 'A' : ''}${binding.shift ? 'S' : ''}|`;
  if (action?.pairArrows && (binding.key === 'ArrowUp' || binding.key === 'ArrowDown')) return [`${mods}ArrowUp`, `${mods}ArrowDown`];
  return [mods + binding.key];
}

export interface BindingEntry {
  id: AnyShortcutId;
  /** 기능이면 그 줄 (창 안 탭은 없음) */
  action?: ShortcutAction;
  binding: Binding;
}

/**
 * 키를 줄 수 있는 것 모두 - 기능(목록 차례) 다음 창 안 탭·내가 만든 것(id 차례, 키가 있는 것만).
 * 키 처리(app/keys)도 이 차례로 본다(먼저 것이 키를 가져간다)
 */
export function allBindings(bindings: Record<ShortcutId, Binding>, extra: ExtraBindings = {}): BindingEntry[] {
  const out: BindingEntry[] = SHORTCUT_ACTIONS.map((action) => ({ id: action.id, action, binding: bindings[action.id] }));
  for (const id of (Object.keys(extra) as ExtraShortcutId[]).sort()) {
    const binding = extra[id];
    if (binding?.key && isExtraShortcutId(id)) out.push({ id, binding });
  }
  return out;
}

/** 같은 조합을 쓰는 기능(·창 안 탭·내가 만든 것)이 있으면 그 쌍을 돌려준다 */
export function findConflicts(bindings: Record<ShortcutId, Binding>, extra: ExtraBindings = {}): Array<[AnyShortcutId, AnyShortcutId]> {
  const slots = new Map<string, AnyShortcutId>();
  const conflicts: Array<[AnyShortcutId, AnyShortcutId]> = [];

  for (const { id, action, binding } of allBindings(bindings, extra)) {
    const met = new Set<AnyShortcutId>();
    for (const slot of slotsOf(action, binding)) {
      const taken = slots.get(slot);
      if (!taken) slots.set(slot, id);
      else if (!met.has(taken)) {
        met.add(taken);
        conflicts.push([taken, id]);
      }
    }
  }
  return conflicts;
}

// ── 눌러서 정하기 (P18 - 메뉴·단추를 눌러 기능을 고르고 키를 누른다) ─────────

export function isShortcutId(id: string): id is ShortcutId {
  return SHORTCUT_ACTIONS.some((a) => a.id === id);
}

/**
 * 한 기능(·창 안 탭·내가 만든 것)에 키를 준다. 같은 자리(조합)를 쓰던 다른 것은 그 키를 뺀다(기능 = 없음, 그 밖 = 목록에서 빠짐) - 뺀 것 목록도 돌려준다.
 * 목록(단축키 탭)은 겹치면 저장을 막지만, 눌러서 정할 때는 '이 키를 여기에'가 뜻이 분명하다(PLAN 5장 P18).
 * 키가 빈 조합을 주면 그것의 단축키를 지운다.
 * 고정 단축키(#149)는 바꾸지도 빼지도 않는다 - 그 키를 다른 것에 주는 것은 recordKeyIssue가 먼저 막는다.
 */
export function assignBinding(
  bindings: Record<ShortcutId, Binding>,
  id: AnyShortcutId,
  binding: Binding,
  extra: ExtraBindings = {},
): { bindings: Record<ShortcutId, Binding>; extra: ExtraBindings; cleared: AnyShortcutId[] } {
  const next = { ...bindings };
  const nextExtra: ExtraBindings = { ...extra };
  if (isFixedShortcut(id)) return { bindings: next, extra: nextExtra, cleared: [] };
  let action: ShortcutAction | undefined;
  if (isExtraShortcutId(id)) {
    if (binding.key) nextExtra[id] = binding;
    else delete nextExtra[id];
  } else {
    next[id] = binding;
    action = SHORTCUT_ACTIONS.find((a) => a.id === id);
  }
  const mine = new Set(slotsOf(action, binding));
  const cleared: AnyShortcutId[] = [];
  if (mine.size === 0) return { bindings: next, extra: nextExtra, cleared };
  for (const other of allBindings(next, nextExtra)) {
    if (other.id === id || other.action?.fixed || !slotsOf(other.action, other.binding).some((s) => mine.has(s))) continue;
    if (isExtraShortcutId(other.id)) delete nextExtra[other.id];
    else next[other.id] = b('');
    cleared.push(other.id);
  }
  return { bindings: next, extra: nextExtra, cleared };
}

/** 글 칸이 쓰는 Ctrl 키 - 단축키로 주면 글 칸에서 복사·붙여넣기가 안 된다 */
const TEXT_BOX_KEYS: Readonly<Record<string, string>> = { C: '복사', V: '붙여넣기', X: '잘라내기', A: '모두 고르기', Z: '되돌리기' };
/** 브라우저가 먼저 가져가는 Ctrl 키 - 앱까지 오지 않는다 */
const BROWSER_KEYS: Readonly<Record<string, string>> = { W: '탭 닫기', T: '새 탭', N: '새 창' };

/** 고정 단축키인 기능을 고르면(눌러서 정하기) 까닭 글 - 아니면 null (#149) */
export function fixedShortcutIssue(id: string): string | null {
  const action = SHORTCUT_ACTIONS.find((a) => a.id === id && a.fixed);
  return action ? `'${action.label}'는 고정 단축키(${formatBinding(action.def)})라 바꿀 수 없습니다.` : null;
}

/**
 * 받지 않는 키 - 까닭 글. 받을 수 있으면 null (ESC는 기록 취소라 여기까지 오지 않는다).
 * id = 그 키를 줄 기능 - 그 기능의 기본 키는 받는다. 고정 단축키(검색·인쇄·되돌리기 - #149)는 그 기능도 바꿀 수 없고, 그 키를 다른 것에 줄 수도 없다.
 */
export function recordKeyIssue(binding: Binding, id?: AnyShortcutId): string | null {
  if (id) {
    const fixed = fixedShortcutIssue(id);
    if (fixed) return fixed;
  }
  const def = SHORTCUT_ACTIONS.find((a) => a.id === id)?.def;
  if (def && formatBinding(def) === formatBinding(binding)) return null;
  if (binding.key === 'Escape') return 'ESC는 바꿀 수 없는 키입니다.';
  const ctrlOnly = binding.ctrl && !binding.alt && !binding.shift;
  if (ctrlOnly && binding.key === 'S') return 'Ctrl + S는 저장 키라 쓸 수 없습니다.';
  const text = ctrlOnly ? TEXT_BOX_KEYS[binding.key] : undefined;
  if (text) return `Ctrl + ${binding.key}는 글 칸의 ${text} 키라 쓸 수 없습니다.`;
  const browser = ctrlOnly ? BROWSER_KEYS[binding.key] : undefined;
  if (browser) return `Ctrl + ${binding.key}는 브라우저가 먼저 가져가(${browser}) 앱까지 오지 않습니다.`;
  const taken = binding.key ? SHORTCUT_ACTIONS.find((a) => a.fixed && formatBinding(a.def) === formatBinding(binding)) : undefined;
  if (taken) return `${formatBinding(binding)}는 고정 단축키(${taken.label})라 쓸 수 없습니다.`;
  return null;
}

/** 글 칸 안에서도 동작하는 조합인가 - Ctrl·Alt가 없으면 글을 칠 때는 듣지 않는다(app/keys) */
export function worksWhileTyping(binding: Binding): boolean {
  return !binding.key || binding.ctrl || binding.alt;
}

export function labelOf(id: ShortcutId): string {
  return SHORTCUT_ACTIONS.find((a) => a.id === id)?.label || id;
}

/** 그것의 지금 키 (창 안 탭·내가 만든 것은 없으면 빈 키) */
export function bindingOf(id: AnyShortcutId, bindings: Record<ShortcutId, Binding>, extra: ExtraBindings = {}): Binding {
  return isExtraShortcutId(id) ? extra[id] || b('') : bindings[id];
}

/** 화면에 보여줄 키 - 기능은 ↑/↓ 짝까지(formatActionBinding), 창 안 탭·내가 만든 것은 그대로 */
export function formatAnyBinding(id: AnyShortcutId, binding: Binding): string {
  const action = isExtraShortcutId(id) ? undefined : SHORTCUT_ACTIONS.find((a) => a.id === id);
  return action ? formatActionBinding(action, binding) : formatBinding(binding);
}
