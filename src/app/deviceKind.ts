// 이 기기가 PC인가 휴대폰인가 (V4 detectDeviceKind). app/prefs가 계정 설정(PC·휴대폰 따로)을 고를 때,
// 창 목록이 팝업창을 띄울지 볼 때 함께 쓴다 - 창 목록(app/windows)이 prefs(서버 맞추기)를 끌어들이지 않게 따로 둔다.

export type DeviceKind = 'pc' | 'mobile';

/**
 * ⚠️ 화면 폭으로 가르면 PC에서 창을 좁히기만 해도 휴대폰 설정으로 넘어간다. 주 입력이 손가락인지, 휴대폰 브라우저인지로 본다(태블릿은 휴대폰 쪽).
 */
export function detectDeviceKind(): DeviceKind {
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return 'mobile';
  } catch {
    /* matchMedia가 없는 환경 */
  }
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'pc';
}
