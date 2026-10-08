// 머리줄 첫 줄 (MENU.md 3-1, V4 Layout 머리줄).
//   PC     : SP5 · ⏳ D-Day · 🗑️ 휴지통 … ＋ 새로 · 🔍 검색 · [화면 탭] · (📂 공간) | ? · ⋮ · 사진
//   휴대폰 : SP5 · ⏳ · 🗑️ … 🔍 · (📂) | ? · ⋮ · 사진   (화면 탭은 아래 탭바, ＋는 탭바 위 둥근 단추)
// 단추는 단축키 id로 일을 부탁한다(keys.runShortcut) - 창이 들어오면 저절로 열린다.
import { useEffect, useRef, useState } from 'react';
import type { ShortcutId } from '../domain/shortcuts';
import { useSession } from '../data/session';
import { logout } from '../features/auth/login';
import { canRun, runFromButton, useShortcutOverrides, useShortcutTitle } from './keys';
import { MORE_MENU } from './moreMenu';
import { setScope, useNav } from './nav';
import { SCREENS } from './screens';
import { formatActionBinding, resolveBindings, SHORTCUT_ACTIONS } from '../domain/shortcuts';

/** 머리줄 작은 단추 (V4 모양) */
const HEAD_BTN =
  'p-1 sm:px-2.5 sm:py-1.5 rounded-md sm:rounded-xl text-xs font-bold transition-all flex items-center gap-0 sm:gap-1 shadow-2xs shrink-0';

