// 새 학년도 띠를 띄울 때 (P9-2) - 껍데기가 늘 부르는 작은 셈만 따로 둔다(P49-3 - 띠 밖의 날에는 새 학년도 셈·화면을 받지 않는다).

/** 띠를 띄우는 학년도 - 2월 15일 ~ 3월 31일이면 그 3월에 시작하는 학년도, 아니면 null */
export function newYearTarget(today: string): number | null {
  const [y, m, d] = today.split('-').map(Number);
  if ((m === 2 && d >= 15) || m === 3) return y;
  return null;
}
