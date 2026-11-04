// 꾸미기 (P20-3) - 계정 값(common decor)을 읽고 쓴다. '계절 따라'는 오늘을 듣고 있어 켜 둔 채 달이 바뀌어도 그림이 따라간다.
import { decorKind, sanitizeDecor, type DecorChoice, type DecorKind } from '../domain/decor';
import { useToday } from '../ui/useToday';
import { setCommonSetting, useCommonSettings } from './prefs';

export const useDecorChoice = (): DecorChoice => sanitizeDecor(useCommonSettings((s) => s.decor));

/** 지금 그릴 그림 (null = 끄기) */
export function useDecorKind(): DecorKind | null {
  const choice = useDecorChoice();
  return decorKind(choice, useToday());
}

/** 고르기 (환경설정 보기 탭) */
export const setDecor = (choice: DecorChoice) => setCommonSetting('decor', choice);
