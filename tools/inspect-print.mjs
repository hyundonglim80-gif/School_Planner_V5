// tools/inspect-print.mjs - 🖨️ 인쇄 창(10-23 사용자 요청 - features/print)을 실제 크롬에서 본다.
//   1) 주간에서 Ctrl+P = 인쇄 창이 그 주·가로로, 미리보기 쪽에 그 주 일정, 단추(+ 등)는 쪽에 없다, 어두운 화면에서도 쪽은 흰 바탕
//   2) 화면 '하루' = 세로, 구간 끝을 달력에서 고르면 쪽이 늘고 🖨️ 인쇄 = 쪽마다 새 용지(.sp5-print-page)·A4 세로
//   3) 한 장에 맞추기: 긴 날은 줄여 한 장(zoom) / 끄면 점선으로 여러 장
//   4) 여백(단추·mm 칸 = @page 여백·쪽 폭)·정렬(가로·세로) - 이 기기에 남는다
//   5) 월간·년간 쪽, 가로·세로 바꾸기, 메모 화면에서 열면 하루 + '이 화면 그대로 인쇄'
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-print.mjs
// 에뮬레이터 teacher 계정에 일정·메모를 심고 끝에 지운다.
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const browser = await launch();
const itemRef = (id) => doc(em.db, 'spaces', `u_${uid}`, 'items', id);
const stamp = { labelIds: [], deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid };

