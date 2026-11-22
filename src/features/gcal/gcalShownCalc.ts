// 구글 캘린더 겹쳐 그리기 - 고르는 셈 (P55-1 첫 화면 JS - gcalView에서 뗐다). 받는 몫(overlayRun)이 부르면 gcalView에 넣는다.
//   고른 캘린더가 없는 사람은 이 셈(domain/gcalOverlay overlayBetween · domain/gcalShow)을 받지 않는다.
import { overlayBetween } from '../../domain/gcalOverlay';
import { gcalShownList } from '../../domain/gcalShow';
import { useGcalCalc, type GcalShownCalc } from './gcalView';

export const gcalShownBetween: GcalShownCalc = (rows, picks, first, last) =>
  gcalShownList(
    overlayBetween(
      rows,
      picks.map((c) => c.id),
      first,
      last,
    ),
    picks,
  );

useGcalCalc.setState({ calc: gcalShownBetween });
