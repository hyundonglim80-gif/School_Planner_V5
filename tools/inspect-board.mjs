// tools/inspect-board.mjs - P24-1 ■4·P24-2 ■4: 한눈에 화면(숨긴 채 - 주소 #/board/날짜로만)을 실제 크롬 1400px에서 본다.
//   1) 주소로 열기 · 둘째 줄 = 주 이름 · 오른쪽 = 고른 날 이름 + 수업|일정 / 메모(글자가 있는지) · 창 높이에 맞음 · 머리줄 탭에는 아직 없다
//   1b) 왼쪽(P24-2): [달력][월][화][수] / [목][금][토][일] 두 줄이 반씩 · 요일 칸 누르기 = 그날 고르기 · 작은 달력(월요일부터·보는 주·점) 날짜 누르기 ·
//       달력 ◀▶ = 달만 · 그 달 '달력' 일정 목록(날짜 차례·기간 m/d~m/d·줄 누르기 = 그날 + 그 일정 칸·칩 = 완료) · 빈 달 · 주말 감추기 = [달력][월][화] / [수][목][금]
//   2) 경계선 셋 끌기(왼쪽|오른쪽 · 수업|일정 · 위/메모) → 크기가 바뀌고 이 기기에 남는다 · 다시 열어도 그대로 · 두 번 누르면 기본
//   3) 수정 칸을 열면 비율 그대로 접힌다(수업/일정 위아래) · ◀▶ 한 주
//   4) '스크롤로 페이지 이동'을 켜도 칸 안 휠은 날짜를 넘기지 않는다
//   5) 좁은 폭(본문 780 밑)은 두 무리를 쌓는다
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-board.mjs
// 에뮬레이터 teacher 계정 개인 공간에 점검 일정·메모(insp_bd…)를 심고 끝에 지운다. 칸 비율은 기기 저장소(sp5-board)라 새 창마다 비어 있다.
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, hashOf, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const DAY = '2026-10-08'; // 목
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid, labelIds: [] };
const ITEMS = {
  insp_bd_event: { kind: 'event', date: DAY, text: '점검한눈 일정', order: 'Zz1', carrying: true },
  insp_bd_note: { kind: 'note', date: DAY, text: '점검한눈 메모', order: 'Zz2' },
  // 다음 주 기간 - 달력 목록 차례·'m/d~m/d' (라벨이 없으면 '달력' 켬)
  insp_bd_period: { kind: 'event', date: '2026-10-12', endDate: '2026-10-14', text: '점검한눈 기간', order: 'Zz3' },
};

/** 칸 자리 [x, y, 폭, 높이] */
const box = (page, s) =>
  page.evaluate((q) => {
    const e = document.querySelector(q);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)];
  }, s);
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('sp5-board') || '{}').state ?? {});
const near = (a, b, d = 4) => Math.abs(a - b) <= d;

