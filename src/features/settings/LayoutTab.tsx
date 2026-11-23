// 환경설정 '화면 배치' 탭 (P59 - 11-23 사용자 'ui 개선점 - 선택할 수 있는 요소는 환경설정에서 직접 선택'). 칸·카드·창이 어디에 어떻게 서는지.
//   글자·밝기·색·꾸미기(보이는 모양)는 '보기' 탭 · 이 탭은 배치 - 화면 표시·창 위치·시작 화면을 보기 탭에서 옮겼다(보기 탭이 아홉 구역이었다).
//   새 선택지의 값은 app/screenPrefs(계정에 PC·휴대폰 따로) - 기본값은 P59 전 모습 그대로. 휴대폰 구역은 휴대폰(손가락 화면)에서만 보인다.
import { useState } from 'react';
import { setWindowPlace, useLayoutPrefs, windowPlace } from '../../app/layoutPrefs';
import { detectDeviceKind } from '../../app/deviceKind';
import { setEnableScrollNav, setStartupScope, setToggle, useNav } from '../../app/nav';
import { useShortcutTitle } from '../../app/keys';
import { setScreenPref, useScreenPrefs } from '../../app/screenPrefs';
import { MEMO_NAV_OPTIONS, ORDER_ARROWS_OPTIONS, PHONE_COLS_OPTIONS, POPUP_STYLE_OPTIONS, STARTUP_OPTIONS } from '../../app/optionShortcuts';
import { ChoiceRow, Choices, Section, ToggleRow } from './parts';

const POPUP_STYLE_DESC: Record<'pc' | 'mobile', string> = {
  pc: '오른쪽·왼쪽 칸 = 화면을 나눠 그쪽에 · 팝업창 = 창마다 브라우저 새 창(다른 모니터로 옮길 수 있고 자리·크기는 창마다 기억)',
  mobile: '오른쪽 칸 = 오른쪽에서 나오는 배너 · 가운데 창 = 화면 가운데에 (쓰는 칸은 늘 오른쪽)',
};

export default function LayoutTab() {
  const nav = useNav();
  const { popupStyle, sideAt } = useLayoutPrefs();
  const screen = useScreenPrefs();
  const [device] = useState(detectDeviceKind);
  const withKey = useShortcutTitle();

  return (
    <div>
      <Section id="display" title="화면 표시" saved="split" desc="둘째 줄 주말 · 일정 · 수업 단추와 같은 값">
        <ToggleRow
          id="showWeekend"
          option="showWeekend"
          label="주말"
          hint={withKey('토·일 칸', 'toggleWeekend')}
          checked={nav.showWeekend}
          onChange={(v) => setToggle('showWeekend', v)}
        />
        <ToggleRow
          id="showEvents"
          option="showEvents"
          label="일정"
          hint={withKey('하루·주간·월간·년간의 일정', 'toggleEvents')}
          checked={nav.showEvents}
          onChange={(v) => setToggle('showEvents', v)}
        />
        <ToggleRow
          id="showClass"
          option="showClass"
          label="수업"
          hint={withKey('시간표와 교시', 'toggleClass')}
          checked={nav.showClass}
          onChange={(v) => setToggle('showClass', v)}
        />
        {/* V4는 휴대폰 첫 화면에 손짓 안내를 띄웠지만 기본이 꺼져 있어 맞지 않았다 - 켜는 자리에 적는다 */}
        <ToggleRow
          id="enableScrollNav"
          option="enableScrollNav"
          label="스크롤로 페이지 이동"
          hint="맨 위·맨 아래에서 더 굴리면 이전·다음 날짜 · 휴대폰은 옆으로 밀면 이전·다음 화면"
          checked={nav.enableScrollNav}
          onChange={setEnableScrollNav}
        />
      </Section>


      {/* P59-1 - 휴대폰(손가락 화면)에서만 듣는 것. 고르지 않으면 P59 전 모습 */}
      {device === 'mobile' && (
        <Section id="phoneCards" title="휴대폰 카드·메모" saved="split">
          <ChoiceRow
            label="카드 열"
            hint="하루 일정·메모 칸과 메모 화면"
            name="phoneCols"
            option="phoneCols"
            value={screen.phoneCols}
            onChange={(v) => setScreenPref('phoneCols', v)}
            options={PHONE_COLS_OPTIONS}
          />
          <ChoiceRow
            label="카드 차례 단추 (▲▼)"
            hint="⇅ 누를 때만 = 칸 머리 ⇅를 누르면 그 칸 카드에 섭니다"
            name="orderArrows"
            option="orderArrows"
            value={screen.orderArrows}
            onChange={(v) => setScreenPref('orderArrows', v)}
            options={ORDER_ARROWS_OPTIONS}
          />
          <ChoiceRow
            label="메모 화면 라벨 칸"
            name="memoNavAt"
            option="memoNavAt"
            value={screen.memoNavAt}
            onChange={(v) => setScreenPref('memoNavAt', v)}
            options={MEMO_NAV_OPTIONS}
          />
          <ToggleRow id="cardTime" option="cardTime" label="메모 카드에 쓴 시각" checked={screen.cardTime} onChange={(v) => setScreenPref('cardTime', v)} />
        </Section>
      )}

      <Section
        id="popupStyle"
        title="창 위치"
        saved="split"
        desc={POPUP_STYLE_DESC[device]}
      >
        <Choices name="popupStyle" option="popupStyle" value={windowPlace(popupStyle, sideAt, device)} onChange={setWindowPlace} options={POPUP_STYLE_OPTIONS[device]} />
      </Section>

      <Section id="startupScope" title="시작 화면" saved="split" desc="앱을 열 때 처음 화면 (새로고침은 보던 화면 그대로)">
        <Choices name="startupScope" option="startupScope" value={nav.startupScope} onChange={setStartupScope} options={STARTUP_OPTIONS} />
      </Section>

    </div>
  );
}
