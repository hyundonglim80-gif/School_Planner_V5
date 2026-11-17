import { describe, expect, it } from 'vitest';
import { restoreSpots } from './restoreSpots';

describe('글 칸이 잰 뒤 둘레 스크롤 되돌리기 (P44-1)', () => {
  it("'auto'로 줄인 순간 위로 당겨진 것은 되돌린다 (P10-5 5f - 긴 메모 아래쪽에 쓰는 곳이 밀려나지 않게)", () => {
    const box = { scrollTop: 300 };
    restoreSpots([[box, 900]]);
    expect(box.scrollTop).toBe(900);
  });
  it('글 칸이 늘어 브라우저가 아래로 옮겨 준 것(스크롤 고정)은 그대로 - 맨 아래 Claude 답을 끌어올리지 않는다', () => {
    const box = { scrollTop: 2020 };
    restoreSpots([[box, 256]]);
    expect(box.scrollTop).toBe(2020);
  });
});
