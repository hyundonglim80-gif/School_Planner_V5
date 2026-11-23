// 환경설정 '보기' 탭 (MENU 3-6). 모두 누르는 즉시 바뀐다 - V4는 글자 크기·창 위치·화면 밝기만 즉시, 나머지는 '저장'을 기다렸다.
// 화면 표시·창 위치·시작 화면은 '화면 배치' 탭으로 옮겼다(P59-1). 글자 크기 말고는 이 기기 또는 계정에 하나(PC·휴대폰 같게) - 칸 제목 옆 표시.
// 어디에 남는지는 칸 제목 옆 같은 모양 표시(parts SavedBadge)로 - 글로 되풀이하지 않는다(P44-3 11-17: 칸 아홉에 안내 열 개, '이 기기' 10번·'계정에' 7번·'PC와 휴대폰' 8번·'인쇄' 5번).
import { useEffect, useState } from 'react';
import { detectDeviceKind } from '../../app/deviceKind';
import { isDarkMode, readThemeMode, setThemeMode, THEME_CHANGED_EVENT, type ThemeMode } from '../../app/theme';
import { setPalette } from '../../app/palette';
import { setDecor, useDecorChoice } from '../../app/decor';
import { useCommonSettings } from '../../app/prefs';
import { readContrast, readDim, setContrast, setCvd, setDim, VIEW_AIDS_CHANGED_EVENT } from '../../app/viewAids';
import { PALETTES, paletteSwatch, sanitizePalette } from '../../domain/palette';
import { decorKind } from '../../domain/decor';
import { DecorPicture } from '../../ui/decorArt';
import { useToday } from '../../ui/useToday';
import { DECOR_OPTIONS, THEME_OPTIONS, useOptionTarget } from '../../app/optionShortcuts';
import { Choices, Section, ToggleRow } from './parts';
import FontSizeRows from './FontSizeRows';
import GcalOverlaySection from '../gcal/GcalOverlaySection';
import { Glyph } from '../../ui/Icon';

export default function ViewTab() {
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
  const optionTarget = useOptionTarget();
  const palette = sanitizePalette(useCommonSettings((s) => s.palette));
  const cvd = useCommonSettings((s) => s.cvd);
  const dark = isDarkMode(themeMode);
  const decor = useDecorChoice();
  const today = useToday();

  return (
    <div>
      {/* P36-3 - 고른 것은 계정에 하나(PC·휴대폰 같게), 받은 일정은 이 기기에만 */}
      <Section
        id="gcalOverlay"
        title="📅 구글 캘린더 겹쳐 보기"
        saved="all"
        desc={
          <>
            고른 캘린더의 일정이 일정 칸에 점선 줄로 보입니다(읽기만 · 이 기기에만).
            <span data-gcal-overlay-how className="block mt-1">
              둘째 줄 &apos;<Glyph e="📅" /> 구글&apos;로 이 기기에서 끄고 켭니다.
            </span>
          </>
        }
      >
        <GcalOverlaySection />
      </Section>

      {/* 화면마다 따로 (메모 요청 #145 - 옛 다섯 단계). 맨 위 머리줄은 늘 100% - index.css [data-fixed-font] */}
      <Section
        id="fontScale"
        title="글자 크기"
        saved="split"
        desc={`화면마다 따로 · 5%씩 · 머리줄은 늘 100%${device === 'pc' ? ' · 한눈에 100% = 다른 화면 90%' : ''}`}
      >
        <FontSizeRows />
      </Section>

      <Section
        id="theme"
        title="화면 밝기"
        saved="device"
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
        saved="all"
        desc="단추·고른 칸의 강조색과 바탕 빛깔"
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
        saved="all"
        desc="머리줄 뒤 흐린 그림과 빈 칸의 작은 그림"
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
                title={o.value === 'season' ? '3~5월 봄 · 6~8월 여름 · 9~11월 가을 · 12~2월 겨울' : undefined}
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
      </Section>

      <Section id="viewAids" title="보기 쉽게">
        <ToggleRow
          id="contrast"
          option="contrast"
          label="고대비"
          saved="device"
          hint="글자와 테두리를 진하게 - 교실 TV·전자칠판에"
          checked={aids.contrast}
          onChange={setContrast}
        />
        <ToggleRow
          id="cvd"
          option="cvd"
          label="색약 배려"
          saved="all"
          hint="완료 초록 → 파랑 쪽, 삭제·중요 빨강 → 주황 쪽 · 색으로만 나누던 곳에 표시(겹친 일정 👥·자리 모둠 번호·단축키 겹침 ⚠)"
          checked={cvd}
          onChange={setCvd}
        />
        <ToggleRow
          id="dim"
          option="dim"
          label="어둡게를 부드럽게"
          saved="device"
          hint="어두운 화면의 바탕을 조금 밝히고 눈부신 글자를 낮춘다 (어둡게일 때만 · 고대비를 켜면 쉰다)"
          checked={aids.dim}
          onChange={setDim}
        />
      </Section>

      <p data-view-print-note className="px-5 py-3 text-xs text-slate-500">인쇄는 이 탭의 밝기·색·꾸미기와 상관없이 늘 밝은 기본 모양입니다.</p>
    </div>
  );
}
