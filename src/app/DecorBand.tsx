// 머리줄 뒤 꾸미기 띠 (P20-3). 머리줄(sticky z-40)이 쌓임 맥락이라 -z-10은 머리줄 바탕 위·글자 아래에 깔린다 - 머리줄 부품은 그대로 둔다.
// 흐리기·고대비에서 쉬기는 index.css `.decor-band`. 아래에 붙여 그려 머리줄이 낮은 화면(메모·학급)은 위가 잘린다.
import { DecorTile, TILE_H, TILE_W } from '../ui/decorArt';
import { useDecorKind } from './decor';

const TILE_ID = 'sp5-decor-tile';

export default function DecorBand() {
  const kind = useDecorKind();
  if (!kind) return null;
  return (
    <div data-decor-band={kind} data-art={kind} aria-hidden="true" className="decor-art decor-band absolute inset-x-0 bottom-0 h-24 -z-10 overflow-hidden pointer-events-none">
      <svg width="100%" height={TILE_H}>
        <defs>
          <pattern id={TILE_ID} width={TILE_W} height={TILE_H} patternUnits="userSpaceOnUse">
            <DecorTile kind={kind} />
          </pattern>
        </defs>
        <rect width="100%" height={TILE_H} fill={`url(#${TILE_ID})`} />
      </svg>
    </div>
  );
}
