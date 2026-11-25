// tools/inspect-ui-overlap.mjs - P57-1: 단추 겹침·불편 재기 (11-22 사용자 'pc와 모바일에서 여러 상황에서 ui버튼이 겹치거나 불편한 것').
//   상황(기기 폭 × 화면 일곱 × 창 × 창 위치 × 글자 크기 × 머리줄 접기 × 밝기 × 카드 올림 …)마다 보이는 누를 것을 잰다(tools/lib/uiOverlap.mjs):
//   가림 · 겹침 · 휴대폰 24px 아래 · 단추 글 넘침 · 말줄임 없이 잘림 · 가로 넘침. 찾은 것은 상황마다 ✘, 끝에 같은 것끼리 모아 몇 상황에서 나왔나.
//   일부러 그런 것은 lib/uiOverlap IGNORE(까닭과 함께).
//
//   SET_RE=<정규식>  묶음 이름으로 거르기(예 SET_RE='^pc' · SET_RE='^ph360$') · ONLY=<정규식>  상황 이름으로 거르기(예 ONLY='/day$' · ONLY='win:')
//   SHOTS=<폴더>   찾은 것이 있는 상황마다 그림(SHOTS_ALL=1 = 모든 상황) · OUT=<파일.json>  모은 결과
//   SUITE=ci  자동 검사 짧은 묶음(P57-3 - 화면 일곱 × PC 1400·휴대폰 360 + 카드 올림 + 창 여덟, tools/ci-chrome.mjs가 이것으로 돌린다) -
//             걸린 것이 하나라도 있으면 틀림 = 배포 멈춤. 오늘은 2026-11-20에 묶는다(심는 자료가 2026학년도 - 날마다 도는 자동 검사가 해가 바뀌어도 같게)
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-ui-overlap.mjs
// 심은 자료(라벨·일정·메모·시간표·학급)와 바꾼 계정 설정(settings/pc·mobile)은 끝에 되돌린다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, pinToday, report, restorer, sel, waitFor } from './lib/probe.mjs';
import { scanPage } from './lib/uiOverlap.mjs';

const SUITE = process.env.SUITE || '';
if (SUITE === 'ci') pinToday('2026-11-20'); // 날짜를 세기 전에 (아래 YEAR)

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const SHOTS = process.env.SHOTS || '';
const OUT = process.env.OUT || '';
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const SET_RE = process.env.SET_RE ? new RegExp(process.env.SET_RE) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const DAY = '2026-10-14';
const MONDAY = '2026-10-12';
const now = new Date();
const YEAR = now.getMonth() + 1 >= 3 ? now.getFullYear() : now.getFullYear() - 1; // 오늘의 학년도 - 학급 화면이 보는 학급
const CLASS_ID = `${YEAR}-5-2`;
const stamp = () => ({ deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid });
const ref = (coll, id) => doc(em.db, 'spaces', sid, coll, id);

