// tools/inspect-week.mjs - P5-1: 주간 화면·작년 이맘때를 실제 크롬에서 본다.
//   1) 요일 카드 일곱(월~일, 토 파랑·일 빨강), 본문이 넓으면 다음 주 줄, 주말 끄기 = 다섯, 오른쪽 칸이 열려 좁아지면 다음 주는 빠진다.
//   2) 일정 칩: 기간 '(k/n)', 라벨 칩 = 완료(문서 하나·그날만), 글 = 오른쪽 일정 칸, ✕ = 지운 표시 + 되돌리기, + = 그날 새 일정 칸,
//      🔗 n = 연결된 데이터, 카드 빈 곳 = 그날 하루 화면, Ctrl = 여러 개 고르기. 오늘 카드에는 이월로 따라오는 일정(↪).
//   3) 📝 n = 그날 기록 창(하루 화면으로 가지 않는다) - '+ 추가' = 같은 기록 칸.
//   4) 🕰️ 작년 이맘때: 작년 학년도 같은 주 이름, 작년 같은 요일 항목, 올해 있는 것은 '올해 있음', 고르기·모두 고르기 →
//      📥 올해로 가져오기 = 그날 새 항목(글·라벨·표만 - 첨부·링크는 빼고) → 되돌리기, 켜 둔 것은 이 기기에 남는다.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-week.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 항목(insp_wk…)을 심고 끝에 지운다. 날짜는 2026-10 둘째 주(오늘 칸은 이 기기의 오늘).
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, hashOf, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = ymd(new Date());
const YESTERDAY = ymd(new Date(Date.now() - 86400000));
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const labelRef = (id) => doc(em.db, 'spaces', sid, 'labels', id);
const read = async (id) => {
  const s = await getDoc(itemRef(id));
  return s.exists() ? s.data() : null;
};
const startedAt = Date.now();
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: startedAt, authorId: uid };
const ITEMS = {
  insp_wk1: { kind: 'event', date: '2026-10-06', text: '점검주간 상담', labelIds: ['insp_wkl'], order: 'Zz1', linkIds: ['insp_wk3'] },
  insp_wk2: { kind: 'event', date: '2026-10-07', endDate: '2026-10-09', text: '점검주간 수학여행', labelIds: [], order: 'Zz2' },
  insp_wk3: { kind: 'note', date: '2026-10-07', text: '점검주간 상담 기록', labelIds: [], order: 'Zz1', linkIds: ['insp_wk1'] },
  insp_wk9: { kind: 'event', date: '2026-10-10', text: '점검주간 지울 일정', labelIds: [], order: 'Zz1' },
  // 작년 같은 주 (2025학년도) - 10.7(수) ↔ 2025.10.8(수)
  insp_wly1: { kind: 'event', date: '2025-10-08', text: '점검주간 작년 운동회', labelIds: ['insp_wkl'], order: 'Zz1', done: true, time: '09:00', linkIds: ['x'], props: { calendar: false } },
  insp_wly2: { kind: 'note', date: '2025-10-08', text: '점검주간 작년 기록', labelIds: [], order: 'Zz2', tables: [{ id: 't1', rows: [{ cells: [{ v: '가' }, { v: '나' }] }], createdAt: 1 }], attachments: [{ name: 'a.pdf', url: 'https://d/a', type: 'application/pdf' }] },
  insp_wly3: { kind: 'event', date: '2025-10-07', text: '점검주간 상담', labelIds: [], order: 'Zz1' },
  insp_wly4: { kind: 'note', date: '2025-10-07', text: '', labelIds: [], order: 'Zz1', attachments: [{ name: 'p.png', url: 'https://d/p', type: 'image/png' }] },
  // 이월: 어제 끝내지 않은 일정(이 일정만 이월 켬) → 오늘 카드에 ↪
  insp_wkf: { kind: 'event', date: YESTERDAY, text: '점검주간 이월 일정', labelIds: [], order: 'Zz1', props: { forward: true } },
};
const madeHere = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return snap.docs.filter((d) => (d.data().createdAt ?? 0) >= startedAt && String(d.data().text).includes('점검주간') && !d.id.startsWith('insp_'));
};

