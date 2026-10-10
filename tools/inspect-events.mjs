// tools/inspect-events.mjs - P3-1: 하루 화면의 일정을 실제 크롬에서 본다 (끝 조건: 저장마다 서버 문서 하나만 바뀐다).
//   1) 하루 화면: 그날 일정 카드(라벨 칩·⏰·기한·🔗), 다른 날 일정은 없다.
//   2) ☐ 완료 = 그 일정 문서 하나(done) - 다른 일정의 updatedAt은 그대로. 라벨 칩 = 완료 풀기.
//   3) ▲ 순서 = 옮긴 일정의 order 하나.
//   4) + 추가 → 새 일정 칸(맨 위 라벨) → Ctrl+S = 새 문서 하나, 칸은 그 일정의 수정 칸이 되고 카드를 짚는다.
//   5) 고치기 = 그 문서의 바뀐 칸만. 날짜를 바꿔 '옮기고 저장' = date만, 안내의 되돌리기 = 원래 날짜.
//   6) 빠른 입력 칩(내일·15:00) 모두 넣기 → 그날·알림. 카드 ⏰ → 시각 바꾸기 = time만.
//   7) 🗑️ = 지운 표시(문서는 남는다) → 안내의 되돌리기. 칸의 삭제 → 칸이 닫힌다 → Ctrl+Z로 되돌리기. 완료도 Ctrl+Z.
//   8) 앱 안 알림: 1분 전 알림 → 가운데 ⏰ 창·소리, 서버에 alarmDone(그 문서 하나), 🔇·확인. ＋ 새로 → 새 일정 = 보는 날의 새 일정 칸.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-events.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 일정(insp_ev…)·라벨을 심고 끝에 지운다.
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const DAY = '2026-10-08';
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const labelRef = (id) => doc(em.db, 'spaces', sid, 'labels', id);
const read = async (id) => {
  const s = await getDoc(itemRef(id));
  return s.exists() ? s.data() : null;
};
/** 그날 일정 문서들의 updatedAt (어느 문서가 바뀌었나 보기) */
const stamps = async () => {
  const snap = await getDocs(query(collection(em.db, 'spaces', sid, 'items'), where('date', '==', DAY)));
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data().updatedAt?.toMillis() ?? 0]));
};
const changed = (a, b) => Object.keys({ ...a, ...b }).filter((id) => a[id] !== b[id]);
const startedAt = Date.now();
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: startedAt, authorId: uid };
/** 점검이 화면에서 만든 일정 (끝에 지운다) */
const madeHere = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return snap.docs.filter((d) => d.data().createdAt >= startedAt && String(d.data().text).includes('점검') && !d.id.startsWith('insp_'));
};
const EVENTS = {
  // carrying: 이월 라벨이라 DAY가 지나면 오늘로 따라온다 - ForwardMarks가 처음 한 번 쓰는 것이 '바뀐 문서'에 끼지 않게 미리 (P8-2 - 날이 바뀌어 깨졌다)
  insp_ev1: { text: '점검 일정 하나', labelIds: ['insp_el'], order: 'Zz1', time: '09:30', due: '2026-10-10', linkIds: ['x'], carrying: true },
  insp_ev2: { text: '점검 일정 둘', labelIds: [], order: 'Zz2' },
  insp_ev3: { text: '점검 일정 셋', labelIds: [], order: 'Zz3' },
  insp_ev9: { text: '점검 다른 날', labelIds: [], order: 'Zz1', date: '2026-10-09' },
};