// ── 심는 자료 ──
const WEEK = { '1': '국어', '2': '수학', '3': '사회', '4': '과학', '5': '체육', '6': '창의적 체험활동' };
const NAMES = '김하나 이두리 박세나 최네모 정다섯 강여섯 조일곱 윤여덟 장아홉 임열 한열하나 오열둘 서열셋 신열넷 권열다섯 황열여섯 안열일곱 송열여덟 류열아홉 홍스물'.split(' ');
const SEED = {
  labels: {
    insp_ov_l1: { kind: 'event', name: '겹침점검', color: 'blue', parentId: null, order: 'Zz1' },
    insp_ov_l2: { kind: 'event', name: '아주 긴 라벨 이름 겹침점검용', color: 'green', parentId: null, order: 'Zz2' },
    insp_ov_n: { kind: 'note', name: '겹침상위', color: 'purple', parentId: null, order: 'Zz1' },
    insp_ov_nc: { kind: 'note', name: '겹침하위 긴 이름', color: 'orange', parentId: 'insp_ov_n', order: 'Zz2' },
  },
  timetables: { insp_ov_tt: { name: '겹침 시간표', from: `${YEAR - 1}-03-01`, to: `${YEAR + 1}-02-28`, grid: { '1': WEEK, '2': WEEK, '3': WEEK, '4': WEEK, '5': WEEK } } },
  items: {
    insp_ov_e1: { kind: 'event', date: DAY, text: '겹침 학부모 상담 준비', labelIds: ['insp_ov_l1'], order: 'Zz1', time: '14:00' },
    insp_ov_e2: { kind: 'event', date: DAY, text: '겹침 아주 긴 일정 제목이 한 줄을 넘어가도 칸 밖으로 나가지 않는지 보는 글입니다', labelIds: ['insp_ov_l2'], order: 'Zz2' },
    insp_ov_e3: { kind: 'event', date: DAY, text: '겹침 끝낸 일', labelIds: ['insp_ov_l1'], done: true, order: 'Zz3' },
    insp_ov_e4: { kind: 'event', date: '2026-10-13', endDate: '2026-10-16', text: '겹침 기간 일정 (현장 체험 학습)', labelIds: ['insp_ov_l2'], order: 'Zz4' },
    insp_ov_n1: { kind: 'note', date: DAY, text: '겹침 메모 하나\n둘째 줄\nhttps://www.youtube.com/watch?v=abc123', labelIds: ['insp_ov_n'], order: 'Zz1' },
    insp_ov_n2: { kind: 'note', date: DAY, text: '겹침 체크 목록\n☐ 하나\n☐ 아주 긴 할 일 줄이 칸 폭을 넘어가는지 보는 글\n☑ 둘', labelIds: ['insp_ov_nc'], order: 'Zz2' },
    insp_ov_n3: { kind: 'note', date: DAY, text: '겹침 긴 제목 메모 - 제목이 길어서 카드 폭을 넘어가는지 보는 아주 긴 한 줄', labelIds: ['insp_ov_n', 'insp_ov_nc'], order: 'Zz3' },
    insp_ov_m1: { kind: 'note', date: null, text: '겹침 날짜 없는 메모 하나', labelIds: [], order: 'Zz1' },
    insp_ov_m2: { kind: 'note', date: null, text: '겹침 날짜 없는 메모 둘\n여러 줄\n셋째 줄', labelIds: ['insp_ov_nc'], order: 'Zz2' },
  },
};
const students = NAMES.map((name, i) => ({ sid: `ov${i + 1}`, num: i + 1, name, status: i === 19 ? 'out' : 'active' }));

// ── 창 ──
const WINDOWS = [
  ['event-new', ['event', { sid, date: DAY }]],
  ['event-edit', ['event', { sid, date: DAY, id: 'insp_ov_e2' }]],
  ['note-view', ['note', { sid, date: DAY, id: 'insp_ov_n2' }]],
  ['note-edit', ['note', { sid, date: DAY, id: 'insp_ov_n2', edit: true }]],
  ['note-new', ['note', { sid, date: DAY }]],
  ['lesson', ['lesson', { sid, date: DAY, n: 2 }]],
  ['dayNotes', ['dayNotes', { sid, date: DAY }]],
  ['links', ['links', { sid, id: 'insp_ov_n1' }]],
  ['linker', ['linker', { sid, id: 'insp_ov_n1' }]],
  ['settings-view', ['settings', { tab: 'view' }]],
  ['settings-layout', ['settings', { tab: 'layout' }]],
  ['settings-app', ['settings', { tab: 'app' }]],
  ['settings-notify', ['settings', { tab: 'notify' }]],
  ['settings-school', ['settings', { tab: 'school' }]],
  ['settings-shortcuts', ['settings', { tab: 'shortcuts' }]],
  ['search', ['search']],
  ['labels-event', ['labels', { tab: 'event' }]],
  ['labels-note', ['labels', { tab: 'note' }]],
  ['timetable', ['timetable']],
  ['help', ['help']],
  ['backup', ['backup']],
  ['attendance', ['attendance', { date: DAY, classId: CLASS_ID }]],
  ['notices', ['notices', { sid, date: DAY }]],
  ['progress', ['progress']],
  ['evaluation', ['evaluation', { sid, date: DAY, at: 1 }]],
  ['evalOverview', ['evalOverview']],
  ['seating', ['seating', { classId: CLASS_ID }]],
  ['studentRecord', ['studentRecord', { classId: CLASS_ID, sid: 'ov1', at: 1 }]],
  ['chat', ['chat']],
  ['clipboard', ['clipboard']],
  ['trash', ['trash']],
  ['print', ['print', { date: DAY, scope: 'day' }]],
  ['newYear', ['newYear', { year: YEAR + 1 }]],
  ['group', ['group']],
  ['dday', ['dday']],
  ['weeklyGuide', ['weeklyGuide', { date: MONDAY }]],
  ['drafts', ['drafts']],
];
const FEW = ['event-new', 'note-edit', 'note-view', 'settings-view', 'settings-layout', 'timetable', 'attendance', 'search', 'labels-note'];

