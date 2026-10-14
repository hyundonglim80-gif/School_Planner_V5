// tools/inspect-manual.mjs - 사용 설명서 점검 (P9-1. V4 tools/inspect-manual.mjs를 V5로 - 항목마다 data-*로).
//   ■1 설명서 창: 머리줄 ?·⋮ '사용 설명서'로 열린다 · 분류 → 기능 → 설명·사용 예 · 왼쪽 목차 · 찾기 · 다른 항목 연결 ·
//      단축키 표는 지금 설정값 · 창의 설명서 주제로 열기({ topic }).
//   ■3 항목마다: 설명서가 말하는 자리(단추·칸·창)가 실제 앱에 있고 열리는지 data-*로 본다 + 그 항목이 설명서 창에 열린다.
//      기능의 자세한 동작은 기능 점검(inspect-events·notes·…)이 맡는다 - 여기서는 '설명서대로 찾아갈 수 있나'.
//      장 파일(src/features/help/chapters/*.ts)의 모든 주제를 한 번씩 거쳤는지도 센다(새 주제를 더하면 여기도 더한다).
//
//   npm run emu · npm run seed · npm run dev:emu (켜 둔다) → node tools/inspect-manual.mjs   (MATCH=<정규식>으로 묶음 고르기)
// 에뮬레이터 teacher(담임)·teacher3(교과)의 개인 공간에 점검 자료(insp_man…)를 심고 끝에 지운다. ⚠️ 에뮬레이터만 건드린다.
import { readdirSync, readFileSync } from 'node:fs';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const MATCH = process.env.MATCH ? new RegExp(process.env.MATCH) : null;

// ── 설명서의 주제 (장 파일에서 읽는다 - 주제는 여섯 칸 들여 쓴 id 줄) ──
const CHAPTERS = 'src/features/help/chapters';
const TOPICS = readdirSync(CHAPTERS).flatMap((f) => [...readFileSync(`${CHAPTERS}/${f}`, 'utf8').matchAll(/^ {6}id: '([a-z0-9-]+)',$/gm)].map((m) => m[1]));
const visited = new Set();

// ── 점검 자료 ──
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const em3 = emulator('inspect3');
const uid3 = await em3.signIn('teacher3@example.com');
const space = (db, u) => ({ ref: (c, id) => doc(db, 'spaces', `u_${u}`, c, id), coll: (c) => collection(db, 'spaces', `u_${u}`, c) });
const A = space(em.db, uid);
const B = space(em3.db, uid3);
const DAY = '2026-10-08'; // 목요일
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TODAY = ymd(new Date());
const YESTERDAY = ymd(new Date(Date.now() - 86400000));
const YEAR = (() => {
  const d = new Date();
  return d.getMonth() + 1 >= 3 ? d.getFullYear() : d.getFullYear() - 1;
})();
const CLASS = `${YEAR}-5-2`;
const tracked = (u) => ({ deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: u });

