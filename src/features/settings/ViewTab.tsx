// 환경설정 '보기' 탭 (MENU 3-6). 모두 누르는 즉시 바뀐다 - V4는 글자 크기·창 위치·화면 밝기만 즉시, 나머지는 '저장'을 기다렸다.
// 화면 밝기 말고는 계정에 PC·휴대폰 따로 올라간다(app/prefs).
import { useEffect, useState } from 'react';
import { FONT_SCALES } from '../../domain/fontScale';
import { setFontScale, setPopupStyle, useLayoutPrefs, type PopupStyle } from '../../app/layoutPrefs';
import { setEnableScrollNav, setStartupScope, setToggle, useNav, type StartupScope } from '../../app/nav';
import { SCREENS } from '../../app/screens';
import { readThemeMode, setThemeMode, THEME_CHANGED_EVENT, type ThemeMode } from '../../app/theme';
import { useShortcutTitle } from '../../app/keys';
import { Choices, Section, ToggleRow } from './parts';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: '🖥️ 기기 설정 따라' },
  { value: 'light', label: '☀️ 밝게' },
  { value: 'dark', label: '🌙 어둡게' },
];

const POPUP_STYLE_OPTIONS: { value: PopupStyle; label: string }[] = [
  { value: 'side', label: '오른쪽 칸' },
  { value: 'center', label: '가운데 창 (예전 방식)' },
];

const STARTUP_OPTIONS: { value: StartupScope; label: string }[] = [
  { value: 'last', label: '마지막에 보던 화면' },
  ...SCREENS.map((s) => ({ value: s.id, label: s.label })),
];

export default function ViewTab() {
  const nav = useNav();
  const { fontScale, popupStyle } = useLayoutPrefs();
  // 화면 밝기는 이 기기에만 (localStorage) - 단축키로 바꿔도 창에 보이게 알림을 듣는다
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readThemeMode);
  useEffect(() => {
    const onChange = () => setThemeModeState(readThemeMode());
    window.addEventListener(THEME_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGED_EVENT, onChange);
  }, []);
  const withKey = useShortcutTitle();

  return (
    <div>
      <p className="px-5 pt-4 text-xs text-slate-500 leading-relaxed">
        이 탭은 고르는 즉시 바뀌고, <strong className="text-slate-700">PC와 휴대폰을 따로</strong> 계정에 저장합니다(화면 밝기는 이 기기에만).
      </p>

      <Section id="display" title="화면 표시" desc="둘째 줄의 주말 / 일정 / 수업 단추와 같은 값입니다.">
        <ToggleRow
          id="showWeekend"
          label="주말"
          hint={withKey('토·일 칸을 달력에 보여줍니다', 'toggleWeekend')}
          checked={nav.showWeekend}
          onChange={(v) => setToggle('showWeekend', v)}
        />
        <ToggleRow
          id="showEvents"
          label="일정"
          hint={withKey('하루·주간·월간·년간에 일정 항목을 보여줍니다', 'toggleEvents')}
          checked={nav.showEvents}
          onChange={(v) => setToggle('showEvents', v)}
        />
        <ToggleRow
          id="showClass"
          label="수업"
          hint={withKey('시간표와 교시 항목을 보여줍니다', 'toggleClass')}
          checked={nav.showClass}
          onChange={(v) => setToggle('showClass', v)}
        />
        {/* V4는 휴대폰 첫 화면에 손짓 안내를 띄웠지만 기본이 꺼져 있어 맞지 않았다 - 켜는 자리에 적는다 */}
        <ToggleRow
          id="enableScrollNav"
          label="스크롤로 페이지 이동"
          hint="화면 맨 위·맨 아래에서 더 굴리거나 당기면 이전·다음 날짜로, 휴대폰에서 옆으로 밀면 이전·다음 화면으로 넘어갑니다"
          checked={nav.enableScrollNav}
          onChange={setEnableScrollNav}
        />
      </Section>

      {/* 크기는 눈으로 보고 정하는 것이라 단계마다 그 크기로 적어 둔다(V4) */}
      <Section id="fontScale" title="글자 크기">
        <Choices
          name="fontScale"
          value={fontScale}
          onChange={setFontScale}
          options={FONT_SCALES.map((s) => ({ value: s.id, label: s.label, style: { fontSize: `calc(0.75rem * ${s.percent} / 100)` } }))}
        />
      </Section>

      <Section
        id="theme"
        title="화면 밝기"
        desc="어둡게 하면 밤이나 어두운 교실에서 눈이 덜 부십니다. 이 기기에만 남습니다. 인쇄는 늘 밝게 찍힙니다."
      >
        <Choices
          name="theme"
          value={themeMode}
          onChange={setThemeMode}
          options={THEME_OPTIONS}
        />
      </Section>

      <Section
        id="popupStyle"
        title="창 위치"
        desc="'오른쪽 칸'은 넓은 화면에서 화면을 나눠 오른쪽에 띄우고(왼쪽 화면을 보며 쓸 수 있다), 휴대폰에서는 오른쪽에서 나오는 배너로 띄웁니다."
      >
        <Choices name="popupStyle" value={popupStyle} onChange={setPopupStyle} options={POPUP_STYLE_OPTIONS} />
      </Section>

      <Section id="startupScope" title="시작 화면" desc="앱을 열었을 때 처음 보여줄 화면입니다. 새로고침하면 보던 화면 그대로입니다.">
        <Choices name="startupScope" value={nav.startupScope} onChange={setStartupScope} options={STARTUP_OPTIONS} />
      </Section>
    </div>
  );
}
