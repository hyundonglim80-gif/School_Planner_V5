// 인쇄 창의 params (app/printScreen이 연다 - 창 목록이 부르는 곳이라 가볍게 둔다)
import type { Scope } from '../../app/route';
import type { PrintPage } from '../../domain/printPages';

export interface PrintParams {
  /** 처음 고른 화면 */
  page?: PrintPage;
  /** 처음 고른 구간 (시작 = 끝 = 보던 날) */
  date?: string;
  /** 연 화면 - 메모·학급이면 '이 화면 그대로' 단추를 둔다 */
  scope?: Scope;
}
