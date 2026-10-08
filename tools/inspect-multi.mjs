// tools/inspect-multi.mjs - P3-3: 여러 개 고르기를 실제 크롬에서 본다.
//   1) 시작: 카드 Ctrl+누르기 → 아래 동작 줄. 고르는 동안 누르기 = 고르기·풀기, Shift = 범위. 그냥 누르기는 수정 칸을 열지 않는다.
//   2) 완료 = 고른 문서만(한 묶음) → 안내의 되돌리기. 라벨 = 하나로. 옮기기 = 한 날로(기간은 고른 날만 - 그날을 빼고 하루 일정으로) → Ctrl+Z.
//      지우기 = 묻지 않고 지운 표시 → 되돌리기. 동작 뒤·✕·ESC로 끝난다. ⋮ '여러 개 고르기'로도 켠다.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-multi.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 일정(insp_m…)·라벨을 심고 끝에 지운다. 날짜는 2027-04(5일 월 ~ 9일 금).
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const DAY = '2027-04-06';
const TO = '2027-04-20';
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const labelRef = (id) => doc(em.db, 'spaces', sid, 'labels', id);
const read = async (id) => {
  const s = await getDoc(itemRef(id));
  return s.exists() ? s.data() : null;
};
const startedAt = Date.now();
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: startedAt, authorId: uid };
const ITEMS = {
  insp_m1: { text: '점검 고르기 하나', order: 'Zz1' },
  insp_m2: { text: '점검 고르기 둘', order: 'Zz2' },
  insp_m3: { text: '점검 고르기 셋', order: 'Zz3' },
  insp_m4: { text: '점검 고르기 넷', order: 'Zz4' },
  insp_mp: { text: '점검 고르기 기간', order: 'Zz5', date: '2027-04-05', endDate: '2027-04-09', workdays: true },
};
const stamps = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return Object.fromEntries(snap.docs.filter((d) => d.id.startsWith('insp_m')).map((d) => [d.id, d.data().updatedAt?.toMillis() ?? 0]));
};
const changed = (a, b) => Object.keys({ ...a, ...b }).filter((id) => a[id] !== b[id]);
/** 옮기기가 기간에서 떼어 만든 하루 일정 */
const copies = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return snap.docs.filter((d) => d.data().text === '점검 고르기 기간' && d.id !== 'insp_mp' && (d.data().createdAt ?? 0) >= startedAt);
};