const SCREENS = [
  ['board', `#/board/${DAY}`],
  ['day', `#/day/${DAY}`],
  ['week', `#/week/${MONDAY}`],
  ['month', '#/month/2026-10'],
  ['year', `#/year/2026`],
  ['memo', '#/memo'],
  ['class', '#/class'],
];

const PC1400 = { width: 1400, height: 900 };
const PC1100 = { width: 1100, height: 800 };
const PC900 = { width: 900, height: 800 };
const PH390 = { width: 390, height: 844, mobile: true };
const PH360 = { width: 360, height: 780, mobile: true };
const PHLAND = { width: 844, height: 390, mobile: true };
const ALL_FONT = (p) => Object.fromEntries([...SCREENS.map(([s]) => s), 'popout'].map((s) => [s, p]));
/** 카드 열 (#206 - app/cardCols 이 기기 값) - 네 칸 모두 n열 */
const CARD_COLS = (n) => JSON.stringify({ state: { lessonCols: n, eventCols: n, journalCols: n, memoCols: n }, version: 0 });

/** 묶음 - 한 창(기기 설정 하나)에서 도는 상황들 */
const SETS = [
  { name: 'pc1400', dev: PC1400, screens: 'all', windows: 'all', hover: true, extra: ['multi', 'table', 'boardSplit'] },
  { name: 'pc1100', dev: PC1100, screens: 'all', windows: FEW, hover: true },
  { name: 'pc900', dev: PC900, screens: 'all', windows: 'all', hover: true },
  { name: 'pc1400-left', dev: PC1400, prefs: { sideAt: 'left' }, screens: ['day', 'week', 'board', 'memo'], windows: FEW },
  { name: 'pc900-left', dev: PC900, prefs: { sideAt: 'left' }, screens: ['day'], windows: FEW },
  { name: 'pc1400-font150', dev: PC1400, prefs: { fontSizes: ALL_FONT(150) }, screens: 'all', windows: FEW, hover: true },
  { name: 'pc900-font150', dev: PC900, prefs: { fontSizes: ALL_FONT(150) }, screens: 'all', windows: FEW },
  { name: 'pc1400-fold', dev: PC1400, local: { 'sp5-header-fold': JSON.stringify({ state: { folded: true }, version: 0 }) }, screens: 'all', windows: ['note-edit'] },
  { name: 'pc1400-dark', dev: PC1400, theme: 'dark', screens: 'all', windows: FEW },
  { name: 'pc1400-hc', dev: PC1400, local: { sp5_contrast: '1' }, screens: 'all', windows: ['note-edit', 'settings-view'] },
  { name: 'pc1400-popup', dev: PC1400, prefs: { popupStyle: 'popup' }, screens: [], windows: [], extra: ['popup'] },
  { name: 'pc1400-popout', dev: PC1400, screens: [], windows: [], extra: ['popout'] },
  { name: 'ph390', dev: PH390, screens: 'all', windows: 'all', extra: ['multi', 'table', 'sheet'] },
  { name: 'ph360', dev: PH360, screens: 'all', windows: 'all', extra: ['multi', 'table', 'sheet'] },
  { name: 'phLand', dev: PHLAND, screens: 'all', windows: FEW },
  { name: 'ph390-font130', dev: PH390, prefs: { fontSizes: ALL_FONT(130) }, screens: 'all', windows: FEW },
  { name: 'ph360-font130', dev: PH360, prefs: { fontSizes: ALL_FONT(130) }, screens: 'all', windows: FEW },
  { name: 'ph390-dark', dev: PH390, theme: 'dark', screens: 'all', windows: FEW },
  // 환경설정 화면 배치 (P59-1) - 휴대폰 선택지를 모두 바꾼 모습 + 칸 머리 ⇅를 누른 하루·메모 화면
  { name: 'ph360-p59', dev: PH360, prefs: { memoNavAt: 'top', orderArrows: 'toggle', cardTime: false }, local: { 'sp5-card-cols': CARD_COLS(1) }, screens: ['day', 'memo'], windows: ['settings-layout', 'note-view'], extra: ['reorderOn'] },
  // 카드 열 (#206 - 이 기기 값): 휴대폰 3열·PC 5열 - 좁은 카드에서 수업 첫 줄이 줄을 바꾸고 칩·단추가 겹치지 않나
  { name: 'ph360-cols3', dev: PH360, local: { 'sp5-card-cols': CARD_COLS(3) }, screens: ['day', 'memo'], windows: ['settings-layout'] },
  { name: 'pc1400-cols5', dev: PC1400, local: { 'sp5-card-cols': CARD_COLS(5) }, screens: ['day', 'board', 'memo'], windows: [], hover: true },
  // 화면 배치 달력 (P59-2) - 월요일부터·월간 화면 맞춤·주간 과목 칩·월간 '수업 n'
  { name: 'pc1400-p59', dev: PC1400, common: { weekStart: 1 }, prefs: { monthFit: true, weekLessons: 'chips', monthLessons: 'count' }, screens: ['month', 'week', 'board', 'year'], windows: ['settings-layout'] },
  { name: 'pc1400-p59cal', dev: PC1400, prefs: { monthFit: true }, screens: ['month'], windows: [] },
  { name: 'ph360-p59cal', dev: PH360, common: { weekStart: 1 }, prefs: { monthFit: true, weekLessons: 'chips', monthLessons: 'count' }, screens: ['month', 'week', 'year'], windows: [], extra: ['sheet'] },
  { name: 'ph390-p59', dev: PH390, prefs: { memoNavAt: 'top', orderArrows: 'toggle' }, screens: ['day', 'memo'], windows: [], extra: ['reorderOn'] },
];

