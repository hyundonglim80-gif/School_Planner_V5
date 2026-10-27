import { describe, expect, it } from 'vitest';
import {
  acceptsPointer,
  clampView,
  defaultPenColor,
  dragThumb,
  exportScale,
  handwritingName,
  hasInk,
  inkBounds,
  isEraserPress,
  panView,
  PAPER_MAX_H,
  paperHeight,
  penWidth,
  pinchView,
  scrollThumb,
  zoomAt,
  type PenStroke,
} from './handwriting';

const stroke = (points: [number, number, number][], erase = false): PenStroke => ({ color: '#000', erase, points: points.map(([x, y, w]) => ({ x, y, w })) });

describe('손글씨 셈', () => {
  it('펜은 누르는 힘에 따라 굵기가 바뀌고, 마우스·손가락은 그대로', () => {
    expect(penWidth(4, 0.5, 'pen')).toBe(4);
    expect(penWidth(4, 1, 'pen')).toBe(6.4);
    expect(penWidth(4, 0.1, 'pen')).toBeCloseTo(2.08);
    expect(penWidth(4, 0, 'pen')).toBe(4);
    expect(penWidth(4, 0.5, 'mouse')).toBe(4);
    expect(penWidth(4, 1, 'touch')).toBe(4);
  });

  it('펜을 쓴 뒤로는 손가락(손바닥)으로 그리지 않는다', () => {
    expect(acceptsPointer('touch', false)).toBe(true);
    expect(acceptsPointer('touch', true)).toBe(false);
    expect(acceptsPointer('pen', true)).toBe(true);
    expect(acceptsPointer('mouse', true)).toBe(true);
  });

  it('펜 옆 단추·펜 뒤 지우개는 지우개', () => {
    expect(isEraserPress('pen', 1)).toBe(false);
    expect(isEraserPress('pen', 2)).toBe(true);
    expect(isEraserPress('pen', 32)).toBe(true);
    expect(isEraserPress('mouse', 2)).toBe(false);
  });

  it('그린 것이 있나 - 지우개만이면 없다', () => {
    expect(hasInk([])).toBe(false);
    expect(hasInk([stroke([[1, 1, 4]], true)])).toBe(false);
    expect(hasInk([stroke([[1, 1, 4]])])).toBe(true);
  });

  it('그린 줄 둘레만 잘라 낸다 (지우개는 빼고, 화면 안으로)', () => {
    const s = [stroke([[100, 50, 4], [200, 80, 6]]), stroke([[0, 0, 30]], true)];
    expect(inkBounds(s, 10, 1000, 1000)).toEqual({ x: 88, y: 38, w: 125, h: 55 });
    expect(inkBounds([stroke([[5, 5, 4]])], 20, 15, 1000)).toEqual({ x: 0, y: 0, w: 15, h: 27 });
    expect(inkBounds([], 10, 100, 100)).toBeNull();
  });

  it('첨부 이름', () => {
    expect(handwritingName(new Date(2026, 9, 21, 9, 5, 7))).toBe('손글씨_20261021_090507.png');
  });

  it('처음 펜 색 = 화면과 반대 (어두운 화면은 흰색)', () => {
    expect(defaultPenColor(true)).toBe('#ffffff');
    expect(defaultPenColor(false)).toBe('#1e293b');
  });

  it('보는 자리는 종이 밖으로 나가지 않고 배율은 1~5', () => {
    expect(clampView({ scale: 0.5, x: 10, y: 10 }, 400, 800)).toEqual({ scale: 1, x: 0, y: 0 });
    expect(clampView({ scale: 2, x: 500, y: -5 }, 400, 800)).toEqual({ scale: 2, x: 200, y: 0 });
    expect(clampView({ scale: 9, x: 0, y: 0 }, 400, 800).scale).toBe(5);
  });

  it('+ / − 는 화면 가운데를 그 자리에 둔 채', () => {
    // 400×800 종이, 가운데 (200, 400)
    const v = zoomAt({ scale: 1, x: 0, y: 0 }, 2, 200, 400, 400, 800);
    expect(v).toEqual({ scale: 2, x: 100, y: 200 });
    expect(zoomAt(v, 1, 200, 400, 400, 800)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('두 손가락: 벌리면 커지고, 가운데 밑의 종이 자리는 손가락을 따라간다', () => {
    const start = { scale: 1, x: 0, y: 0 };
    const v = pinchView(start, { x: 100, y: 100 }, 100, { x: 100, y: 100 }, 200, 400, 800);
    expect(v).toEqual({ scale: 2, x: 50, y: 50 });
    // 두 배 상태에서 가운데를 왼쪽으로 40 옮기면 종이는 20만큼 오른쪽을 본다
    expect(pinchView(v, { x: 100, y: 100 }, 100, { x: 60, y: 100 }, 100, 400, 800)).toEqual({ scale: 2, x: 70, y: 50 });
  });

  it('한 손가락으로 옮기기', () => {
    expect(panView({ scale: 2, x: 100, y: 100 }, 40, -20, 400, 800)).toEqual({ scale: 2, x: 80, y: 110 });
    expect(panView({ scale: 1, x: 0, y: 0 }, 40, 40, 400, 800)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('그림 배율은 최대 3배, 긴 쪽 3000px 안', () => {
    expect(exportScale(200, 100)).toBe(3);
    expect(exportScale(1500, 600)).toBe(2);
    expect(exportScale(5000, 10)).toBe(1);
  });

  it('아래로 길게 쓰기 - 종이는 그린 것 아래로 한 화면 더, 줄지 않고 끝이 있다 (10-28)', () => {
    expect(paperHeight([], 600)).toBe(600);
    // 맨 아래 점 500(+굵기 반 2) + 한 화면
    expect(paperHeight([stroke([[10, 100, 4], [10, 500, 4]])], 600)).toBe(1102);
    // 지우개 줄은 세지 않는다 · 앞 높이보다 줄지 않는다
    expect(paperHeight([stroke([[10, 2000, 4]], true)], 600)).toBe(600);
    expect(paperHeight([stroke([[10, 100, 4]])], 600, 1500)).toBe(1500);
    expect(paperHeight([stroke([[10, 99999, 4]])], 600)).toBe(PAPER_MAX_H);
  });

  it('종이가 길면 배율 1에서도 아래로 옮긴다 (휠·두 손가락·한 손가락)', () => {
    expect(panView({ scale: 1, x: 0, y: 0 }, 0, -300, 800, 600)).toEqual({ scale: 1, x: 0, y: 0 });
    expect(panView({ scale: 1, x: 0, y: 0 }, 0, -300, 800, 600, 1500)).toEqual({ scale: 1, x: 0, y: 300 });
    // 끝(종이 − 한 화면)을 넘지 않는다 · 옆으로는 배율 1이면 그대로
    expect(panView({ scale: 1, x: 0, y: 800 }, -50, -300, 800, 600, 1500)).toEqual({ scale: 1, x: 0, y: 900 });
    expect(clampView({ scale: 2, x: 0, y: 5000 }, 800, 600, 1500)).toEqual({ scale: 2, x: 0, y: 1200 });
    expect(zoomAt({ scale: 1, x: 0, y: 900 }, 2, 400, 300, 800, 600, 1500).y).toBe(1050);
  });

  it('오른쪽 스크롤 막대 - 보이는 몫·자리, 끌면 그만큼 내려간다', () => {
    expect(scrollThumb({ scale: 1, x: 0, y: 0 }, 600, 600)).toBeNull();
    expect(scrollThumb({ scale: 1, x: 0, y: 0 }, 600, 1200)).toEqual({ top: 0, size: 300 });
    expect(scrollThumb({ scale: 1, x: 0, y: 600 }, 600, 1200)).toEqual({ top: 300, size: 300 });
    // 크게 보면 한 화면에 덜 보인다 · 막대는 너무 작지 않게
    expect(scrollThumb({ scale: 2, x: 0, y: 0 }, 600, 600)?.size).toBe(300);
    expect(scrollThumb({ scale: 1, x: 0, y: 0 }, 600, 8000)?.size).toBe(45);
    // 막대 300px 중 남은 길 300px를 150 끌면 = 종이 남은 600의 절반
    expect(dragThumb({ scale: 1, x: 0, y: 0 }, 150, 600, 1200, 800)).toEqual({ scale: 1, x: 0, y: 300 });
    expect(dragThumb({ scale: 1, x: 0, y: 0 }, 9999, 600, 1200, 800).y).toBe(600);
    expect(dragThumb({ scale: 1, x: 0, y: 0 }, 50, 600, 600, 800)).toEqual({ scale: 1, x: 0, y: 0 });
  });
});