try {
  await setDoc(labelRef('insp_ml'), { kind: 'event', name: '점검고르기', color: 'purple', parentId: null, order: 'Zz9', ...stamp });
  undo.add(() => deleteDoc(labelRef('insp_ml')));
  for (const [id, data] of Object.entries(ITEMS)) {
    await setDoc(itemRef(id), { kind: 'event', date: DAY, labelIds: [], ...data, ...stamp });
    undo.add(() => deleteDoc(itemRef(id)));
  }
  undo.add(async () => {
    for (const d of await copies()) await deleteDoc(d.ref);
  });

  const { page, errors } = await newPage(browser);
  await open(page, `#/day/${DAY}`);
  const card = (id) => page.locator(sel('event-card', id));
  const bar = page.locator(sel('multi-bar'));
  const picked = () => page.locator('[data-event-picked="1"]').evaluateAll((els) => els.map((e) => e.dataset.eventCard));
  await waitFor(card('insp_mp'), 8000);

  r.section('시작·고르기');
  r.check((await bar.count()) === 0, '처음에는 동작 줄이 없다');
  await card('insp_m1').click({ modifiers: ['Control'] });
  r.check(await waitFor(bar), 'Ctrl+누르기 → 아래 동작 줄');
  await card('insp_m2').click();
  await card('insp_m4').click({ modifiers: ['Shift'] });
  r.check(JSON.stringify(await picked()) === '["insp_m1","insp_m2","insp_m3","insp_m4"]', `누르기 = 더하기, Shift = 범위 (${await picked()})`);
  await card('insp_m3').click();
  r.check(JSON.stringify(await picked()) === '["insp_m1","insp_m2","insp_m4"]', '다시 누르면 풀린다');
  r.check((await bar.getAttribute('data-multi-bar')) === '3', '줄에 3');
  r.check((await page.locator(sel('event-panel')).count()) === 0, '고르는 동안 수정 칸은 열리지 않는다');

  r.section('완료 (한 묶음)');
  let before = await stamps();
  await page.locator(sel('multi-complete')).click();
  const done = await serverUntil(async () => Promise.all(['insp_m1', 'insp_m2', 'insp_m4'].map(read)), (l) => l.every((d) => d?.done));
  r.check(done.every((d) => d?.done === true), '고른 셋이 완료');
  let after = await stamps();
  r.check(JSON.stringify(changed(before, after).sort()) === '["insp_m1","insp_m2","insp_m4"]', `바뀐 문서는 고른 셋 (${changed(before, after).join(',')})`);
  r.check(await waitFor(async () => (await bar.count()) === 0), '동작 뒤 여러 개 고르기가 끝난다');
  await page.locator(sel('toast')).filter({ hasText: '완료로 표시했습니다' }).locator('[data-toast-action="되돌리기"]').click();
  const undone = await serverUntil(async () => Promise.all(['insp_m1', 'insp_m2', 'insp_m4'].map(read)), (l) => l.every((d) => !d?.done));
  r.check(undone.every((d) => !d?.done), '안내의 되돌리기 = 셋 모두 제자리');

  r.section('라벨');
  await card('insp_m1').click({ modifiers: ['Control'] });
  await page.locator(sel('multi-label-open')).click();
  await page.locator(sel('multi-label', 'insp_ml')).click();
  const relabeled = await serverUntil(() => read('insp_m1'), (d) => d?.labelIds?.[0] === 'insp_ml');
  r.check(JSON.stringify(relabeled?.labelIds) === '["insp_ml"]', '라벨을 하나로');

  r.section('옮기기 (기간은 고른 날만)');
  await card('insp_m3').click({ modifiers: ['Control'] });
  await card('insp_mp').click();
  await page.locator(sel('multi-move-open')).click();
  await page.fill(sel('multi-move-date'), TO);
  await page.locator(sel('multi-move-go')).click();
  const m3 = await serverUntil(() => read('insp_m3'), (d) => d?.date === TO);
  r.check(m3?.date === TO, '하루 일정은 그 날로');
  const mp = await serverUntil(() => read('insp_mp'), (d) => d?.skipDates?.length === 1);
  r.check(JSON.stringify(mp?.skipDates) === `["${DAY}"]` && mp.endDate === '2027-04-09', '기간은 고른 날만 빼고 그대로');
  const made = await serverUntil(copies, (l) => l.length === 1);
  r.check(made.length === 1 && made[0].data().date === TO && !made[0].data().endDate, '그 날에 하루 일정으로');
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('Control+z');
  const back3 = await serverUntil(() => read('insp_m3'), (d) => d?.date === DAY);
  const backP = await serverUntil(() => read('insp_mp'), (d) => !d?.skipDates);
  const goneCopy = await serverUntil(copies, (l) => l.every((d) => d.data().deletedAt));
  r.check(back3?.date === DAY && !backP?.skipDates && goneCopy.every((d) => d.data().deletedAt), 'Ctrl+Z = 모두 제자리 (떼어 낸 하루 일정은 지운 표시)');

  r.section('지우기 · ESC · ⋮');
  await card('insp_m4').click({ modifiers: ['Control'] });
  await page.locator(sel('multi-delete')).click();
  const del = await serverUntil(() => read('insp_m4'), (d) => !!d?.deletedAt);
  r.check(!!del?.deletedAt, '묻지 않고 지운 표시');
  await page.locator(sel('toast')).filter({ hasText: '삭제했습니다' }).locator('[data-toast-action="되돌리기"]').click();
  r.check(!(await serverUntil(() => read('insp_m4'), (d) => !d?.deletedAt))?.deletedAt, '되돌리기');
  await card('insp_m1').click({ modifiers: ['Control'] });
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await bar.count()) === 0 && (await picked()).length === 0), 'ESC = 끝 (고른 것도 풀린다)');
  await page.click(sel('more-menu'));
  await page.click(sel('menu-item', 'multiSelect'));
  r.check(await waitFor(bar), "⋮ '여러 개 고르기'로 켠다");
  await card('insp_m2').click();
  r.check(JSON.stringify(await picked()) === '["insp_m2"]', '켠 뒤에는 그냥 누르기 = 고르기');
  await page.locator(sel('multi-end')).click();
  r.check(await waitFor(async () => (await bar.count()) === 0), '✕ = 끝');
  await card('insp_m2').click();
  r.check(await waitFor(page.locator(sel('event-panel'))), '끝난 뒤 누르기 = 수정 칸');
  await page.keyboard.press('Escape');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