/** 심고 끝에 지운다 (같은 id가 이미 있으면 그 문서를 되돌린다) */
async function plant(S, coll, id, data) {
  await setDoc(S.ref(coll, id), data);
  undo.add(() => deleteDoc(S.ref(coll, id)));
}
/** 컬렉션을 비우고 끝에 되돌린다 (명렬표·시간표 - 점검 학급만 보이게) */
async function clearAndKeep(S, coll) {
  const before = (await getDocs(S.coll(coll))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before) await deleteDoc(S.ref(coll, id));
  undo.add(async () => {
    for (const d of (await getDocs(S.coll(coll))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before) await setDoc(S.ref(coll, id), data);
  });
}

const browser = await launch();
const { page, errors, dialogs } = await newPage(browser);
const q = (s) => page.locator(s).first();
const count = (s) => page.locator(s).count();
const has = (s, ms = 6000) => waitFor(page.locator(s).first(), ms);
const win = (id, params) => page.evaluate(([i, p]) => window.sp5.openWindow(i, p), [id, params]);
const shortcut = (id) => page.evaluate((i) => window.sp5.runShortcut(i), id);
/** 항목 사이에 오른쪽 칸을 모두 닫는다 - 저장 안 한 칸이 있으면 묻는 창에 '닫기'로 (점검 자료는 끝에 지운다) */
const closeAll = async () => {
  dialogs.answer = true;
  await page.evaluate(() => window.sp5.closeAllWindows()).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  dialogs.answer = false;
};
/** 주소로 화면을 연다 (# 뒤만 바뀌면 다시 읽지 않는다 - 그 화면이 뜰 때까지) */
const go = async (hash, screen) => {
  await page.evaluate((h) => (location.hash = h), hash);
  if (screen) await has(sel('screen', screen), 8000);
};

/** 설명서 주제 하나: 설명서가 말하는 자리를 보고, 그 주제가 설명서 창에 열리는지 본다 */
async function topic(id, fn) {
  if (MATCH && !MATCH.test(id)) return;
  visited.add(id);
  r.section(id);
  try {
    await fn();
  } catch (e) {
    r.bad(`${id} - 멈춤: ${String(e?.message || e).split('\n')[0]}`);
  }
  await closeAll();
  await win('help', { topic: id });
  r.check(await has(sel('help-detail', id), 5000), `설명서 창에 '${id}' 항목이 열린다`);
  await closeAll();
}

try {
  // ── 자료 심기 ──
  await clearAndKeep(A, 'classes');
  await clearAndKeep(A, 'timetables');
  await clearAndKeep(B, 'classes');
  await clearAndKeep(B, 'timetables');
  const students = [
    { sid: 'm1', num: 1, name: '김하늘', gender: 'F', status: 'active' },
    { sid: 'm2', num: 2, name: '이바다', gender: 'M', status: 'active' },
    { sid: 'm3', num: 3, name: '박구름', gender: 'F', status: 'active' },
  ];
  await plant(A, 'classes', CLASS, { year: YEAR, grade: 5, num: 2, students, ...tracked(uid) });
  await plant(B, 'classes', CLASS, { year: YEAR, grade: 5, num: 2, students, ...tracked(uid3) });
  const week = (s) => Object.fromEntries(['1', '2', '3', '4', '5'].map((d) => [d, { '1': s, '2': '수학' }]));
  await plant(A, 'timetables', 'insp_man_tt', { name: '점검 시간표', from: `${YEAR}-03-01`, to: `${YEAR + 1}-02-28`, grid: week('국어'), ...tracked(uid) });
  await plant(B, 'timetables', 'insp_man_tt', { name: '점검 전담', from: `${YEAR}-03-01`, to: `${YEAR + 1}-02-28`, grid: week('5-2 과학'), ...tracked(uid3) });
  await plant(A, 'labels', 'insp_man_el', { kind: 'event', name: '점검달력', color: 'blue', parentId: null, order: 'Zz1', props: { calendar: true }, ...tracked(uid) });
  await plant(A, 'labels', 'insp_man_nl', { kind: 'note', name: '점검기록', color: 'green', parentId: null, order: 'Zz1', ...tracked(uid) });
  const item = (id, data) => plant(A, 'items', id, { order: 'Zz1', labelIds: [], ...data, ...tracked(uid) });
  await item('insp_man_e1', { kind: 'event', date: DAY, text: '설명서점검 일정', labelIds: ['insp_man_el'], time: '09:30', linkIds: ['insp_man_n1'] });
  await item('insp_man_e2', { kind: 'event', date: DAY, endDate: '2026-10-12', text: '설명서점검 기간', order: 'Zz2', workdays: true });
  await item('insp_man_e3', { kind: 'event', date: YESTERDAY, text: '설명서점검 지난 일정' });
  const table = { id: 't1', rows: [{ cells: [{ v: '가' }, { v: '나' }] }, { cells: [{ v: '1' }, { v: '2' }] }], createdAt: Date.now() };
  const img = { name: '점검.png', url: 'https://drive.google.com/uc?id=insp_man_img', type: 'image/png', driveId: 'insp_man_img' };
  await item('insp_man_n1', { kind: 'note', date: DAY, text: '설명서점검 기록', labelIds: ['insp_man_nl'], linkIds: ['insp_man_e1'], tables: [table], attachments: [img], studentIds: [`${CLASS}/m1`] });
  await item('insp_man_m1', { kind: 'note', date: null, text: '설명서점검 메모', labelIds: ['insp_man_nl'] });
  await item('insp_man_m2', { kind: 'note', date: null, text: '설명서점검 끝낸 메모', done: true, order: 'Zz2' });
  // 그날 알림장 (기록 칸 '📢 알림장' 카드·알림장 칸 미리 보기)
  await plant(A, 'notices', DAY, { date: DAY, lines: ['설명서점검 알림장'], ...tracked(uid) });

  await open(page, `#/day/${DAY}`);
  await has(sel('day-events'), 10000);

  // ════════ 설명서 창 (■1) ════════
  if (!MATCH || MATCH.test('help')) {
    r.section('설명서 창 - 여는 길·목차·찾기·연결·단축키 표');
    await q(sel('header-help')).click();
    r.check(await has(sel('help-window'), 8000), '머리줄 ?로 설명서 창이 열린다');
    r.check((await count(sel('help-category'))) === 11, '첫 화면에 기능별 분류 11장');
    r.check((await count(sel('help-tree'))) === 1, '왼쪽 목차가 선다 (넓은 칸)');
    await closeAll();
    await q(sel('more-menu')).click();
    await q(sel('menu-item', 'help')).click();
    r.check(await has(sel('help-window'), 5000), "⋮ '사용 설명서'로도 열린다");
    await q(sel('help-category', 'events')).click();
    await q(`${sel('help-content')} ${sel('help-topic', 'forwarding')}`).click();
    r.check((await q(sel('help-tree-topic', 'forwarding')).getAttribute('aria-current')) === 'page', '목차에서 지금 항목이 짚인다');
    const lookback = await q(sel('help-lookback')).innerText();
    r.check(/^\d+$/.test(lookback), `이월 기간 자리표가 숫자로 풀린다 (${lookback})`);
    const link = q(`${sel('help-content')} ${sel('help-link')}`);
    const to = await link.getAttribute('data-help-link');
    await link.click();
    r.check(await has(sel('help-detail', to), 3000), `설명 안의 연결로 '${to}' 항목으로 간다`);
    await q(sel('help-crumb-home')).click();
    await q(sel('help-search')).fill('캡처');
    const n = Number(await q(sel('help-results')).getAttribute('data-help-results'));
    r.check(n > 0 && (await count(`${sel('help-content')} ${sel('help-topic')}`)) === n, `'캡처'로 찾으면 ${n}개 항목`);
    await q(sel('help-search')).fill('');
    await q(sel('help-shortcuts-open')).click();
    r.check((await count(sel('help-shortcut'))) > 40, '단축키 한눈에 보기 - 모든 기능을 펼친다');
    await q(sel('help-tree-toggle')).click();
    r.check((await count(sel('help-tree'))) === 0, '📚 목차로 목차를 접는다');
    await q(sel('help-tree-toggle')).click();
    await win('help', { topic: 'trash' });
    r.check(await has(sel('help-detail', 'trash'), 3000), '열린 설명서를 다른 주제로 다시 열면 그 항목');
    await closeAll();
  }

  // ════════ 1장 시작하기 ════════
  await topic('layout', async () => {
    for (const s of ['header-dday', 'header-trash', 'header-search', 'header-help', 'more-menu', 'account']) r.check((await count(sel(s))) > 0, `머리줄 ${s}`);
    r.check((await count(sel('new-menu'))) === 0, 'PC 머리줄에 ＋ 새로 없음 (P10-1 - 휴대폰은 둥근 ＋)');
    r.check((await count(sel('scope-tab'))) === 6, '화면 탭 여섯');
    r.check((await count(sel('view-toggle'))) === 3 && (await count(sel('date-label'))) === 1, '둘째 줄: 토글 셋·날짜');
    await q(sel('more-menu')).click();
    r.check((await count(sel('menu-section'))) === 4, '⋮ 네 구역');
    r.check((await count(sel('menu-item'))) === 7, '⋮ 하루 화면에서 일곱 항목 (인쇄는 주간·년간에서만)');
    await page.keyboard.press('Escape');
  });

  await topic('login', async () => {
    r.check((await page.locator('[data-session="signed-in"][data-user="teacher@example.com"]').count()) === 1, '로그인한 계정');
    await q(sel('account')).click();
    r.check(await has(sel('account-panel')), '프로필 사진 → 계정 칸');
    r.check((await q(sel('account-email')).innerText()).includes('teacher@example.com'), '계정 칸에 메일');
    r.check((await count(sel('account-groups'))) === 1 && (await count(sel('logout'))) === 1, '계정 칸에 👥 공유 그룹·로그아웃');
    await page.keyboard.press('Escape');
  });

  await topic('install', async () => {
    await win('settings', { tab: 'app' });
    r.check(await has(sel('install-pwa')), "환경설정 '앱' 탭의 📱 앱으로 설치");
  });

  await topic('navigation', async () => {
    await q(sel('scope-tab', 'week')).click();
    r.check(await has(sel('screen', 'week')), '화면 탭 → 주간');
    r.check(page.url().includes('#/week/'), '주소에 화면이 남는다 (#/week/…)');
    await go(`#/day/${DAY}`, 'day');
    await q(sel('date-next')).click();
    r.check(await waitFor(async () => page.url().includes('#/day/2026-10-09'), 3000), '▶ = 다음 날 (주소도)');
    await q(sel('date-label')).click();
    r.check(await waitFor(async () => page.url().includes(`#/day/${TODAY}`), 3000), '가운데 날짜 = 오늘');
    await go(`#/day/${DAY}`, 'day');
  });

  await topic('toggles', async () => {
    await q(sel('view-toggle', 'showEvents')).click();
    r.check(await waitFor(async () => (await count(sel('day-events'))) === 0, 3000), "'일정' 끄면 하루 화면 일정 칸이 걷힌다");
    await q(sel('view-toggle', 'showEvents')).click();
    r.check(await has(sel('day-events')), '다시 누르면 돌아온다');
    await page.waitForTimeout(1500); // 계정에 올라가는 설정 (CLAUDE.md 2장)
  });

  await topic('popups', async () => {
    await win('settings');
    await win('search');
    r.check(await waitFor(async () => (await count(sel('side-tab'))) >= 2, 4000), '오른쪽 칸 위에 탭이 둘');
    await q(sel('side-tab-close')).click();
    r.check(await waitFor(async () => (await count(sel('popup-frame'))) === 1, 3000), '탭 × = 그 칸만 닫기');
    await page.keyboard.press('Escape');
    r.check(await waitFor(async () => (await count(sel('popup-frame'))) === 0, 3000), 'ESC = 오른쪽 칸 모두 닫기');
  });

  await topic('mobile', async () => {
    r.check((await count(sel('mobile-tabbar'))) === 1 && (await count(sel('tabbar-tab'))) === 6, '아래 탭바 (휴대폰 폭에서 보인다)');
    r.check((await count(sel('new-fab'))) === 1, '탭바 위 둥근 ＋');
  });

  // ════════ 2장 화면 보기 ════════
  await topic('day-overview', async () => {
    for (const s of ['day-lessons', 'day-events', 'day-journal']) r.check((await count(sel(s))) === 1, `하루 화면 ${s}`);
    r.check((await count(sel('day-bell'))) === 1 && (await count(sel('lessons-settings'))) === 1, '수업 칸 머리줄 🔔 종·⚙️');
    r.check((await count(sel('lessons-tool', 'attendance'))) + (await count(sel('lessons-tool', 'notices'))) === 2, '담임: 📋 출석부·📢 알림장');
    r.check((await count(sel('lessons-tool', 'drawStudent'))) === 1, '담임: 🎯 뽑기');
    r.check((await count(sel('journal-add-memo'))) === 1, '기록 칸 + 메모');
  });

  await topic('week', async () => {
    await go(`#/week/${DAY}`, 'week');
    r.check((await count(sel('week-day'))) >= 5, '요일 카드');
    r.check((await count(sel('week-guide'))) === 1, '📰 주간학습안내 (담임)');
    r.check((await count(sel('last-year-toggle'))) === 1, '🕰️ 작년 이맘때');
    r.check((await count(sel('week-lesson'))) > 0, '수업 줄 (시간표에서 계산)');
    await q(sel('more-menu')).click();
    r.check((await count(sel('menu-item', 'print'))) === 1, '⋮ 🖨️ 이 화면 인쇄 (주간에서 보인다)');
    await page.keyboard.press('Escape');
  });

  await topic('month', async () => {
    await go('#/month/2026-10', 'month');
    r.check((await count(sel('month-day'))) >= 28, '날짜 칸');
    r.check(await has(sel('month-event', 'insp_man_e1')), "'달력' 라벨 일정이 보인다");
    r.check((await count(sel('period-bar'))) > 0, '기간 일정 = 막대');
  });

  await topic('year', async () => {
    await go(`#/year/${YEAR}`, 'year');
    r.check((await count(sel('year-view'))) === 2, '📅 학사력 / 📋 자세히');
    // 열두 달은 세 달씩 나눠 그린다 - 다 그릴 때까지 기다린다 (P9-3 - 바쁠 때 덜 그려진 것을 세었다)
    r.check(await waitFor(async () => (await count(sel('sheet-month'))) >= 12 || (await count(sel('year-month'))) >= 12, 5000), '열두 달');
  });

  await topic('badges', async () => {
    await go(`#/week/${DAY}`, 'week');
    const notes = q(sel('week-notes'));
    r.check(await waitFor(notes, 5000), '📝 기록 수 표식');
    await notes.click();
    r.check(await has(sel('day-notes', DAY)), '📝 → 그날 기록 창');
  });

  await topic('holidays', async () => {
    await go(`#/week/${DAY}`, 'week');
    r.check(await has(sel('holiday-name', '한글날')), '공휴일 이름 (10/9 한글날 - 고정 공휴일)');
  });

  await topic('dday', async () => {
    await q(sel('header-dday')).click();
    r.check(await has(sel('dday-window')), '⏳ → D-Day 관리');
    r.check((await count(sel('dday-title'))) === 1 && (await count(sel('dday-add'))) === 1, '새 D-Day 추가 칸');
  });

  // ════════ 3장 일정 ════════
  await go(`#/day/${DAY}`, 'day');
  await topic('event-add', async () => {
    await q(sel('event-add')).click();
    r.check(await has(sel('event-panel', 'new')), '+ 추가 → 새 일정 칸');
    for (const s of ['event-text-input', 'event-date', 'event-due-input', 'event-alarm-open', 'event-period-open', 'label-picker']) r.check((await count(sel(s))) > 0, `칸: ${s}`);
    await q(sel('event-text-input')).fill('내일 15:00 점검');
    r.check(await waitFor(async () => (await count(sel('quick-chip'))) >= 2, 3000), '빠른 입력 칩 (내일·15:00)');
    await q(sel('event-text-input')).fill('');
  });

  await topic('event-edit', async () => {
    const card = q(sel('event-card', 'insp_man_e1'));
    r.check(await waitFor(card), '일정 카드');
    for (const s of ['event-up', 'event-edit', 'event-delete']) r.check((await card.locator(sel(s)).count()) === 1, `카드 ${s}`);
    await card.locator(sel('event-edit')).click();
    r.check(await has(sel('event-panel', 'edit')), '✏️ → 일정 수정 칸');
  });

  await topic('event-complete', async () => {
    r.check((await count('[data-event-card="insp_man_e1"][data-event-done="0"]')) === 1, '카드에 완료 표시 (끝내지 않음)');
    r.check((await q(sel('event-card', 'insp_man_e1')).locator(sel('event-done-chip', '0')).count()) === 1, '완료 칩 (✓ 없음)');
    r.check((await q(sel('event-card', 'insp_man_e1')).locator('input[type="checkbox"]').count()) === 0, '☐ 체크 칸 없음');
    r.check((await q(sel('event-card', 'insp_man_e1')).locator(sel('event-chip')).count()) > 0, '라벨 칩 (누르면 완료)');
  });

  await topic('event-labels', async () => {
    await q(sel('event-add')).click();
    await has(sel('event-panel', 'new'));
    r.check((await count(sel('label-picker'))) === 1 && (await count(sel('label-picker-settings'))) === 1, '라벨 줄 + ⚙️ 라벨 수정');
  });

  await topic('event-attrs', async () => {
    await q(sel('event-add')).click();
    await has(sel('event-panel', 'new'));
    const attrs = await page.locator(sel('event-attr')).evaluateAll((els) => els.map((e) => e.getAttribute('data-event-attr')));
    r.check(['calendar', 'forward', 'skip', 'gcal'].every((a) => attrs.includes(a)), `속성 설정 (${attrs.join('·')})`);
  });

  await topic('alarm', async () => {
    await q(sel('event-add')).click();
    await has(sel('event-panel', 'new'));
    await q(sel('event-alarm-open')).click();
    r.check(await has(sel('alarm-window')), '⏰ 알림 추가 → 알림 창');
    r.check((await count(sel('alarm-time'))) === 1, '시간 칸 (24시간제)');
    await win('settings', { tab: 'notify' });
    r.check(await has(sel('push-alarm')), "환경설정 '알림' 탭 - 이 기기에서 받기");
  });

  await topic('period', async () => {
    await q(sel('event-add')).click();
    await has(sel('event-panel', 'new'));
    await q(sel('event-period-open')).click();
    r.check(await has(sel('event-end')), '📆 끝 날 → 끝 칸');
    r.check((await count(sel('event-workdays'))) === 1, '주말·공휴일 빼기');
    r.check((await count(`${sel('event-recur-row', 'none')} ${sel('recur-day')}`)) === 7, '끝 날 줄의 요일 칩 일곱 (안 고르면 기간)');
    await closeAll();
    r.check(await has(sel('event-period')), "기간 일정 카드에 '(k/n)'");
  });

  await topic('recurring', async () => {
    await shortcut('recurring');
    r.check(await has(sel('event-panel', 'new')), "단축키 '반복 일정' = 새 일정 칸");
    r.check(await has(sel('event-recur-row', 'weekly')), '끝 날 줄이 펴지고 시작 날 요일을 골라 둔다 (매주)');
  });

  await topic('group-delete', async () => {
    await q(sel('event-card', 'insp_man_e2')).locator(sel('event-delete')).click();
    r.check(await has(sel('scope-window')), '기간 일정 지우기 → 어디까지 묻는 창');
    r.check((await count(sel('scope-choice'))) === 3, '세 갈래 (이 날만·이 날과 이후·전체)');
  });

  await topic('forwarding', async () => {
    await go(`#/day/${TODAY}`, 'day');
    r.check(await has(sel('past-toggle'), 8000), "오늘 일정 칸 아래 '📥 지난 일정 N개'");
    await q(sel('past-toggle')).click();
    r.check(await has(sel('past-item', 'insp_man_e3')), '펼치면 지난 일정이 줄로');
    r.check((await count(sel('past-bring'))) === 1, '오늘로 가져오기 단추');
    await win('settings', { tab: 'school' });
    r.check(await has(sel('forward-days')), "이월 기간 = 환경설정 '학교' 탭");
    await go(`#/day/${DAY}`, 'day');
  });

  await topic('multi-select', async () => {
    await q(sel('event-card', 'insp_man_e1')).click({ modifiers: ['Control'] });
    r.check(await has(sel('multi-bar')), 'Ctrl+누르기 → 여러 개 고르기 막대');
    r.check(await has(sel('event-picked')), '고른 일정이 짚인다');
    for (const s of ['multi-complete', 'multi-label-open', 'multi-move-open', 'multi-delete']) r.check((await count(sel(s))) === 1, `막대 ${s}`);
    await q(sel('multi-end')).click();
    r.check(await waitFor(async () => (await count(sel('multi-bar'))) === 0, 3000), '✕ 로 끝낸다');
  });

  // ════════ 4장 수업 · 시간표 ════════
  await topic('teaching-mode', async () => {
    await win('timetable', { tab: 'teaching' });
    r.check(await waitFor(async () => (await count(sel('teacher-preset'))) === 3, 5000), "시간표 창 '교사 유형' 탭 - 셋 중 하나");
    await win('settings', { tab: 'school' });
    r.check(await has('[data-settings-panel="school"] button'), "환경설정 '학교' 탭에 시간표 창으로 가는 단추");
  });

  await topic('class-cell', async () => {
    const card = q(sel('lesson-card'));
    r.check(await waitFor(card), '교시 카드 (시간표에서 계산)');
    r.check((await q(sel('lesson-subject')).innerText()).includes('국어'), '과목 = 시간표 것');
    await card.click();
    r.check(await has(sel('lesson-editor')), '교시를 누르면 그 자리에서 고친다');
    await page.keyboard.press('Escape');
  });

  await topic('detail-popup', async () => {
    await go(`#/week/${DAY}`, 'week');
    await q(sel('week-lesson')).click();
    r.check(await has(sel('lesson-panel')), "주간 교시 → 오른쪽 'N교시 수정' 칸");
    r.check((await count(sel('lesson-panel-link'))) === 1 && (await count(sel('lesson-panel-evals'))) === 1, '🔗 링크 추가·📊 조사표');
    await go(`#/day/${DAY}`, 'day');
  });

  await topic('timetable', async () => {
    await q(sel('more-menu')).click();
    await q(sel('menu-item', 'timetable')).click();
    r.check(await has(sel('timetable-window')), '⋮ ⏰ 시간표');
    r.check((await count(sel('timetable-tab'))) === 4, '탭 넷 (교사 유형·시간표·교시·학기·방학)');
    await win('timetable', { tab: 'grid' });
    r.check(await has(sel('timetable-add')), '+ 새 시간표');
    r.check((await count('input[data-cell]')) > 0, '요일 × 교시 칸');
  });

  await topic('new-year', async () => {
    // 띠는 2/15 ~ 3/31에만 (tools/inspect-new-year.mjs) - 여기서는 시간표 창 머리줄 🌱로 창과 네 단계
    await win('timetable', { tab: 'grid' });
    await q(sel('timetable-new-year')).click();
    r.check(await has(sel('new-year-window')), '⏰ 시간표 창 위 🌱 새 학년도 → 새 학년도 준비 창');
    r.check((await count(sel('new-year-step'))) === 4, '단계 넷 (새 학급·시간표·학기·방학·교사 유형·담임반)');
    r.check((await count(sel('new-year-names'))) === 1 && (await count(sel('new-year-create-class'))) === 1 && (await count(sel('new-year-done'))) === 1, '명단 붙여넣기·🏫 학급 만들기·✅ 준비 끝');
  });

  await topic('progress', async () => {
    await q(sel('lessons-tool', 'progress')).click();
    r.check(await has(sel('progress-window')), '하루 수업 칸 📘 진도 관리');
    r.check((await count(sel('progress-sample'))) === 1 && (await count(sel('progress-csv-open'))) === 1, '⬇️ 예시 CSV·📂 CSV 불러오기');
  });

  await topic('weekly-guide', async () => {
    await go(`#/week/${DAY}`, 'week');
    await q(sel('week-guide')).click();
    r.check(await has(sel('weekly-guide-window')), '주간 📰 주간학습안내');
    r.check((await count(sel('guide-print'))) === 1 && (await count(sel('guide-copy'))) === 1, '🖨️ 인쇄·📋 표 복사');
    await go(`#/day/${DAY}`, 'day');
  });

  // ════════ 5장 기록 · 메모 ════════
  await topic('journal', async () => {
    await q(sel('journal-add')).click();
    r.check(await has(sel('note-panel', 'new')), '+ 추가 → 새 기록 칸');
    for (const s of ['note-date', 'checklist-toggle', 'note-students', 'note-attach']) r.check((await count(sel(s))) > 0, `칸: ${s}`);
    r.check(await has(sel('day-card', 'notice')), "기록 칸 맨 위 '📢 알림장' 카드 (그날 알림장을 계산해 보인다)");
  });

  await topic('journal-view', async () => {
    const card = q(sel('entry-card', 'insp_man_n1'));
    r.check(await waitFor(card), '기록 카드');
    for (const s of ['entry-complete', 'entry-favorite-toggle', 'entry-table', 'entry-students']) r.check((await card.locator(sel(s)).count()) > 0, `카드 ${s}`);
    r.check((await count(sel('filter-chip'))) > 0, '라벨로 보기 칩');
  });

  await topic('memo-screen', async () => {
    await go('#/memo', 'memo');
    r.check(await has(sel('memo-filter-nav')), '📁 라벨로 보기');
    r.check(await has(sel('entry-card', 'insp_man_m1')), '메모 카드');
    r.check((await count(sel('memo-active'))) === 1 && (await count(sel('memo-done'))) === 1, '진행 / 완료 구역');
  });

  await topic('memo-write', async () => {
    await q(sel('memo-new')).click();
    r.check(await has(sel('note-panel', 'new')), '+ 새 메모 → 새 메모 칸');
    r.check((await q(sel('note-date')).inputValue()) === '', '메모 = 날짜 없음');
  });

  await topic('memo-manage', async () => {
    await go('#/memo', 'memo');
    r.check(await has(sel('memo-clear-done')), '완료 구역 🗑️ 전체 비우기 (끝낸 메모가 있을 때)');
    const card = q(sel('entry-card', 'insp_man_m1'));
    r.check((await card.locator(sel('entry-favorite-toggle')).count()) === 1, '☆ 즐겨찾기');
  });

  await topic('move-entry', async () => {
    await go('#/memo', 'memo');
    await q(sel('entry-card', 'insp_man_m1')).locator(sel('entry-edit')).click();
    r.check(await has(sel('note-panel', 'edit')), '메모 수정 칸');
    await q(sel('note-date')).fill(DAY);
    r.check(await has(sel('note-place-hint')), "📅 날짜를 넣으면 '저장하면 … 기록으로 옮깁니다'");
    await q(sel('note-place-keep')).click();
    await go(`#/day/${DAY}`, 'day');
  });

  await topic('keep', async () => {
    await win('backup', { tab: 'import' });
    r.check(await has(sel('keep-pick')), "백업 창 '가져오기' 탭의 Keep 파일 고르기");
  });

  // ════════ 6장 첨부 · 캡처 · 링크 ════════
  await topic('attach', async () => {
    await q(sel('entry-card', 'insp_man_n1')).locator(sel('entry-edit')).click();
    r.check(await has(sel('note-attach')), '쓰는 칸의 📎 파일 첨부');
  });

  await topic('paste-table', async () => {
    await q(sel('entry-card', 'insp_man_n1')).locator(sel('entry-edit')).click();
    r.check(await has(sel('note-table')), '칸 안의 표 (칸 글자·행/열 고치기)');
    r.check((await count(sel('table-op'))) > 0, '행/열 단추');
  });

  await topic('paste-image', async () => {
    await q(sel('entry-card', 'insp_man_n1')).locator(sel('entry-edit')).click();
    r.check(await has(sel('note-text-input')), '내용 칸 (Ctrl + V로 캡처 붙이기)');
    r.check((await count(sel('note-attach'))) === 1, '📎 (붙인 그림은 첨부로)');
  });

  await topic('clipboard', async () => {
    await q(sel('clipboard-toggle')).click();
    r.check(await has(sel('clipboard-panel')), '왼쪽 📋 → 클립보드 칸');
    r.check((await count(sel('clipboard-fetch'))) === 1, '⤓ 가져오기');
    await q(sel('clipboard-close')).click();
  });

  await topic('image-viewer', async () => {
    const card = q(sel('entry-card', 'insp_man_n1'));
    const image = card.locator(sel('entry-image')).first();
    if (!(await waitFor(image, 2000))) await card.locator(sel('entry-collapse')).click();
    await card.locator(sel('entry-image')).first().click();
    r.check(await has(sel('image-viewer')), '그림을 누르면 크게 보기');
    await page.keyboard.press('Escape');
    r.check(await waitFor(async () => (await count(sel('image-viewer'))) === 0, 3000), 'ESC = 크게 보기만 닫기');
  });

  await topic('links', async () => {
    await q(sel('event-card', 'insp_man_e1')).locator(sel('event-edit')).click();
    await has(sel('event-panel', 'edit'));
    await q(sel('event-link-add')).click();
    r.check(await has(sel('linker')), '🔗 링크 추가 → 새 데이터 연결하기');
    r.check((await count(sel('linker-tab'))) >= 4 && (await count(sel('linker-save'))) === 1, '탭(일정·수업·기록·메모)·연결 저장');
  });

  await topic('link-viewer', async () => {
    await q(sel('event-card', 'insp_man_e1')).locator(sel('event-links')).click();
    r.check(await has(sel('link-viewer')), '🔗 1 → 연결된 데이터');
    r.check(await has('[data-link-viewer] [data-entry-card], [data-link-viewer] *:text("설명서점검 기록")'), '연결된 기록이 보인다');
  });

  // ════════ 7장 학급 운영 ════════
  await go('#/class', 'class');
  await topic('class-screen', async () => {
    await go('#/class', 'class');
    if (await count(sel('roster'))) await q(sel('class-mode', 'hub')).click();
    const tools = await page.locator(sel('class-tool')).evaluateAll((els) => els.map((e) => e.getAttribute('data-class-tool')));
    r.check(['attendance', 'notices', 'seating', 'drawStudent', 'studentRecord', 'evalOverview', 'roster'].every((t) => tools.includes(t)), `도구 카드 (${tools.length}) - 담임`);
    r.check(await has(sel('class-students')), '학생 명단');
    r.check((await count(sel('class-view'))) === 2, '이름 / 📷 사진');
    r.check((await count(sel('class-today'))) === 1, '📋 오늘 출결 줄');
  });

  /** 학급 화면의 명렬표 (관리 · 검색 · 암기) */
  const openRoster = async () => {
    await go('#/class', 'class');
    if (!(await count(sel('roster')))) await q(sel('class-mode', 'roster')).click();
    await has(sel('roster'));
  };
  await topic('roster', async () => {
    await openRoster();
    r.check(await has(sel('roster')), '🧑‍🤝‍🧑 명렬표 (학급 화면 안)');
    r.check((await count(sel('roster-tab'))) === 3, '관리 · 검색 · 암기');
    for (const s of ['roster-csv-up', 'roster-csv-down', 'roster-all-csv-up', 'roster-all-csv-down']) r.check((await count(sel(s))) === 1, `주고받기 ${s}`);
  });

  await topic('student-photos', async () => {
    await openRoster();
    r.check(await has(sel('roster-photos')), '명렬표 📷 사진 켜기');
  });

  await topic('roster-search', async () => {
    await openRoster();
    await q(sel('roster-tab', 'search')).click();
    r.check(await has(sel('search-name')), '검색 탭 - 이름(초성)');
    await q(sel('roster-tab', 'memorize')).click();
    r.check(await has(sel('roster-memorize')), '암기 탭');
    await q(sel('class-mode', 'hub')).click();
  });

  await topic('notice', async () => {
    await go(`#/day/${DAY}`, 'day');
    await q(sel('lessons-tool', 'notices')).click();
    r.check(await has(sel('notice-panel')), '하루 수업 칸 📢 알림장 → 알림장 칸');
    r.check(await has(sel('notice-copy')), '미리 보기의 📋 복사 (📤 공유는 공유 창이 있는 브라우저에서)');
    r.check((await count(sel('notice-tab'))) === 2, '✏️ 쓰기 · 📚 모아 보기');
  });

  await topic('attendance', async () => {
    await q(sel('lessons-tool', 'attendance')).click();
    r.check(await has(sel('attendance-panel')), '하루 수업 칸 📋 출석부 → 출석부 칸');
    r.check((await count(sel('attendance-row'))) === 3, '학생 셋 (모두 출석에서 시작)');
    r.check((await count(sel('attendance-kind'))) > 0, '결석·지각·조퇴·결과');
  });

  await topic('subject-attendance', async () => {
    await win('subjectAttendance');
    r.check(await has(sel('subject-summary')), '교과 출결 누계 창');
    // 교과(teacher3) 교시 카드의 🙋 출결
    const p3 = (await newPage(browser)).page;
    await open(p3, `#/day/${DAY}`, { as: 3 });
    r.check(await waitFor(p3.locator(sel('subject-attendance')).first(), 10000), '교과 모드 교시 카드의 🙋 출결 (teacher3)');
    await p3.locator(sel('subject-attendance')).first().click();
    r.check(await waitFor(p3.locator(sel('subject-att-panel')).first(), 5000), '🙋 → 그 반 그 교시 교과 출결 칸');
    r.check(await waitFor(p3.locator(sel('class-tool-btn')).first(), 3000), '교시 카드의 반 도구 (🪑·🎯·📊)');
    await p3.context().close();
  });

  await topic('student-record', async () => {
    await go('#/class', 'class');
    await q(sel('class-student')).click();
    r.check(await has(sel('student-record')), '학생 이름 → 학생 기록(누가기록)');
    r.check((await count(sel('student-record-tab'))) === 2 && (await count(sel('student-record-copy'))) === 1, '🗓️ 기록·출결 / 📊 탭·📋 전체 복사');
    r.check(await has(sel('student-timeline-item')), '학생을 붙인 기록이 모인다');
  });

  await topic('seating', async () => {
    await go('#/class', 'class');
    await q(sel('class-tool', 'seating')).click();
    r.check(await has(sel('seating-window')), '🪑 자리표 카드 → 자리표');
    r.check(await has(sel('seating-create')), '자리표가 없는 학급 - + 자리표 만들기');
    await closeAll();
    await q(sel('class-tool', 'drawStudent')).click();
    r.check(await has(sel('seating-window')), '🎯 발표자 뽑기 카드 → 자리표(뽑기)');
  });

  await topic('evaluation', async () => {
    await go(`#/day/${DAY}`, 'day');
    await q(sel('lesson-card')).hover();
    await q(sel('lesson-evals')).click({ force: true });
    r.check(await has(sel('eval-window')), '수업 칸 📊 → 조사표 창');
    r.check(await has(sel('eval-new')) || (await count(sel('eval-create'))) === 1, '+ 새 조사표');
    await closeAll();
    await win('evalOverview');
    r.check(await has(sel('eval-overview-window')), '조사표 모아 보기');
  });

  // ════════ 8장 찾기 · 정리 ════════
  await topic('search', async () => {
    await q(sel('header-search')).click();
    r.check(await has(sel('search-window')), '🔍 검색 → 검색 창');
    await q(sel('search-input')).fill('설명서점검');
    r.check(await waitFor(async () => (await count(sel('search-hit'))) >= 3, 5000), '치는 대로 결과 (단추 없이)');
    await q('[data-search-hit*="insp_man_m1"]').click();
    r.check(await waitFor(async () => page.url().includes('#/memo') && (await count('[data-search-focus]')) > 0, 6000), '결과(메모)를 누르면 메모 화면으로 가서 짚는다');
    r.check((await count(sel('search-window'))) === 1, '검색 창은 오른쪽 칸에 그대로');
    await q('[data-search-open*="insp_man_m1"]').click();
    r.check(await has(sel('note-panel', 'edit')), '✏️ = 그 항목의 쓰는 칸');
    await go(`#/day/${DAY}`, 'day');
  });

  await topic('labels', async () => {
    await q(sel('more-menu')).click();
    await q(sel('menu-item', 'labels')).click();
    r.check(await has(sel('labels-window')), '⋮ 🏷️ 라벨 관리');
    r.check((await count(sel('label-tab'))) === 2, '일정 / 메모·기록 탭');
    await q(sel('label-tab', 'note')).click();
    r.check(await has(sel('label-usage', 'insp_man_nl')), '붙은 수가 늘 보인다');
  });

  await topic('trash', async () => {
    await q(sel('header-trash')).click();
    r.check(await has(sel('trash-window')), '🗑️ → 휴지통');
    r.check((await count(sel('trash-tab'))) === 6, '탭 여섯 (전체·일정·기록·메모·클립보드·기타)');
    r.check((await count(sel('trash-settings'))) === 1, '⚙️ 자동 비우기');
  });

  // ════════ 9장 공유 · 연동 · 백업 ════════
  await topic('groups', async () => {
    await q(sel('account')).click();
    await q(sel('account-groups')).click();
    r.check(await has(sel('groups-window')), '계정 칸 👥 공유 그룹 → 공유 그룹 창');
    r.check((await count(sel('group-new-name'))) === 1 && (await count(sel('group-join-code'))) === 1, '그룹 만들기·초대 코드로 참여');
    r.check(await has(sel('v4-groups')), 'V4 그룹 가져오기');
  });

  await topic('calendar-sync', async () => {
    await shortcut('calendar');
    r.check(await has(sel('backup-window', 'send')), "단축키 '구글 캘린더로 보내기' = 백업 창 '보내기' 탭");
    r.check(await has(sel('calendar-sync-window')), '📅 구글 캘린더로 보내기 칸');
  });

  await topic('neis', async () => {
    await win('settings', { tab: 'school' });
    r.check(await has(sel('school-setting')), "환경설정 '학교' 탭 - 우리 학교");
    r.check((await count(sel('school-query'))) === 1, '학교 이름 찾기');
  });

  await topic('backup', async () => {
    await q(sel('more-menu')).click();
    await q(sel('menu-item', 'backup')).click();
    r.check(await has(sel('backup-window')), '⋮ 💾 백업 · 가져오기 · 보내기');
    const tabs = await page.locator(sel('backup-tab-btn')).evaluateAll((els) => els.map((e) => e.getAttribute('data-backup-tab-btn')));
    r.check(tabs.join(',') === 'backup,import,send,tidy', `탭 넷 (${tabs.join('·')})`);
  });

  await topic('v4-import', async () => {
    await win('backup', { tab: 'import' });
    r.check(await has(sel('import-run')), "'가져오기' 탭 - 📥 V4 자료 가져오기");
    r.check((await count(sel('import-groups-open'))) === 1, '공유 그룹 창 길 (V4 그룹)');
  });

  // ════════ 10장 설정 · 단축키 ════════
  await topic('settings', async () => {
    await q(sel('more-menu')).click();
    await q(sel('menu-item', 'settings')).click();
    const tabs = await page.locator(sel('settings-tab')).evaluateAll((els) => els.map((e) => e.getAttribute('data-settings-tab')));
    r.check(tabs.join(',') === 'view,notify,school,shortcuts,app', `탭 다섯 (${tabs.join('·')})`);
  });

  await topic('shortcuts', async () => {
    await win('help', { topic: 'shortcuts' });
    r.check(await has(sel('help-shortcuts')), '설명서의 단축키 표 (지금 설정값)');
  });

  await topic('shortcuts-edit', async () => {
    await win('settings', { tab: 'shortcuts' });
    r.check(await waitFor(async () => (await count(sel('shortcut-row'))) > 40, 5000), "환경설정 '단축키' 탭 - 기능마다 키");
    r.check((await count(sel('shortcut-reset'))) === 1, '기본값으로');
  });

  // ════════ 11장 문제 해결 ════════
  await topic('trouble-data', async () => {
    await win('settings', { tab: 'app' });
    r.check(await has(sel('mirror-reset')), "환경설정 '앱' 탭 - 🔄 이 기기 사본 다시 받기");
    r.check(Number(await q(sel('mirror-count')).getAttribute('data-mirror-count')) > 0, '이 기기에 담아 둔 수');
  });

  await topic('trouble-save', async () => {
    // 저장하지 않고 닫은 글은 다시 열면 '되살리기' (쓰던 글 보관)
    await go(`#/day/${DAY}`, 'day');
    await q(sel('journal-add')).click();
    await has(sel('note-panel', 'new'));
    await q(sel('note-text-input')).fill('설명서점검 쓰던 글');
    await page.waitForTimeout(2500);
    await q(sel('note-close')).click();
    await waitFor(async () => (await count(sel('note-panel'))) === 0, 3000);
    await q(sel('journal-add')).click();
    r.check(await has(sel('draft-offer'), 5000), "다시 열면 '📝 저장하지 않은 글이 있습니다 - 되살리기 / 버리기'");
    if (await has(sel('draft-discard'), 1000)) await q(sel('draft-discard')).click();
  });

  // ── 모든 주제를 거쳤나 ──
  if (!MATCH) {
    r.section('설명서 주제를 모두 거쳤나');
    const missing = TOPICS.filter((t) => !visited.has(t));
    r.check(TOPICS.length >= 69 && missing.length === 0, `장 파일의 주제 ${TOPICS.length}개를 모두 점검했다`, `점검에 없는 주제: ${missing.join(', ')}`);
  }
  r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' | ')}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
