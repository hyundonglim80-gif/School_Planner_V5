// 체크 줄 (V4 lib/checkLines.ts) - 순수 셈. '☐ 우유' / '☑ 우유' 처럼 체크 글자로 시작하는 줄.
//
// 구글 Keep의 목록 메모가 이 글자로 들어온다(V4 keepImport). 카드에서 그 줄을
// 누르면 글자만 ☐ ↔ ☑ 로 바꾼다 - 나머지 글(앞의 띄어쓰기·뒤의 내용·다른 줄)은 건드리지 않는다.

/** 줄 앞의 띄어쓰기(들여쓰기)와 체크 글자 */
const CHECK_LINE = /^([ \t]*)([☐☑])/;

/** 체크 줄이면 'open'(☐)·'done'(☑), 아니면 null */
export function checkLineState(line: string): 'open' | 'done' | null {
  const m = CHECK_LINE.exec(line);
  if (!m) return null;
  return m[2] === '☑' ? 'done' : 'open';
}

/** 글에 체크 줄이 하나라도 있나 */
export function hasCheckLines(text: string): boolean {
  return text.split('\n').some((line) => checkLineState(line) !== null);
}

/**
 * lineIndex번째 줄의 체크 글자만 바꾼 글. 그 줄이 체크 줄이 아니거나, expectedLine을 주었는데
 * 그 줄이 다르면(그새 다른 곳에서 고쳤다) null - 엉뚱한 줄을 바꾸지 않는다.
 */
export function toggleCheckLine(text: string, lineIndex: number, expectedLine?: string): string | null {
  const lines = text.split('\n');
  const line = lines[lineIndex];
  if (line === undefined) return null;
  if (expectedLine !== undefined && line !== expectedLine) return null;
  const m = CHECK_LINE.exec(line);
  if (!m) return null;
  lines[lineIndex] = m[1] + (m[2] === '☐' ? '☑' : '☐') + line.slice(m[0].length);
  return lines.join('\n');
}

// ── 쓰는 칸에서 체크 목록 만들기 ─────────────────────────────

/** 글자 자리 → 그 자리가 든 줄 번호 */
const lineIndexAt = (text: string, pos: number) => text.slice(0, Math.max(0, pos)).split('\n').length - 1;
/** 줄 번호 → 그 줄이 시작하는 글자 자리 */
const lineStartOf = (lines: string[], i: number) => lines.slice(0, i).reduce((n, l) => n + l.length + 1, 0);

/**
 * '☑ 체크리스트' 단추·단축키: 커서가 있는 줄(골랐으면 고른 줄들) 앞에 '☐ '를 붙인다. 모두 붙어 있으면 뗀다(☑ 줄도).
 * 들여쓰기는 그대로 두고 그 뒤에 붙인다. 바뀐 글과 옮겨진 커서 자리를 돌려준다.
 */
export function toggleLinesPrefix(text: string, selStart: number, selEnd: number): { text: string; selStart: number; selEnd: number } {
  const lines = text.split('\n');
  const first = lineIndexAt(text, selStart);
  // 고른 끝이 줄 맨 앞이면 그 줄은 빼고 (줄을 통째로 골랐을 때)
  let last = lineIndexAt(text, selEnd);
  if (selEnd > selStart && last > first && selEnd === lineStartOf(lines, last)) last -= 1;
  const all = lines.slice(first, last + 1).every((l) => checkLineState(l) !== null);
  let shiftStart = 0;
  let shiftEnd = 0;
  for (let i = first; i <= last; i++) {
    const line = lines[i];
    const m = /^([ \t]*)([☐☑] ?)?/.exec(line)!;
    const indent = m[1];
    let next: string;
    if (all) next = indent + line.slice(m[0].length);
    else if (m[2]) next = line;
    else next = indent + '☐ ' + line.slice(indent.length);
    const delta = next.length - line.length;
    if (i === first) shiftStart = delta;
    shiftEnd += delta;
    lines[i] = next;
  }
  const out = lines.join('\n');
  const firstStart = lineStartOf(lines, first);
  const clamp = (n: number) => Math.max(firstStart, Math.min(out.length, n));
  return { text: out, selStart: clamp(selStart + shiftStart), selEnd: clamp(selEnd + shiftEnd) };
}

/**
 * 체크 줄에서 Enter: 다음 줄도 '☐ '로(들여쓰기 유지). 내용이 빈 체크 줄에서 Enter면 표시만 지우고 목록을 끝낸다.
 * 체크 줄이 아니면 null (쓰는 칸이 보통 Enter로 둔다).
 */
export function continueOnEnter(text: string, caret: number): { text: string; caret: number } | null {
  const lines = text.split('\n');
  const i = lineIndexAt(text, caret);
  const line = lines[i];
  const m = /^([ \t]*)([☐☑]) ?/.exec(line);
  if (!m) return null;
  const start = lineStartOf(lines, i);
  if (caret - start < m[0].length) return null; // 표시 앞에서 누른 Enter는 보통대로
  if (!line.slice(m[0].length).trim()) {
    // 빈 체크 줄 → 표시만 지운다
    lines[i] = m[1];
    return { text: lines.join('\n'), caret: start + m[1].length };
  }
  const insert = `\n${m[1]}☐ `;
  return { text: text.slice(0, caret) + insert + text.slice(caret), caret: caret + insert.length };
}

