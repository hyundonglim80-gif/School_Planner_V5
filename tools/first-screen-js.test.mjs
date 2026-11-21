// tools/first-screen-js.mjs의 셈 (P50-1) - node --test tools/first-screen-js.test.mjs (npm run check:size)
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { LIMIT_KB, ROOTS, measure, staticClosure } from './first-screen-js.mjs';

// vite manifest 꼴: 입구 → 라이브러리·공용 조각, 하루 화면(나눠 받는 입구) → 입구·자기 조각, 다른 화면은 나눠 받기로만
const manifest = {
  'index.html': { file: 'assets/index.js', isEntry: true, imports: ['_vendor.js'], dynamicImports: ['src/features/day/DayScreen.tsx', 'src/features/week/WeekScreen.tsx'] },
  '_vendor.js': { file: 'assets/vendor.js' },
  'src/features/day/DayScreen.tsx': { file: 'assets/DayScreen.js', isDynamicEntry: true, imports: ['index.html', '_vendor.js', '_DayBody.js'], dynamicImports: ['src/features/notes/NotePanel.tsx'] },
  '_DayBody.js': { file: 'assets/DayBody.js', imports: ['_shared.js'] },
  '_shared.js': { file: 'assets/shared.js' },
  'src/features/week/WeekScreen.tsx': { file: 'assets/WeekScreen.js', isDynamicEntry: true, imports: ['index.html', '_shared.js'] },
  'src/features/notes/NotePanel.tsx': { file: 'assets/NotePanel.js', isDynamicEntry: true, imports: ['index.html'] },
};

test('입구 + 하루 화면이 정적으로 부르는 조각만, 겹친 것은 한 번', () => {
  assert.deepEqual(staticClosure(manifest), ['assets/index.js', 'assets/vendor.js', 'assets/DayScreen.js', 'assets/DayBody.js', 'assets/shared.js']);
});

test('나눠 받는 조각(다른 화면·쓰는 칸)은 세지 않는다', () => {
  const files = staticClosure(manifest);
  assert.ok(!files.includes('assets/WeekScreen.js'));
  assert.ok(!files.includes('assets/NotePanel.js'));
});

test('하루 화면 파일을 옮겨 목록에 없으면 알려 준다 (말없이 입구만 재지 않게)', () => {
  const { ['src/features/day/DayScreen.tsx']: _, ...moved } = manifest;
  assert.throws(() => staticClosure(moved), /DayScreen\.tsx.*ROOTS/);
});

test('부르는 조각이 목록에 없으면 알려 준다', () => {
  assert.throws(() => staticClosure({ ...manifest, '_DayBody.js': { file: 'assets/DayBody.js', imports: ['_gone.js'] } }), /_gone\.js/);
});

test('파일마다 gzip 크기를 더하고 큰 것부터', () => {
  // 라이브러리 = 줄지 않는 바이트 3000개(늘 가장 크다) · 나머지 = 짧은 글
  const body = { 'assets/vendor.js': randomBytes(3000) };
  const read = (file) => body[file] ?? Buffer.from(`// ${file}`);
  const { rows, total } = measure(manifest, read);
  assert.equal(rows.length, 5);
  assert.equal(rows[0].file, 'assets/vendor.js');
  const expected = staticClosure(manifest).reduce((sum, f) => sum + gzipSync(read(f), { level: 9 }).length, 0);
  assert.equal(total, expected);
});

test('정한 값·첫 화면은 inspect-perf와 같은 하루 화면', () => {
  assert.ok(LIMIT_KB < 400, 'V4 첫 화면 약 400KB 아래');
  assert.deepEqual(ROOTS, ['index.html', 'src/features/day/DayScreen.tsx']);
});
