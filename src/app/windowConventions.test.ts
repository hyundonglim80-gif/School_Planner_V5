import { describe, it, expect } from 'vitest';
import './windowList';
import { listWindows } from './windows';

// 창 공통 규칙을 코드에서 지키고 있는지 본다 (V4 components/modalConventions.test.ts에서 옮김).
// 창이 30개가 넘어 하나씩 눈으로 보기 어렵고, 새 창을 만들 때 규칙이 쉽게 어긋난다.
// 파일 내용은 Vite의 ?raw 로 읽는다 (node:fs를 쓰면 앱 tsconfig에 Node 타입이 없어 빌드가 깨진다).

/** 창 파일: 기능 폴더의 *Window.tsx(창)·*Panel.tsx(쓰는 칸) */
const windowSources = import.meta.glob(['../features/**/*Window.tsx', '../features/**/*Panel.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const entries = Object.entries(windowSources).map(([path, src]) => ({ name: path.replace('../features/', ''), src }));

// 사진 보기는 화면 가운데 그림을 띄우는 것이 맞다 (P4-2에서 옮기면 여기에)
const CENTERED_BY_DESIGN: string[] = [];

describe('창 공통 규칙', () => {
  it('창 파일을 찾았다', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries.filter((e) => !CENTERED_BY_DESIGN.includes(e.name)))('$name - 틀을 직접 만들지 않는다 (ModalShell·PopupFrame·SidePanelFrame)', ({ src }) => {
    // 바깥 틀을 직접 만들면 환경설정 '창 위치'(오른쪽 칸 / 가운데)와 오른쪽 줄의 탭·ESC·Ctrl+S를 따르지 않는다.
    expect(/ModalShell|PopupFrame|SidePanelFrame/.test(src)).toBe(true);
    expect(src).not.toMatch(/fixed inset-0 flex items-start justify-center/);
    // 내용이 바뀔 때 위아래로 같이 움직이지 않게 위에 붙는다
    expect(src).not.toMatch(/inset-0 flex items-center justify-center/);
  });

  it.each(entries)('$name - 배경 닫기를 onClick으로 직접 걸지 않는다', ({ src }) => {
    // click은 누른 곳과 뗀 곳의 공통 조상에서 일어난다. 배경에 onClick만 걸면 창 안에서 글자를 끌어 선택하다
    // 밖에서 손을 뗐을 때 창이 닫힌다. 누른 곳과 뗀 곳이 둘 다 배경일 때만 닫도록 useBackdropClose를 쓴다.
    expect(src).not.toMatch(/onClick=\{closeAllLayers\}/);
    expect(src).not.toMatch(/onClick=\{\(\) => closeAllLayers\(\)\}/);
  });

  it.each(entries)('$name - 닫기 단추 글로 "취소"를 쓰지 않는다', ({ src }) => {
    // 저장과 닫기를 나누기로 했으므로 닫기 쪽 글은 '닫기'로 맞춘다
    expect(src).not.toMatch(/>\s*취소\s*</);
  });

  it.each(entries.filter((e) => e.name.endsWith('Panel.tsx')))('$name - 쓰는 칸의 닫기 단추에 data-close (탭 ×가 누른다)', ({ src }) => {
    expect(src).toMatch(/data-close/);
  });
});

// 그림만 있는 단추는 화면 낭독기에 "버튼"이라고만 읽히고, 마우스를 올려도 아무 설명이 뜨지 않는다(V4: ✕ 닫기 단추 12곳).
describe('그림만 있는 단추에는 설명이 붙어 있다', () => {
  const allSources = import.meta.glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const offenders: string[] = [];
  for (const [path, src] of Object.entries(allSources)) {
    if (path.includes('.test.')) continue;
    for (const m of src.matchAll(/<button([\s\S]*?)>([\s\S]*?)<\/button>/g)) {
      const attrs = m[1];
      const text = m[2].replace(/<[^>]+>/g, '').replace(/\{[^{}]*\}/g, '').trim();
      if (!text) continue;
      if (/[0-9A-Za-z가-힣]/.test(text)) continue;
      if (attrs.includes('title=') || attrs.includes('aria-label')) continue;
      offenders.push(`${path.replace('../', '')} — "${text.slice(0, 4)}"`);
    }
  }
  it('설명 없는 그림 단추가 없다', () => {
    expect(offenders, offenders.join(' / ')).toEqual([]);
  });
});

// 창 목록이 MENU.md 자리를 지킨다 (MENU.md 5장 - V4 inspect-more-menu 대신).
// 창이 들어오는 세션마다 여기 표에 맞춰 등록한다. 다 들어오면(P8) '⊆'를 '='로 바꾼다.
const MENU_SPEC: Record<string, string[]> = {
  일정: ['labels', 'multiSelect'],
  수업: ['progress', 'timetable'],
  자료: ['backup', 'print'],
  설정: ['settings', 'help'],
};
const CLASS_TOOLS = ['attendance', 'notices', 'subjectAttendance', 'seating', 'drawStudent', 'studentRecord', 'evalOverview', 'roster'];

describe('창 목록 = MENU.md', () => {
  const real = listWindows().filter((w) => !w.dev);

  it('⋮ 메뉴는 4구역 8항목 안에서만 (MENU.md 3-4)', () => {
    expect(Object.values(MENU_SPEC).flat()).toHaveLength(8);
    for (const w of real.filter((x) => x.menu)) {
      expect(MENU_SPEC[w.menu!], `${w.id}는 ⋮ '${w.menu}' 구역에 없다`).toContain(w.id);
    }
  });

  it('학급 도구 카드는 여덟 가운데서만 (MENU.md 3-3)', () => {
    expect(CLASS_TOOLS).toHaveLength(8);
    for (const w of real.filter((x) => x.classTool)) expect(CLASS_TOOLS).toContain(w.id);
  });

  it('점검용 창은 ⋮·학급 도구·수업 머리줄에 없다', () => {
    for (const w of listWindows().filter((x) => x.dev)) {
      expect(w.menu || w.classTool || w.lessonHeader).toBeFalsy();
    }
  });
});