/** 쓰는 칸에서 체크 글자(줄 맨 앞 ☐/☑ 바로 위)를 누르면 바꾼 글. 그 자리가 아니면 null */
export function toggleCheckAtCaret(text: string, caret: number): string | null {
  const i = checkGlyphLineAt(text, caret);
  return i === null ? null : toggleCheckLine(text, i);
}

// ── 쓰는 칸에서 체크 목록 고치기 (P10-5 사용자 의견 5b·5c - 글 차례를 실제로 바꾼다) ─────────────
// 체크 목록 = 이어진 체크 줄 한 덩이(빈 줄·글 줄이 끊는다). 덩이 안에서 체크 안 한 줄이 위, 체크한 줄이 아래.
// 체크하면 덩이 맨 아래로, 풀면 체크 안 한 줄들의 맨 아래로 옮긴다. 체크 줄이 아닌 줄(제목·문단)은 제자리.
// (카드는 글을 바꾸지 않고 보이기만 아래로 모은다 - EntryCard)

/** 쓰는 칸에서 누른 자리가 줄 맨 앞 체크 글자(☐/☑) 바로 위면 그 줄 번호, 아니면 null */
export function checkGlyphLineAt(text: string, caret: number): number | null {
  const lines = text.split('\n');
  const i = lineIndexAt(text, caret);
  const m = /^([ \t]*)([☐☑])/.exec(lines[i] || '');
  if (!m) return null;
  const col = caret - lineStartOf(lines, i);
  return col < m[1].length || col > m[1].length + 1 ? null : i;
}

/** i번째 줄이 든 체크 목록 덩이 [처음, 끝] (체크 줄이 아니면 null) */
function checkRunOf(lines: readonly string[], i: number): [number, number] | null {
  if (checkLineState(lines[i] ?? '') === null) return null;
  let a = i;
  let b = i;
  while (a > 0 && checkLineState(lines[a - 1]) !== null) a--;
  while (b < lines.length - 1 && checkLineState(lines[b + 1]) !== null) b++;
  return [a, b];
}

/** 줄 하나를 from에서 to로 옮긴 줄 목록 (to = 옮긴 뒤 그 줄의 자리) */
function moveLine(lines: readonly string[], from: number, to: number): string[] {
  const out = [...lines];
  const [line] = out.splice(from, 1);
  out.splice(to, 0, line);
  return out;
}

/**
 * 쓰는 칸에서 체크하기·풀기: 글자를 바꾸고 그 줄을 옮긴다 - 체크하면 덩이 맨 아래, 풀면 체크 안 한 줄들의 맨 아래(없으면 덩이 맨 위).
 * 체크 줄이 아니면 null. line = 옮긴 뒤 그 줄의 번호.
 */
export function toggleCheckMoving(text: string, lineIndex: number): { text: string; line: number } | null {
  const toggled = toggleCheckLine(text, lineIndex);
  if (toggled === null) return null;
  const lines = toggled.split('\n');
  const [a, b] = checkRunOf(lines, lineIndex)!;
  let to: number;
  if (checkLineState(lines[lineIndex]) === 'done') {
    to = b;
  } else {
    // 그 줄을 뺀 덩이에서 마지막 체크 안 한 줄 바로 뒤
    let lastOpen = -1;
    for (let k = a; k <= b; k++) if (k !== lineIndex && checkLineState(lines[k]) === 'open') lastOpen = k;
    to = lastOpen < 0 ? a : lastOpen < lineIndex ? lastOpen + 1 : lastOpen;
  }
  return { text: moveLine(lines, lineIndex, to).join('\n'), line: to };
}

/** ▲(-1)·▼(+1)로 옮길 수 있나 - 같은 덩이 안, 같은 무리(체크 안 함끼리·체크함끼리)의 옆 줄과만 */
export function canMoveCheckLine(text: string, lineIndex: number, step: -1 | 1): boolean {
  const lines = text.split('\n');
  const st = checkLineState(lines[lineIndex] ?? '');
  const next = lines[lineIndex + step];
  return st !== null && next !== undefined && checkLineState(next) === st;
}

/** 체크 줄 ▲▼ - 옆 줄과 맞바꾼 글과 옮긴 뒤 줄 번호. 못 옮기면 null */
export function moveCheckLine(text: string, lineIndex: number, step: -1 | 1): { text: string; line: number } | null {
  if (!canMoveCheckLine(text, lineIndex, step)) return null;
  return { text: moveLine(text.split('\n'), lineIndex, lineIndex + step).join('\n'), line: lineIndex + step };
}

/** 줄 번호 → 그 줄 체크 글자 뒤 글자 자리 (커서를 그 줄에 둘 때). 체크 줄이 아니면 줄 맨 앞 */
export function caretAfterCheck(text: string, lineIndex: number): number {
  const lines = text.split('\n');
  const m = /^([ \t]*)([☐☑] ?)/.exec(lines[lineIndex] ?? '');
  return lineStartOf(lines, lineIndex) + (m ? m[0].length : 0);
}

/** 체크 줄 셈 (카드 머리줄 '☑ 2/5'). 체크 줄이 없으면 total 0 */
export function checkCount(text: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const line of text.split('\n')) {
    const st = checkLineState(line);
    if (!st) continue;
    total++;
    if (st === 'done') done++;
  }
  return { done, total };
}