/** 경계선을 dx·dy만큼 끈다 (가운데를 잡고 여러 걸음 - 손으로 끄는 것처럼) */
async function drag(page, name, dx, dy) {
  const h = await page.locator(sel('split-handle', name)).boundingBox();
  const x = h.x + h.width / 2;
  const y = h.y + h.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

try {
  for (const [id, data] of Object.entries(ITEMS)) {
    await setDoc(itemRef(id), { ...stamp, ...data });
    undo.add(() => deleteDoc(itemRef(id)));
  }
  const { page, errors } = await newPage(browser);
  await open(page, `#/board/${DAY}`);
  const screen = page.locator(sel('screen', 'board'));

  r.section('주소로 열기 · 칸 자리 · 글자');
  r.check(await waitFor(screen, 10000), '#/board/날짜로 한눈에 화면이 뜬다');
  r.check((await screen.getAttribute('data-board-date')) === DAY, `고른 날 = 주소의 날 (${await screen.getAttribute('data-board-date')})`);
  const label = await page.locator(sel('date-label')).textContent();
  r.check(label === '2026년 10월 2주', `둘째 줄 = 주 이름 (${label})`);
  const title = await page.locator(sel('board-day-title')).textContent();
  r.check(title?.startsWith('10월 8일 (목)'), `오른쪽 위 = 고른 날 이름 (${title})`);
  r.check((await page.locator(sel('scope-tab', 'board')).count()) === 0, '머리줄 화면 탭에는 아직 없다 (P24-3까지 숨김)');
  // 오른쪽 세 칸에 글자 (크기만 재면 빈 칸도 통과한다 - CLAUDE.md 2장)
  const eventCard = page.locator(`${sel('board-pane', 'events')} ${sel('event-card', 'insp_bd_event')}`);
  const noteCard = page.locator(`${sel('board-pane', 'memo')} ${sel('entry-card', 'insp_bd_note')}`);
  r.check(await waitFor(eventCard, 8000), '일정 칸에 심은 일정 카드');
  r.check(((await eventCard.textContent()) ?? '').includes('점검한눈 일정'), '일정 카드에 글자');
  r.check(await waitFor(noteCard, 8000), '메모 칸에 심은 메모 카드');
  r.check(((await noteCard.textContent()) ?? '').includes('점검한눈 메모'), '메모 카드에 글자');
  r.check(((await page.locator(sel('board-pane', 'lessons')).textContent()) ?? '').includes('수업'), '수업 칸에 수업 머리');
  const [left, lessons, events, memo] = await Promise.all(['[data-board-left]', sel('board-pane', 'lessons'), sel('board-pane', 'events'), sel('board-pane', 'memo')].map((q) => box(page, q)));
  r.check(left && lessons && left[0] + left[2] < lessons[0], `왼쪽 무리 | 오른쪽 무리 (왼 ${left} · 수업 ${lessons})`);
  r.check(lessons && events && lessons[0] + lessons[2] < events[0] && near(lessons[1], events[1]), `수업 | 일정 나란히 (${lessons} | ${events})`);
  r.check(memo && memo[1] > lessons[1] + lessons[3] && near(memo[0], lessons[0]), `메모는 그 아래 (${memo})`);
  const fit = await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight]);
  r.check(fit[0] <= fit[1] + 1, `창 높이에 맞음 - 화면이 스크롤하지 않는다 (${fit})`);
  // 기본 비율: 왼쪽 58%
  const board = await box(page, sel('split', 'board-main'));
  r.check(near(left[2] / board[2], 0.58, 0.02), `기본 왼쪽 몫 58% (${Math.round((left[2] / board[2]) * 100)}%)`);

  r.section("왼쪽 - 요일 칸 일곱 · 작은 달력 · 달력 일정 목록 (P24-2)");
  const L = '[data-board-left]';
  const cards = page.locator(`${L} ${sel('week-day')}`);
  r.check(await waitFor(async () => (await cards.count()) === 7), `요일 칸 일곱 (${await cards.count()})`);
  const dayLabels = (await page.locator(`${L} ${sel('week-day-label')}`).allTextContents()).join(' ');
  r.check(dayLabels === '10.5 10.6 10.7 10.8 10.9 10.10 10.11', `요일 칸 글자 = 월~일 (${dayLabels})`);
  const [cal, mon, thu, sun] = await Promise.all([sel('board-month'), sel('week-day', '2026-10-05'), sel('week-day', '2026-10-08'), sel('week-day', '2026-10-11')].map((q) => box(page, `${L} ${q}`)));
  r.check(cal && mon && cal[0] + cal[2] < mon[0] && near(cal[1], mon[1]), `첫 칸 = 달력, 그 오른쪽 월 (${cal} | ${mon})`);
  r.check(thu && near(thu[0], cal[0]) && thu[1] >= cal[1] + cal[3], `목은 둘째 줄 첫 칸 (${thu})`);
  r.check(sun && near(sun[1], thu[1]) && sun[0] > thu[0], `일은 둘째 줄 끝 (${sun})`);
  r.check(near(thu[3], cal[3], 3) && near(mon[3], cal[3], 3), `두 줄이 반씩 - 같은 높이 (${cal[3]} · ${mon[3]} · ${thu[3]})`);
  const selectedCard = () => page.locator(`${L} [data-board-day-selected]`).getAttribute('data-week-day');
  r.check((await selectedCard()) === DAY, `고른 칸 = 고른 날 (${await selectedCard()})`);
  // 작은 달력 - 월요일부터 · 보는 주 한 줄 · 고른 날 · 점 · 글자
  const calDay = (d) => page.locator(sel('board-cal-day', d));
  const firstCal = await page.locator(sel('board-cal-day')).first().getAttribute('data-board-cal-day');
  r.check(firstCal === '2026-09-28', `달력은 월요일부터 (첫 칸 ${firstCal})`);
  r.check((await page.locator(sel('board-cal-week')).getAttribute('data-board-cal-week')) === '2026-10-05', '보는 주 한 줄을 칠한다');
  r.check((await calDay(DAY).textContent()) === '8' && (await calDay(DAY).getAttribute('aria-current')) === 'date', '고른 날 칸 - 글자 8·칠함');
  r.check(Number(await calDay(DAY).getAttribute('data-board-cal-count')) >= 1, `달력 일정이 있는 날 = 점 (${await calDay(DAY).getAttribute('data-board-cal-count')})`);
  r.check(((await page.locator(sel('board-cal-title')).textContent()) ?? '') === '2026년 10월', '달력 머리 = 그 달');
  // 목록 - 날짜 차례 · 글자 · 기간 m/d~m/d
  const item = (id) => page.locator(sel('board-month-item', id));
  r.check(await waitFor(item('insp_bd_period'), 8000), '목록에 심은 기간 일정');
  r.check(((await item('insp_bd_event').textContent()) ?? '').includes('10/8') && ((await item('insp_bd_event').textContent()) ?? '').includes('점검한눈 일정'), `목록 줄 = m/d + 글 (${await item('insp_bd_event').textContent()})`);
  r.check(((await item('insp_bd_period').textContent()) ?? '').includes('10/12~10/14'), `기간 = m/d~m/d (${await item('insp_bd_period').textContent()})`);
  const order = await page.locator(sel('board-month-item')).evaluateAll((es) => es.map((e) => e.getAttribute('data-board-month-item')));
  r.check(order.indexOf('insp_bd_event') >= 0 && order.indexOf('insp_bd_event') < order.indexOf('insp_bd_period'), '날짜 차례 (10/8 → 10/12)');

  // 요일 칸 누르기 = 그날 고르기 (하루 화면으로 가지 않는다)
  await page.locator(`${sel('week-day', '2026-10-06')} ${sel('week-day-label')}`).click();
  r.check(await waitFor(async () => hashOf(page) === '#/board/2026-10-06'), `요일 칸 누르기 = 그날 고르기 (${hashOf(page)})`);
  r.check(((await page.locator(sel('board-day-title')).textContent()) ?? '').startsWith('10월 6일 (화)'), '오른쪽이 그날');
  r.check((await selectedCard()) === '2026-10-06' && (await calDay('2026-10-06').getAttribute('aria-current')) === 'date', '고른 칸·달력이 따라온다');
  // 달력 날짜 = 그날 (다른 주면 요일 칸도 그 주)
  await calDay('2026-10-21').click();
  r.check(await waitFor(async () => hashOf(page) === '#/board/2026-10-21'), `달력 날짜 누르기 = 그날 (${hashOf(page)})`);
  r.check(await waitFor(page.locator(`${L} ${sel('week-day', '2026-10-19')}`)), '요일 칸이 그 주 (10/19~)');
  r.check((await page.locator(sel('board-cal-week')).getAttribute('data-board-cal-week')) === '2026-10-19', '달력 칠한 주도 그 주');
  r.check(((await page.locator(sel('date-label')).textContent()) ?? '').includes('10월 4주'), `둘째 줄 주 이름 (${await page.locator(sel('date-label')).textContent()})`);
  // 달력 ◀▶ = 달만 넘겨 보기 (고른 날은 그대로)
  await page.locator(sel('board-cal-next')).click();
  r.check(await waitFor(page.locator(sel('board-month', '2026-11'))), '달력 ▶ = 다음 달');
  r.check(hashOf(page) === '#/board/2026-10-21' && (await calDay('2026-11-30').count()) === 1, '고른 날은 그대로');
  r.check(((await page.locator(sel('board-cal-title')).textContent()) ?? '') === '2026년 11월', '달력 머리 = 넘겨 본 달');
  // 고른 날이 바뀌면(둘째 줄 ◀ = 한 주) 그 달로 돌아온다
  await page.locator(sel('date-prev')).click();
  r.check(await waitFor(async () => hashOf(page) === '#/board/2026-10-14'), `◀ = 한 주 (${hashOf(page)})`);
  r.check(await waitFor(page.locator(sel('board-month', '2026-10'))), '고른 날이 바뀌면 달력이 그 달로');
  // 목록 줄 누르기 = 그날 + 그 일정 칸
  await page.locator(`${sel('board-month-item', 'insp_bd_event')} ${sel('board-month-item-text')}`).click();
  r.check(await waitFor(async () => hashOf(page) === `#/board/${DAY}`), `목록 줄 = 그날 고르기 (${hashOf(page)})`);
  const evPanel = page.locator(`#side-column ${sel('event-panel', 'edit')}`);
  r.check(await waitFor(evPanel, 5000), '목록 줄 = 그 일정 칸');
  r.check((await evPanel.getAttribute('data-event-id')) === 'insp_bd_event', `그 일정 (${await evPanel.getAttribute('data-event-id')})`);
  await page.keyboard.press('Escape');
  await waitFor(async () => (await page.locator('#side-column').count()) === 0, 5000);
  // 칩 = 완료 (서버) · 다시 = 풀기
  await page.locator(sel('board-month-item-chip', 'insp_bd_event')).click();
  const doneOf = async () => (await getDoc(itemRef('insp_bd_event'))).data()?.done;
  r.check((await serverUntil(doneOf, (v) => v === true)) === true, '목록 칩 = 완료 (서버)');
  r.check(await waitFor(async () => (await item('insp_bd_event').getAttribute('data-board-month-item-done')) === '1'), '목록 줄 = 끝낸 표시 ✓');
  await page.locator(sel('board-month-item-chip', 'insp_bd_event')).click();
  r.check((await serverUntil(doneOf, (v) => !v)) !== true, '다시 누르면 풀기');
  // 빈 달
  await page.goto(page.url().replace(/#.*$/, '#/board/2031-01-15'));
  r.check(await waitFor(page.locator(sel('board-month-empty')), 5000), '달력 일정이 없는 달');
  r.check(((await page.locator(sel('board-month-empty')).textContent()) ?? '').includes('1월 달력 일정이 없습니다'), `빈 달 안내 글자 (${await page.locator(sel('board-month-empty')).textContent()})`);
  await page.goto(page.url().replace(/#.*$/, `#/board/${DAY}`));
  await waitFor(async () => (await selectedCard()) === DAY, 5000);
  // 주말 감추기 = [달력][월][화] / [수][목][금]
  await page.locator(sel('view-toggle', 'showWeekend')).click();
  try {
    r.check(await waitFor(async () => (await cards.count()) === 5), `주말을 감추면 요일 칸 다섯 (${await cards.count()})`);
    const [cal5, tue5, wed5] = await Promise.all([sel('board-month'), sel('week-day', '2026-10-06'), sel('week-day', '2026-10-07')].map((q) => box(page, `${L} ${q}`)));
    r.check(near(tue5[1], cal5[1]) && tue5[0] > cal5[0], `화는 첫 줄 끝 (${tue5})`);
    r.check(near(wed5[0], cal5[0]) && wed5[1] >= cal5[1] + cal5[3], `수는 둘째 줄 첫 칸 (${wed5})`);
  } finally {
    await page.locator(sel('view-toggle', 'showWeekend')).click();
    await page.waitForTimeout(2500); // 계정 설정은 1초 뒤 올라간다
  }
  r.check(await waitFor(async () => (await cards.count()) === 7), '주말을 다시 켜면 일곱');

  r.section('경계선 셋 끌기 → 이 기기에 남는다');
  await drag(page, 'board-main', -150, 0);
  const left2 = await box(page, '[data-board-left]');
  r.check(near(left2[2], left[2] - 150, 6), `왼쪽|오른쪽 - 왼쪽이 150px 좁아졌다 (${left[2]} → ${left2[2]})`);
  await drag(page, 'board-day', 60, 0);
  const [lessons2, events2] = await Promise.all([box(page, sel('board-pane', 'lessons')), box(page, sel('board-pane', 'events'))]);
  r.check(lessons2[2] > lessons[2] && lessons2[2] / (lessons2[2] + events2[2]) > lessons[2] / (lessons[2] + events[2]), `수업|일정 - 수업 몫이 늘었다 (${lessons[2]}:${events[2]} → ${lessons2[2]}:${events2[2]})`);
  await drag(page, 'board-memo', 0, -80);
  const memo2 = await box(page, sel('board-pane', 'memo'));
  r.check(near(memo2[3], memo[3] + 80, 6), `위/메모 - 메모가 80px 높아졌다 (${memo[3]} → ${memo2[3]})`);
  const saved = await stored(page);
  r.check(typeof saved.main === 'number' && typeof saved.day === 'number' && typeof saved.memo === 'number', `비율 셋이 이 기기에 (${JSON.stringify(saved)})`);

  await page.reload();
  await page.locator(sel('board-pane', 'memo')).waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  const [left3, memo3] = await Promise.all([box(page, '[data-board-left]'), box(page, sel('board-pane', 'memo'))]);
  r.check(near(left3[2], left2[2], 3) && near(memo3[3], memo2[3], 3), `다시 열어도 그대로 (왼 ${left3[2]} · 메모 높이 ${memo3[3]})`);

  await page.locator(sel('split-handle', 'board-main')).dblclick();
  const left4 = await box(page, '[data-board-left]');
  r.check(near(left4[2], left[2], 3) && (await stored(page)).main === null, `두 번 누르면 기본으로 (${left4[2]} - 처음 ${left[2]})`);
  // 키: 경계선에 초점 두고 → 2%
  await page.locator(sel('split-handle', 'board-main')).focus();
  await page.keyboard.press('ArrowRight');
  r.check(near((await stored(page)).main ?? 0, 60, 0.6), `경계선에서 → = 2% 넓게 (${(await stored(page)).main})`);
  r.check(hashOf(page) === `#/board/${DAY}`, '키로 바꿔도 화면·날짜 그대로');
  await page.locator(sel('split-handle', 'board-main')).dblclick();

  r.section('수정 칸을 열면 비율 그대로 접힌다 · ◀▶ 한 주');
  await page.locator(`${sel('board-pane', 'events')} ${sel('event-add')}`).click();
  const panel = page.locator('#side-column');
  r.check(await waitFor(panel, 5000), '오른쪽 수정 칸이 열렸다');
  await page.waitForTimeout(600);
  const [leftP, boardP, lessonsP, eventsP] = await Promise.all(['[data-board-left]', sel('split', 'board-main'), sel('board-pane', 'lessons'), sel('board-pane', 'events')].map((q) => box(page, q)));
  r.check(boardP[2] < board[2] - 300, `본문이 줄었다 (${board[2]} → ${boardP[2]})`);
  r.check(near(leftP[2] / boardP[2], 0.58, 0.03), `왼쪽 몫은 그대로 58% (${Math.round((leftP[2] / boardP[2]) * 100)}%)`);
  r.check(eventsP[1] > lessonsP[1] + lessonsP[3] - 2, `좁은 오른쪽 무리 - 수업/일정 위아래 (${lessonsP} / ${eventsP})`);
  r.check(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), '수정 칸이 열려도 창 높이에 맞음');
  await page.keyboard.press('Escape');
  await waitFor(async () => (await panel.count()) === 0, 5000);
  await page.locator(sel('date-next')).click();
  r.check(await waitFor(async () => hashOf(page) === '#/board/2026-10-15'), `▶ = 한 주 뒤 같은 요일 (${hashOf(page)})`);
  await page.locator(sel('date-prev')).click();
  r.check(await waitFor(async () => hashOf(page) === `#/board/${DAY}`), `◀ = 돌아온다 (${hashOf(page)})`);

  r.section("'스크롤로 페이지 이동'을 켜도 칸 안 휠은 날짜를 넘기지 않는다");
  // 계정(기기 설정 문서)에 올라가는 설정 - 끝에 끄고 기다린다
  const nav = (on) => page.evaluate(async (v) => (await import(window.__appModule('/src/app/nav.ts'))).setEnableScrollNav(v), on);
  await nav(true);
  try {
    await page.waitForTimeout(300);
    for (const pane of ['left', 'lessons', 'memo']) {
      const b = await box(page, sel('board-pane', pane));
      await page.mouse.move(b[0] + b[2] / 2, b[1] + b[3] / 2);
      for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
      await page.waitForTimeout(400);
      for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -400);
      await page.waitForTimeout(900);
      r.check(hashOf(page) === `#/board/${DAY}`, `${pane} 칸 안 휠 - 날짜 그대로 (${hashOf(page)})`);
    }
    // 비교: 칸 밖(고른 날 이름 줄)에서 굴리면 넘어간다 - 설정이 정말 켜졌나
    const t = await box(page, sel('board-day-title'));
    await page.mouse.move(t[0] + 5, t[1] + t[3] / 2);
    await page.mouse.wheel(0, 300);
    r.check(await waitFor(async () => hashOf(page) !== `#/board/${DAY}`, 3000), `칸 밖에서 굴리면 한 주 넘어간다 (${hashOf(page)})`);
  } finally {
    await nav(false);
    await page.waitForTimeout(3000);
  }

  r.section('좁은 폭은 두 무리를 쌓는다');
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto(page.url().replace(/#.*$/, `#/board/${DAY}`));
  r.check(await waitFor(page.locator(`${sel('screen', 'board')}[data-board-stacked]`), 5000), '본문 780 밑 - 쌓기');
  const [leftS, dayS] = await Promise.all([box(page, '[data-board-left]'), box(page, sel('board-day-group'))]);
  r.check(leftS && dayS && dayS[1] >= leftS[1] + leftS[3], `오른쪽 무리가 왼쪽 무리 아래 (${leftS} / ${dayS})`);
  r.check((await page.locator(sel('split-handle')).count()) === 0, '쌓으면 경계선이 없다');
  r.check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '가로로 넘치지 않는다');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