/**
 * 자동 검사 짧은 묶음 (P57-3 - SUITE=ci): 다시 겹치지 않게 지킨다. 화면 일곱 × PC 1400(카드 올림·창 여덟)·휴대폰 360(창 여덟·여러 개 고르기·월간 그날 목록).
 * 넓은 상황 표(폭 1100·900·글자 150%·130%·왼쪽 칸·팝업창 …)는 손으로 - 화면 자리를 바꾸면 그 묶음을 SET_RE로 돌린다(CLAUDE.md 2장).
 */
const CI_SETS = [
  { name: 'pc1400', dev: PC1400, screens: 'all', windows: FEW, hover: true },
  { name: 'ph360', dev: PH360, screens: 'all', windows: FEW, extra: ['multi', 'sheet'] },
];
const RUN_SETS = SUITE === 'ci' ? CI_SETS : SETS;

// ── 결과 모으기 ──
const all = new Map(); // 종류|이름|상대 → { …, at: [상황] }
let situations = 0;
const KIND = { cover: '가림', overlap: '겹침', reach: '누르는 자리 겹침', small: '작은 누를 곳', spill: '글 넘침', cut: '잘린 글', wide: '가로 넘침' };
const fmt = (f) => `${KIND[f.kind]} ${f.name}${f.other ? ` ⨯ ${f.other}` : ''} (${f.detail})`;
const want = (name) => !ONLY || ONLY.test(name);

async function measure(page, name, dev) {
  situations++;
  await page.waitForTimeout(250);
  const res = await scanPage(page, dev);
  for (const f of res.found) {
    const k = `${f.kind}|${f.name}|${f.other}`;
    const a = all.get(k) ?? { ...f, at: [] };
    a.at.push(name);
    all.set(k, a);
  }
  r.check(
    res.found.length === 0,
    `${name}: 누를 것 ${res.count} - 걸린 것 없음`,
    `${name}: ${res.found.length}건 - ${res.found
      .slice(0, 5)
      .map(fmt)
      .join(' · ')}${res.found.length > 5 ? ' …' : ''}`,
  );
  if (SHOTS && (res.found.length || process.env.SHOTS_ALL)) await page.screenshot({ path: `${SHOTS}/${name.replace(/[/:]/g, '_')}.png` }).catch(() => {});
}

