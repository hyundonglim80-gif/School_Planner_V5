// 화면마다 글자 크기 (메모 요청 #145) - 화면 이름과 단축키. 값·입히기는 app/layoutPrefs, % 셈은 domain/fontScale.
//   단축키 '글자 작게 / 크게 / 초기화'(기본 키 없음)는 지금 보는 화면(팝업창 안이면 '팝업창')을 5%씩 바꾸고 안내한다 - 누를 때마다 쌓인다.
import { POPOUT_FONT_PAGE } from '../domain/fontScale';
import { currentFontPage, stepFontSize } from './layoutPrefs';
import { SCREENS } from './screens';
import { showToast } from './toast';

/** 글자 크기 자리 이름 ('하루' · '팝업창') */
export function fontPageLabel(page: string): string {
  if (page === POPOUT_FONT_PAGE) return '팝업창';
  return SCREENS.find((s) => s.id === page)?.label ?? page;
}

/** 단축키 - 지금 화면을 한 칸 작게(-1)·크게(+1)·초기화(0). 안내는 하나만 남긴다(여러 번 눌러도 안내가 쌓이지 않게) */
export function stepFontSizeByKey(step: -1 | 0 | 1) {
  const page = currentFontPage();
  const percent = stepFontSize(step, page);
  document.querySelectorAll('[data-font-toast]').forEach((el) => el.remove());
  showToast(`🔤 글자 크기 (${fontPageLabel(page)}): ${percent}%`);
  const toasts = document.querySelectorAll('[data-toast]');
  toasts[toasts.length - 1]?.setAttribute('data-font-toast', '');
}