try {
  const put = async (id, data) => {
    await setDoc(itemRef(id), { ...stamp, ...data });
    undo.add(() => deleteDoc(itemRef(id)));
  };
  await put('insp_pr_ev', { kind: 'event', date: '2026-10-13', text: '인쇄점검 현장학습', order: 'a0', props: { calendar: true } });
  await put('insp_pr_note', { kind: 'note', date: '2026-10-12', text: '인쇄점검 메모', order: 'a0' });
  // 긴 날 - 메모 서른 장 (한 장에 맞추기)
  for (let i = 0; i < 30; i++) await put(`insp_pr_long${i}`, { kind: 'note', date: '2026-10-14', text: `인쇄점검 긴 메모 ${i}\n둘째 줄\n셋째 줄\n넷째 줄`, order: `a${String(i).padStart(2, '0')}` });

  const { page, errors } = await newPage(browser);
  await page.addInitScript(() => localStorage.setItem('sp5_theme', 'dark'));
  await open(page, '#/week/2026-10-12');
  await waitFor(page.locator(sel('week-grid')), 8000);
  await page.evaluate(() => {
    window.print = () => {
      window.__printed = (window.__printed || 0) + 1;
    };
  });

  r.section('주간에서 Ctrl+P');
  await page.keyboard.press('Control+p');
  const win = page.locator(sel('print-window'));
  r.check(await waitFor(win, 8000), 'Ctrl+P = 인쇄 창');
  r.check((await win.getAttribute('data-print-window')) === 'week', '처음 화면 = 보던 화면(주간)');
  r.check((await page.locator(sel('print-range')).getAttribute('data-print-range')) === '2026-10-12~2026-10-12', '구간 = 보던 주 하나');
  r.check((await page.locator(sel('print-orient', 'landscape')).getAttribute('aria-pressed')) === 'true', '주간은 가로');
  const paper = page.locator('[data-print-paper]');
  r.check(await waitFor(paper.filter({ hasText: '인쇄점검 현장학습' }), 8000), '미리보기 쪽에 그 주 일정');
  r.check((await paper.locator('.sp5-print-title').first().textContent()).startsWith('2026년 10.12 ~ 10.1'), '쪽 제목 = 그 주');
  r.check(!(await paper.locator('[data-week-next]').count()) && !(await paper.locator(sel('last-year-toggle')).count()), '다음 주 줄·단추 줄은 쪽에 없다');
  r.check(await page.evaluate(() => document.documentElement.classList.contains('dark')), '어두운 화면');
  const bg = await paper.first().evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el.querySelector('[data-week-day], .bg-white') ?? el).backgroundColor]);
  r.check(bg[0] === 'rgb(255, 255, 255)', `쪽 바탕은 흰색 (${bg[0]})`);
  r.check(/255, 255, 255|oklch\(1 |#fff/.test(bg[1]) || bg[1] === 'rgba(0, 0, 0, 0)', `쪽 안 카드도 밝게 (${bg[1]})`);

  r.section('하루 - 구간·세로·인쇄');
  await page.locator(sel('print-page', 'day')).click();
  r.check((await page.locator(sel('print-orient', 'portrait')).getAttribute('aria-pressed')) === 'true', '하루는 세로');
  await page.locator(sel('print-to')).click();
  await page.locator('[data-date-picker-popover] [data-picker-day="2026-10-14"]').click();
  r.check(await waitFor(async () => (await page.locator(sel('print-sheet')).count()) === 3), '끝 = 10/14 → 세 쪽');
  r.check((await page.locator(sel('print-count')).getAttribute('data-print-count')) === '3', "'3쪽'");
  const day12 = page.locator(`${sel('print-sheet', '2026-10-12')} [data-print-paper]`);
  r.check(await waitFor(day12.filter({ hasText: '인쇄점검 메모' })), '그날 메모가 그날 쪽에');
  r.check(!(await day12.locator(sel('journal-add')).isVisible()) && !(await day12.locator(sel('event-add')).isVisible()), '+ 추가 단추는 쪽에 보이지 않는다');
  await page.locator(sel('print-go')).click();
  r.check((await page.evaluate(() => window.__printed)) === 1, '🖨️ 인쇄 = 브라우저 인쇄 창');
  r.check((await page.locator('#sp5-print-root .sp5-print-page').count()) === 3, '찍을 것 = 쪽마다 새 용지 셋');
  r.check((await page.locator('#sp5-print-root-page').textContent()).includes('A4 portrait'), 'A4 세로');
  // 찍을 때의 모양 (인쇄 미디어로 본다 - afterprint가 오지 않아 찍을 준비가 남아 있다)
  await page.emulateMedia({ media: 'print' });
  r.check(await page.locator('#sp5-print-root .sp5-print-page').first().isVisible(), '인쇄 모양: 쪽이 보인다');
  r.check(!(await page.locator('#sp5-print-root [data-journal-add]').first().isVisible()), '인쇄 모양: + 추가는 찍히지 않는다');
  r.check(!(await page.locator(sel('print-window')).isVisible()), '인쇄 모양: 인쇄 창·앱은 찍히지 않는다');
  await page.emulateMedia({ media: 'screen' });
  const titles = await page.locator('#sp5-print-root .sp5-print-title').allTextContents();
  r.check(titles.join('|') === '2026년 10월 12일 (월)|2026년 10월 13일 (화)|2026년 10월 14일 (수)', `쪽 제목 = 날마다 (${titles.join(' | ')})`);

  r.section('한 장에 맞추기');
  const long = page.locator(sel('print-sheet', '2026-10-14'));
  r.check(await waitFor(async () => Number(await long.getAttribute('data-print-zoom')) < 1), '긴 날은 줄여서 (zoom < 1)');
  r.check((await long.getAttribute('data-print-sheets')) === '1', '한 장');
  await page.locator(sel('print-fit')).uncheck();
  r.check(await waitFor(async () => Number(await long.getAttribute('data-print-sheets')) > 1), `끄면 여러 장 (${await long.getAttribute('data-print-sheets')})`);
  r.check((await long.getAttribute('data-print-zoom')) === '1', '줄이지 않는다');
  await page.locator(sel('print-fit')).check();

  r.section('여백·정렬');
  const mmPx = (mm) => (mm * 96) / 25.4;
  const frameW = async (start) => (await page.locator(`${sel('print-sheet', start)} [data-print-frame]`).evaluate((el) => el.offsetWidth));
  r.check((await page.locator(sel('print-margin', 8)).getAttribute('aria-pressed')) === 'true', '처음 여백 = 보통 8mm');
  r.check(Math.abs((await frameW('2026-10-12')) - mmPx(210 - 16)) < 1, '쪽 폭 = 용지 - 여백 둘 (194mm)');
  await page.locator(sel('print-margin', 15)).click();
  r.check(await waitFor(async () => Math.abs((await frameW('2026-10-12')) - mmPx(180)) < 1), '넓게 15mm → 쪽 폭 180mm');
  r.check((await page.locator(sel('print-margin-input')).inputValue()) === '15', 'mm 칸도 15');
  await page.locator(sel('print-margin-input')).fill('12');
  r.check(await waitFor(async () => Math.abs((await frameW('2026-10-12')) - mmPx(186)) < 1), 'mm 칸에 12 → 쪽 폭 186mm');
  r.check((await page.locator('[data-print-margin][aria-pressed="true"]').count()) === 0, '단추 셋은 고르지 않은 채');
  await page.locator(sel('print-align-y', 'middle')).click();
  await page.locator(sel('print-align-x', 'right')).click();
  const place = async (start) =>
    page.locator(sel('print-sheet', start)).evaluate((s) => {
      const f = s.querySelector('[data-print-frame]').getBoundingClientRect();
      const p = s.querySelector('[data-print-paper]').getBoundingClientRect();
      return { left: p.left - f.left, right: f.right - p.right, top: p.top - f.top, bottom: f.bottom - p.bottom };
    });
  const short = await place('2026-10-13');
  r.check(short.top > 10 && Math.abs(short.top - short.bottom) < 2, `세로 가운데 - 짧은 쪽은 위아래가 같게 (${Math.round(short.top)} / ${Math.round(short.bottom)})`);
  const shrunk = await place('2026-10-14');
  r.check(shrunk.left > 10 && shrunk.right < 1, `가로 오른쪽 - 줄인 쪽은 오른쪽에 (${Math.round(shrunk.left)} / ${Math.round(shrunk.right)})`);
  await page.locator(sel('print-go')).click();
  r.check((await page.locator('#sp5-print-root-page').textContent()).includes('margin: 12mm'), '찍을 때 @page 여백 12mm');
  r.check((await page.locator('#sp5-print-root .sp5-print-page > [data-print-frame]').count()) === 3, '찍을 것 = 쪽 틀째 (정렬이 따라간다)');
  await page.emulateMedia({ media: 'print' });
  const printed = await page.locator('#sp5-print-root .sp5-print-page').nth(1).evaluate((pg) => {
    const f = pg.querySelector('[data-print-frame]').getBoundingClientRect();
    const p = pg.querySelector('[data-print-paper]').getBoundingClientRect();
    return { top: p.top - f.top, bottom: f.bottom - p.bottom };
  });
  await page.emulateMedia({ media: 'screen' });
  r.check(printed.top > 10 && Math.abs(printed.top - printed.bottom) < 3, `인쇄 모양에서도 세로 가운데 (${Math.round(printed.top)} / ${Math.round(printed.bottom)})`);
  await page.reload();
  await waitFor(page.locator(sel('session', 'signed-in')), 20000);
  await page.keyboard.press('Control+p');
  await waitFor(win, 8000);
  r.check(
    (await page.locator(sel('print-margin-input')).inputValue()) === '12' &&
      (await page.locator(sel('print-align-x', 'right')).getAttribute('aria-pressed')) === 'true' &&
      (await page.locator(sel('print-align-y', 'middle')).getAttribute('aria-pressed')) === 'true',
    '다시 열어도 여백·정렬 그대로 (이 기기)',
  );
  await page.locator(sel('print-margin', 8)).click();
  await page.locator(sel('print-align-x', 'center')).click();
  await page.locator(sel('print-align-y', 'top')).click();
  await page.evaluate(() => {
    window.print = () => {
      window.__printed = (window.__printed || 0) + 1;
    };
  });

  r.section('월간·년간');
  await page.locator(sel('print-page', 'month')).click();
  r.check(await waitFor(async () => (await page.locator(sel('print-sheet')).count()) === 1), '월간 = 그 달 한 쪽 (10/12 ~ 10/14)');
  r.check((await page.locator(sel('print-orient', 'landscape')).getAttribute('aria-pressed')) === 'true', '월간은 가로');
  const month = page.locator('[data-print-paper]').first();
  r.check(await waitFor(month.locator('[data-month-week]').first()), '쪽에 월간 달력');
  r.check(await waitFor(month.filter({ hasText: '인쇄점검 현장학습' })), '달력 일정');
  r.check((await month.locator('.sp5-print-title').textContent()) === '2026년 10월', '쪽 제목 = 2026년 10월');
  await page.locator(sel('print-orient', 'portrait')).click();
  await page.locator(sel('print-go')).click();
  r.check((await page.locator('#sp5-print-root-page').textContent()).includes('A4 portrait'), '세로로 바꾸면 A4 세로');
  await page.locator(sel('print-page', 'year')).click();
  const year = page.locator('[data-print-paper]').first();
  r.check(await waitFor(async () => (await year.locator('[data-sheet-month]').count()) === 12, 8000), '년간 = 학사력 열두 달');
  r.check((await year.locator('.sp5-print-title').textContent()) === '2026학년도 학사력', '쪽 제목 = 학년도 학사력');
  await page.locator(sel('print-go')).click();
  r.check((await page.locator('#sp5-print-root [data-year-sheet]').count()) === 1 && (await page.locator('#sp5-print-root-page').textContent()).includes('landscape'), '찍을 것 = 학사력, 가로');
  await page.locator(sel('print-page', 'month')).click();
  r.check((await page.locator(sel('print-orient', 'portrait')).getAttribute('aria-pressed')) === 'true', '고른 방향은 화면마다 남는다 (월간 세로)');

  r.section('메모 화면에서');
  await page.locator(sel('close')).click();
  await page.goto(page.url().replace(/#.*$/, '#/memo'));
  await waitFor(page.locator(sel('screen', 'memo')), 8000);
  await page.locator(sel('more-menu')).click();
  await page.locator(sel('menu-item', 'print')).click();
  r.check(await waitFor(win), '⋮ 🖨️ 이 화면 인쇄 = 인쇄 창');
  r.check((await win.getAttribute('data-print-window')) === 'day', '메모 화면은 하루로');
  r.check((await page.locator(sel('print-as-is')).count()) === 1, "'이 화면 그대로 인쇄' 단추");
  const before = await page.evaluate(() => window.__printed || 0);
  await page.locator(sel('print-as-is')).click();
  r.check(await waitFor(async () => (await page.evaluate(() => window.__printed)) === before + 1), '누르면 창을 닫고 브라우저 인쇄');
  r.check(!(await win.count()), '창은 닫혔다');

  r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' / ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack || e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
