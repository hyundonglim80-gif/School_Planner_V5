// 카드 열 고르기의 값 (11-25 메모 요청 #206 '카드형일 때 표시 단을 1~5단으로 - 기기마다 설정 값 저장').
//   칸 넷(하루 수업·일정·메모 칸, 메모 화면)마다 0 = 자동(고르기 전 모습 그대로) · 1~5 = 한 줄에 그 수만큼.
//   값이 사는 곳은 app/cardCols(이 기기에만 - 화면 폭이 기기마다 달라서, 카드/목록 보기와 같다). 여기는 모양과 셈만(초기화 묶음도 읽는다).
export type CardCols = 0 | 1 | 2 | 3 | 4 | 5;
export const CARD_COLS_VALUES: readonly CardCols[] = [0, 1, 2, 3, 4, 5];

/** 칸 이름 = 값 이름(환경설정 값 단축키 'opt.<이름>.<값>'·초기화 묶음 칸도 이 이름) */
export type CardColsKey = 'lessonCols' | 'eventCols' | 'journalCols' | 'memoCols';
export const CARD_COLS_KEYS: readonly CardColsKey[] = ['lessonCols', 'eventCols', 'journalCols', 'memoCols'];

export type CardColsPrefs = Record<CardColsKey, CardCols>;
export const CARD_COLS_DEFAULTS: CardColsPrefs = { lessonCols: 0, eventCols: 0, journalCols: 0, memoCols: 0 };

export const isCardCols = (v: unknown): v is CardCols => CARD_COLS_VALUES.includes(v as CardCols);

/** 이 칸의 열 수 - 고른 수, 자동이면 auto(그 칸이 폭으로 센 수) */
export const cardColumns = (choice: CardCols, auto: number): number => (choice > 0 ? choice : auto);
