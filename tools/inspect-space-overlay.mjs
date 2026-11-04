// tools/inspect-space-overlay.mjs - P17-2 일정 겹쳐 보기: 둘째 줄 공간 칩 Ctrl+누르기(휴대폰 길게 누르기)로 다른 공간 일정을 주 공간 것 뒤에.
//   계정 하나(teacher)가 그룹을 만들고 개인·그룹에 일정(그룹은 기간 하나 + 그룹에만 있는 라벨) → Ctrl 겹치기 →
//   하루(구분 줄·공간 색 배경·머리 수는 주 공간 것)·주간·월간(칸·막대)·년간(자세히·학사력)에 둘 다 · 그룹 일정 누르기 = 그 공간 칸(칸 머리 색 칩·'공유') ·
//   겹친 칩·겹친 일정은 공간 색 배경(11-02 사용자 - ✓·색 점 대신, 다크 모드에서도 어둡게) ·
//   완료 → 그 공간 문서 · 새 일정 = 주 공간 문서 · 겹친 것은 끌리지 않고 고르기에 들지 않음 · 다시 열어도 기억 · 그냥 누르기 = 끔 ·
//   휴대폰 390 길게 누르기·넘침 · 그룹이 없어지면 빠짐 · 끝에 심은 것 걷기.
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-space-overlay.mjs   (SHOT=<폴더>면 그림을 남긴다)
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const browser = await launch();
const DAY = '2027-10-05';
const NAME = '겹침점검 그룹';
const PERSONAL = `u_${uid}`;
const SHOT = process.env.SHOT;
const shot = async (page, name) => SHOT && (await page.screenshot({ path: `${SHOT}/${name}.png` }));

const myGroups = async () => (await getDocs(query(collection(em.db, 'spaces'), where(`members.${uid}`, 'in', ['owner', 'member'])))).docs.filter((d) => d.data().name === NAME);
const itemsOf = async (sid) => (await getDocs(collection(em.db, 'spaces', sid, 'items'))).docs.map((d) => ({ id: d.id, ...d.data() }));
const dropGroups = async () => {
  for (const g of await myGroups()) {
    for (const c of ['items', 'labels', 'people', 'settings']) for (const d of (await getDocs(collection(em.db, 'spaces', g.id, c))).docs) await deleteDoc(d.ref);
    if (g.data().inviteCode) await deleteDoc(doc(em.db, 'spaceInvites', g.data().inviteCode)).catch(() => {});
    await deleteDoc(g.ref);
  }
};
undo.add(async () => {
  await dropGroups();
  for (const it of await itemsOf(PERSONAL)) if (String(it.text).startsWith('겹침점검')) await deleteDoc(doc(em.db, 'spaces', PERSONAL, 'items', it.id));
});
const stamp = () => ({ deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid });
const light = (page) =>
  page.addInitScript(() => {
    try {
      localStorage.setItem('sp5_theme', 'light');
    } catch {
      /* about:blank (서비스 워커) */
    }
  });

/** 그 공간에 일정 하나 (쓰는 칸으로) */
async function addEvent(page, sid, text) {
  await page.evaluate(([s, d]) => window.sp5.openWindow('event', { sid: s, date: d }), [sid, DAY]);
  await page.locator(sel('event-panel', 'new')).locator(sel('event-text-input')).fill(text);
  await page.locator(sel('event-save')).click();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.sp5.closeAllWindows());
}
const go = (page, hash) => page.evaluate((h) => (location.hash = h), hash);
/** 실제로 칠해진 배경색 (공간 색 배경이 보통 것과 다른지) - 칩·카드의 transition을 끝낸 뒤 읽는다(도중 값은 흰색에 가깝다) */
const bgOf = (loc) =>
  loc.first().evaluate((el) => {
    for (const a of el.getAnimations()) a.finish();
    return getComputedStyle(el).backgroundColor;
  });
/** 어두운 색인가 (sRGB 밝기 - 다크 모드에서 공간 배경이 밝게 튀지 않는지) */
const isDark = (loc) =>
  loc.first().evaluate((el) => {
    for (const a of el.getAnimations()) a.finish();
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = getComputedStyle(el).backgroundColor;
    c.fillRect(0, 0, 1, 1);
    const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
  });

