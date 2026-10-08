// tools/inspect-move-dday.mjs - P5-3: 끌어 옮기기·D-Day·공휴일을 실제 크롬에서 본다.
//   1) 끌어 옮기기: 주간(하루짜리 = 곧바로·되돌리기, 기간 = 범위 창 '이 날만' = 그날을 빼고 하루 일정), 월간(칸·막대 조각 → '통째로'),
//      년간 자세히(날 줄 → 날 줄), 반복(세 갈래 - '이 날부터' = 뒤 항목을 같은 날 수만큼), 손댄 일정 칸이 옮겨진 날짜를 따라간다.
//   2) D-Day: ⏳ → 관리 창, 추가 = 머리줄 이름·D-n, 계정 설정(settings/common.ddays), 하루 화면 다른 날 = 둘째 줄 그날 기준,
//      ★ 내리기·다시 세우기, 삭제 = 지운 표시 + 되돌리기.
//   3) 공휴일: 서버 holidays/2026(관리자로 심는다)·고정 공휴일 → 주간·월간·학사력 빨간 이름, 주말·공휴일 빼기 기간이 공휴일을 건너뛴다(빠지는 공휴일 이름).
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-move-dday.mjs
// 에뮬레이터 teacher 계정에 점검 항목(insp_mv…)을 심고 끝에 지운다. 계정 설정 common의 D-Day 칸·holidays/2026은 끝에 되돌린다.
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { emulator, emulatorAdmin, hashOf, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const admin = emulatorAdmin();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = ymd(new Date());
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const commonRef = doc(em.db, 'spaces', sid, 'settings', 'common');
const read = async (id) => {
  const s = await getDoc(itemRef(id));
  return s.exists() ? s.data() : null;
};
const startedAt = Date.now();
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: startedAt, authorId: uid };
const ITEMS = {
  insp_mv1: { kind: 'event', date: '2026-10-13', text: '점검옮기기 하루', labelIds: [], order: 'Zz1' },
  // 10/14(수) ~ 10/16(금) 주말 빼기 = 3일
  insp_mv2: { kind: 'event', date: '2026-10-14', endDate: '2026-10-16', workdays: true, text: '점검옮기기 기간', labelIds: [], order: 'Zz2' },
  insp_mv3: { kind: 'event', date: '2026-10-20', text: '점검옮기기 월간', labelIds: [], order: 'Zz1' },
  // 10/26(월) ~ 10/28(수)
  insp_mv4: { kind: 'event', date: '2026-10-26', endDate: '2026-10-28', text: '점검옮기기 월간 기간', labelIds: [], order: 'Zz2' },
  insp_mv5: { kind: 'event', date: '2026-11-10', text: '점검옮기기 년간', labelIds: [], order: 'Zz1' },
  insp_mv6: { kind: 'event', date: '2026-11-12', text: '점검옮기기 년간 자리', labelIds: [], order: 'Zz1' },
  // 반복 셋 (화요일마다)
  insp_mvs1: { kind: 'event', date: '2026-12-01', text: '점검옮기기 반복', labelIds: [], order: 'Zz1', seriesId: 'insp_mvS', seriesIndex: 0 },
  insp_mvs2: { kind: 'event', date: '2026-12-08', text: '점검옮기기 반복', labelIds: [], order: 'Zz1', seriesId: 'insp_mvS', seriesIndex: 1 },
  insp_mvs3: { kind: 'event', date: '2026-12-15', text: '점검옮기기 반복', labelIds: [], order: 'Zz1', seriesId: 'insp_mvS', seriesIndex: 2 },
  insp_mv7: { kind: 'event', date: '2026-12-02', text: '점검옮기기 칸 따라가기', labelIds: [], order: 'Zz2' },
  // 공휴일: 10/5(월) 추석 연휴 ~ 10/9(금) 한글날, 주말·공휴일 빼기 → 6·7·8 = 3일
  insp_mvh: { kind: 'event', date: '2026-10-05', endDate: '2026-10-09', workdays: true, text: '점검옮기기 공휴일 기간', labelIds: [], order: 'Zz3' },
};
const madeHere = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return snap.docs.filter((d) => (d.data().createdAt ?? 0) >= startedAt && String(d.data().text).includes('점검옮기기') && !d.id.startsWith('insp_'));
};

