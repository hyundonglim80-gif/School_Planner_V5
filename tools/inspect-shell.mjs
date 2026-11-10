// tools/inspect-shell.mjs - P1-3 끝 조건을 크롬으로 본다 (앱 껍데기).
//   1) 빈 화면 일곱(P24-3 한눈에 포함)을 화면 탭·단축키·주소로 오간다. 새로고침해도 그 자리, 뒤로가기 = 앞 화면.
//   2) 둘째 줄: ◀▶·날짜(오늘로)·📅 고르기·토글, 메모·학급에는 없다.
//   3) 시험 창 둘(창·쓰는 칸)이 V4처럼: 탭(숨은 탭도 글이 남는다)·탭 ×·Ctrl+S(커서 든 칸, 없으면 보이는 탭)·
//      뒤로가기(맨 위 하나, 다 닫은 뒤라야 앞 화면)·ESC(줄 전체, 저장 안 한 글은 먼저 묻는다)·폭 끌기·
//      팝업창(11-09 - PC 창 위치: 누르면 브라우저 팝업창, 다시 누르면 그 팝업창, 팝업창의 화면 옮기기는 큰 창으로, 자리 기억)·
//      팝업창을 못 띄울 때의 가운데 창(방금 누르지 않음·막힘).
//   4) 머리줄 ⋮ = 4구역.
//   5) 고친 시간표 창: ✕·탭 ×·Alt+W·뒤로가기·가운데 창 배경도 묻는다, 아니오면 칸과 고친 것이 남고 뒤로가기가 화면을 떠나지 않는다(P22-2).
//   6) 자정 넘김: 오늘을 보던 화면은 새 오늘로, 열린 칸은 그대로·연 날짜로 저장, 다른 날을 보던 화면은 그대로(P22-4).
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-shell.mjs
// 창 위치는 계정 설정(settings/pc)을 따른다 - 처음에 '창 위치'가 적혀 있으면 걷고(다른 점검이 남긴 것에 흔들리지 않게),
// 끝에는 이 점검이 '가운데 창'을 시험하며 올린 것도 걷는다(P4-1 - 남겨 두면 다음 점검들이 가운데 창으로 열렸다).
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { emulator, hashOf, launch, newPage, open, report, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const pcRef = doc(em.db, 'spaces', `u_${uid}`, 'settings', 'pc');
/** pc 설정에서 창 위치를 걷는다 (다른 칸이 없으면 문서째) */
async function clearPopupStyle() {
  const snap = await getDoc(pcRef);
  if (!snap.exists() || snap.data().popupStyle === undefined) return;
  const rest = { ...snap.data() };
  delete rest.popupStyle;
  if (Object.keys(rest).every((k) => k === 'v' || k === 'updatedAt')) await deleteDoc(pcRef);
  else await setDoc(pcRef, rest);
}
await clearPopupStyle();
const browser = await launch();
try {
  const { page, errors, dialogs } = await newPage(browser);
  const screenIs = async (scope) => waitFor(page.locator(sel('screen', scope)));
  const openWin = (id, params) => page.evaluate(([i, p]) => window.sp5.openWindow(i, p), [id, params]);
  const slots = () => page.locator('#side-column > [data-side-slot]').count();

  r.section('화면 탭·주소');
  await open(page, '#/day/2026-10-08');
  r.check(await screenIs('day'), '주소로 연 하루 화면');
  for (const scope of ['week', 'month', 'year', 'board', 'memo', 'class', 'day']) {
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

  r.section('머리줄 접기 (메모 요청 #142)');
  // 손잡이 자리: 머리줄 높이 · 손잡이 위끝·가운데(머리줄 아래 테두리에서, 화면 가운데에서 얼마나 벗어났나) · 글자
  const foldLook = () =>
    page.evaluate(() => {
      const header = document.querySelector('header').getBoundingClientRect();
      const btn = document.querySelector('[data-header-fold]');
      const b = btn.getBoundingClientRect();
      return {
        headerH: Math.round(header.height),
        top: Math.round(b.top),
        offEdge: Math.round(Math.abs(b.top + b.height / 2 - header.bottom)),
        offCenter: Math.round(Math.abs(b.left + b.width / 2 - document.documentElement.clientWidth / 2)),
        text: btn.textContent,
        mainTop: Math.round(document.querySelector('main').getBoundingClientRect().top + window.scrollY),
        headerVar: document.documentElement.style.getPropertyValue('--app-header-h').trim(),
        saved: JSON.parse(localStorage.getItem('sp5-header-fold') ?? '{}').state?.folded,
      };
    });
  const foldDate = () => page.locator(sel('header-fold-date')).textContent();
  const opened = await foldLook();
  r.check((await page.locator(sel('header-fold', 'open')).count()) === 1 && opened.headerH > 60, `펴진 머리줄(${opened.headerH}px)에 접기 손잡이`);
  r.check(opened.text.includes('▲') && opened.offEdge <= 2 && opened.offCenter <= 2, `▲는 머리줄 아래 테두리 가운데 (테두리에서 ${opened.offEdge}px · 가운데에서 ${opened.offCenter}px)`);
  await page.click(sel('header-fold', 'open'));
  r.check(await waitFor(page.locator(sel('header-fold', 'folded'))), '▲ = 접는다');
  await waitFor(async () => (await foldLook()).headerVar === '0px');
  const folded = await foldLook();
  r.check(folded.headerH === 0 && folded.headerVar === '0px' && folded.mainTop === 0, `머리줄 높이 0 · 본문이 화면 맨 위부터 (머리줄 ${folded.headerH} · --app-header-h ${folded.headerVar} · 본문 위 ${folded.mainTop})`);
  r.check(folded.text.includes('▼') && folded.top === 0 && folded.offCenter <= 2, `▼는 화면 위 가운데 (위 ${folded.top}px · 가운데에서 ${folded.offCenter}px)`);
  r.check(!(await page.locator(sel('scope-tab', 'day')).isVisible()) && !(await page.locator(sel('date-label')).isVisible()), '첫 줄·둘째 줄은 보이지 않는다');
  const foldDay = await foldDate();
  r.check(!!foldDay && foldDay === (await page.locator(sel('date-label')).textContent()), `손잡이에 보는 날짜 (${foldDay})`);
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+ArrowRight');
  r.check(await waitFor(async () => (await foldDate()) !== foldDay), `접은 채 Ctrl+→ = 다음 날 - 손잡이 날짜가 바뀐다 (${foldDay} → ${await foldDate()})`);
  await page.keyboard.press('Control+ArrowLeft');
  await waitFor(async () => (await foldDate()) === foldDay);
  r.check(folded.saved === true, '접은 상태를 이 기기에 기억한다 (sp5-header-fold)');
  await page.click(sel('header-fold', 'folded'));
  r.check(await waitFor(page.locator(sel('header-fold', 'open'))), '▼ = 다시 편다');
  const reopened = await foldLook();
  r.check(reopened.headerH === opened.headerH && reopened.saved === false && (await page.locator(sel('scope-tab', 'day')).isVisible()), `머리줄이 그대로 돌아온다 (${reopened.headerH}px)`);

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
  r.check((await page.locator(sel('side-tab')).count()) === 2, `둘이면 위에 탭 둘 (${await page.locator(sel('side-tab')).count()})`);
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

  r.section('✕·탭 ×·Alt+W·뒤로가기도 묻는다 (P22-2)');
  const ttWin = sel('timetable-window');
  const ttCell = page.locator(`${ttWin} input[data-cell="0-1"]`);
  /** 시간표 창을 열어 고친다 (저장하지 않는다 - 끝에 닫으면 계정에 남는 것이 없다) */
  const dirtyTimetable = async () => {
    await openWin('timetable');
    await waitFor(page.locator(ttWin));
    await waitFor(ttCell);
    await ttCell.fill('점검 고친 칸');
    await waitFor(page.locator(sel('timetable-dirty')));
  };
  /** 물음 하나가 뜨고 시간표 창이 고친 그대로 남았나 */
  const asked = async (how) => {
    const ok = await waitFor(() => dialogs.seen.length === 1);
    r.check(ok && dialogs.seen[0].includes('저장하지 않고 닫을까요') && (await ttCell.inputValue()) === '점검 고친 칸', `${how}: 묻고, 아니오면 칸과 고친 것이 남는다`, `물음 ${dialogs.seen.join(' / ')}`);
    dialogs.seen.length = 0;
  };
  dialogs.seen.length = 0;
  dialogs.answer = false;
  await dirtyTimetable();
  await page.locator(`${sel('popup-frame', 'side')} ${sel('close')}`).click();
  await asked('✕');
  await ttCell.click();
  await page.keyboard.press('Alt+w');
  await asked('Alt+W');
  await openWin('devWindow');
  await waitFor(page.locator(sel('test-window')));
  await page.locator(sel('side-tab-close')).first().click();
  await waitFor(() => dialogs.seen.length === 1);
  r.check(dialogs.seen.length === 1 && (await slots()) === 2, '숨은 탭의 ×: 묻고, 아니오면 탭이 남는다');
  dialogs.seen.length = 0;
  await page.locator(sel('side-tab-close')).nth(1).click();
  await waitFor(async () => (await slots()) === 1);
  r.check(dialogs.seen.length === 0, '고친 것이 없는 탭 ×는 묻지 않는다');
  const hashBefore = hashOf(page);
  await page.goBack();
  await asked('뒤로가기');
  await page.goBack();
  await asked('다시 뒤로가기');
  r.check(hashOf(page) === hashBefore && (await slots()) === 1, '뒤로가기: 아니오면 화면을 떠나지 않는다');
  dialogs.answer = true;
  await page.locator(sel('close')).first().click();
  r.check(await waitFor(async () => (await slots()) === 0), '예 → 닫는다');
  await waitFor(() => dialogs.seen.length === 1);
  dialogs.seen.length = 0;
  dialogs.answer = false;

  // 창을 연 채 화면을 바꾸면 뒤로가기는 창부터, 그다음 앞 화면
  await openWin('devWindow');
  await waitFor(page.locator(sel('test-window')));
  await page.click(sel('scope-tab', 'year'));
  await screenIs('year');
  await page.goBack();
  r.check((await waitFor(async () => (await slots()) === 0)) && (await screenIs('year')), '창을 연 채 화면을 바꾸면 뒤로가기는 창부터');
  await page.goBack();
  r.check(await screenIs('month'), '그다음 뒤로가기는 앞 화면');

  r.section('창 위치 - 팝업창 (11-09)');
  // 창 위치는 계정 설정(PC) - 기기 저장소만 바꾸면 다시 열 때 계정 값이 이긴다(P1-4 설정 맞추기)
  const pcNow = (await getDoc(pcRef)).data() ?? {};
  await setDoc(pcRef, { ...pcNow, popupStyle: 'popup', v: 1 });
  await page.reload();
  await screenIs('month');
  {
    const ctx = page.context();
    await page.goto(page.url().replace(/#.*$/, '#/day/2026-10-08'));
    await screenIs('day');
    const ttBtn = page.locator(sel('lessons-settings'));
    await waitFor(ttBtn);
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }), ttBtn.click()]);
    await pop.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
    r.check(new URL(pop.url()).searchParams.get('popout')?.includes('"timetable"'), '누르면 브라우저 팝업창 (시간표)', pop.url());
    r.check(await waitFor(pop.locator(`${sel('popup-frame', 'window')} ${ttWin}`), 10000), '팝업창 안은 그 창 가득');
    r.check((await page.locator('[data-popup-card]').count()) === 0 && (await slots()) === 0, '큰 창에는 창도 오른쪽 칸도 없다');
    const pagesBefore = ctx.pages().length;
    await ttBtn.click();
    await page.waitForTimeout(800);
    r.check(ctx.pages().length === pagesBefore && !pop.isClosed(), '다시 누르면 새로 띄우지 않고 그 팝업창', `창 ${ctx.pages().length}개`);
    // 팝업창에서 화면을 옮기면 큰 창이 옮긴다
    await pop.evaluate(async () => (await import(window.__appModule('/src/app/nav.ts'))).setDate('2026-10-20'));
    r.check(await waitFor(async () => (await hashOf(page)) === '#/day/2026-10-20', 5000), '팝업창의 화면 옮기기 = 큰 창이 옮긴다', await hashOf(page));
    // 자리·크기는 창마다 기억한다
    await pop.waitForTimeout(1800);
    const rects = await page.evaluate(() => JSON.parse(localStorage.getItem('sp5-popup-rects') || '{}'));
    r.check(rects.timetable?.w > 200 && rects.timetable?.h > 200, '팝업창 자리·크기를 남긴다', JSON.stringify(rects.timetable));
    await pop.close();
    await page.evaluate(() => localStorage.removeItem('sp5-popup-rects'));
  }

  r.section('창 위치 - 팝업창을 못 띄우면 가운데 창');
  // 점검이 부른 열기(evaluate)는 '방금 누르지 않음'이면 이 창 안 가운데 - 바로 앞 누르기가 몇 초 '방금'으로 남아 새로 연다.
  // 그리고 브라우저가 팝업창을 막은 때(window.open = null)도 가운데 - 그 안내는 아래 Enter에서 본다
  await page.goto(page.url().replace(/#.*$/, '#/month/2026-10'));
  await page.reload();
  await screenIs('month');
  await page.evaluate(() => {
    window.open = () => null;
  });
  await openWin('devWindow');
  await openWin('devPanel', { n: 2 });
  await waitFor(page.locator(sel('test-panel', 2)));
  r.check(
    (await page.locator(sel('popup-frame', 'center')).count()) === 1 && (await page.locator(sel('panel-frame', 'side')).count()) === 1,
    '창은 가운데, 쓰는 칸은 그래도 오른쪽',
  );
  await page.keyboard.press('Escape');
  await waitFor(async () => (await page.locator(sel('popup-frame', 'center')).count()) === 0);

  // 가운데 창 배경 누르기는 층을 모두 닫는다 - 고친 창은 먼저 묻는다 (P22-2)
  dialogs.seen.length = 0;
  dialogs.answer = false;
  await dirtyTimetable();
  await page.mouse.click(5, 300);
  await asked('가운데 창 배경');
  await page.keyboard.press('Escape');
  r.check(await waitFor(() => dialogs.seen.length === 1), '배경에서 아니오 뒤에도 층이 남아 ESC가 묻는다');
  dialogs.seen.length = 0;
  dialogs.answer = true;
  await page.keyboard.press('Escape');
  await waitFor(async () => (await page.locator(sel('popup-frame', 'center')).count()) === 0);
  r.check(dialogs.seen.length === 1, 'ESC: 예 → 한 번만 묻고 닫는다', `물음 ${dialogs.seen.length}번`);
  dialogs.seen.length = 0;

  // 초점 (P22-7): 가운데 창을 열면 안으로, Tab은 창 안에서 돌고, 닫으면 연 단추(하루 수업 ⚙️)로 돌아온다
  // 브라우저가 팝업창을 막은 때 - 가운데 창으로 (11-09, window.open은 위에서 막았다)
  await page.goto(page.url().replace(/#.*$/, '#/day/2026-10-08'));
  await screenIs('day');
  await page.locator(sel('lessons-settings')).focus();
  await page.keyboard.press('Enter');
  const centerCard = page.locator(`${sel('popup-frame', 'center')} [data-popup-card]`);
  r.check(await waitFor(centerCard, 8000), 'Enter로 연 시간표 창 = 가운데 (팝업창이 막혔을 때)');
  r.check(await waitFor(page.locator('#sp5-toast-container', { hasText: '팝업창을 막아' })), '막혔다고 알린다');
  const inCard = () => page.evaluate(() => !!document.activeElement?.closest('[data-popup-frame="center"]'));
  r.check((await centerCard.getAttribute('aria-modal')) === 'true' && (await inCard()), '열면 초점이 창 안 · aria-modal');
  let stayed = true;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    if (!(await inCard())) stayed = false;
  }
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Shift+Tab');
    if (!(await inCard())) stayed = false;
  }
  r.check(stayed, 'Tab·Shift+Tab 45번 - 초점이 창 밖(뒤 화면)으로 나가지 않는다');
  await page.keyboard.press('Escape');
  await waitFor(async () => (await page.locator(sel('popup-frame', 'center')).count()) === 0);
  r.check(await page.evaluate(() => document.activeElement?.hasAttribute('data-lessons-settings')), '닫으면 연 단추(⚙️)로 돌아온다');

  // 팝업창이면 뒤 묶음(자정 넘김·새 계정)의 쓰는 칸도 팝업창으로 뜬다 - 여기서 걷는다
  await clearPopupStyle();

  r.section('머리줄');
  await page.click(sel('more-menu'));
  const sections = await page.locator(sel('menu-section')).evaluateAll((els) => els.map((e) => e.dataset.menuSection).join(','));
  r.check(sections === '일정,수업,자료,설정', `⋮ 4구역 (${sections})`);
  await page.keyboard.press('Escape');

  r.section('자정 넘김 (P22-4)');
  const night = await newPage(browser);
  const p = night.page;
  const passTime = async (iso) => {
    await p.clock.setFixedTime(new Date(iso));
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  };
  await p.clock.setFixedTime(new Date('2026-11-06T23:59:50'));
  await open(p, '#/day/2026-11-06');
  await p.locator(sel('journal-add')).click();
  const box = p.locator(sel('note-text-input'));
  await waitFor(box);
  await box.fill('자정 점검 글');
  await passTime('2026-11-07T00:00:05');
  r.check(await waitFor(async () => (await hashOf(p)) === '#/day/2026-11-07', 5000), '오늘을 보던 화면 = 새 오늘로', await hashOf(p));
  r.check((await box.inputValue()) === '자정 점검 글', '열린 칸은 쓰던 글째 그대로');
  await p.locator(sel('note-save')).click();
  const items = collection(em.db, 'spaces', `u_${uid}`, 'items');
  const savedNote = await serverUntil(async () => (await getDocs(items)).docs.find((d) => d.data().text === '자정 점검 글'), (d) => !!d);
  r.check(savedNote?.data().date === '2026-11-06', '칸은 연 날짜로 저장한다', savedNote?.data().date);
  if (savedNote) await deleteDoc(savedNote.ref);
  await p.evaluate(() => { location.hash = '#/day/2026-10-08'; });
  await waitFor(async () => (await hashOf(p)) === '#/day/2026-10-08', 5000);
  await passTime('2026-11-08T00:00:05');
  await p.waitForTimeout(300);
  r.check((await hashOf(p)) === '#/day/2026-10-08', '다른 날을 보던 화면은 그대로', await hashOf(p));
  await night.ctx.close();

  r.section('처음 쓰는 사람 - 띠만 보고 시간표·학급까지 (P22-7)');
  // 그때 만든 새 계정(?as=new-…) - V4 자료·설정·자료가 하나도 없다
  const who = `new-p227-${Date.now().toString(36)}`;
  const made = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${who}@example.com`, password: 'test1234', returnSecureToken: true }),
  });
  r.check(made.ok, '새 계정을 만든다', made.status);
  const fresh = await newPage(browser);
  const fp = fresh.page;
  await open(fp, `#/day/${new Date().toISOString().slice(0, 10)}`, { as: who });
  const teach = fp.locator(sel('teacher-mode-banner'));
  const steps = fp.locator(sel('first-steps-banner'));
  r.check(await waitFor(teach, 10000), '처음 = 교사 유형 띠');
  r.check((await steps.count()) === 0 && (await fp.locator(sel('auto-backup-banner')).count()) === 0, '교사 유형을 고르기 전에는 다음 띠·백업 띠가 없다');
  await fp.locator(sel('banner-preset', 'homeroom')).click();
  r.check(await waitFor(steps, 8000), "고르면 '다음: ⏰ 시간표 → 🏫 학급' 띠");
  r.check((await steps.textContent()).includes('시간표') && (await fp.locator(sel('first-step', 'timetable')).getAttribute('data-done')) === 'false', '띠에 글자가 있고 시간표가 아직');
  await fp.locator(sel('first-step', 'timetable')).click();
  r.check(await waitFor(fp.locator(ttWin), 8000), '⏰ 시간표 넣기 = 시간표 창');
  await fp.locator(`${ttWin} input[data-cell="0-1"]`).fill('국어');
  await fp.locator(sel('timetable-save')).click();
  r.check(
    await waitFor(async () => (await fp.locator(sel('first-step', 'timetable')).getAttribute('data-done').catch(() => '')) === 'true', 10000),
    '시간표를 저장하면 ✓',
  );
  await fp.keyboard.press('Escape');
  await fp.locator(sel('first-step', 'class')).click();
  r.check(await waitFor(fp.locator(sel('class-empty')), 8000), '🏫 학급 만들기 = 학급 화면 (명렬표 만들기 안내)');
  await fp.locator(sel('class-make-roster')).click();
  if ((await fp.locator(sel('roster-edit')).getAttribute('aria-pressed')) !== 'true') await fp.locator(sel('roster-edit')).click();
  await fp.locator(sel('roster-meta', 'grade')).fill('5');
  await fp.locator(sel('roster-meta', 'num')).fill('2');
  await fp.locator(sel('roster-add-count')).fill('1');
  await fp.locator(sel('roster-add-students')).click();
  await fp.locator(sel('roster-row', 0)).locator('[data-student-field="name"]').fill('김하늘');
  await fp.locator(sel('roster-save')).click();
  await waitFor(async () => !(await fp.locator(sel('roster-dirty')).count()), 10000);
  await fp.locator(sel('scope-tab', 'day')).click();
  await waitFor(fp.locator(sel('screen', 'day')), 5000);
  await fp.waitForTimeout(1000);
  r.check((await steps.count()) === 0 && (await teach.count()) === 0, '시간표·학급을 만들면 띠가 사라진다');
  await fresh.ctx.close();

  r.check(errors.length === 0 && night.errors.length === 0 && fresh.errors.length === 0, '화면 오류 없음', `화면 오류: ${[...errors, ...night.errors, ...fresh.errors].join(' / ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await clearPopupStyle();
}
r.done();
process.exit();
