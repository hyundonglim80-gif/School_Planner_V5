// 꾸미기 (P20-3) - 머리줄 뒤 띠·빈 화면 그림을 고르는 값. 그림은 ui/decorArt, 계정 값은 common decor(PC·휴대폰 같게).
// 색 테마·화면 밝기와 따로 고른다 - 꾸미기가 켜져도 글자·단추 색은 바뀌지 않는다.

export const DECOR_CHOICES = ['off', 'season', 'spring', 'summer', 'autumn', 'winter', 'animal'] as const;
export type DecorChoice = (typeof DECOR_CHOICES)[number];
export type DecorKind = Exclude<DecorChoice, 'off' | 'season'>;

export const DEFAULT_DECOR: DecorChoice = 'off';

/** 모르는 값(옛 기기·지운 꾸미기)은 끄기 */
export function sanitizeDecor(v: unknown): DecorChoice {
  return (DECOR_CHOICES as readonly unknown[]).includes(v) ? (v as DecorChoice) : DEFAULT_DECOR;
}

/** 'YYYY-MM-DD'의 계절 - 3~5 봄 · 6~8 여름 · 9~11 가을 · 12~2 겨울 */
export function seasonOf(date: string): Exclude<DecorKind, 'animal'> {
  const month = Number(date.slice(5, 7));
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/** 그릴 그림 (null = 끄기). '계절 따라'는 오늘 달을 따른다 */
export function decorKind(choice: DecorChoice, today: string): DecorKind | null {
  if (choice === 'off') return null;
  return choice === 'season' ? seasonOf(today) : choice;
}
