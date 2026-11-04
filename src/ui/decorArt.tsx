// 꾸미기 그림 (P20-3) - 코드로 그린 SVG. 번들 안에 있어 오프라인에서도 뜬다(파일로 두면 sw.js 담을 목록을 따로 챙겨야 한다).
// 빛깔은 index.css `.decor-art`의 변수(밝기마다 - 여기서는 변수만 쓴다). 이미 있는 캐릭터는 본뜨지 않는다.
//   DecorTile    = 머리줄 뒤 띠의 무늬 한 칸 (TILE_W × TILE_H, 아래쪽이 머리줄 아래에 붙는다 - 메모·학급 화면은 머리줄이 낮아 위가 잘린다)
//   DecorPicture = 빈 화면 그림 (72 × 72)
import type { ReactNode } from 'react';
import type { DecorKind } from '../domain/decor';

export const TILE_W = 480;
export const TILE_H = 96;

/** 빈 화면 그림의 자리 - 동물은 자리마다 다른 동물 */
export type DecorSlot = 'events' | 'journal' | 'memo' | 'search';

interface At {
  x: number;
  y: number;
  /** 크기 배수 */
  s?: number;
  /** 돌리기 (도) */
  r?: number;
}

const at = ({ x, y, s = 1, r = 0 }: At) => `translate(${x} ${y}) rotate(${r}) scale(${s})`;

const c = (n: number) => `var(--decor-${n})`;

// ── 조각 ──

const PETAL = 'M0 0C-4.6-3-6.2-9-2.7-12.6L0-10.2L2.7-12.6C6.2-9 4.6-3 0 0Z';
const MAPLE = 'M0-15L2.6-8.4L6.2-10L5.2-4.2L11.4-5.4L8.4-1.6L10.6 0.2L4.2 3.8L5.2 6.4L0.8 5.4V12H-0.8V5.4L-5.2 6.4L-4.2 3.8L-10.6 0.2L-8.4-1.6L-11.4-5.4L-5.2-4.2L-6.2-10L-2.6-8.4Z';
const GINKGO = 'M0 0C-3-4-11.5-7-13.4-13.6C-8.6-18-3.4-18-0.9-15L0-11L0.9-15C3.4-18 8.6-18 13.4-13.6C11.5-7 3-4 0 0ZM-0.7 0H0.7V9H-0.7Z';

function Blossom(p: At) {
  return (
    <g transform={at(p)}>
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a} d={PETAL} transform={`rotate(${a})`} fill={c(1)} />
      ))}
      <circle r="2.6" fill={c(3)} />
    </g>
  );
}

const Petal = (p: At) => <path d={PETAL} transform={at(p)} fill={c(2)} />;
const Maple = (p: At) => <path d={MAPLE} transform={at(p)} fill={c(1)} />;
const Ginkgo = (p: At) => <path d={GINKGO} transform={at(p)} fill={c(2)} />;

function Snowflake(p: At) {
  return (
    <g transform={at(p)} fill="none" stroke={c(1)} strokeWidth="1.6" strokeLinecap="round">
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path key={a} transform={`rotate(${a})`} d="M0 0V-11M0-6.5L-3-9.5M0-6.5L3-9.5" />
      ))}
    </g>
  );
}

function Sun(p: At) {
  return (
    <g transform={at(p)}>
      <path d="M0-17V-13M0 13V17M-17 0H-13M13 0H17M-12-12L-9.2-9.2M9.2 9.2L12 12M-12 12L-9.2 9.2M9.2-9.2L12-12" fill="none" stroke={c(3)} strokeWidth="2.4" strokeLinecap="round" />
      <circle r="10" fill={c(3)} />
    </g>
  );
}

const Gull = (p: At) => <path d="M-10 0Q-5-6 0 0Q5-6 10 0" transform={at(p)} fill="none" stroke={c(4)} strokeWidth="1.8" strokeLinecap="round" />;

/** 위아래로 넘실대는 물결 (폭 `to`까지, 한 물결 2·half 폭 - 무늬가 이어지게 TILE_W가 그 배수) */
function wave(top: number, height: number, half: number, to: number, from = 0): string {
  let d = `M${from} ${top + height + 40}V${top}Q${from + half / 2} ${top - height} ${from + half} ${top}`;
  for (let x = from + half * 2; x <= to; x += half) d += `T${x} ${top}`;
  return `${d}V${top + height + 40}Z`;
}

