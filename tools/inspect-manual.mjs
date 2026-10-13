// tools/inspect-manual.mjs - 사용 설명서 점검 (P9-1. V4 tools/inspect-manual.mjs를 V5로 - 항목마다 data-*로).
//   ■1 설명서 창: 머리줄 ?·⋮ '사용 설명서'로 열린다 · 분류 → 기능 → 설명·사용 예 · 왼쪽 목차 · 찾기 · 다른 항목 연결 ·
//      단축키 표는 지금 설정값 · 창의 설명서 주제로 열기({ topic }).
//
//   npm run emu · npm run seed · npm run dev:emu (켜 둔다) → node tools/inspect-manual.mjs   (MATCH=<정규식>으로 묶음 고르기)
// ⚠️ 에뮬레이터만 건드린다.
import { launch, newPage, open, report, sel, waitFor } from './lib/probe.mjs';

const r = report();
const MATCH = process.env.MATCH ? new RegExp(process.env.MATCH) : null;
const browser = await launch();
const { page, errors } = await newPage(browser);
const q = (s) => page.locator(s);
const count = (s) => q(s).count();
const detailId = () => q(sel('help-detail')).getAttribute('data-help-detail');

async function group(name, fn) {
  if (MATCH && !MATCH.test(name)) return;
  r.section(name);
  try {
    await fn();
  } catch (e) {
    r.bad(`${name} - 멈춤: ${String(e?.message || e).split('\n')[0]}`);
  } finally {
    await page.evaluate(() => window.sp5.closeAllWindows()).catch(() => {});
  }
}

try {
  await open(page, '#/day/2026-10-08');

  await group('설명서 창 - 여는 길', async () => {
    await q(sel('header-help')).click();
    r.check(await waitFor(q(sel('help-window')), 8000), '머리줄 ?로 설명서 창이 열린다');
    r.check((await count(sel('help-category'))) === 11, '첫 화면에 기능별 분류 11장');
    r.check((await count(sel('help-tree'))) === 1, '왼쪽 목차가 선다 (넓은 칸)');
    await q(sel('close')).first().click();
    await waitFor(async () => (await count(sel('help-window'))) === 0, 3000);

    await q(sel('more-menu')).click();
    await q(sel('menu-item', 'help')).click();
    r.check(await waitFor(q(sel('help-window')), 5000), "⋮ '사용 설명서'로도 열린다");
  });

  await group('설명서 창 - 분류 → 기능 → 설명', async () => {
    await page.evaluate(() => window.sp5.openWindow('help'));
    await waitFor(q(sel('help-home')), 5000);
    await q(sel('help-category', 'events')).click();
    const topics = await count(`${sel('help-content')} ${sel('help-topic')}`);
    r.check(topics > 5, `일정 분류의 세부 기능 ${topics}개`);
    await q(`${sel('help-content')} ${sel('help-topic', 'forwarding')}`).click();
    r.check((await detailId()) === 'forwarding', '이월 항목의 설명이 열린다');
    r.check((await count(sel('help-example'))) > 0, '사용 예가 있다');
    r.check((await q(sel('help-tree-topic', 'forwarding')).getAttribute('aria-current')) === 'page', '목차에서 지금 항목이 짚인다');
    const lookback = await q(sel('help-lookback')).first().innerText();
    r.check(/^\d+$/.test(lookback), `이월 기간 자리표가 숫자로 풀린다 (${lookback})`);

    // 설명 안의 연결로 다른 항목으로
    const link = q(sel('help-link')).first();
    const to = await link.getAttribute('data-help-link');
    await link.click();
    r.check((await detailId()) === to, `설명 안의 연결로 '${to}' 항목으로 간다`);

    await q(sel('help-crumb-home')).click();
    r.check(await waitFor(q(sel('help-home')), 3000), "위치 표시 '사용 설명서'로 첫 화면");
  });

  await group('설명서 창 - 찾기·단축키 표', async () => {
    await page.evaluate(() => window.sp5.openWindow('help'));
    await waitFor(q(sel('help-search')), 5000);
    await q(sel('help-search')).fill('캡처');
    const n = Number(await q(sel('help-results')).getAttribute('data-help-results'));
    r.check(n > 0 && (await count(`${sel('help-content')} ${sel('help-topic')}`)) === n, `'캡처'로 찾으면 ${n}개 항목`);
    await q(sel('help-search')).fill('');
    await q(sel('help-shortcuts-open')).click();
    r.check((await detailId()) === 'shortcuts', '단축키 한눈에 보기');
    r.check((await count(sel('help-shortcut'))) > 40, '단축키 표가 모든 기능을 펼친다');
    r.check((await q(`${sel('help-shortcut', 'scopeDay')} kbd`).innerText()).length > 0, '하루 화면 단축키 칸에 지금 키');
  });

  await group('설명서 창 - 창의 설명서 주제로 열기', async () => {
    await page.evaluate(() => window.sp5.openWindow('help', { topic: 'seating' }));
    r.check(await waitFor(async () => (await count(sel('help-detail', 'seating'))) === 1, 5000), "{ topic: 'seating' }으로 열면 자리표 항목");
    await page.evaluate(() => window.sp5.openWindow('help', { topic: 'trash' }));
    r.check(await waitFor(async () => (await count(sel('help-detail', 'trash'))) === 1, 3000), '열린 설명서를 다른 주제로 다시 열면 그 항목');
    await q(sel('help-tree-toggle')).click();
    r.check((await count(sel('help-tree'))) === 0, '📚 목차로 목차를 접는다');
    await q(sel('help-tree-toggle')).click();
    r.check((await count(sel('help-tree'))) === 1, '다시 누르면 목차가 선다');
  });

  r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' | ')}`);
} finally {
  await browser.close();
  r.done();
  process.exit();
}
