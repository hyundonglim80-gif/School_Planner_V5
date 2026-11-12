// 환경설정 보기 탭 '글자 크기' (메모 요청 #145 - 옛 다섯 단계 고르기를 바꿨다). 화면마다 한 줄: 이름 · % · − · 초기화 · +
//   − / + 는 누를 때마다 5%씩(50~200%), 초기화 = 100%. 고르는 그 순간 그 화면에 입힌다(크기는 눈으로 보고 정하는 것이라).
//   지금 보는 화면 줄은 빛깔로 짚는다 - 그 줄의 단추가 단축키 '글자 작게 / 크게 / 초기화'와 같다(⌨️ 단축키 설정에서 눌러 고른다).
//   팝업창 줄은 PC만(휴대폰에는 브라우저 새 창이 없다). 팝업창 안에서 열면 '팝업창' 줄이 지금 화면이다.
import { useState } from 'react';
import { fontPercentOf, POPOUT_FONT_PAGE } from '../../domain/fontScale';
import { FONT_PAGES, stepFontSize, useLayoutPrefs } from '../../app/layoutPrefs';
import { fontPageLabel } from '../../app/fontSize';
import { detectDeviceKind } from '../../app/deviceKind';
import { useShortcutTitle } from '../../app/keys';
import { useNav } from '../../app/nav';
import { POPOUT } from '../../ui/popout';
import { shortcutTarget } from '../../ui/shortcutTarget';
import type { ShortcutId } from '../../domain/shortcuts';

const BTN =
  'px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-primary hover:text-primary transition-colors cursor-pointer';

const STEPS: Array<{ step: -1 | 0 | 1; key: 'down' | 'reset' | 'up'; label: string; title: string; shortcut: ShortcutId }> = [
  { step: -1, key: 'down', label: '−', title: '글자 작게 (5%)', shortcut: 'fontSmaller' },
  { step: 0, key: 'reset', label: '초기화', title: '글자 크기 초기화 (초기화 값 - 처음은 100%)', shortcut: 'fontReset' },
  { step: 1, key: 'up', label: '+', title: '글자 크게 (5%)', shortcut: 'fontLarger' },
];

export default function FontSizeRows() {
  const fontSizes = useLayoutPrefs((s) => s.fontSizes);
  const scope = useNav((s) => s.scope);
  const [device] = useState(detectDeviceKind);
  const withKey = useShortcutTitle();
  const current = POPOUT ? POPOUT_FONT_PAGE : scope;
  const pages = FONT_PAGES.filter((p) => p !== POPOUT_FONT_PAGE || device === 'pc');

  return (
    <div className="flex flex-col gap-0.5">
      {pages.map((page) => {
        const now = page === current;
        const percent = fontPercentOf(fontSizes, page);
        const name = fontPageLabel(page);
        return (
          <div
            key={page}
            data-font-page={page}
            data-font-current={now ? '' : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${now ? 'bg-primary/10' : ''}`}
          >
            <span className="flex-1 min-w-0 text-sm font-bold text-slate-700">
              {name}
              {now && <span className="ml-1.5 text-2xs font-bold text-primary">지금 화면</span>}
            </span>
            <span data-font-percent={page} className={`w-12 text-right text-sm font-black tabular-nums ${percent === 100 ? 'text-slate-400' : 'text-primary'}`}>
              {percent}%
            </span>
            {STEPS.map((s) => (
              <button
                key={s.key}
                type="button"
                data-font-step={`${page}:${s.key}`}
                // 지금 화면 줄만 단축키와 같은 일을 한다 - 다른 줄은 그 화면만 바꾼다
                {...(now ? shortcutTarget(s.shortcut) : {})}
                onClick={() => stepFontSize(s.step, page)}
                title={now ? withKey(s.title, s.shortcut) : `${name} - ${s.title}`}
                aria-label={`${name} ${s.title}`}
                className={`${BTN} ${s.step === 0 ? '' : 'w-8'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