function Paw(p: At) {
  return (
    <g transform={at(p)} fill={c(1)}>
      <path d="M0-1C4-1 7 3 6 6C5 8 2 7 0 7C-2 7-5 8-6 6C-7 3-4-1 0-1Z" />
      <ellipse cx="-6.6" cy="-2.6" rx="2.1" ry="2.9" transform="rotate(-24 -6.6 -2.6)" />
      <ellipse cx="-2.4" cy="-6.6" rx="2.1" ry="3" transform="rotate(-8 -2.4 -6.6)" />
      <ellipse cx="2.4" cy="-6.6" rx="2.1" ry="3" transform="rotate(8 2.4 -6.6)" />
      <ellipse cx="6.6" cy="-2.6" rx="2.1" ry="2.9" transform="rotate(24 6.6 -2.6)" />
    </g>
  );
}

// ── 동물 (72 × 72 - 띠에서는 줄여 쓴다) ──
// 변수: 1 선 · 2 고양이 · 3 강아지 · 4 강아지 귀 · 5 토끼 · 6 병아리 · 7 분홍(코·귀 안) · 8 주황(부리·발)

const LINE = { stroke: c(1), strokeWidth: 2.4, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
const Eye = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r="2.7" fill={c(1)} />;

function Cat() {
  return (
    <>
      <path d="M13 32L10 8L29 18Q36 16.4 43 18L62 8L59 32Q63 39 60 46Q54 63 36 63Q18 63 12 46Q9 39 13 32Z" fill={c(2)} {...LINE} />
      <path d="M16 23L15 15L23 19.6ZM56 23L57 15L49 19.6Z" fill={c(7)} />
      <path d="M36 21V27M30 22L31 27M42 22L41 27" fill="none" stroke={c(4)} strokeWidth="2.2" strokeLinecap="round" />
      <Eye x={26} y={39} />
      <Eye x={46} y={39} />
      <path d="M33.4 45H38.6L36 48Z" fill={c(7)} />
      <path d="M36 48Q33.5 52 29.5 50M36 48Q38.5 52 42.5 50" fill="none" {...LINE} strokeWidth="1.8" />
      <path d="M5 41L16 43M5 50L16 48M67 41L56 43M67 50L56 48" fill="none" {...LINE} strokeWidth="1.6" />
    </>
  );
}

function Dog() {
  return (
    <>
      <path d="M19 22Q36 9 53 22Q60 35 56 48Q50 63 36 63Q22 63 16 48Q12 35 19 22Z" fill={c(3)} {...LINE} />
      <path d="M21 19Q8 16 5 29Q4 44 13 47Q19 37 24 23ZM51 19Q64 16 67 29Q68 44 59 47Q53 37 48 23Z" fill={c(4)} {...LINE} />
      <ellipse cx="36" cy="49" rx="12.5" ry="9.5" fill={c(5)} />
      <Eye x={27} y={36} />
      <Eye x={45} y={36} />
      <ellipse cx="36" cy="43.5" rx="4.2" ry="3" fill={c(1)} />
      <path d="M36 46.5V50M36 50Q32 54 28 51M36 50Q40 54 44 51" fill="none" {...LINE} strokeWidth="1.8" />
      <path d="M33 53.2Q36 60 39 53.2Q36 54.6 33 53.2Z" fill={c(7)} />
    </>
  );
}

function Rabbit() {
  return (
    <>
      <path d="M23 34Q14 6 23 3Q33 3 33 32ZM49 34Q58 6 49 3Q39 3 39 32Z" fill={c(5)} {...LINE} />
      <path d="M25 28Q20 12 24 9Q28.5 10 29 28ZM47 28Q52 12 48 9Q43.5 10 43 28Z" fill={c(7)} />
      <ellipse cx="36" cy="46" rx="23" ry="18.5" fill={c(5)} {...LINE} />
      <Eye x={27} y={44} />
      <Eye x={45} y={44} />
      <path d="M33.4 49.4H38.6L36 52.4Z" fill={c(7)} />
      <path d="M36 52.4Q34 56 30.5 54.6M36 52.4Q38 56 41.5 54.6" fill="none" {...LINE} strokeWidth="1.8" />
      <circle cx="19.5" cy="51" r="3.4" fill={c(7)} opacity="0.55" />
      <circle cx="52.5" cy="51" r="3.4" fill={c(7)} opacity="0.55" />
    </>
  );
}

function Chick() {
  return (
    <>
      <path d="M28 64V69M28 69L23.5 70.5M28 69L32 70.5M44 64V69M44 69L39.5 70.5M44 69L48 70.5" fill="none" stroke={c(8)} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M36 14Q32 8 34.5 4M36 14Q37.5 8 41.5 6" fill="none" {...LINE} />
      <path d="M36 12C52 12 60 26 60 40C60 54 50 64 36 64C22 64 12 54 12 40C12 26 20 12 36 12Z" fill={c(6)} {...LINE} />
      <path d="M13 40Q6 46 9 54Q17 54 20 47ZM59 40Q66 46 63 54Q55 54 52 47Z" fill={c(6)} {...LINE} />
      <Eye x={27} y={33} />
      <Eye x={45} y={33} />
      <path d="M30.4 38.4H41.6L36 45Z" fill={c(8)} {...LINE} strokeWidth="1.8" />
      <circle cx="21" cy="42" r="3.4" fill={c(7)} opacity="0.55" />
      <circle cx="51" cy="42" r="3.4" fill={c(7)} opacity="0.55" />
    </>
  );
}

const ANIMAL_OF: Record<DecorSlot, () => ReactNode> = { events: Cat, journal: Dog, memo: Rabbit, search: Chick };

/** 동물 얼굴 하나를 (x, y) 가운데에 */
function Face({ x, y, s, of }: { x: number; y: number; s: number; of: () => ReactNode }) {
  const Draw = of;
  return (
    <g transform={`translate(${x - 36 * s} ${y - 36 * s}) scale(${s})`}>
      <Draw />
    </g>
  );
}

function Snowman() {
  return (
    <>
      <circle cx="36" cy="50" r="17" fill={c(2)} stroke={c(1)} strokeWidth="2.2" />
      <circle cx="36" cy="25" r="12.5" fill={c(2)} stroke={c(1)} strokeWidth="2.2" />
      <path d="M24 34Q36 40 48 34L48.8 39Q36 45 23.2 39Z" fill={c(3)} />
      <path d="M41 39.6L43 53L48.4 51.6L46.4 37.8Z" fill={c(3)} />
      <circle cx="31.4" cy="22" r="1.9" fill={c(5)} />
      <circle cx="40.6" cy="22" r="1.9" fill={c(5)} />
      <path d="M36 25L46 27.4L36 29Z" fill={c(4)} />
      <circle cx="36" cy="49" r="1.9" fill={c(5)} />
      <circle cx="36" cy="57" r="1.9" fill={c(5)} />
    </>
  );
}

// ── 머리줄 띠 무늬 ──

function SpringTile() {
  return (
    <>
      <path d="M296 0C294 12 278 18 262 26M60 96C62 84 56 72 42 62" fill="none" stroke={c(2)} strokeWidth="2.2" strokeLinecap="round" />
      <Blossom x={38} y={58} s={1} r={8} />
      <Blossom x={150} y={64} s={0.8} r={24} />
      <Blossom x={258} y={28} s={0.95} r={40} />
      <Blossom x={374} y={60} s={1.05} r={12} />
      <Blossom x={452} y={22} s={0.7} r={50} />
      <Petal x={92} y={20} s={0.62} r={30} />
      <Petal x={112} y={76} s={0.52} r={120} />
      <Petal x={204} y={48} s={0.58} r={200} />
      <Petal x={222} y={84} s={0.6} r={60} />
      <Petal x={320} y={36} s={0.52} r={300} />
      <Petal x={332} y={84} s={0.5} r={150} />
      <Petal x={424} y={86} s={0.56} r={90} />
      <Petal x={14} y={22} s={0.52} r={250} />
    </>
  );
}

function SummerTile() {
  return (
    <>
      <Sun x={402} y={32} s={1} />
      <Gull x={118} y={30} />
      <Gull x={146} y={44} s={0.7} />
      <Gull x={286} y={24} s={0.8} />
      <path d="M224 66H254L249 74H229ZM238 64V44L252 64Z" fill={c(1)} />
      <path d={wave(74, 7, 30, TILE_W + 60, -30)} fill={c(2)} />
      <path d={wave(85, 5, 40, TILE_W + 80)} fill={c(1)} />
    </>
  );
}

function AutumnTile() {
  return (
    <>
      <Maple x={40} y={34} s={1.05} r={-18} />
      <Ginkgo x={112} y={70} s={0.85} r={24} />
      <Maple x={182} y={72} s={0.8} r={34} />
      <Ginkgo x={250} y={30} s={0.95} r={-30} />
      <Maple x={326} y={62} s={1} r={12} />
      <Ginkgo x={404} y={78} s={0.8} r={70} />
      <Maple x={452} y={26} s={0.75} r={-40} />
      <Ginkgo x={146} y={24} s={0.6} r={120} />
      <Ginkgo x={18} y={80} s={0.6} r={-70} />
    </>
  );
}

function WinterTile() {
  return (
    <>
      <path d="M0 96V86C50 78 104 92 172 85C232 79 300 91 356 84C402 79 446 89 480 86V96Z" fill={c(2)} />
      <Snowflake x={44} y={36} s={1.1} r={10} />
      <Snowflake x={158} y={58} s={0.8} r={24} />
      <Snowflake x={250} y={26} s={1} r={0} />
      <Snowflake x={352} y={54} s={1.15} r={14} />
      <Snowflake x={446} y={28} s={0.85} r={30} />
      {[
        [96, 22],
        [112, 68],
        [204, 62],
        [216, 18],
        [300, 62],
        [302, 18],
        [400, 22],
        [408, 66],
        [12, 66],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="2.2" fill={c(1)} />
      ))}
    </>
  );
}

