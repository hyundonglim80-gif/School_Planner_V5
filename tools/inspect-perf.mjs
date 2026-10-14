// tools/inspect-perf.mjs - P9-3 ■3 성능: 1만 항목 계정(teacher4 - ?as=4)으로
//   1) 첫 화면 JS - 하루 화면이 뜰 때까지 받은 JS (빌드 + preview로 돌리면 dist 파일의 gzip 크기를 더한다)
//   2) 열 때 서버 읽기 수 - 기기 사본이 없을 때(처음)·있을 때(다시 열기). 앱이 세는 window.__sp5Reads(에뮬레이터 빌드만)
//   3) 큰 자료 검색 - 1만 항목에서 치는 대로 찾기가 결과를 그리기까지
//   결과는 표로 찍는다 → docs/DESIGN.md 끝에 옮겨 적는다.
//
//   npm run emu · npm run seed(teacher4) → npm run build:emu → npx vite preview --port 4175 → SITE=http://localhost:4175/ node tools/inspect-perf.mjs
//   (개발 서버로 돌리면 JS 크기는 빼고 잰다 - 개발 서버 파일은 나뉘고 줄이지 않아 견줄 수 없다)
// ⚠️ 에뮬레이터만. 심은 1만 항목은 teacher4 공간에 둔다(다른 점검 계정과 섞이지 않는다 - 다시 돌리면 같은 id라 늘지 않는다).
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { collection, doc, getCountFromServer, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, sel, SITE, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher4@example.com');
const sid = `u_${uid}`;
const N = 10000;
const DAY = '2026-10-14';
const isPreview = !SITE.includes(':5175');

// ── 1만 항목 심기 (같은 id - 몇 번 돌려도 1만) ──
const WORDS = ['수업 준비', '학부모 상담', '현장 체험학습', '견학 안내', '교직원 회의', '공문 처리', '평가 계획', '생활 지도', '동아리 활동', '방과후 수업',
  '학급 회의', '교육과정 협의', '연수 신청', '출장', '학교 행사', '청소 점검', '급식 지도', '안전 교육', '독서 활동', '진로 상담'];
const LABELS = [
  ['perf_le1', 'event', '업무', 'blue'], ['perf_le2', 'event', '학급', 'green'], ['perf_le3', 'event', '행사', 'orange'], ['perf_le4', 'event', '회의', 'purple'], ['perf_le5', 'event', '출장', 'red'],
  ['perf_ln1', 'note', '상담', 'teal'], ['perf_ln2', 'note', '수업 기록', 'yellow'], ['perf_ln3', 'note', '아이디어', 'pink'],
];
const RARE = new Set([777, 5555, 9999]);
const FROM = Date.UTC(2024, 2, 1);
const SPAN = 1095; // 2024-03-01 ~ 2027-02-28 세 학년도
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
function itemOf(i) {
  const h = (i * 2654435761) >>> 0; // 고르게 흩는 수
  const kind = h % 100 < 70 ? 'event' : 'note';
  const memo = kind === 'note' && h % 100 >= 95;
  // 이틀에 하나는 오늘 근처(점검 날)에 두어 하루 화면에 카드가 있게
  const date = memo ? null : i % 500 === 0 ? DAY : ymd(FROM + ((h >>> 8) % SPAN) * 86400000);
  const w = WORDS[(h >>> 4) % WORDS.length];
  const labels = LABELS.filter(([, k]) => k === kind);
  return {
    kind,
    date,
    text: `${w} ${i}${RARE.has(i) ? ' 희귀어' : ''}${kind === 'note' ? `\n${WORDS[(h >>> 12) % WORDS.length]} 메모 줄` : ''}`,
    labelIds: [labels[(h >>> 16) % labels.length][0]],
    order: `a${String(i).padStart(5, '0')}`,
  };
}

const stamp = () => ({ deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid });
const items = collection(em.db, 'spaces', sid, 'items');
const have = (await getCountFromServer(items)).data().count;
if (have < N) {
  console.log(`1만 항목 심기 (있는 것 ${have})…`);
  let b = writeBatch(em.db);
  for (const [id, kind, name, color] of LABELS) b.set(doc(em.db, 'spaces', sid, 'labels', id), { kind, name, color, parentId: null, order: id, ...stamp() });
  for (let i = 1; i <= N; i++) {
    b.set(doc(items, `perf_${String(i).padStart(5, '0')}`), { ...itemOf(i), ...stamp() });
    if (i % 400 === 0) {
      await b.commit();
      b = writeBatch(em.db);
    }
  }
  await b.commit();
}
// 구독은 '가장 늦은 판 - 1분'부터라(sync OVERLAP_MS) 방금 한꺼번에 심은 1만 개가 그 1분 안에 들면 구독이 1만 개를 다시 보내
// 에뮬레이터 통로가 막힌다(10001 - P9-3에서 에뮬레이터가 멈췄다). 실제로는 마지막 1분에 바뀐 것만 겹친다 →
// 1분 넘게 기다린 뒤 표시 하나를 써서 커서를 그 뒤로 둔다.
if (have < N) {
  console.log('구독 겹침(1분)을 넘기려 65초 기다린다…');
  await new Promise((res) => setTimeout(res, 65000));
}
await setDoc(doc(items, 'perf_marker'), { kind: 'note', date: null, text: '성능 점검 표시', labelIds: [], order: 'z', ...stamp() });
const count = (await getCountFromServer(items)).data().count;
r.check(count >= N, `teacher4 항목 ${count}개 (+ 표시 하나)`);
const hitsOf = (word) => Array.from({ length: N }, (_, k) => itemOf(k + 1)).filter((it) => it.text.includes(word)).length;

/** 앱이 센 서버 읽기가 3초 동안 늘지 않을 때까지 (최대 ms) - 마지막 값 */
async function readsSettled(page, ms = 120000) {
  const end = Date.now() + ms;
  let last = '';
  let since = Date.now();
  for (;;) {
    const now = JSON.stringify(await page.evaluate(() => window.__sp5Reads ?? {}));
    if (now !== last) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since > 3000) break;
    if (Date.now() > end) break;
    await new Promise((res) => setTimeout(res, 250));
  }
  return JSON.parse(last || '{}');
}
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

