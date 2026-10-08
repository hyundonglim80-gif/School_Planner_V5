// tools/inspect-shell.mjs - P1-3 끝 조건을 크롬으로 본다 (앱 껍데기).
//   1) 빈 화면 여섯을 화면 탭·단축키·주소로 오간다. 새로고침해도 그 자리, 뒤로가기 = 앞 화면.
//   2) 둘째 줄: ◀▶·날짜(오늘로)·📅 고르기·토글, 메모·학급에는 없다.
//   3) 시험 창 둘(창·쓰는 칸)이 V4처럼: 탭(숨은 탭도 글이 남는다)·탭 ×·Ctrl+S(커서 든 칸, 없으면 보이는 탭)·
//      뒤로가기(맨 위 하나, 다 닫은 뒤라야 앞 화면)·ESC(줄 전체, 저장 안 한 글은 먼저 묻는다)·폭 끌기·가운데 창.
//   4) 머리줄 ⋮ = 4구역.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-shell.mjs
// 서버 자료는 쓰지 않는다(창 위치 같은 것은 이 창의 기기 저장소에만 - 새 창이라 끝나면 사라진다).
import { hashOf, launch, newPage, open, report, sel, waitFor } from './lib/probe.mjs';

const r = report();
const browser = await launch();
try {
  const { page, errors, dialogs } = await newPage(browser);
  const screenIs = async (scope) => waitFor(page.locator(sel('screen', scope)));
  const openWin = (id, params) => page.evaluate(([i, p]) => window.sp5.openWindow(i, p), [id, params]);
  const slots = () => page.locator('#side-column > [data-side-slot]').count();

  r.section('화면 탭·주소');
  await open(page, '#/day/2026-10-08');
  r.check(await screenIs('day'), '주소로 연 하루 화면');
  for (const scope of ['week', 'month', 'year', 'memo', 'class', 'day']) {
    await page.click(sel('scope-tab', scope));
    const shown = await screenIs(scope);
    r.check(shown && hashOf(page).startsWith(`#/${scope}`), `탭 → ${scope} (${hashOf(page)})`);
  }
  await page.click(sel('scope-tab', 'memo'));
  await screenIs('memo');
  r.check((await page.locator(sel('second-row')).count()) === 0, '메모 화면에는 둘째 줄이 없다');

  r.section('단축키');
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Shift+Digit3');
  r.check(await screenIs('month'), 'Shift+3 → 월간');
  await page.keyboard.press('Shift+ArrowRight');
  r.check(await screenIs('year'), 'Shift+→ → 년간');
  await page.keyboard.press('Shift+Digit1');
  await screenIs('day');
  const before = await page.locator(sel('date-label')).textContent();
  await page.keyboard.press('Control+ArrowRight');
  r.check(hashOf(page) === '#/day/2026-10-09', `Ctrl+→ 다음 날 (${before} → ${hashOf(page)})`);

  r.section('둘째 줄');
  await page.click(sel('date-prev'));
  r.check(hashOf(page) === '#/day/2026-10-08', '◀ 앞날');
  await page.click(sel('date-picker'));
  await page.click(sel('picker-day', '2026-10-20'));
  r.check(hashOf(page) === '#/day/2026-10-20', '📅 고르기 → 10/20');
  await page.click(sel('date-label'));
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  r.check(hashOf(page) === `#/day/${todayStr}`, '날짜를 누르면 오늘');
  await page.click(sel('view-toggle', 'showWeekend'));
  r.check((await page.locator(sel('view-toggle', 'showWeekend')).getAttribute('aria-pressed')) === 'false', '주말 토글 끔');
  await page.click(sel('view-toggle', 'showWeekend'));

  r.section('주소·새로고침·뒤로가기');
  await page.goto(page.url().split('#')[0] + '#/month/2026-12');
  r.check(await screenIs('month'), '주소를 바꾸면 그 화면 (#/month/2026-12)');
  await page.reload();
  r.check((await screenIs('month')) && hashOf(page) === '#/month/2026-12', '새로고침해도 그 자리');
  await page.click(sel('scope-tab', 'week'));
  await screenIs('week');
  await page.goBack();
  r.check((await screenIs('month')) && hashOf(page) === '#/month/2026-12', '뒤로가기 = 앞 화면');

  r.section('오른쪽 줄 - 시험 창 둘');
  await openWin('devPanel', { n: 1 });
  await page.locator(`${sel('test-panel', 1)} textarea`).fill('첫 칸 글');
  await openWin('devWindow');
  await waitFor(page.locator(sel('test-window')));
  r.check((await page.locator(sel('side-tab')).count()) === 2, '둘이면 위에 탭 둘');
  r.check(!(await page.locator(sel('test-panel', 1)).isVisible()) && (await page.locator(sel('test-window')).isVisible()), '새 창이 보이고 먼저 연 칸은 숨는다');
  await page.locator(sel('side-tab')).first().locator('button').first().click();
  r.check((await page.locator(`${sel('test-panel', 1)} textarea`).inputValue()) === '첫 칸 글', '숨었던 칸의 글이 그대로');

  await page.locator(`${sel('test-panel', 1)} textarea`).click();
  await page.keyboard.press('Control+s');
  r.check(
    (await page.locator(sel('test-panel', 1)).getAttribute('data-saved')) === '첫 칸 글' &&
      (await page.locator(sel('test-window')).getAttribute('data-saved')) === '',
    'Ctrl+S는 커서가 든 칸만',
  );
  await page.locator(sel('side-tab')).nth(1).locator('button').first().click();
  await page.locator(sel('test-input')).fill('창 글');
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+s');
  r.check((await page.locator(sel('test-window')).getAttribute('data-saved')) === '창 글', '커서가 없으면 Ctrl+S는 보이는 탭');

  const col = page.locator('#side-column');
  const w0 = (await col.boundingBox()).width;
  const grip = await page.locator(sel('column-resizer', 'right')).boundingBox();
  await page.mouse.move(grip.x + 4, 400);
  await page.mouse.down();
  await page.mouse.move(grip.x - 120, 400, { steps: 5 });
  await page.mouse.up();
  const w1 = (await col.boundingBox()).width;
  await page.locator(sel('column-resizer', 'right')).dblclick();
  const w2 = (await col.boundingBox()).width;
  r.check(w1 > w0 + 100 && Math.abs(w2 - w0) < 2, `폭 끌기 ${Math.round(w0)} → ${Math.round(w1)}, 두 번 누르면 ${Math.round(w2)}`);

  await page.locator(sel('side-tab')).nth(1).locator(sel('side-tab-close')).click();
  r.check((await waitFor(async () => (await slots()) === 1)) && (await page.locator(sel('test-panel', 1)).isVisible()), '탭 ×는 그 칸 하나만 닫는다');

  await openWin('devWindow');
  await waitFor(page.locator(sel('test-window')));
  await page.goBack();
  r.check((await waitFor(async () => (await slots()) === 1)) && hashOf(page) === '#/month/2026-12', '뒤로가기는 맨 위 창 하나만 (화면은 그대로)');

  // 첫 칸은 저장한 뒤 고쳐서 저장 안 한 글이 있다
  await page.locator(`${sel('test-panel', 1)} textarea`).fill('고친 글');
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  dialogs.answer = false;
  await page.keyboard.press('Escape');
  r.check(dialogs.seen.length === 1 && (await slots()) === 1, 'ESC: 저장 안 한 글이 있으면 먼저 묻는다 (아니오 → 그대로)');
  dialogs.answer = true;
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await slots()) === 0), 'ESC: 예 → 줄 전체를 닫는다');

  // 창을 연 채 화면을 바꾸면 뒤로가기는 창부터, 그다음 앞 화면
  await openWin('devWindow');
  await waitFor(page.locator(sel('test-window')));
  await page.click(sel('scope-tab', 'year'));
  await screenIs('year');
  await page.goBack();
  r.check((await waitFor(async () => (await slots()) === 0)) && (await screenIs('year')), '창을 연 채 화면을 바꾸면 뒤로가기는 창부터');
  await page.goBack();
  r.check(await screenIs('month'), '그다음 뒤로가기는 앞 화면');

  r.section('창 위치 - 가운데 창');
  await page.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('sp5-layout') || '{"state":{},"version":0}');
    v.state.popupStyle = 'center';
    localStorage.setItem('sp5-layout', JSON.stringify(v));
  });
  await page.reload();
  await screenIs('month');
  await openWin('devWindow');
  await openWin('devPanel', { n: 2 });
  await waitFor(page.locator(sel('test-panel', 2)));
  r.check(
    (await page.locator(sel('popup-frame', 'center')).count()) === 1 && (await page.locator(sel('panel-frame', 'side')).count()) === 1,
    '창은 가운데, 쓰는 칸은 그래도 오른쪽',
  );
  await page.keyboard.press('Escape');

  r.section('머리줄');
  await page.click(sel('more-menu'));
  const sections = await page.locator(sel('menu-section')).evaluateAll((els) => els.map((e) => e.dataset.menuSection).join(','));
  r.check(sections === '일정,수업,자료,설정', `⋮ 4구역 (${sections})`);
  await page.keyboard.press('Escape');

  r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' / ')}`);
} finally {
  await browser.close();
}
r.done();
