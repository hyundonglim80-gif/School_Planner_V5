import { describe, it, expect } from 'vitest';
import {
  buildReport,
  DAY_MAX,
  errorKey,
  groupErrors,
  isNoise,
  LIMITS,
  readDaySent,
  readSessionSent,
  scrubText,
  SESSION_MAX,
  shouldSend,
  stackHead,
  type ErrorContext,
  type ErrorReportDoc,
} from './errorReport';

const CTX: ErrorContext = { build: '2026-10-29.1', scope: 'day', device: 'pc', standalone: false, ua: 'Mozilla/5.0 Chrome/141' };

describe('scrubText - 글 내용을 지운다', () => {
  it('메일·문서 경로·긴 숫자·숫자 섞인 긴 id', () => {
    expect(scrubText('teacher@example.com 님 권한 없음')).toBe('… 님 권한 없음');
    expect(scrubText('No document to update: projects/p/databases/(default)/documents/spaces/u_abc123/items/x9')).toBe(
      'No document to update: projects/p/databases/(default)/documents/spaces/…',
    );
    expect(scrubText('users/AbC123/settings/labels 읽기 실패')).toBe('users/… 읽기 실패');
    expect(scrubText('학번 20261234 전화 01012345678')).toBe('학번 … 전화 …');
    expect(scrubText('uid oWrXNPuOtbmcab7O7EG12JeNUR7P 없음')).toBe('uid … 없음');
  });

  it('따옴표 안 사용자 글·파일 이름은 지우고, 코드 이름은 둔다', () => {
    expect(scrubText("'김철수 상담' 라벨이 이미 있습니다.")).toBe('… 라벨이 이미 있습니다.');
    expect(scrubText('5학년 1반 명렬표.csv을 읽지 못했습니다.')).toBe('5학년 1반 …을 읽지 못했습니다.');
    expect(scrubText("Cannot read properties of undefined (reading 'title')")).toBe("Cannot read properties of undefined (reading 'title')");
    expect(scrubText('Unexpected token "{"a":1} 우리반" is not valid JSON')).not.toContain('우리반');
  });

  it('주소의 ? 뒤(토큰)는 지운다', () => {
    expect(scrubText('GET https://www.googleapis.com/drive/v3/files?access_token=ya29.SECRET 403')).toBe('GET https://www.googleapis.com/drive/v3/files 403');
  });

  it('300자에서 자른다', () => {
    const s = scrubText('가'.repeat(500));
    expect(s.length).toBe(LIMITS.message);
    expect(s.endsWith('…')).toBe(true);
  });
});

describe('stackHead - 앞 8줄, 주소는 파일:줄', () => {
  it('크롬·파이어폭스 스택', () => {
    const chrome = [
      'TypeError: x is undefined',
      '    at render (http://localhost:5175/src/features/day/DayView.tsx?t=1730000000000:42:7)',
      '    at https://schoolplanner-v5.web.app/assets/index-BwZ9B8To.js:1:234567',
      ...Array.from({ length: 10 }, (_, i) => `    at f${i} (https://schoolplanner-v5.web.app/assets/a.js:1:${i})`),
    ].join('\n');
    const head = stackHead(chrome).split('\n');
    expect(head).toHaveLength(8);
    expect(head[1]).toBe('at render (DayView.tsx:42:7)');
    expect(head[2]).toBe('at index-BwZ9B8To.js:1:234567');
    expect(stackHead('render@http://localhost:5175/src/App.tsx:3:9\n@blob:http://x/abc:1:1')).toBe('render@App.tsx:3:9\n@abc:1:1');
  });

  it('빈 스택은 빈 글, 1500자에서 자른다', () => {
    expect(stackHead(undefined)).toBe('');
    expect(stackHead(Array.from({ length: 8 }, () => 'a'.repeat(250)).join('\n')).length).toBeLessThanOrEqual(LIMITS.stack);
  });
});

describe('isNoise - 보내지 않을 것', () => {
  const e = (message: string, extra: Partial<{ name: string; stack: string; source: string }> = {}) => ({ name: 'Error', message, stack: '', ...extra });
  it('브라우저 소음·확장 프로그램·새 판 조각·끊긴 동안·이미 안내한 실패', () => {
    expect(isNoise(e('ResizeObserver loop completed with undelivered notifications.'), true)).toBe(true);
    expect(isNoise(e('Script error.'), true)).toBe(true);
    expect(isNoise(e('x', { stack: 'at chrome-extension://abc/content.js:1:1' }), true)).toBe(true);
    expect(isNoise(e('x', { source: 'moz-extension://abc/a.js' }), true)).toBe(true);
    expect(isNoise(e('Failed to fetch dynamically imported module: https://x/assets/a.js'), true)).toBe(true);
    expect(isNoise(e('x', { name: 'ShownError' }), true)).toBe(true);
    expect(isNoise(e('TypeError: x is undefined'), false)).toBe(true);
  });
  it('그 밖은 보낸다', () => {
    expect(isNoise(e('TypeError: x is undefined'), true)).toBe(false);
  });
});