async function go(page, hash) {
  for (let i = 0; i < 3; i++) {
    await page.goto(page.url().replace(/#.*$/, hash));
    if (await waitFor(async () => new URL(page.url()).hash === hash, 3000)) return;
  }
}

const windowCount = (page) => page.locator('[data-window-key]').count();
async function closeAll(page) {
  await page.evaluate(() => window.sp5.closeAllWindows());
  await waitFor(async () => (await windowCount(page)) === 0 && !(await page.evaluate(() => history.state?.sp5Sign)), 5000);
}

/** 기기 설정 문서(계정 - settings/pc·mobile)에 상황 값을 넣는다 - 끝에 처음 것으로 */
const origSettings = {};
async function setDevicePrefs(kind, prefs) {
  const d = ref('settings', kind);
  if (!(kind in origSettings)) {
    const s = await getDoc(d);
    origSettings[kind] = s.exists() ? s.data() : null;
    undo.add(async () => (origSettings[kind] ? setDoc(d, origSettings[kind]) : deleteDoc(d)));
  }
  const base = origSettings[kind] ?? {};
  await setDoc(d, { ...base, popupStyle: 'side', sideAt: 'right', fontSizes: {}, ...prefs, v: 1, updatedAt: serverTimestamp() });
}

/** 계정 공통 문서(settings/common)에 상황 값을 넣는다 (P59-2 한 주의 시작) - 다음 묶음은 처음 것으로 돌아간다 */
async function setCommonPrefs(prefs) {
  const d = ref('settings', 'common');
  if (!('common' in origSettings)) {
    if (!Object.keys(prefs).length) return;
    const s = await getDoc(d);
    origSettings.common = s.exists() ? s.data() : null;
    undo.add(async () => (origSettings.common ? setDoc(d, origSettings.common) : deleteDoc(d)));
  }
  await setDoc(d, { ...(origSettings.common ?? {}), ...prefs, v: 1, updatedAt: serverTimestamp() });
}

async function runSet(browser, set) {
  const { dev } = set;
  const kind = dev.mobile ? 'mobile' : 'pc';
  await setDevicePrefs(kind, set.prefs ?? {});
  await setCommonPrefs(set.common ?? {});
  const { ctx, page, errors, dialogs } = await newPage(browser, {
    width: dev.width,
    height: dev.height,
    ...(dev.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  dialogs.answer = true; // 닫을 때 묻는 창은 '예' - 상황마다 칸을 모두 닫는다
  await page.addInitScript(
    ([theme, local]) => {
      try {
        localStorage.setItem('sp5_theme', theme);
        for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
      } catch {
        /* about:blank */
      }
    },
    [set.theme ?? 'light', set.local ?? {}],
  );
  await open(page, `#/day/${DAY}`);
  await waitFor(page.locator(sel('day-journal', DAY)), 10000);
  const layoutKeys = Object.entries(set.prefs ?? {});
  if (layoutKeys.length) {
    const ok = await waitFor(
      () =>
        page.evaluate(async (p) => {
          // 창 위치·글자 크기 = layoutPrefs · 화면 배치(P59-1) = screenPrefs
          const s = {
            ...(await import(window.__appModule('/src/app/layoutPrefs.ts'))).useLayoutPrefs.getState(),
            ...(await import(window.__appModule('/src/app/screenPrefs.ts'))).useScreenPrefs.getState(),
          };
          return p.every(([k, v]) => JSON.stringify(s[k]) === JSON.stringify(v));
        }, layoutKeys),
      15000,
    );
    r.check(ok, `${set.name}: 계정 설정이 섰다 (${layoutKeys.map(([k]) => k).join(', ')})`);
  }

  const screens = set.screens === 'all' ? SCREENS : SCREENS.filter(([s]) => set.screens.includes(s));
  for (const [screen, hash] of screens) {
    const name = `${set.name}/${screen}`;
    if (!want(name)) continue;
    await go(page, hash);
    await waitFor(page.locator(sel('screen', screen)), 8000);
    await page.waitForTimeout(1000);
    await measure(page, name, dev);
  }

  // 카드에 올리기 (PC - 올렸을 때만 서는 단추)
  if (set.hover) {
    for (const [screen, hash, cards] of [
      ['day', `#/day/${DAY}`, ['[data-lesson-card]', '[data-event-card="insp_ov_e2"]', '[data-event-card="insp_ov_e1"]', '[data-entry-card="insp_ov_n2"]', '[data-entry-card="insp_ov_n3"]']],
      ['board', `#/board/${DAY}`, ['[data-lesson-card]', '[data-event-card="insp_ov_e2"]', '[data-entry-card="insp_ov_n2"]']],
      ['memo', '#/memo', ['[data-entry-card="insp_ov_m2"]', '[data-entry-card="insp_ov_n3"]']],
      ['week', `#/week/${MONDAY}`, ['[data-week-event="insp_ov_e2"]', '[data-week-event="insp_ov_e4"]']],
    ]) {
      if (!cards.some((_, i) => want(`${set.name}/hover:${screen}${i + 1}`))) continue;
      await go(page, hash);
      await waitFor(page.locator(sel('screen', screen)), 8000);
      await page.waitForTimeout(1000);
      for (const [i, c] of cards.entries()) {
        const name = `${set.name}/hover:${screen}${i + 1}`;
        if (!want(name)) continue;
        const card = page.locator(c).first();
        if (!(await card.count())) {
          r.bad(`${name}: 카드 ${c}를 찾지 못했다`);
          continue;
        }
        await card.scrollIntoViewIfNeeded();
        await card.hover();
        await page.waitForTimeout(350);
        await measure(page, name, dev);
      }
      await page.mouse.move(1, dev.height - 2);
    }
  }

  // 창 - 하루 화면 위에
  const wins = set.windows === 'all' ? WINDOWS : WINDOWS.filter(([w]) => set.windows.includes(w));
  if (wins.some(([w]) => want(`${set.name}/win:${w}`))) {
    await go(page, `#/day/${DAY}`);
    await waitFor(page.locator(sel('screen', 'day')), 8000);
    for (const [w, args] of wins) {
      const name = `${set.name}/win:${w}`;
      if (!want(name)) continue;
      await page.evaluate((a) => void window.sp5.openWindow(...a), args);
      const opened = await waitFor(async () => (await windowCount(page)) > 0, 6000);
      if (!opened) {
        r.bad(`${name}: 창이 뜨지 않았다`);
        continue;
      }
      await page.waitForTimeout(1200); // 나눠 받는 창·사본
      await measure(page, name, dev);
      await closeAll(page);
    }
  }

  for (const x of set.extra ?? []) await EXTRA[x]?.(ctx, page, set);
  await page.waitForTimeout(300);
  r.check(errors.length === 0, `${set.name}: 화면 오류 없음 ${errors.join(' | ')}`);
  await ctx.close();
}

/** 따로 여는 상황 */
const EXTRA = {
  // 칸 머리 ⇅를 누른 모습 (P59-1 - 휴대폰 카드 ▲▼ '⇅ 누를 때만'): 하루 수업·일정·메모 칸 모두 켜고, 메모 화면 진행 칸
  async reorderOn(ctx, page, set) {
    for (const [screen, hash, names] of [
      ['day', `#/day/${DAY}`, ['lessons', 'events', 'journal']],
      ['memo', '#/memo', ['memo']],
    ]) {
      const name = `${set.name}/${screen}-reorder`;
      if (!want(name)) continue;
      await go(page, hash);
      for (const n of names) {
        const btn = page.locator(sel('reorder-toggle', n));
        if (!(await waitFor(btn, 8000))) return r.bad(`${name}: ⇅(${n})가 없다`);
        await btn.click();
      }
      const shown = await page.locator('[data-reorder-on] .order-arrows').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0).length);
      r.check(shown > 0, `${name}: 누른 칸에 ▲▼ ${shown}개`);
      await measure(page, name, set.dev);
      for (const n of names) await page.locator(sel('reorder-toggle', n)).click();
    }
  },
  // 여러 개 고르기 띠
  async multi(ctx, page, set) {
    const name = `${set.name}/multi-bar`;
    if (!want(name)) return;
    await go(page, `#/day/${DAY}`);
    await waitFor(page.locator(sel('event-card', 'insp_ov_e1')), 8000);
    await page.click(sel('more-menu'));
    await page.click(sel('menu-item', 'multiSelect'));
    if (!(await waitFor(page.locator(sel('multi-bar'))))) return r.bad(`${name}: 여러 개 고르기 띠가 뜨지 않았다`);
    await page.locator(sel('event-card', 'insp_ov_e1')).click();
    await page.locator(sel('event-card', 'insp_ov_e2')).click();
    await page.waitForTimeout(400);
    await measure(page, name, set.dev);
    await page.locator(sel('multi-end')).click();
  },
  // 메모 표 띠 (P49-2 - 칸을 고르면 제목 줄 자리에 겹쳐 뜬다)
  async table(ctx, page, set) {
    const name = `${set.name}/table-band`;
    if (!want(name)) return;
    await go(page, `#/day/${DAY}`);
    await page.evaluate((a) => void window.sp5.openWindow(...a), ['note', { sid, date: DAY }]);
    await waitFor(page.locator(sel('note-text-input')), 8000);
    await page.locator(sel('note-text-input')).fill('겹침 표 메모');
    await page.locator(sel('note-table-add')).click();
    const cell = page.locator(`${sel('note-table')} [data-cell="0-1"]`);
    if (!(await waitFor(cell))) return r.bad(`${name}: 표가 서지 않았다`);
    await cell.click();
    if (!(await waitFor(page.locator(sel('table-bar'))))) return r.bad(`${name}: 표 띠가 뜨지 않았다`);
    await page.waitForTimeout(300);
    await measure(page, name, set.dev);
    await page.keyboard.press('Escape').catch(() => {});
    await closeAll(page);
  },
  // 휴대폰 월간 그날 목록
  async sheet(ctx, page, set) {
    const name = `${set.name}/month-sheet`;
    if (!want(name)) return;
    await go(page, '#/month/2026-10');
    await waitFor(page.locator(sel('month-day', DAY)), 8000);
    await page.locator(sel('month-day', DAY)).click({ position: { x: 10, y: 10 } });
    if (!(await waitFor(page.locator(sel('month-day-sheet', DAY))))) return r.bad(`${name}: 그날 목록이 뜨지 않았다`);
    await page.waitForTimeout(400);
    await measure(page, name, set.dev);
    await page.locator(sel('sheet-close')).click().catch(() => {});
  },
  // 한눈에 경계선을 끝까지 끈 뒤 (이 기기 sp5-board - 5 ~ 95%)
  async boardSplit(ctx, page, set) {
    for (const [tag, v] of [
      ['narrowLeft', { main: 30, day: 20, memo: 30 }],
      ['wideLeft', { main: 85, day: 85, memo: 85 }],
    ]) {
      const name = `${set.name}/board-${tag}`;
      if (!want(name)) continue;
      await page.evaluate(async (s) => (await import(window.__appModule('/src/app/boardPrefs.ts'))).useBoardPrefs.setState(s), v);
      await go(page, `#/board/${DAY}`);
      await waitFor(page.locator(sel('screen', 'board')), 8000);
      await page.waitForTimeout(800);
      await measure(page, name, set.dev);
    }
    await page.evaluate(async () => (await import(window.__appModule('/src/app/boardPrefs.ts'))).useBoardPrefs.setState({ main: null, day: null, memo: null }));
  },
  // 창 위치 '팝업창' - 누르면 브라우저 새 창
  async popup(ctx, page, set) {
    for (const [tag, target, hash] of [
      ['note-new', sel('journal-add'), `#/day/${DAY}`],
      ['event-new', sel('event-add'), `#/day/${DAY}`],
      ['note-view', `${sel('entry-card', 'insp_ov_n3')} [data-entry-title]`, `#/day/${DAY}`], // 체크 줄·링크가 없는 메모 - 그 글을 누르면 체크·링크 열기가 된다
    ]) {
      const name = `${set.name}/popup:${tag}`;
      if (!want(name)) continue;
      await go(page, hash);
      await waitFor(page.locator(target).first(), 8000);
      const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }).catch(() => null), page.locator(target).first().click()]);
      if (!pop) {
        r.bad(`${name}: 팝업창이 뜨지 않았다`);
        continue;
      }
      await pop.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 }).catch(() => {});
      await pop.waitForTimeout(1500);
      const [w, h] = await pop.evaluate(() => [innerWidth, innerHeight]);
      await measure(pop, `${name}(${w}×${h})`, { width: w, height: h, mobile: false });
      await pop.close().catch(() => {});
    }
  },
  // ↗ 새 창 + 그 안의 오른쪽 분할 칸 (P43)
  async popout(ctx, page, set) {
    const name = `${set.name}/popout-split`;
    if (!want(name)) return;
    await go(page, `#/day/${DAY}`);
    await page.evaluate((a) => void window.sp5.openWindow(...a), ['note', { sid, date: DAY, id: 'insp_ov_n1', edit: true }]);
    const btn = page.locator(`#side-column ${sel('popout-open')}`);
    if (!(await waitFor(btn, 8000))) return r.bad(`${name}: ↗ 단추가 없다`);
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }).catch(() => null), btn.click()]);
    if (!pop) return r.bad(`${name}: 새 창이 뜨지 않았다`);
    await pop.locator(sel('note-panel', 'edit')).waitFor({ timeout: 20000 }).catch(() => {});
    await pop.waitForTimeout(800);
    let [w, h] = await pop.evaluate(() => [innerWidth, innerHeight]);
    await measure(pop, `${set.name}/popout(${w}×${h})`, { width: w, height: h, mobile: false });
    await pop.locator(sel('note-link-add')).click();
    await waitFor(pop.locator(`#side-column ${sel('linker')}`), 8000);
    await pop.waitForTimeout(800);
    [w, h] = await pop.evaluate(() => [innerWidth, innerHeight]);
    await measure(pop, `${name}(${w}×${h})`, { width: w, height: h, mobile: false });
    await pop.close().catch(() => {});
  },
};