try {
  const A = await newPage(browser);
  A.dialogs.answer = true;
  await light(A.page);
  await open(A.page, `#/day/${DAY}`);

  r.section('준비');
  await A.page.locator(sel('account')).click();
  await A.page.locator(sel('account-groups')).click();
  await waitFor(A.page.locator(sel('groups-window')), 8000);
  await A.page.locator(sel('group-new-name')).fill(NAME);
  await A.page.locator(sel('group-create')).click();
  const gid = (await serverUntil(myGroups, (l) => l.length === 1, 10000))[0]?.id ?? '';
  await A.page.evaluate(() => window.sp5.closeAllWindows());
  r.check(gid.startsWith('g_'), `그룹 만듦 (${gid})`);
  await addEvent(A.page, gid, '겹침점검 그룹 일정');
  // 그룹에만 있는 라벨을 붙인 기간 일정 - 개인 트리에는 없는 라벨이 보이면 그 공간 트리로 그린 것
  await setDoc(doc(em.db, 'spaces', gid, 'labels', 'ov_glabel'), { kind: 'event', name: '겹침그룹라벨', color: 'purple', parentId: null, order: 'Zz9', ...stamp() });
  await setDoc(doc(em.db, 'spaces', gid, 'items', 'ov_period'), { kind: 'event', date: '2027-10-06', endDate: '2027-10-08', text: '겹침점검 그룹 기간', labelIds: ['ov_glabel'], order: 'Zz9', ...stamp() });
  await A.page.locator(sel('space-chip', PERSONAL)).click();
  await waitFor(A.page.locator(`${sel('space-chip', PERSONAL)}[aria-pressed="true"]`), 5000);
  await addEvent(A.page, PERSONAL, '겹침점검 개인 일정');
  const countBefore = await A.page.locator(sel('event-count')).getAttribute('data-event-count');

  r.section('칩 Ctrl+누르기');
  r.check((await A.page.locator(sel('overlay-group')).count()) === 0, '겹치기 전에는 구분 줄 없음');
  await A.page.locator(sel('space-chip', PERSONAL)).click({ modifiers: ['Control'] });
  r.check((await A.page.locator('[data-space-overlay]').count()) === 0, '주 공간 칩에는 Ctrl이 듣지 않는다');
  await A.page.locator(sel('space-chip', gid)).click({ modifiers: ['Control'] });
  r.check(await waitFor(A.page.locator(`${sel('space-chip', gid)}[data-space-overlay="1"]`), 5000), '그룹 칩 = 겹침');
  r.check((await A.page.locator(`${sel('space-chip', PERSONAL)}[aria-pressed="true"]`).count()) === 1, '주 공간은 개인 그대로 (aria-pressed)');
  const chipBg = await bgOf(A.page.locator(sel('space-chip', gid)));
  r.check(chipBg !== (await bgOf(A.page.locator(sel('space-chip-manage')))) && chipBg !== (await bgOf(A.page.locator(sel('space-chip', PERSONAL)))), `겹친 칩 = 공간 색 배경 (${chipBg} - 안 고른 칩·주 공간 칩과 다르다)`);
  r.check(((await A.page.locator(sel('space-chip', gid)).textContent()) ?? '') === `👥 ${NAME}`, '겹친 칩 글자는 그대로 (✓·점 없음)');
  r.check(((await A.page.locator(sel('space-overlay-hint')).textContent()) ?? '').includes('겹쳐 보기'), 'PC 흐린 글 (Ctrl+누르기 = 겹쳐 보기)');

  r.section('하루 화면');
  const group = A.page.locator(sel('overlay-group', gid));
  r.check(await waitFor(group, 5000), '구분 줄');
  r.check(((await group.locator(sel('overlay-name')).textContent()) ?? '').includes(NAME), '구분 줄에 그룹 이름');
  const card = A.page.locator(`[data-event-card][data-event-space="${gid}"]`).filter({ hasText: '겹침점검 그룹 일정' });
  r.check((await card.count()) === 1, '그룹 일정 카드');
  const mainCard = A.page.locator('[data-event-card]:not([data-event-space])').filter({ hasText: '겹침점검 개인 일정' });
  const cardBg = await bgOf(card);
  r.check(cardBg !== (await bgOf(mainCard)), `카드 = 공간 색 배경 (${cardBg} - 주 공간 카드와 다르다)`);
  r.check(cardBg === chipBg, '카드와 칩이 같은 공간 색');
  r.check((await bgOf(group.locator(sel('overlay-name')))) === chipBg, '구분 줄 이름도 같은 공간 색');
  r.check((await card.locator('[data-event-up], [data-event-delete]').count()) === 0 && (await card.getAttribute('draggable')) !== 'true', '▲▼·🗑️·끌기 없음');
  r.check((await A.page.locator(sel('event-count')).getAttribute('data-event-count')) === countBefore, `머리 수는 주 공간 것 그대로 (${countBefore})`);
  r.check((await A.page.locator('[data-event-card]:not([data-event-space])').filter({ hasText: '겹침점검 개인 일정' }).count()) === 1, '개인 일정도 그대로');
  const overflow = await A.page.evaluate(() => {
    const row = document.querySelector('[data-second-row]');
    return row ? row.scrollWidth - row.clientWidth : -1;
  });
  r.check(overflow === 0, `둘째 줄 넘침 0 (${overflow})`);
  await shot(A.page, 'overlay-day-1400');
  // 다크 모드 - 색 변수를 바꿔 끼우므로 공간 배경도 어두운 빛깔로
  await A.page.evaluate(() => document.documentElement.classList.add('dark'));
  r.check((await isDark(card)) && (await isDark(A.page.locator(sel('space-chip', gid)))), '다크 모드에서 공간 배경도 어둡다 (밝게 튀지 않는다)');
  await shot(A.page, 'overlay-day-1400-dark');
  await A.page.evaluate(() => document.documentElement.classList.remove('dark'));

  r.section('누르기·완료·새 일정');
  await card.locator(sel('event-text')).click({ modifiers: ['Control'] });
  const panel = A.page.locator(sel('event-panel', 'edit'));
  r.check(await waitFor(panel, 5000), 'Ctrl+누르기도 그 공간 수정 칸 (고르기 아님)');
  r.check((await A.page.locator(sel('multi-bar')).count()) === 0, '고르기 줄 없음');
  r.check((await A.page.locator(sel('event-panel-space', gid)).count()) === 1, '칸 머리 공간 색 칩');
  r.check(((await panel.textContent()) ?? '').includes('공유'), "칸 머리 '공유'");
  await A.page.waitForTimeout(300);
  r.check(((await card.getAttribute('class')) ?? '').includes('ring-primary'), '열린 칸의 겹친 일정을 짚는다');
  await A.page.evaluate(() => window.sp5.closeAllWindows());
  await card.locator(sel('event-chip')).first().click();
  const done = await serverUntil(async () => (await itemsOf(gid)).find((x) => x.text === '겹침점검 그룹 일정'), (x) => x?.done === true);
  r.check(done?.done === true, '라벨 칩 = 그 공간(그룹) 문서에 완료');
  await A.page.locator(sel('event-add')).click();
  r.check(await waitFor(A.page.locator(sel('event-panel-space', PERSONAL)), 5000), '+ 추가 칸 머리 = 주 공간 칩(🔒 개인)');
  await A.page.locator(sel('event-panel', 'new')).locator(sel('event-text-input')).fill('겹침점검 새 일정');
  await A.page.locator(sel('event-save')).click();
  const fresh = await serverUntil(async () => (await itemsOf(PERSONAL)).some((x) => x.text === '겹침점검 새 일정'), (x) => x);
  r.check(fresh && !(await itemsOf(gid)).some((x) => x.text === '겹침점검 새 일정'), '새 일정 = 주 공간(개인) 문서');
  await A.page.evaluate(() => window.sp5.closeAllWindows());

  r.section('주간');
  const gq = (s) => `${s}[data-event-space="${gid}"]`;
  await go(A.page, `#/week/${DAY}`);
  const wk = A.page.locator(`${sel('week-day', DAY)} ${gq('[data-week-event]')}`).filter({ hasText: '겹침점검 그룹 일정' });
  r.check(await waitFor(wk, 8000), '그날 카드에 그룹 일정');
  const wkMain = A.page.locator(`${sel('week-day', DAY)} [data-week-event]:not([data-event-space])`).first();
  r.check((await bgOf(wk)) !== (await bgOf(wkMain)) && (await wk.locator('[data-week-event-delete]').count()) === 0, '공간 색 배경 (주 공간 칩과 다르다) · ✕ 없음');
  r.check((await wk.getAttribute('draggable')) !== 'true', '끌리지 않는다');
  r.check((await A.page.locator(`${sel('week-day', DAY)} [data-week-count]`).getAttribute('data-week-count')) === '2', '요일 수는 주 공간 것만 (2)');
  const wp = A.page.locator(`${sel('week-day', '2027-10-07')} ${gq('[data-week-event]')}`).filter({ hasText: '겹침점검 그룹 기간' });
  r.check((await wp.count()) === 1 && ((await wp.textContent()) ?? '').includes('겹침그룹라벨'), '그룹 기간 일정도 그날 · 그 공간 라벨');
  await shot(A.page, 'overlay-week-1400');
  await wk.click();
  r.check(await waitFor(A.page.locator(sel('event-panel-space', gid)), 5000), '누르면 그 공간 칸');
  await A.page.evaluate(() => window.sp5.closeAllWindows());

  r.section('월간');
  await go(A.page, `#/month/${DAY.slice(0, 7)}`);
  const me = A.page.locator(`${sel('month-day', DAY)} ${gq('[data-month-event]')}`);
  r.check(await waitFor(me, 8000), '그날 칸에 그룹 일정');
  const meMain = A.page.locator(`${sel('month-day', DAY)} [data-month-event]:not([data-event-space])`).first();
  r.check((await bgOf(me)) !== (await bgOf(meMain)) && (await me.getAttribute('draggable')) !== 'true', '공간 색 배경 (주 공간 것과 다르다) · 끌리지 않는다');
  const bar = A.page.locator(gq('[data-period-bar]')).first();
  r.check((await bar.count()) === 1 && ((await bar.textContent()) ?? '').includes('겹침그룹라벨'), '그룹 기간 막대 · 그 공간 라벨');
  r.check((await bgOf(bar.locator(sel('period-cell')))) === cardBg, '막대 바탕 = 공간 색');
  r.check((await A.page.locator(`${sel('month-day', DAY)} [data-month-event]:not([data-event-space])`).filter({ hasText: '겹침점검 개인 일정' }).count()) === 1, '개인 일정도');
  await shot(A.page, 'overlay-month-1400');
  // 색약 배려(P20-2 ■2): 어느 공간인지가 배경색뿐이던 것에 모양
  await A.page.evaluate(() => document.documentElement.classList.add('cvd'));
  const beforeOf = (loc) => loc.first().evaluate((el) => getComputedStyle(el, '::before').content);
  r.check((await beforeOf(me)) === '"👥"', '색약 배려: 겹친 칩 앞에 👥');
  r.check((await beforeOf(bar.locator('.pointer-events-none'))) === '"👥"', '색약 배려: 겹친 막대 앞에 👥');
  r.check((await beforeOf(A.page.locator(`${sel('month-day', DAY)} [data-month-event]:not([data-event-space])`))) === 'none', '색약 배려: 주 공간 일정은 그대로');
  await shot(A.page, 'overlay-month-1400-cvd');
  await A.page.evaluate(() => document.documentElement.classList.remove('cvd'));
  await me.locator(sel('month-event-text')).click();
  r.check(await waitFor(A.page.locator(sel('event-panel-space', gid)), 5000), '누르면 그 공간 칸');
  await A.page.evaluate(() => window.sp5.closeAllWindows());

  r.section('년간');
  await go(A.page, `#/year/${DAY.slice(0, 4)}`);
  await A.page.locator(sel('year-view', 'detail')).click();
  r.check(await waitFor(A.page.locator(gq('[data-year-event]')).filter({ hasText: '겹침점검 그룹 일정' }), 8000), '자세히: 그룹 일정');
  r.check((await A.page.locator(gq('[data-year-period]')).count()) === 1, '자세히: 그룹 기간 줄');
  r.check((await A.page.locator(`${gq('[data-year-event]')} [data-year-event-delete]`).count()) === 0, '자세히: ✕ 없음');
  await A.page.locator(sel('year-view', 'sheet')).click();
  r.check(await waitFor(A.page.locator(gq('[data-sheet-item]')).first(), 8000), '학사력: 그룹 일정 줄');
  await shot(A.page, 'overlay-year-1400');
  await go(A.page, `#/day/${DAY}`);

  r.section('기억 · 그냥 누르기');
  await A.page.reload();
  await A.page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  r.check(await waitFor(A.page.locator(sel('overlay-group', gid)), 8000), '다시 열어도 겹친 그대로 (이 기기)');
  await A.page.locator(sel('space-chip', PERSONAL)).click();
  r.check(!(await waitFor(A.page.locator(sel('overlay-group', gid)), 1500)), '그냥 누르기 = 그 공간 하나 (겹쳐 보기 끔)');
  await A.page.locator(sel('space-chip', gid)).click({ modifiers: ['Control'] });
  await waitFor(A.page.locator(sel('overlay-group', gid)), 5000);

  r.section('휴대폰 390');
  const M = await newPage(browser, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await light(M.page);
  await open(M.page, `#/day/${DAY}`);
  const chip = M.page.locator(sel('space-chip', gid));
  await waitFor(chip, 8000);
  await chip.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 5, clientY: 5, isPrimary: true });
  await M.page.waitForTimeout(700);
  await chip.dispatchEvent('pointerup', { pointerType: 'touch' });
  await chip.dispatchEvent('click');
  r.check(await waitFor(M.page.locator(`${sel('space-chip', gid)}[data-space-overlay="1"]`), 3000), '길게 누르기 = 겹침 (손을 뗀 click은 넘긴다)');
  r.check((await M.page.locator(`${sel('space-chip', PERSONAL)}[aria-pressed="true"]`).count()) === 1, '주 공간은 그대로');
  r.check(await waitFor(M.page.locator(sel('overlay-group', gid)), 5000), '구분 줄');
  r.check(((await M.page.locator(sel('overlay-name')).textContent()) ?? '').length > 0, '구분 줄 글자 있음');
  const w = await M.page.evaluate(() => document.documentElement.scrollWidth);
  r.check(w <= 390, `하루 넘침 없음 (${w})`);
  await shot(M.page, 'overlay-day-390');
  await go(M.page, `#/month/${DAY.slice(0, 7)}`);
  await M.page.locator(sel('month-day', DAY)).click();
  r.check(await waitFor(M.page.locator(`${sel('month-day-sheet', DAY)} ${gq('[data-sheet-event]')}`), 5000), '월간 그날 목록에 그룹 일정');
  const mw = await M.page.evaluate(() => document.documentElement.scrollWidth);
  r.check(mw <= 390, `월간 넘침 없음 (${mw})`);
  await shot(M.page, 'overlay-month-390');
  r.check(M.errors.length === 0, `휴대폰 화면 오류 없음 ${M.errors.join(' / ')}`);
  await M.ctx.close();

  r.section('그룹이 없어지면');
  await dropGroups();
  r.check(await waitFor(async () => (await A.page.locator(sel('space-chip', gid)).count()) === 0, 10000), '그룹 칩이 사라진다');
  r.check((await A.page.locator(sel('overlay-group')).count()) === 0 && (await A.page.locator('[data-event-space]').count()) === 0, '겹친 일정도 빠진다');
  r.check(A.errors.length === 0, `화면 오류 없음 ${A.errors.join(' / ')}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