describe('shouldSend - 같은 오류는 세션에 한 번, 세션 10건·하루 30건', () => {
  it('같은 열쇠는 한 번', () => {
    const first = shouldSend({ keys: [] }, { day: '', count: 0 }, 'k', '2026-10-29')!;
    expect(first).toEqual({ session: { keys: ['k'] }, day: { day: '2026-10-29', count: 1 } });
    expect(shouldSend(first.session, first.day, 'k', '2026-10-29')).toBeNull();
    expect(shouldSend(first.session, first.day, 'k2', '2026-10-29')?.day.count).toBe(2);
  });

  it('세션 10건까지', () => {
    const keys = Array.from({ length: SESSION_MAX }, (_, i) => `k${i}`);
    expect(shouldSend({ keys }, { day: '2026-10-29', count: SESSION_MAX }, 'new', '2026-10-29')).toBeNull();
  });

  it('하루 30건까지 - 날이 바뀌면 다시', () => {
    expect(shouldSend({ keys: [] }, { day: '2026-10-29', count: DAY_MAX }, 'k', '2026-10-29')).toBeNull();
    expect(shouldSend({ keys: [] }, { day: '2026-10-28', count: DAY_MAX }, 'k', '2026-10-29')?.day).toEqual({ day: '2026-10-29', count: 1 });
  });

  it('저장소 값이 망가져 있으면 빈 기록', () => {
    expect(readSessionSent('{bad')).toEqual({ keys: [] });
    expect(readSessionSent(null)).toEqual({ keys: [] });
    expect(readSessionSent('{"keys":["a",3]}')).toEqual({ keys: ['a'] });
    expect(readDaySent('"x"')).toEqual({ day: '', count: 0 });
    expect(readDaySent('{"day":"2026-10-29","count":4}')).toEqual({ day: '2026-10-29', count: 4 });
  });

  it('열쇠 = 종류 + 문장 + 스택 첫 자리', () => {
    expect(errorKey('error', 'm', 'TypeError\nat a (A.tsx:1:2)')).toBe('error|m|at a (A.tsx:1:2)');
    expect(errorKey('error', 'm', '')).not.toBe(errorKey('rejection', 'm', ''));
  });
});

describe('buildReport - 올릴 칸', () => {
  it('오류 문장 앞에 이름·코드, 스택은 앞 8줄', () => {
    const err = Object.assign(new Error('Missing or insufficient permissions.'), { name: 'FirebaseError', code: 'permission-denied' });
    const r = buildReport('rejection', err, CTX);
    expect(r.message).toBe('FirebaseError: [permission-denied] Missing or insufficient permissions.');
    expect(r.kind).toBe('rejection');
    expect(r.note).toBe('');
    expect(Object.keys(r).sort()).toEqual(['build', 'device', 'kind', 'message', 'note', 'scope', 'stack', 'standalone', 'ua']);
  });

  it("'toast'는 앱 안내 글(사용자 글은 지움) + 오류 이름·코드만 - 오류 문장은 싣지 않는다", () => {
    const err = Object.assign(new Error('Quota exceeded for 김철수.png'), { name: 'FirebaseError', code: 'resource-exhausted' });
    const r = buildReport('toast', err, CTX, { toastText: "'김철수.png' 업로드에 실패했습니다." });
    expect(r.message).toBe('… 업로드에 실패했습니다.');
    expect(r.note).toBe('FirebaseError resource-exhausted');
    expect(JSON.stringify(r)).not.toContain('김철수');
  });

  it("'react'는 컴포넌트 이름 스택을 note에", () => {
    const r = buildReport('react', new TypeError('x is undefined'), CTX, { componentStack: '\n    at DayView (http://localhost:5175/src/DayView.tsx:3:1)\n    at Shell' });
    expect(r.message).toBe('TypeError: x is undefined');
    expect(r.note).toBe('at DayView (DayView.tsx:3:1)\nat Shell');
  });

  it('Error가 아닌 것을 던져도 · 화면 이름은 글자만', () => {
    expect(buildReport('rejection', 'boom', CTX).message).toBe('boom');
    expect(buildReport('rejection', undefined, CTX).message).toBe('(빈 문장)');
    expect(buildReport('error', new Error('x'), { ...CTX, scope: 'day/2026-10-29' }).scope).toBe('day2026-10-29');
  });
});

describe('groupErrors - 같은 문장끼리', () => {
  const doc = (id: string, message: string, at: number, extra: Partial<ErrorReportDoc> = {}): ErrorReportDoc => ({
    id,
    at,
    ...buildReport('error', new Error(message), CTX),
    message,
    ...extra,
  });
  it('건수·마지막 시각·판·기기, 늦은 묶음부터', () => {
    const groups = groupErrors([
      doc('a', 'A', 100),
      doc('b', 'B', 300),
      doc('c', 'A', 200, { build: 'old', device: 'mobile', standalone: true }),
      doc('d', 'A', 50),
    ]);
    expect(groups.map((g) => g.message)).toEqual(['B', 'A']);
    const a = groups[1];
    expect(a.count).toBe(3);
    expect(a.lastAt).toBe(200);
    expect(a.latest.id).toBe('c');
    expect(a.builds).toEqual(['old', CTX.build]);
    expect(a.devices).toEqual(['mobile·앱', 'pc']);
    expect(a.ids.sort()).toEqual(['a', 'c', 'd']);
  });
});