function AnimalTile() {
  return (
    <>
      <Face x={54} y={60} s={0.5} of={Cat} />
      <Paw x={102} y={78} s={0.62} r={70} />
      <Paw x={124} y={62} s={0.62} r={70} />
      <Face x={174} y={60} s={0.5} of={Dog} />
      <Paw x={222} y={78} s={0.62} r={70} />
      <Paw x={244} y={62} s={0.62} r={70} />
      <Face x={294} y={58} s={0.52} of={Rabbit} />
      <Paw x={342} y={78} s={0.62} r={70} />
      <Paw x={364} y={62} s={0.62} r={70} />
      <Face x={414} y={60} s={0.5} of={Chick} />
      <Paw x={462} y={78} s={0.62} r={70} />
      <Paw x={8} y={62} s={0.62} r={70} />
    </>
  );
}

const TILES: Record<DecorKind, () => ReactNode> = { spring: SpringTile, summer: SummerTile, autumn: AutumnTile, winter: WinterTile, animal: AnimalTile };

export function DecorTile({ kind }: { kind: DecorKind }) {
  const Draw = TILES[kind];
  return <Draw />;
}

// ── 빈 화면 그림 ──

function SpringPicture() {
  return (
    <>
      <path d="M4 62C18 54 30 44 42 36C50 31 58 22 66 8" fill="none" stroke={c(4)} strokeWidth="3" strokeLinecap="round" />
      <path d="M28 46C25 38 25 32 28 26M52 28C56 34 58 40 58 47" fill="none" stroke={c(4)} strokeWidth="2.2" strokeLinecap="round" />
      <Blossom x={46} y={18} s={1} r={14} />
      <Blossom x={24} y={21} s={1.1} r={40} />
      <Blossom x={56} y={50} s={0.95} r={20} />
      <Petal x={12} y={46} s={0.6} r={200} />
      <Petal x={34} y={62} s={0.55} r={130} />
    </>
  );
}