export default function Header() {
  const scope = useNav((s) => s.scope);
  const user = useSession((s) => s.user);
  const withShortcut = useShortcutTitle();
  // 어느 계정으로 들어와 있는지 언제든 확인할 수 있게 (V4 - 계정이 여럿이면 화면만 봐서는 알 수 없었다)
  const accountTitle = user?.email ? `${user.displayName || '사용자'} (${user.email})` : user?.displayName || '사용자';

  return (
    <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
      {/* 자리가 모자라면 겹치는 대신 검색·화면 탭 묶음이 아랫줄로 내려간다 (V4) */}
      <div className="flex flex-wrap items-center justify-between flex-1 gap-x-0.5 sm:gap-x-4 gap-y-1.5 pr-1 sm:pr-2 min-w-0">
        <div className="flex items-center gap-0.5 sm:gap-2 shrink">
          <h1 className="text-base sm:text-xl font-extrabold text-primary tracking-tighter pr-0 sm:pr-1 shrink-0">SP5</h1>
          {/* ⏳ D-Day - 좁은 화면에서도 남은 날은 보인다(V4). 남은 날 글자는 P5-3 */}
          <button
            type="button"
            data-header-dday
            onClick={() => runFromButton('dday')}
            className={`${HEAD_BTN} bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80`}
            title={withShortcut('학사 D-Day 관리', 'dday')}
          >
            <span>⏳</span>
            <span className="hidden sm:inline">D-Day</span>
          </button>
          {/* 휴지통은 휴대폰에서도 맨 위에 (V4 사용자 결정) */}
          <button
            type="button"
            data-header-trash
            onClick={() => runFromButton('trash')}
            className={`${HEAD_BTN} bg-slate-100 hover:bg-slate-200 text-slate-600`}
            title={withShortcut('휴지통', 'trash')}
            aria-label="휴지통"
          >
            <span>🗑️</span>
            <span className="hidden sm:inline">휴지통</span>
          </button>
          {/* P8-1: 📅 못 보낸 일정 N (구글 캘린더 - 있을 때만) */}
        </div>

        <div className="flex flex-wrap items-center gap-0.5 sm:gap-2 gap-y-1.5 shrink min-w-0">
          <NewMenu />
          <button
            type="button"
            data-header-search
            onClick={() => runFromButton('search')}
            className={`${HEAD_BTN} bg-slate-100 hover:bg-slate-200 text-slate-600 shadow-none`}
            title={withShortcut('검색', 'search')}
          >
            <span>🔍</span>
            <span className="hidden sm:inline">검색</span>
          </button>
          {/* 화면 탭 - 좁은 화면에서는 아래 탭바(MobileTabBar)가 대신한다 */}
          <div className="hidden sm:flex bg-slate-100 p-1 rounded-xl gap-1 shrink-0 overflow-hidden">
            {SCREENS.map((s) => (
              <button
                key={s.id}
                type="button"
                data-scope-tab={s.id}
                aria-pressed={scope === s.id}
                onClick={() => setScope(s.id)}
                title={withShortcut(`${s.label} 화면`, s.shortcut)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  scope === s.id ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {/* P8-4: 📂 공간 고르기 (공유 그룹이 있을 때) */}
        </div>
      </div>

      {/* 오른쪽 끝 - 드롭다운이 잘리지 않게 줄바꿈 묶음 밖에 둔다 */}
      <div className="flex items-center gap-0.5 sm:gap-2 shrink-0 pl-1 border-l border-slate-200">
        <button
          type="button"
          data-header-help
          onClick={() => runFromButton('help')}
          className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-md sm:rounded-xl text-xs sm:text-sm transition-colors"
          title={withShortcut('사용 설명서', 'help')}
          aria-label="사용 설명서"
        >
          ?
        </button>
        <MoreMenu />
        <AccountMenu title={accountTitle} />
      </div>
    </div>
  );
}

/** 바깥을 누르거나 ESC면 닫히는 드롭다운 */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

/** 메뉴 항목 오른쪽의 단축키 (정한 것이 없으면 아무것도) */
function MenuKey({ id }: { id: ShortcutId }) {
  const overrides = useShortcutOverrides((s) => s.overrides);
  const binding = resolveBindings(overrides)[id];
  if (!binding.key) return null;
  const action = SHORTCUT_ACTIONS.find((a) => a.id === id)!;
  return <kbd className="ml-auto pl-2 shrink-0 text-2xs font-mono font-bold text-slate-400 whitespace-nowrap">{formatActionBinding(action, binding)}</kbd>;
}

const NEW_ITEMS: Array<{ id: ShortcutId; icon: string; label: string }> = [
  { id: 'newEvent', icon: '📅', label: '새 일정' },
  { id: 'newNote', icon: '📔', label: '새 기록' },
  { id: 'newMemo', icon: '🗒️', label: '새 메모' },
];

function NewItems({ close }: { close: () => void }) {
  return (
    <>
      {NEW_ITEMS.map((it) => (
        <button
          key={it.id}
          type="button"
          data-new={it.id}
          onClick={() => {
            close();
            runFromButton(it.id);
          }}
          className={`w-full px-4 py-2 text-left font-bold flex items-center gap-2 hover:bg-slate-50 hover:text-primary ${
            canRun(it.id) ? 'text-slate-700' : 'text-slate-400'
          }`}
        >
          <span>{it.icon}</span> {it.label}
          <MenuKey id={it.id} />
        </button>
      ))}
    </>
  );
}

/** ＋ 새로 (PC 머리줄) / 둥근 ＋ (휴대폰 - 탭바 위 오른쪽). 어느 화면에서나 새 일정·기록·메모 (V5 새 기능) */
function NewMenu() {
  const { open, setOpen, ref } = useDropdown();
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-new-menu
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`${HEAD_BTN} hidden sm:flex bg-primary hover:bg-blue-700 text-white`}
        title="새로 만들기"
      >
        <span>＋</span>
        <span>새로</span>
      </button>
      <button
        type="button"
        data-new-fab
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="sm:hidden fixed right-4 z-40 w-12 h-12 rounded-full bg-primary text-white text-2xl font-bold shadow-lg flex items-center justify-center"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
        title="새로 만들기"
        aria-label="새로 만들기"
      >
        ＋
      </button>
      {open && (
        <div
          data-new-list
          className="fixed sm:absolute right-4 sm:right-auto sm:left-0 bottom-36 sm:bottom-auto sm:top-10 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 text-xs"
        >
          <NewItems close={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/** 계정 사진 (없으면 이름 첫 글자) */
function Avatar({ size }: { size: 'sm' | 'lg' }) {
  const user = useSession((s) => s.user);
  const box = size === 'lg' ? 'w-10 h-10 text-base' : 'w-6 h-6 sm:w-8 sm:h-8 text-xs';
  return user?.photoURL ? (
    <img src={user.photoURL} alt="" className={`${box} rounded-full border-2 border-white shadow-sm object-cover shrink-0`} />
  ) : (
    <span className={`${box} rounded-full bg-slate-200 border-2 border-white flex items-center justify-center font-bold text-slate-500 shadow-sm shrink-0`}>
      {(user?.displayName || '선').charAt(0)}
    </span>
  );
}

/**
 * 계정 칸 (MENU 3-5): 사진을 누르면 이름·메일·로그아웃. V4는 PC 머리줄에 로그아웃 단추, 휴대폰은 ⋮에 두었다.
 * 👥 공유 그룹(만들기·참여·관리)은 P8-4에서 이 칸에 더한다.
 */
function AccountMenu({ title }: { title: string }) {
  const { open, setOpen, ref } = useDropdown();
  const user = useSession((s) => s.user);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-account
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={title}
        aria-label={`계정: ${title}`}
        className="flex rounded-full cursor-pointer"
      >
        <Avatar size="sm" />
      </button>
      {open && (
        <div data-account-panel className="absolute right-0 top-10 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 text-xs">
          <div className="flex items-center gap-3 px-4 py-2">
            <Avatar size="lg" />
            <div className="min-w-0">
              <div data-account-name className="text-sm font-black text-slate-800 truncate">
                {user?.displayName || '이름 없음'}
              </div>
              <div data-account-email className="text-xs text-slate-500 truncate">
                {user?.email}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 mt-1 pt-1">
            <button
              type="button"
              data-logout
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="w-full px-4 py-2 text-left font-bold flex items-center gap-2 text-slate-700 hover:bg-slate-50 hover:text-red-600 cursor-pointer"
            >
              <span>🚪</span> 로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** ⋮ 메뉴 - 4구역 8항목 (moreMenu.ts). 구역 안의 차례는 자주 쓰는 것이 위. */
function MoreMenu() {
  const { open, setOpen, ref } = useDropdown();
  const scope = useNav((s) => s.scope);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-more-menu
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-md sm:rounded-xl text-sm sm:text-base transition-colors"
        title="더보기 메뉴"
      >
        ⋮
      </button>
      {open && (
        <div data-more-list className="absolute right-0 top-10 w-72 max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 text-xs">
          {MORE_MENU.map((section) => (
            <div key={section.section} role="group" aria-label={section.section} data-menu-section={section.section} className="border-t border-slate-100 first:border-t-0 mt-1 pt-1">
              <div className="px-4 pt-1.5 pb-0.5 text-2xs font-black text-slate-500 tracking-wide select-none">{section.section}</div>
              {section.items
                .filter((item) => !item.screens || item.screens.includes(scope))
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-menu-item={item.id}
                    onClick={() => {
                      setOpen(false);
                      runFromButton(item.id);
                    }}
                    className={`w-full px-4 py-2 text-left font-bold flex items-center gap-2 hover:bg-slate-50 hover:text-primary ${
                      canRun(item.id) ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    <span>{item.icon}</span> {item.label}
                    <MenuKey id={item.id} />
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