try {
  await setDoc(labelRef('insp_el'), { kind: 'event', name: '점검이월', color: 'green', parentId: null, order: 'Zz1', props: { forward: true }, ...stamp });
  undo.add(() => deleteDoc(labelRef('insp_el')));
  for (const [id, data] of Object.entries(EVENTS)) {
    await setDoc(itemRef(id), { kind: 'event', date: DAY, ...data, ...stamp });
    undo.add(() => deleteDoc(itemRef(id)));
  }

  const { page, errors } = await newPage(browser);
  await open(page, `#/day/${DAY}`);
  const card = (id) => page.locator(sel('event-card', id));

  r.section('하루 화면 일정 칸');
  r.check(await waitFor(card('insp_ev3')), '심은 일정 카드가 보인다');
  r.check((await card('insp_ev9').count()) === 0, '다른 날 일정은 없다');
  r.check(await card('insp_ev1').locator(sel('event-chip', 'insp_el')).isVisible(), '라벨 칩');
  r.check((await card('insp_ev1').locator(sel('event-alarm')).textContent()).includes('09:30'), '⏰ 알림 시각');
  r.check((await card('insp_ev1').locator(sel('due-badge')).count()) === 1, '⏳ 기한');
  r.check((await card('insp_ev1').locator(sel('event-links')).textContent()).includes('1'), '🔗 링크 수');
  const ids = await page.locator(sel('event-card')).evaluateAll((els) => els.map((e) => e.dataset.eventCard));
  r.check(ids.indexOf('insp_ev1') < ids.indexOf('insp_ev2') && ids.indexOf('insp_ev2') < ids.indexOf('insp_ev3'), '차례대로');

  r.section('완료 = 문서 하나');
  let before = await stamps();
  await card('insp_ev2').locator(sel('event-complete')).click();
  r.check(await waitFor(async () => (await card('insp_ev2').getAttribute('data-event-done')) === '1', 2000), '☐ 누르면 곧바로 완료로 보인다');
  const done = await serverUntil(() => read('insp_ev2'), (d) => d?.done === true);
  r.check(done?.done === true && typeof done.doneAt === 'number', '서버: done·doneAt');
  let after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(JSON.stringify(changed(before, after)) === JSON.stringify(['insp_ev2']), `바뀐 문서는 그 일정 하나 (${changed(before, after).join(',')})`);
  before = after;
  await card('insp_ev1').locator(sel('event-chip', 'insp_el')).click();
  r.check((await serverUntil(() => read('insp_ev1'), (d) => d?.done === true))?.done === true, '라벨 칩 누르기 = 완료');
  await card('insp_ev1').locator(sel('event-chip', 'insp_el')).click();
  const undone = await serverUntil(() => read('insp_ev1'), (d) => d?.done === false);
  r.check(undone?.done === false && undone.doneAt === undefined, '한 번 더 = 완료 풀기 (doneAt 지움)');
  r.check((await page.locator(sel('toast')).count()) === 0, '완료에는 안내가 뜨지 않는다 (V4 그대로)');

  r.section('순서 = 문서 하나');
  before = await stamps();
  await card('insp_ev3').hover();
  await card('insp_ev3').locator(sel('event-up')).click();
  after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(changed(before, after).length === 1, `▲ 한 번 = 문서 하나의 order (${changed(before, after).join(',')})`);
  r.check(
    await waitFor(async () => {
      const now = await page.locator(sel('event-card')).evaluateAll((els) => els.map((e) => e.dataset.eventCard));
      return now.indexOf('insp_ev3') < now.indexOf('insp_ev2');
    }),
    '셋째가 둘째 위로',
  );

  r.section('새 일정 칸 → 저장 = 문서 하나 → 수정 칸');
  undo.add(async () => {
    for (const d of await madeHere()) await deleteDoc(d.ref);
  });
  const panel = page.locator(sel('event-panel'));
  await page.locator(sel('event-add')).click();
  r.check(await waitFor(panel), '+ 추가 → 오른쪽에 새 일정 칸');
  r.check((await panel.getAttribute('data-event-panel')) === 'new', '새 일정');
  r.check(await page.evaluate(() => document.activeElement?.hasAttribute('data-event-text-input')), '열면 커서가 내용 칸에');
  const pickedDefault = await panel.locator('[data-label-pick][aria-pressed="true"]').count();
  r.check(pickedDefault === 1, `맨 위 라벨을 골라 둔다 (${pickedDefault})`);
  before = await stamps();
  await page.keyboard.type('점검 새 일정');
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.getAttribute('data-event-panel')) === 'edit'), 'Ctrl+S → 그 일정의 수정 칸이 된다');
  const newId = await panel.getAttribute('data-event-id');
  after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(JSON.stringify(changed(before, after)) === JSON.stringify([newId]), `서버에 새 문서 하나 (${changed(before, after).join(',')})`);
  const made = await read(newId);
  r.check(made?.kind === 'event' && made.date === DAY && made.text === '점검 새 일정' && made.deletedAt === null, '새 문서 모양 (kind·date·text·deletedAt)');
  r.check(await waitFor(async () => ((await card(newId).getAttribute('class')) ?? '').includes('ring-primary')), '목록의 그 카드를 짚는다');
  r.check((await page.locator(sel('event-text-input')).inputValue()) === '점검 새 일정', '적은 것이 남는다');

  r.section('고치기 = 바뀐 칸만 / 날짜 옮기기 = date만');
  before = await stamps();
  await page.locator(sel('event-text-input')).fill('점검 새 일정 (고침)');
  await page.locator(sel('event-save')).click();
  const edited = await serverUntil(() => read(newId), (d) => d?.text === '점검 새 일정 (고침)');
  r.check(edited?.text === '점검 새 일정 (고침)', '서버: 글이 바뀐다');
  after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(JSON.stringify(changed(before, after)) === JSON.stringify([newId]), '바뀐 문서는 그 일정 하나');
  await page.locator(sel('event-date-next')).click();
  r.check(await waitFor(page.locator(sel('event-move-note'))), "'저장하면 … 로 옮깁니다' 줄");
  await page.locator(sel('event-save')).click();
  const moved = await serverUntil(() => read(newId), (d) => d?.date === '2026-10-09');
  r.check(moved?.date === '2026-10-09' && moved.text === '점검 새 일정 (고침)', '옮기고 저장 → date만 2026-10-09');
  r.check(await waitFor(async () => (await card(newId).count()) === 0), '그날 목록에서 빠진다');
  // 안내가 여럿 쌓여 있다(추가·저장·옮김) - 옮긴 안내의 되돌리기
  const undoBtn = page.locator(sel('toast')).filter({ hasText: '옮겼습니다' }).locator('[data-toast-action="되돌리기"]');
  r.check(await waitFor(undoBtn), '옮긴 안내에 되돌리기');
  await undoBtn.click();
  r.check((await serverUntil(() => read(newId), (d) => d?.date === DAY))?.date === DAY, '되돌리기 = 원래 날짜');
  r.check(await waitFor(card(newId)), '목록에 돌아온다');

  r.section('빠른 입력 · 카드 ⏰');
  await page.locator(sel('close')).first().click();
  await page.locator(sel('event-add')).click();
  await waitFor(panel);
  await page.locator(sel('event-text-input')).fill('점검 내일 15:00 회의');
  r.check(await waitFor(page.locator(sel('quick-chip', 'date'))), '날짜·시각 칩이 뜬다');
  await page.locator(sel('quick-chip', 'all')).click();
  r.check((await page.locator(sel('event-date')).inputValue()) === '2026-10-09', '모두 넣기 → 저장할 날짜가 내일');
  await page.locator(sel('event-save')).click();
  r.check(await waitFor(async () => (await panel.getAttribute('data-event-panel')) === 'edit'), '저장');
  const quickId = await panel.getAttribute('data-event-id');
  const quickDoc = await serverUntil(() => read(quickId), (d) => !!d);
  r.check(quickDoc?.date === '2026-10-09' && quickDoc.time === '15:00' && quickDoc.text === '점검 15:00 회의', `서버: 내일·15:00·'내일'은 글에서 뺐다 (${quickDoc?.text})`);
  await page.locator(sel('close')).first().click();
  before = await stamps();
  await card('insp_ev1').locator(sel('event-alarm')).click();
  await page.locator(sel('alarm-time')).fill('1010');
  await page.locator(sel('alarm-save')).click();
  r.check((await serverUntil(() => read('insp_ev1'), (d) => d?.time === '10:10'))?.time === '10:10', '카드 ⏰ → 시각 바꾸기 = 곧바로 저장');
  after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(JSON.stringify(changed(before, after)) === JSON.stringify(['insp_ev1']), '바뀐 문서는 그 일정 하나');

  r.section('지우기 = 지운 표시 · 되돌리기 · Ctrl+Z');
  before = await stamps();
  await card('insp_ev3').hover();
  await card('insp_ev3').locator(sel('event-delete')).click();
  r.check(await waitFor(async () => (await card('insp_ev3').count()) === 0), '🗑️ → 곧바로 목록에서 빠진다 (확인 창 없이)');
  const del = await serverUntil(() => read('insp_ev3'), (d) => !!d?.deletedAt);
  r.check(!!del?.deletedAt && del.text === '점검 일정 셋', '서버: 문서는 남고 지운 표시(deletedAt)');
  after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(JSON.stringify(changed(before, after)) === JSON.stringify(['insp_ev3']), '바뀐 문서는 그 일정 하나');
  await page.locator(sel('toast')).filter({ hasText: '삭제했습니다' }).locator('[data-toast-action="되돌리기"]').click();
  r.check((await serverUntil(() => read('insp_ev3'), (d) => d?.deletedAt === null))?.deletedAt === null, '안내의 되돌리기 → 지운 표시가 걷힌다');
  r.check(await waitFor(card('insp_ev3')), '목록에 돌아온다');

  await card('insp_ev2').click();
  r.check(await waitFor(async () => (await panel.getAttribute('data-event-id')) === 'insp_ev2'), '카드를 누르면 그 일정의 수정 칸');
  await page.locator(sel('event-delete')).last().click();
  r.check(await waitFor(async () => (await panel.count()) === 0), '칸의 삭제 → 칸이 닫힌다');
  r.check(!!(await serverUntil(() => read('insp_ev2'), (d) => !!d?.deletedAt))?.deletedAt, '서버: 지운 표시');
  await page.locator('body').click({ position: { x: 5, y: 600 } });
  await page.keyboard.press('Control+z');
  r.check((await serverUntil(() => read('insp_ev2'), (d) => d?.deletedAt === null))?.deletedAt === null, 'Ctrl+Z → 되살아난다');
  r.check(await waitFor(card('insp_ev2')), '목록에 돌아온다');

  await card('insp_ev1').locator(sel('event-complete')).click();
  await serverUntil(() => read('insp_ev1'), (d) => d?.done === true);
  await page.locator('body').click({ position: { x: 5, y: 600 } });
  await page.keyboard.press('Control+z');
  r.check((await serverUntil(() => read('insp_ev1'), (d) => d?.done === false))?.done === false, '완료도 Ctrl+Z로 되돌린다');

  r.section('앱 안 알림 · ＋ 새로');
  // 이 기기 시각으로 오늘·1분 전 (알림은 일정 날의 시각)
  const now = new Date(Date.now() - 60_000);
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  await setDoc(itemRef('insp_alarm'), { kind: 'event', date: today, text: '점검 알림', labelIds: [], order: 'Zz9', time: `${pad(now.getHours())}:${pad(now.getMinutes())}`, ...stamp });
  undo.add(() => deleteDoc(itemRef('insp_alarm')));
  await page.evaluate(() => {
    window.__spAlarmSoundCount = 0;
  });
  const popup = page.locator(sel('alarm-item', 'insp_alarm'));
  r.check(await waitFor(popup, 30000), '알림 시각이 지난 일정 → 가운데 ⏰ 알림 창 (20초 안)');
  r.check((await page.evaluate(() => window.__spAlarmSoundCount)) >= 1, '알림 소리');
  r.check((await serverUntil(() => read('insp_alarm'), (d) => d?.alarmDone === true))?.alarmDone === true, '서버: 그 일정에 alarmDone (다른 기기는 건너뛴다)');
  // 알림 창은 늘 깜빡이며 커졌다 작아진다(V4 그대로) - Playwright가 '멈춘 단추'를 기다리지 않게 force
  await page.locator(sel('alarm-mute')).click({ force: true });
  const muted = await page.evaluate(() => window.__spAlarmSoundCount);
  await page.waitForTimeout(3500);
  r.check((await page.evaluate(() => window.__spAlarmSoundCount)) === muted, '🔇 소리 끄기 → 더 울리지 않는다');
  await page.locator(sel('alarm-dismiss')).click({ force: true });
  r.check(await waitFor(async () => (await page.locator(sel('alarm-popup')).count()) === 0), '확인 → 창이 닫힌다');

  await page.locator(sel('new-menu')).click();
  await page.locator(sel('new', 'newEvent')).click();
  r.check(await waitFor(async () => (await panel.getAttribute('data-event-panel')) === 'new'), '＋ 새로 → 새 일정 → 새 일정 칸');
  r.check((await page.locator(sel('event-date')).inputValue()) === DAY, '보는 날의 일정');

  r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' / ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack || e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
