// 라벨의 색·기본 라벨·속성 읽기 (V4 hooks/useLabels.ts·components/LabelModal.tsx의 표). 자료 모양은 DESIGN 4-3.
//
// - 색은 이름(blue·green …)으로 적는다. 칩은 이 표의 바탕·글자·테두리로 그린다(V4 COLOR_PALETTE 그대로).
// - 일정 라벨 속성: 달력(calendar)은 적지 않았으면 켜짐, 나머지는 꺼짐(V4 normalizeEventLabel과 같다).
// - 맨 위(차례가 가장 앞) 라벨이 새 항목의 기본 라벨이다 - 메모·기록은 트리 차례의 맨 위.
import type { ItemKind, LabelProps } from '../data/types';

export interface LabelColor {
  bg: string;
  text: string;
  border: string;
  label: string;
}

export const LABEL_COLORS: Readonly<Record<string, LabelColor>> = {
  blue: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', label: '파랑' },
  green: { bg: '#dcfce7', text: '#166534', border: '#86efac', label: '초록' },
  red: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: '빨강' },
  orange: { bg: '#ffedd5', text: '#9a3412', border: '#fdba74', label: '주황' },
  yellow: { bg: '#fef9c3', text: '#854d0e', border: '#fde047', label: '노랑' },
  indigo: { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc', label: '남색' },
  purple: { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe', label: '보라' },
  // V3 라벨에만 있던 색 - 고르기 칸에는 없다(V4 라벨 관리와 같다)
  pink: { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4', label: '분홍' },
  gray: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1', label: '회색' },
};

/** 색 고르기 칸의 차례 (V4 라벨 관리 그대로) */
export const PICKER_COLORS = ['blue', 'green', 'red', 'orange', 'yellow', 'indigo', 'purple', 'gray'] as const;

/** 모르는 색은 회색 */
export const labelColor = (key: string | undefined): LabelColor => LABEL_COLORS[key ?? ''] ?? LABEL_COLORS.gray;

/** 일정 라벨 속성을 모두 채워 읽는다 (적지 않은 달력 = 켜짐) */
export function labelProps(props: LabelProps | undefined): Required<LabelProps> {
  return {
    calendar: props?.calendar !== false,
    forward: !!props?.forward,
    skip: !!props?.skip,
    gcal: !!props?.gcal,
    period: !!props?.period,
    recur: !!props?.recur,
  };
}

/** 라벨 관리 창의 일정 라벨 속성 칸 (차례·화면 이름·설명 - V4 그대로, 화면 이름은 UX-AUDIT T2·T6 사용자 결정) */
export const EVENT_LABEL_PROPS: ReadonlyArray<{ key: keyof LabelProps; name: string; title: string; color: string }> = [
  { key: 'calendar', name: '달력', title: '켜 둔 라벨의 일정만 월간·년간 달력에 나옵니다. 끄면 하루·주간 화면에만 보입니다.', color: 'accent-blue-600' },
  { key: 'forward', name: '이월', title: '끝내지 못하면 다음 날로 따라옵니다.', color: 'accent-emerald-600' },
  { key: 'period', name: '기간', title: '새 일정 칸을 열 때 끝 날 줄을 펴 둡니다.', color: 'accent-indigo-600' },
  { key: 'recur', name: '반복', title: '새 일정 칸을 열 때 반복 줄을 펴 둡니다.', color: 'accent-purple-600' },
  { key: 'skip', name: '수업X', title: '그날은 수업이 없는 날로 봅니다.', color: 'accent-amber-600' },
  {
    key: 'gcal',
    name: '구글 캘린더',
    title: "이 라벨의 일정을 저장·완료·옮기기·지울 때 구글 캘린더에도 반영합니다 ('달력'과 다릅니다).",
    color: 'accent-sky-600',
  },
];

export interface DefaultLabel {
  id: string;
  name: string;
  color: string;
  props?: LabelProps;
}

/**
 * 라벨이 하나도 없는 공간에 넣는 기본 라벨 (라벨 관리 창의 '기본 라벨 넣기' - PLAN 5장 'P2-3 기본 라벨').
 * id를 정해 두어 두 기기에서 함께 눌러도 겹치지 않는다. 일정 = V4 기본 다섯, 메모·기록 = V4 기록·메모 기본을 합친 일곱.
 */
export const DEFAULT_LABELS: Readonly<Record<ItemKind, readonly DefaultLabel[]>> = {
  event: [
    { id: 'dflt_e1', name: '달력', color: 'red', props: labelProps({ calendar: true }) },
    { id: 'dflt_e2', name: '수업X', color: 'orange', props: labelProps({ calendar: true, skip: true }) },
    { id: 'dflt_e3', name: '이월', color: 'green', props: labelProps({ calendar: false, forward: true }) },
    { id: 'dflt_e4', name: '기간', color: 'indigo', props: labelProps({ calendar: false, period: true }) },
    { id: 'dflt_e5', name: '반복', color: 'purple', props: labelProps({ calendar: false, recur: true }) },
  ],
  note: [
    { id: 'dflt_n1', name: '긴급', color: 'red' },
    { id: 'dflt_n2', name: '중요', color: 'orange' },
    { id: 'dflt_n3', name: '학급활동', color: 'green' },
    { id: 'dflt_n4', name: '학생상담', color: 'yellow' },
    { id: 'dflt_n5', name: '업무전달', color: 'blue' },
    { id: 'dflt_n6', name: '수업기록', color: 'purple' },
    { id: 'dflt_n7', name: '개인', color: 'gray' },
  ],
};

/** 라벨 이름 다듬기 (앞뒤 빈칸, 맨 앞 '#' - 쓰는 칸에서 '#회의'로 만든 것도 같은 이름) */
export const cleanLabelName = (name: string) => name.trim().replace(/^#+/, '').trim();