try {
  await setDoc(labelRef('insp_wkl'), { kind: 'event', name: '점검주간라벨', color: 'blue', parentId: null, order: 'Zz1', ...stamp });
  undo.add(() => deleteDoc(labelRef('insp_wkl')));
  for (const [id, data] of Object.entries(ITEMS)) {
    await setDoc(itemRef(id), { ...data, ...stamp });
    undo.add(() => deleteDoc(itemRef(id)));
  }
  undo.add(async () => {
    for (const d of await madeHere()) await deleteDoc(d.ref);
  });

  const { page, errors } = await newPage(browser);
  await open(page, '#/week/2026-10-08');
  await page.evaluate(() => localStorage.removeItem('sp5-last-year'));
  await page.reload();
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  const day = (d) => page.locator(`${sel('week-this')} ${sel('week-day', d)}`);
  const chip = (id) => page.locator(sel('week-event', id));

  r.section('요일 카드');
  r.check(await waitFor(day('2026-10-07'), 8000), '주간 화면');
  const days = await page.locator(`${sel('week-this')} ${sel('week-day')}`).evaluateAll((els) => els.map((e) => e.dataset.weekDay));
  r.check(days.join(',') === '2026-10-05,2026-10-06,2026-10-07,2026-10-08,2026-10-09,2026-10-10,2026-10-11', `월~일 일곱 (${days[0]}~${days[6]})`);
  const color = async (d) => day(d).locator(sel('week-day-label')).evaluate((e) => getComputedStyle(e).color);
  r.check((await color('2026-10-10')) !== (await color('2026-10-08')) && (await color('2026-10-11')) !== (await color('2026-10-10')), '토·일은 색이 다르다');
  r.check(await waitFor(page.locator(sel('week-next'))), '넓은 화면은 다음 주 줄');
  r.check((await chip('insp_wk2').count()) === 3 && (await day('2026-10-08').locator(sel('week-event', 'insp_wk2')).textContent()).includes('(2/3)'), '기간 일정은 날마다 (2/3)');
  r.check((await day('2026-10-07').locator(sel('week-notes')).getAttribute('data-week-notes')) === '1', '📝 1 (그날 기록 수)');

  r.section('일정 칩');
  await day('2026-10-06').locator(sel('week-event-chip', 'insp_wk1')).click();
  const done1 = await serverUntil(() => read('insp_wk1'), (d) => d?.done === true);
  r.check(done1?.done === true, '라벨 칩 = 완료 (서버)');
  r.check(await waitFor(async () => (await chip('insp_wk1').getAttribute('data-week-event-done')) === '1'), '완료로 보인다');
  await day('2026-10-08').locator(sel('week-event', 'insp_wk2')).click();
  const evPanel = page.locator(sel('event-panel', 'edit'));
  r.check(await waitFor(evPanel), '글 누르기 = 오른쪽 일정 칸');
  r.check(await waitFor(async () => (await page.locator(sel('week-next')).count()) === 0), '오른쪽 칸이 열려 좁아지면 다음 주는 빠진다');
  await page.keyboard.press('Escape');
  r.check(await waitFor(page.locator(sel('week-next'))), '닫으면 다음 주가 돌아온다');
  await chip('insp_wk1').locator(sel('week-event-links')).click();
  r.check(await waitFor(page.locator(sel('link-viewer', 'insp_wk1'))), '🔗 1 = 연결된 데이터');
  await page.keyboard.press('Escape');
  await chip('insp_wk9').hover();
  await chip('insp_wk9').locator(sel('week-event-delete')).click();
  r.check(!!(await serverUntil(() => read('insp_wk9'), (d) => !!d?.deletedAt))?.deletedAt, '✕ = 지운 표시');
  await page.locator(sel('toast')).filter({ hasText: '삭제' }).locator('[data-toast-action="되돌리기"]').click();
  r.check(!(await serverUntil(() => read('insp_wk9'), (d) => !d?.deletedAt))?.deletedAt, '안내의 되돌리기 = 되살린다');
  await day('2026-10-09').locator(sel('week-add')).click();
  const newPanel = page.locator(sel('event-panel', 'new'));
  r.check(await waitFor(newPanel), '+ = 그날 새 일정 칸');
  r.check((await page.locator(sel('event-date')).inputValue()) === '2026-10-09', '날짜는 그 요일');
  await page.keyboard.press('Escape');
  await chip('insp_wk2').first().click({ modifiers: ['Control'] });
  r.check((await page.locator(sel('event-picked', '1')).count()) >= 1, 'Ctrl = 여러 개 고르기');
  await page.keyboard.press('Escape');

  r.section('📝 그날 기록');
  await day('2026-10-07').locator(sel('week-notes')).click();
  const notesWin = page.locator(sel('day-notes', '2026-10-07'));
  r.check(await waitFor(notesWin), '📝 = 그날 기록 창');
  r.check(hashOf(page).startsWith('#/week'), '하루 화면으로 가지 않는다');
  r.check((await notesWin.locator(sel('entry-card', 'insp_wk3')).count()) === 1, '그날 기록 카드');
  await page.locator(sel('day-notes-add')).click();
  r.check(await waitFor(page.locator(sel('note-panel', 'new'))), '+ 추가 = 같은 기록 칸');
  await page.keyboard.press('Escape');

  r.section('주말 끄기·카드 = 하루 화면');
  await page.locator(sel('view-toggle', 'showWeekend')).click();
  r.check(await waitFor(async () => (await page.locator(`${sel('week-this')} ${sel('week-day')}`).count()) === 5), '주말을 끄면 다섯');
  await page.locator(sel('view-toggle', 'showWeekend')).click();
  await page.waitForTimeout(2500); // 계정 설정은 1초 뒤 올라간다
  // 머리줄 빈 곳 (가운데는 수업 줄이 받는다 - P6-1)
  await day('2026-10-05').click({ position: { x: 90, y: 20 } });
  r.check(await waitFor(async () => hashOf(page) === '#/day/2026-10-05'), `카드 빈 곳 = 그날 하루 화면 (${hashOf(page)})`);

  r.section('오늘 카드 - 이월');
  await page.goto(page.url().replace(/#.*$/, `#/week/${TODAY}`));
  const todayCard = page.locator(`${sel('week-this')} ${sel('week-day', TODAY)}`);
  r.check(await waitFor(todayCard, 8000), `오늘 카드 (${TODAY})`);
  r.check((await todayCard.getAttribute('data-today')) === 'true', '오늘 표시');
  r.check(await waitFor(todayCard.locator(`${sel('week-event', 'insp_wkf')}[data-week-carried="1"]`)), '어제 일정이 오늘 카드에 ↪ (이월)');

  r.section('🕰️ 작년 이맘때');
  await page.goto(page.url().replace(/#.*$/, '#/week/2026-10-08'));
  await waitFor(day('2026-10-07'), 8000);
  await page.locator(sel('last-year-toggle')).click();
  const label = page.locator(sel('last-year-label'));
  r.check(await waitFor(label), '작년 같은 주 이름');
  r.check((await label.textContent()).includes('2025학년도') && (await label.textContent()).includes('2025.10.6'), `학년도 몇째 주 (${(await label.textContent()).trim()})`);
  const ly = (d) => day(d).locator(sel('last-year'));
  r.check((await ly('2026-10-07').getAttribute('data-last-year')) === '2025-10-08', '수 10.7 ↔ 작년 수 10.8');
  r.check((await ly('2026-10-06').locator('[data-already]').count()) === 1, "올해 같은 글은 '올해 있음' (고를 수 없다)");
  r.check((await ly('2026-10-06').locator('[data-last-year-item="note"] input').count()) === 0, '첨부만 있는 기록은 고를 수 없다');
  await ly('2026-10-07').locator('[data-last-year-id="insp_wly1"] input').check();
  r.check((await page.locator(sel('last-year-picks')).getAttribute('data-last-year-picks')) === '1', '1개 고름');
  await page.locator(sel('last-year-unpick')).click();
  await page.locator(sel('last-year-pick-all')).click();
  r.check((await page.locator(sel('last-year-picks')).getAttribute('data-last-year-picks')) === '2', '모두 고르기 = 고를 수 있는 것 둘');
  await page.locator(sel('last-year-import')).click();
  const made = await serverUntil(madeHere, (l) => l.length === 2);
  const ev = made.map((d) => d.data()).find((d) => d.kind === 'event');
  const nt = made.map((d) => d.data()).find((d) => d.kind === 'note');
  r.check(made.length === 2, `서버: 새 항목 둘 (${made.length})`);
  r.check(ev?.date === '2026-10-07' && ev.labelIds?.[0] === 'insp_wkl' && !ev.done && !ev.time && !ev.linkIds && ev.props?.calendar === false, '일정 = 글·라벨·속성만 (완료·알림·링크 빼고)');
  r.check(nt?.date === '2026-10-07' && nt.tables?.length === 1 && !nt.attachments, '기록 = 글·표만 (첨부 빼고)');
  r.check(await waitFor(async () => (await ly('2026-10-07').locator('[data-already]').count()) === 2), "가져온 뒤에는 '올해 있음'");
  await page.locator(sel('toast')).filter({ hasText: '올해로 가져왔습니다' }).locator('[data-toast-action="되돌리기"]').click();
  r.check(await waitFor(async () => (await madeHere()).every((d) => d.data().deletedAt), 8000), '안내의 되돌리기 = 가져온 것만 지운 표시');
  await page.reload();
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  r.check(await waitFor(page.locator(sel('last-year-label')), 8000), '켜 둔 것은 이 기기에 남는다 (새로고침 뒤에도)');
  await page.locator(sel('last-year-toggle')).click();
  r.check(await waitFor(async () => (await page.locator(sel('last-year')).count()) === 0), '끄면 작년 칸이 사라진다');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