try {
  for (const [coll, docs] of Object.entries(SEED)) {
    for (const [id, data] of Object.entries(docs)) {
      await setDoc(ref(coll, id), { ...data, ...stamp() });
      undo.add(() => deleteDoc(ref(coll, id)));
    }
  }
  // 앱이 심은 것에서 만든 것(저장된 시간표 '…-saved' 등)도 이름 머리로 걷는다
  undo.add(async () => {
    for (const c of ['items', 'labels', 'timetables']) for (const d of (await getDocs(collection(em.db, 'spaces', sid, c))).docs) if (d.id.startsWith('insp_ov_')) await deleteDoc(d.ref);
  });
  // 학급 - 학급 화면·출석부·자리표·학생 기록이 볼 것 (그 학년도 학급은 끝에 되돌린다)
  const beforeClasses = (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs.map((d) => [d.id, d.data()]);
  undo.add(async () => {
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs) await deleteDoc(d.ref);
    for (const [id, data] of beforeClasses) await setDoc(ref('classes', id), data);
  });
  await setDoc(ref('classes', CLASS_ID), { year: YEAR, grade: 5, num: 2, students, ...stamp() });

  const browser = await launch();
  try {
    for (const set of RUN_SETS) {
      if (SET_RE && !SET_RE.test(set.name)) continue;
      r.section(set.name);
      try {
        await runSet(browser, set);
      } catch (e) {
        r.bad(`${set.name}: 묶음이 멈췄다 ${e?.stack ?? e}`);
      }
    }
  } finally {
    await browser.close();
  }

  // ── 모아 보기 ──
  r.section(`모아 보기 - 상황 ${situations}개, 걸린 것 ${all.size}가지`);
  const list = [...all.values()].sort((a, b) => a.kind.localeCompare(b.kind) || b.at.length - a.at.length);
  // 같은 꼴(이름의 값만 다름 - 교시·날짜·id)끼리 묶어 한 줄: 몇 개·몇 상황·보기 하나
  const bare = (n) => n.replace(/=[^@⨯ ]*/g, '');
  const groups = new Map();
  for (const f of list) {
    const k = `${f.kind}|${bare(f.name)}|${bare(f.other)}`;
    const g = groups.get(k) ?? { ...f, n: 0, at: new Set() };
    g.n++;
    for (const a of f.at) g.at.add(a);
    groups.set(k, g);
  }
  const order = ['wide', 'cover', 'overlap', 'reach', 'cut', 'spill', 'small'];
  for (const g of [...groups.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.at.size - a.at.size)) {
    const at = [...g.at];
    console.log(`  · ${KIND[g.kind]} ${bare(g.name)}${g.other ? ` ⨯ ${bare(g.other)}` : ''} ×${g.n} (보기 ${g.name} ${g.detail}) - ${at.length}상황: ${at.slice(0, 5).join(', ')}${at.length > 5 ? ' …' : ''}`);
  }
  if (OUT) writeFileSync(OUT, JSON.stringify({ situations, found: list }, null, 1));
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  r.done();
  process.exit();
}