try {
  for (const [id, data] of Object.entries(ITEMS)) {
    await setDoc(itemRef(id), { ...data, ...stamp });
    undo.add(() => deleteDoc(itemRef(id)));
  }
  undo.add(async () => {
    for (const d of await madeHere()) await deleteDoc(d.ref);
  });
  const commonBefore = (await getDoc(commonRef)).data() ?? null;
  undo.add(async () => {
    if (!(await getDoc(commonRef)).exists()) return;
    await updateDoc(commonRef, {
      ddays: commonBefore?.ddays ?? deleteField(),
      ddayPick: commonBefore?.ddayPick ?? deleteField(),
    });
  });
  const holBefore = await admin.get('holidays/2026');
  await admin.set('holidays/2026', { year: 2026, days: { '2026-10-03': '개천절', '2026-10-05': '추석 연휴', '2026-10-09': '한글날' }, updatedAt: 1 });
  undo.add(() => (holBefore ? admin.set('holidays/2026', holBefore) : admin.remove('holidays/2026')));

  const { page, errors } = await newPage(browser);
  await open(page, '#/week/2026-10-12');
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  const toastUndo = (text) => page.locator(sel('toast')).filter({ hasText: text }).locator('[data-toast-action="되돌리기"]');
  const weekDay = (d) => page.locator(`${sel('week-this')} ${sel('week-day', d)}`);

  r.section('끌어 옮기기 - 주간');
  await waitFor(page.locator(sel('week-event', 'insp_mv1')), 8000);
  r.check((await page.locator(sel('week-event', 'insp_mv1')).getAttribute('draggable')) === 'true', '마우스 화면은 일정을 끌 수 있다');
  await page.locator(sel('week-event', 'insp_mv1')).dragTo(weekDay('2026-10-15'));
  r.check((await serverUntil(() => read('insp_mv1'), (d) => d?.date === '2026-10-15'))?.date === '2026-10-15', '하루짜리 = 놓은 날로 곧바로 (서버 date)');
  r.check(await waitFor(weekDay('2026-10-15').locator(sel('week-event', 'insp_mv1'))), '그 요일 카드에 보인다');
  await toastUndo('옮겼습니다').click();
  r.check((await serverUntil(() => read('insp_mv1'), (d) => d?.date === '2026-10-13'))?.date === '2026-10-13', '안내의 되돌리기 = 원래 날');
  await weekDay('2026-10-15').locator(sel('week-event', 'insp_mv2')).dragTo(weekDay('2026-10-12'));
  r.check(await waitFor(page.locator(sel('scope-window'))), '기간을 끌면 어디까지 묻는다');
  r.check((await page.locator(sel('scope-choice')).count()) === 2, "기간은 '이 날만'·'통째로' 둘");
  await page.locator(sel('scope-choice', 'only')).click();
  const split = await serverUntil(() => read('insp_mv2'), (d) => d?.skipDates?.includes('2026-10-15'));
  r.check(split?.skipDates?.includes('2026-10-15') && split.date === '2026-10-14', "이 날만 = 기간에서 그날을 뺀다");
  const made = await serverUntil(madeHere, (l) => l.length === 1);
  r.check(made.length === 1 && made[0].data().date === '2026-10-12' && made[0].data().text === '점검옮기기 기간', '그 날에 하루 일정으로');
  await toastUndo('옮겼습니다').click();
  r.check(!(await serverUntil(() => read('insp_mv2'), (d) => !d?.skipDates))?.skipDates, '되돌리기 = 기간 그대로');

  r.section('끌어 옮기기 - 월간');
  await page.goto(page.url().replace(/#.*$/, '#/month/2026-10'));
  const cell = (d) => page.locator(sel('month-day', d));
  await waitFor(page.locator(sel('month-event', 'insp_mv3')), 8000);
  await page.locator(sel('month-event', 'insp_mv3')).dragTo(cell('2026-10-22'));
  r.check((await serverUntil(() => read('insp_mv3'), (d) => d?.date === '2026-10-22'))?.date === '2026-10-22', '일정을 다른 칸으로');
  await page.locator(`${sel('period-bar', 'insp_mv4')} ${sel('period-cell', '2026-10-26')}`).dragTo(cell('2026-10-29'));
  await waitFor(page.locator(sel('scope-window')));
  r.check((await page.locator(sel('scope-choice', 'all')).textContent()).includes('3일 뒤로'), "막대 조각을 끌면 범위 창 ('3일 뒤로')");
  await page.locator(sel('scope-choice', 'all')).click();
  const shifted = await serverUntil(() => read('insp_mv4'), (d) => d?.date === '2026-10-29');
  r.check(shifted?.date === '2026-10-29' && shifted.endDate === '2026-10-31', `통째로 = 끝 날도 같은 날 수만큼 (${shifted?.date}~${shifted?.endDate})`);

  r.section('끌어 옮기기 - 년간 자세히');
  await page.goto(page.url().replace(/#.*$/, '#/year/2026'));
  await page.locator(sel('year-view', 'detail')).click();
  await waitFor(page.locator(sel('year-event', 'insp_mv5')), 8000);
  await page.locator(sel('year-event', 'insp_mv5')).dragTo(page.locator(sel('year-day', '2026-11-12')));
  r.check((await serverUntil(() => read('insp_mv5'), (d) => d?.date === '2026-11-12'))?.date === '2026-11-12', '날 줄에 놓으면 그 날로');
  await page.locator(sel('year-view', 'sheet')).click();

  r.section('끌어 옮기기 - 반복·쓰는 칸');
  await page.goto(page.url().replace(/#.*$/, '#/week/2026-11-30'));
  await waitFor(page.locator(sel('week-event', 'insp_mv7')), 8000);
  await page.locator(sel('week-event', 'insp_mvs1')).dragTo(weekDay('2026-12-03'));
  await waitFor(page.locator(sel('scope-window')));
  r.check((await page.locator(sel('scope-choice')).count()) === 3, '반복은 세 갈래');
  await page.locator(sel('scope-choice', 'after')).click();
  const s3 = await serverUntil(() => read('insp_mvs3'), (d) => d?.date === '2026-12-17');
  r.check(s3?.date === '2026-12-17' && (await read('insp_mvs2'))?.date === '2026-12-10', '이 날부터 = 뒤 항목도 같은 날 수만큼 (12.10·12.17)');
  await page.locator(sel('week-event', 'insp_mv7')).click();
  const panel = page.locator(sel('event-panel', 'edit'));
  await waitFor(panel);
  await page.locator(sel('event-text-input')).fill('점검옮기기 칸 따라가기 고침');
  await page.locator(sel('week-event', 'insp_mv7')).dragTo(weekDay('2026-12-04'));
  await serverUntil(() => read('insp_mv7'), (d) => d?.date === '2026-12-04');
  r.check(await waitFor(async () => (await page.locator(sel('event-date')).inputValue()) === '2026-12-04'), '손댄 일정 칸도 옮겨진 날짜를 따라간다');
  r.check((await page.locator(sel('event-text-input')).inputValue()).endsWith('고침'), '적던 글은 그대로');
  await page.locator(sel('event-save')).click();
  r.check((await serverUntil(() => read('insp_mv7'), (d) => d?.text?.endsWith('고침')))?.date === '2026-12-04', '저장해도 옛 날로 돌아가지 않는다');
  await page.keyboard.press('Escape');

  r.section('D-Day');
  await page.goto(page.url().replace(/#.*$/, `#/day/${TODAY}`));
  await page.locator(sel('header-dday')).click();
  r.check(await waitFor(page.locator(sel('dday-window'))), '⏳ = D-Day 관리 창');
  const target = ymd(new Date(Date.now() + 30 * 86400000));
  await page.locator(sel('dday-title')).fill('점검옮기기 수능');
  await page.locator(sel('dday-date')).fill(target);
  await page.locator(sel('dday-add')).click();
  r.check(await waitFor(page.locator(sel('header-dday-text'))), '처음 더한 것은 머리줄에');
  r.check((await page.locator(sel('header-dday-text')).textContent()) === 'D-30', `머리줄 남은 날 (${await page.locator(sel('header-dday-text')).textContent()})`);
  const server = await serverUntil(async () => (await getDoc(commonRef)).data(), (d) => d?.ddays?.some((x) => x.title === '점검옮기기 수능'));
  const added = server?.ddays?.find((x) => x.title === '점검옮기기 수능');
  r.check(!!added && server.ddayPick === added.id, '계정 설정에 (ddays·ddayPick)');
  await page.locator(sel('dday-pick', added.id)).click();
  r.check(await waitFor(async () => (await page.locator(sel('header-dday-text')).count()) === 0), '★ 누르기 = 머리줄에서 내린다');
  await page.locator(sel('dday-pick', added.id)).click();
  r.check(await waitFor(page.locator(sel('header-dday-text'))), '다시 누르기 = 다시 세운다');
  await page.keyboard.press('Escape');
  const other = ymd(new Date(Date.now() + 10 * 86400000));
  await page.goto(page.url().replace(/#.*$/, `#/day/${other}`));
  r.check(await waitFor(async () => (await page.locator(sel('date-dday')).textContent()) === 'D-20'), '하루 화면 다른 날 = 둘째 줄 그날 기준 (D-20)');
  await page.locator(sel('header-dday')).click();
  await page.locator(sel('dday-delete', added.id)).click();
  r.check(await waitFor(async () => (await page.locator(sel('dday-row', added.id)).count()) === 0), '삭제 = 목록에서 빠진다');
  const gone = await serverUntil(async () => (await getDoc(commonRef)).data(), (d) => d?.ddays?.find((x) => x.id === added.id)?.deletedAt);
  r.check(!!gone?.ddays?.find((x) => x.id === added.id)?.deletedAt && !gone.ddayPick, '서버: 지운 표시 (머리줄에서도 내림)');
  await toastUndo('D-Day를 삭제').click();
  r.check(await waitFor(page.locator(sel('dday-row', added.id))), '되돌리기 = 되살린다');
  r.check(await waitFor(page.locator(sel('header-dday-text'))), '머리줄에도 다시');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500); // 계정 설정은 1초 뒤 올라간다

  r.section('공휴일');
  await page.goto(page.url().replace(/#.*$/, '#/week/2026-10-05'));
  r.check(await waitFor(weekDay('2026-10-05').locator(sel('holiday-name', '추석 연휴')), 8000), '주간: 서버 표의 공휴일 이름');
  r.check((await weekDay('2026-10-09').locator(sel('holiday-name')).textContent()) === '한글날', '주간: 한글날');
  const counts = await page.locator(sel('week-event', 'insp_mvh')).count();
  r.check(counts === 3, `주말·공휴일 빼기 기간은 공휴일을 건너뛴다 (${counts}일 = 6·7·8)`);
  r.check((await weekDay('2026-10-07').locator(sel('week-event', 'insp_mvh')).textContent()).includes('(2/3)'), '(k/n)도 공휴일을 빼고 센다 (2/3)');
  await page.locator(sel('week-event', 'insp_mvh')).first().click();
  r.check(await waitFor(page.locator(sel('event-period-holidays'))), "일정 칸: '빠지는 공휴일'");
  r.check((await page.locator(sel('event-period-holidays')).textContent()).includes('추석 연휴'), '빠지는 공휴일 이름');
  await page.keyboard.press('Escape');
  await page.goto(page.url().replace(/#.*$/, '#/month/2026-10'));
  r.check(await waitFor(page.locator(`${sel('month-day', '2026-10-03')} ${sel('holiday-name', '개천절')}`), 8000), '월간: 공휴일 이름');
  await page.goto(page.url().replace(/#.*$/, '#/year/2026'));
  r.check(await waitFor(page.locator(`${sel('sheet-date', '2026-10-05')}[data-sheet-holiday="추석 연휴"]`), 8000), '학사력: 공휴일 칸');
  r.check((await page.locator(`${sel('sheet-month', '2026-10')} ${sel('sheet-item', 'holiday')}`).count()) === 3, '학사력 목록에 공휴일 셋');
  r.check(!!(await page.locator(sel('sheet-date', '2026-05-05')).getAttribute('data-sheet-holiday')), '표에 없는 달도 고정 공휴일 (어린이날)');
  r.check(hashOf(page) === '#/year/2026', '년간 그대로');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
