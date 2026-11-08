// 머리줄 뒤 꾸미기 띠 (P20-3). 머리줄(sticky z-40)이 쌓임 맥락이라 -z-10은 머리줄 바탕 위·글자 아래에 깔린다 - 머리줄 부품은 그대로 둔다.
// 흐리기·고대비에서 쉬기는 index.css `.decor-band`. 아래에 붙여 그려 머리줄이 낮은 화면(메모·학급)은 위가 잘린다.
// 그림(ui/decorArt)은 켰을 때만 나눠 받는다(P25-1 첫 화면 JS - 꾸미기는 기본 끄기). 받는 동안·끊겨 못 받으면 띠는 빈 채.
import { Suspense } from 'react';
import { useDecorKind } from './decor';
import { lazyWithReload } from './lazyWithReload';

const DecorBandArt = lazyWithReload(
  () => import('../ui/decorArt').then((m) => ({ default: m.DecorBandArt })),
  () => null,
);

export default function DecorBand() {
  const kind = useDecorKind();
  if (!kind) return null;
  return (
    <div data-decor-band={kind} data-art={kind} aria-hidden="true" className="decor-art decor-band absolute inset-x-0 bottom-0 h-24 -z-10 overflow-hidden pointer-events-none">
      <Suspense fallback={null}>
        <DecorBandArt kind={kind} />
      </Suspense>
    </div>
  );
}
