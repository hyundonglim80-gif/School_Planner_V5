// 환경설정 '보기' 탭 (MENU 3-6). 모두 누르는 즉시 바뀐다 - V4는 글자 크기·창 위치·화면 밝기만 즉시, 나머지는 '저장'을 기다렸다.
// 화면 밝기·고대비·어둡게를 부드럽게(이 기기에만)·색 테마·색약 배려·꾸미기(계정에 하나 - PC·휴대폰 같게, P20) 말고는 계정에 PC·휴대폰 따로 올라간다(app/prefs).
import { useEffect, useState } from 'react';
import { FONT_SCALES } from '../../domain/fontScale';
import { setFontScale, setPopupStyle, useLayoutPrefs, windowMode } from '../../app/layoutPrefs';
import { detectDeviceKind } from '../../app/deviceKind';
import { setEnableScrollNav, setStartupScope, setToggle, useNav } from '../../app/nav';
import { isDarkMode, readThemeMode, setThemeMode, THEME_CHANGED_EVENT, type ThemeMode } from '../../app/theme';
import { setPalette } from '../../app/palette';
import { setDecor, useDecorChoice } from '../../app/decor';
import { useCommonSettings } from '../../app/prefs';
import { readContrast, readDim, setContrast, setCvd, setDim, VIEW_AIDS_CHANGED_EVENT } from '../../app/viewAids';
import { PALETTES, paletteSwatch, sanitizePalette } from '../../domain/palette';
import { decorKind } from '../../domain/decor';
import { DecorPicture } from '../../ui/decorArt';
import { useToday } from '../../ui/useToday';
import { useShortcutTitle } from '../../app/keys';
import { DECOR_OPTIONS, POPUP_STYLE_OPTIONS, STARTUP_OPTIONS, THEME_OPTIONS, useOptionTarget } from '../../app/optionShortcuts';
import { Choices, Section, ToggleRow } from './parts';

const POPUP_STYLE_DESC: Record<'pc' | 'mobile', string> = {
  pc: "'오른쪽 칸'은 화면을 나눠 오른쪽에 띄웁니다(왼쪽 화면을 보며 쓸 수 있다). '팝업창'은 창마다 브라우저 새 창으로 띄워 브라우저 밖·다른 모니터로 옮길 수 있습니다 - 자리와 크기는 창마다 기억합니다.",
  mobile: "'오른쪽 칸'은 오른쪽에서 나오는 배너로, '가운데 창'은 화면 가운데에 띄웁니다(메모·일정을 쓰는 칸은 늘 오른쪽).",
};