const browser = await launch();
const rows = [];
try {
  const { page, errors } = await newPage(browser);
  const js = new Map();
  page.on('response', (res) => {
    const u = new URL(res.url());
    if (u.origin === new URL(SITE).origin && u.pathname.endsWith('.js')) js.set(u.pathname, true);
  });

  r.section('처음 열기 (기기 사본 없음)');
  let t0 = Date.now();
  await open(page, `#/day/${DAY}`, { as: '4' });
  const card = page.locator(`${sel('day-events', DAY)} ${sel('event-card')}`).first();
  r.check(await waitFor(card, 60000), '하루 화면에 일정 카드');
  const firstCard = Date.now() - t0;
  const firstJs = [...js.keys()];
  const reads1 = await readsSettled(page);
  const synced1 = Date.now() - t0;
  r.check(sum(reads1) >= N, `처음 받기 = 서버 읽기 ${sum(reads1)} (항목 ${reads1.items ?? 0})`);
  rows.push(['처음 열기(사본 없음)', `${firstCard}ms`, `${synced1}ms`, sum(reads1), JSON.stringify(reads1)]);

  if (isPreview) {
    let gz = 0;
    let raw = 0;
    for (const p of firstJs) {
      const f = `dist${p}`;
      if (!existsSync(f)) continue;
      const buf = readFileSync(f);
      raw += buf.length;
      gz += gzipSync(buf, { level: 9 }).length;
    }
    rows.push(['첫 화면 JS', `${firstJs.length}개 파일`, `${kb(raw)} (gzip ${kb(gz)})`, '', '']);
    r.check(gz < 400 * 1024, `첫 화면 JS gzip ${kb(gz)} (V4 약 400KB보다 작다)`, `첫 화면 JS gzip ${kb(gz)} - V4 약 400KB보다 크다`);
  } else console.log('  - 개발 서버라 JS 크기는 재지 않는다 (SITE=preview 주소로)');

  const usage = await page.evaluate(async () => (await navigator.storage.estimate()).usage ?? 0);
  rows.push(['이 기기 저장 (사본·캐시)', '', kb(usage), '', '']);

  r.section('다시 열기 (기기 사본 있음)');
  t0 = Date.now();
  await page.reload();
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  r.check(await waitFor(card, 30000), '하루 화면에 일정 카드');
  const secondCard = Date.now() - t0;
  const reads2 = await readsSettled(page);
  const synced2 = Date.now() - t0;
  r.check(sum(reads2) < 100, `다시 열면 서버 읽기 ${sum(reads2)} (바뀐 것·지운 표시 견주기만)`);
  rows.push(['다시 열기(사본 있음)', `${secondCard}ms`, `${synced2}ms`, sum(reads2), JSON.stringify(reads2)]);

  r.section('1만 항목 검색 (치는 대로)');
  await page.evaluate(() => window.sp5.openWindow('search'));
  const input = page.locator(sel('search-input'));
  await input.waitFor({ timeout: 8000 });
  const hits = page.locator(sel('search-hit'));
  for (const [word, want] of [['희귀어', 3], ['견학', hitsOf('견학')], ['수업', hitsOf('수업')]]) {
    await input.fill('');
    await waitFor(async () => (await hits.count()) === 0, 3000);
    t0 = Date.now();
    await input.fill(word);
    const ok = await waitFor(async () => (await hits.count()) > 0, 10000);
    const ms = Date.now() - t0;
    const shown = await hits.count();
    const total = (await page.locator(sel('search-results')).getAttribute('data-search-results').catch(() => null)) ?? '';
    r.check(ok && ms < 1000, `'${word}' ${ms}ms - 보이는 결과 ${shown}${total ? ` / ${total}` : ''} (자료에 ${want})`, `'${word}' ${ms}ms - 느리거나 결과 없음 (${shown})`);
    rows.push([`검색 '${word}'`, `${ms}ms`, `보이는 ${shown}${total ? ` / ${total}` : ''}`, '', `자료에 ${want}`]);
  }
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);

  console.log('\n| 잰 것 | 처음 그림 | 다 받음 / 크기 | 서버 읽기 | 자세히 |\n|---|---|---|---|---|');
  for (const row of rows) console.log(`| ${row.join(' | ')} |`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  // 앱의 구독을 먼저 끊고 닫는다 (끊긴 통로가 에뮬레이터에 남지 않게)
  for (const ctx of browser.contexts()) for (const p of ctx.pages()) await p.goto('about:blank').catch(() => {});
  await new Promise((res) => setTimeout(res, 1000));
  await browser.close();
  r.done();
  process.exit();
}
