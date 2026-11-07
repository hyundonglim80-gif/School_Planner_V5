// tools/inspect-board.mjs - P24-1 ■4: 한눈에 화면 틀(숨긴 채 - 주소 #/board/날짜로만)을 실제 크롬 1400px에서 본다.
//   1) 주소로 열기 · 둘째 줄 = 주 이름 · 오른쪽 = 고른 날 이름 + 수업|일정 / 메모(글자가 있는지) · 창 높이에 맞음 · 머리줄 탭에는 아직 없다
//   2) 경계선 셋 끌기(왼쪽|오른쪽 · 수업|일정 · 위/메모) → 크기가 바뀌고 이 기기에 남는다 · 다시 열어도 그대로 · 두 번 누르면 기본
//   3) 수정 칸을 열면 비율 그대로 접힌다(수업/일정 위아래) · ◀▶ 한 주
//   4) '스크롤로 페이지 이동'을 켜도 칸 안 휠은 날짜를 넘기지 않는다
//   5) 좁은 폭(본문 780 밑)은 두 무리를 쌓는다
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-board.mjs
// 에뮬레이터 teacher 계정 개인 공간에 점검 일정·메모(insp_bd…)를 심고 끝에 지운다. 칸 비율은 기기 저장소(sp5-board)라 새 창마다 비어 있다.
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, hashOf, launch, newPage, open, report, restorer, sel, waitFor } from './lib/probe.mjs';

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
    for (const pane of ['lessons', 'memo']) {
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