export default function ViewTab() {
  const nav = useNav();
  const { fontScale, popupStyle } = useLayoutPrefs();
  const [device] = useState(detectDeviceKind);
  // 화면 밝기는 이 기기에만 (localStorage) - 단축키로 바꿔도 창에 보이게 알림을 듣는다
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readThemeMode);
  useEffect(() => {
    const onChange = () => setThemeModeState(readThemeMode());
    window.addEventListener(THEME_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGED_EVENT, onChange);
  }, []);
  // 고대비·어둡게를 부드럽게도 이 기기에만 - 다른 창(↗ 새 창)에서 바꿔도 보이게
  const [aids, setAids] = useState(() => ({ contrast: readContrast(), dim: readDim() }));
  useEffect(() => {
    const onChange = () => setAids({ contrast: readContrast(), dim: readDim() });
    window.addEventListener(VIEW_AIDS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(VIEW_AIDS_CHANGED_EVENT, onChange);
  }, []);
  const withKey = useShortcutTitle();
  const optionTarget = useOptionTarget();
  const palette = sanitizePalette(useCommonSettings((s) => s.palette));
  const cvd = useCommonSettings((s) => s.cvd);
  const dark = isDarkMode(themeMode);
  const decor = useDecorChoice();
  const today = useToday();

  return (
    <div>
      <p className="px-5 pt-4 text-xs text-slate-500 leading-relaxed">
        이 탭은 고르는 즉시 바뀌고, <strong className="text-slate-700">PC와 휴대폰을 따로</strong> 계정에 저장합니다(화면 밝기는 이 기기에만, 색 테마·꾸미기는 PC·휴대폰 같게).
      </p>

      <Section id="display" title="화면 표시" desc="둘째 줄의 주말 / 일정 / 수업 단추와 같은 값입니다.">
        <ToggleRow
          id="showWeekend"
          option="showWeekend"
          label="주말"
          hint={withKey('토·일 칸을 달력에 보여줍니다', 'toggleWeekend')}
          checked={nav.showWeekend}
          onChange={(v) => setToggle('showWeekend', v)}
        />
        <ToggleRow
          id="showEvents"
          option="showEvents"
          label="일정"
          hint={withKey('하루·주간·월간·년간에 일정 항목을 보여줍니다', 'toggleEvents')}
          checked={nav.showEvents}
          onChange={(v) => setToggle('showEvents', v)}
        />
        <ToggleRow
          id="showClass"
          option="showClass"
          label="수업"
          hint={withKey('시간표와 교시 항목을 보여줍니다', 'toggleClass')}
          checked={nav.showClass}
          onChange={(v) => setToggle('showClass', v)}
        />
        {/* V4는 휴대폰 첫 화면에 손짓 안내를 띄웠지만 기본이 꺼져 있어 맞지 않았다 - 켜는 자리에 적는다 */}
        <ToggleRow
          id="enableScrollNav"
          option="enableScrollNav"
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
          option="fontScale"
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
          option="theme"
          value={themeMode}
          onChange={setThemeMode}
          options={THEME_OPTIONS}
        />
      </Section>

      {/* 견본 = 그 테마의 바탕 네모 + 강조 동그라미 (지금 밝기의 것) - 누르는 즉시 바뀐다 */}
      <Section
        id="palette"
        title="🎨 색 테마"
        desc="단추·고른 칸의 강조색과 바탕 빛깔을 바꿉니다. 계정에 저장해 PC와 휴대폰이 같은 테마이고, 화면 밝기와 따로 고릅니다. 토요일 파랑·이월·완료·라벨 색은 그대로, 인쇄는 늘 기본 색입니다."
      >
        <div className="flex flex-wrap gap-1.5">
          {PALETTES.map((p) => {
            const sw = paletteSwatch(p.id, dark);
            const on = p.id === palette;
            return (
              <button
                key={p.id}
                type="button"
                {...optionTarget('palette', p.id)}
                data-palette-pick={p.id}
                aria-pressed={on}
                onClick={() => setPalette(p.id)}
                className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  on ? 'border-primary ring-2 ring-primary/30 text-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                <span aria-hidden className="relative w-7 h-5 shrink-0 rounded border border-slate-300" style={{ background: sw.body }}>
                  <span className="absolute right-0.5 bottom-0.5 w-3 h-3 rounded-full" style={{ background: sw.accent }} />
                </span>
                {p.emoji} {p.name}
              </button>
            );
          })}
        </div>
      </Section>

      {/* 견본 = 그 꾸미기의 빈 화면 그림 ('계절 따라'는 지금 계절) - 누르는 즉시 바뀐다 */}
      <Section
        id="decor"
        title="✨ 꾸미기"
        desc="머리줄 뒤에 흐린 그림을 깔고, 비어 있는 칸에 작은 그림을 넣습니다. 계정에 저장해 PC와 휴대폰이 같습니다. 글자·단추 색은 그대로이고, 고대비를 켜면 머리줄 그림은 쉽니다. 인쇄에는 나오지 않습니다."
      >
        <div className="flex flex-wrap gap-1.5">
          {DECOR_OPTIONS.map((o) => {
            const kind = decorKind(o.value, today);
            const on = o.value === decor;
            return (
              <button
                key={o.value}
                type="button"
                {...optionTarget('decor', o.value)}
                data-decor-pick={o.value}
                aria-pressed={on}
                onClick={() => setDecor(o.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  on ? 'border-primary ring-2 ring-primary/30 text-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                {kind && <DecorPicture kind={kind} slot="events" className="w-5 h-5 shrink-0" />}
                {o.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-1.5">계절 따라: 3~5월 봄 · 6~8월 여름 · 9~11월 가을 · 12~2월 겨울로 저절로 바뀝니다.</p>
      </Section>

      <Section id="viewAids" title="보기 쉽게" desc="셋은 따로 켜고 끕니다. 색 테마·화면 밝기와 섞어 쓸 수 있고, 인쇄는 늘 기본 색입니다.">
        <ToggleRow
          id="contrast"
          option="contrast"
          label="고대비"
          hint="글자와 테두리를 진하게 합니다. 교실 TV·전자칠판에 띄울 때 좋습니다. 이 기기에만 남습니다."
          checked={aids.contrast}
          onChange={setContrast}
        />
        <ToggleRow
          id="cvd"
          option="cvd"
          label="색약 배려"
          hint="완료 초록을 파랑 쪽으로, 삭제·중요 빨강을 주황 쪽으로 바꾸고 색으로만 나누던 곳에 표시를 더합니다(겹친 일정 👥·자리 모둠 번호·단축키 겹침 ⚠). 계정에 저장해 PC와 휴대폰이 같습니다."
          checked={cvd}
          onChange={setCvd}
        />
        <ToggleRow
          id="dim"
          option="dim"
          label="어둡게를 부드럽게"
          hint="어두운 화면의 바탕을 조금 밝히고 눈부신 글자를 낮춥니다. 어둡게일 때만 바뀌고, 고대비를 켜면 쉽니다. 이 기기에만 남습니다."
          checked={aids.dim}
          onChange={setDim}
        />
      </Section>

      <Section
        id="popupStyle"
        title="창 위치"
        desc={POPUP_STYLE_DESC[device]}
      >
        <Choices name="popupStyle" option="popupStyle" value={windowMode(popupStyle, device)} onChange={setPopupStyle} options={POPUP_STYLE_OPTIONS[device]} />
      </Section>

      <Section id="startupScope" title="시작 화면" desc="앱을 열었을 때 처음 보여줄 화면입니다. 새로고침하면 보던 화면 그대로입니다.">
        <Choices name="startupScope" option="startupScope" value={nav.startupScope} onChange={setStartupScope} options={STARTUP_OPTIONS} />
      </Section>
    </div>
  );
}
