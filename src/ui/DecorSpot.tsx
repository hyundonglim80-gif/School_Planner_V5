// 빈 화면 그림 (P20-3) - 꾸미기가 켜져 있으면 그림, 꺼져 있으면 그 자리의 원래 모습(fallback). 글자 밑에 깔리지 않아 고대비에서도 그대로.
import type { ReactNode } from 'react';
import { useDecorKind } from '../app/decor';
import { DecorPicture, type DecorSlot } from './decorArt';

export default function DecorSpot({ slot, fallback = null }: { slot: DecorSlot; fallback?: ReactNode }) {
  const kind = useDecorKind();
  if (!kind) return <>{fallback}</>;
  return <DecorPicture data-decor-spot={kind} kind={kind} slot={slot} className="block w-16 h-16 mx-auto mb-2 rounded-2xl print:hidden" />;
}