function SummerPicture() {
  return (
    <>
      <Sun x={50} y={22} s={1.05} />
      <Gull x={18} y={20} s={0.8} />
      <path d="M14 44H42L37 52H19ZM27 42V24L39 42Z" fill={c(4)} />
      <path d={wave(52, 5, 12, 96, -12)} fill={c(2)} />
      <path d={wave(60, 4, 16, 96)} fill={c(1)} />
    </>
  );
}

function AutumnPicture() {
  return (
    <>
      <Maple x={27} y={28} s={1.75} r={-16} />
      <Ginkgo x={52} y={50} s={1.25} r={24} />
      <Ginkgo x={16} y={60} s={0.6} r={-60} />
      <Maple x={56} y={14} s={0.62} r={30} />
    </>
  );
}

function WinterPicture() {
  return (
    <>
      <Snowman />
      <Snowflake x={11} y={18} s={0.72} r={12} />
      <Snowflake x={62} y={14} s={0.6} r={30} />
      <Snowflake x={62} y={46} s={0.5} />
    </>
  );
}

const PICTURES: Record<Exclude<DecorKind, 'animal'>, () => ReactNode> = { spring: SpringPicture, summer: SummerPicture, autumn: AutumnPicture, winter: WinterPicture };

export function DecorPicture({ kind, slot, className }: { kind: DecorKind; slot: DecorSlot; className?: string }) {
  const Draw = kind === 'animal' ? ANIMAL_OF[slot] : PICTURES[kind];
  return (
    <svg viewBox="0 0 72 72" aria-hidden="true" data-decor-spot={kind} data-art={kind} className={`decor-art ${className ?? ''}`}>
      <Draw />
    </svg>
  );
}
