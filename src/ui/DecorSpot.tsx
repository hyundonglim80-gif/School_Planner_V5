// 빈 화면 그림 (P20-3) - 꾸미기가 켜져 있으면 그림, 꺼져 있으면 그 자리의 원래 모습(fallback). 글자 밑에 깔리지 않아 고대비에서도 그대로.
// 그림(decorArt)은 켰을 때만 나눠 받는다(P25-1 첫 화면 JS - 꾸미기는 기본 끄기). 받는 동안은 같은 크기 빈자리(글이 밀리지 않게).
import { Suspense, type ReactNode } from 'react';
import { useDecorKind } from '../app/decor';
import { lazyWithReload } from '../app/lazyWithReload';
import type { DecorSlot } from './decorArt';

const SIZE = 'block w-16 h-16 mx-auto mb-2 print:hidden';

const DecorPicture = lazyWithReload(
  () => import('./decorArt').then((m) => ({ default: m.DecorPicture })),
  () => <span aria-hidden="true" className={SIZE} />,
);

export default function DecorSpot({ slot, fallback = null }: { slot: DecorSlot; fallback?: ReactNode }) {
  const kind = useDecorKind();
  if (!kind) return <>{fallback}</>;
  return (
    <Suspense fallback={<span aria-hidden="true" className={SIZE} />}>
      <DecorPicture data-decor-spot={kind} kind={kind} slot={slot} className={`${SIZE} rounded-2xl`} />
    </Suspense>
  );
}
