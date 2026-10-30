// tools/inspect-month-year.mjs - P5-2: 월간·년간·오늘로를 실제 크롬에서 본다.
//   1) 월간: 한 주 한 줄, 하루짜리는 칸에, 기간은 막대(주마다 나뉘고 '1~2/5'·'3~5/5', 주말·공휴일 빼기), '달력'을 끈 일정은 없다,
//      라벨 칩 = 완료(문서 하나), 일정 = 오른쪽 일정 칸, 막대 조각 = 그날 일정 칸, 막대 라벨 칩 = 기간 전체 완료·풀기(10-30), + = 새 일정 칸, 📝 n = 그날 기록 창,
//      ✕ = 지운 표시 + 되돌리기, Ctrl = 여러 개 고르기, 주말 끄기 = 다섯 칸, 칸 빈 곳 = 하루 화면, 다음 달은 막대가 ◂로 이어진다.
//      (10월에는 고정 공휴일 개천절 3일·한글날 9일이 있다 - 자세히는 공휴일 날도 줄로 그린다)
//   2) 년간 학사력: 열두 달, 점(하루짜리)·가는 막대(기간), 달 아래 목록(기간은 처음 날 한 번 '~10.14'), 목록 = 일정 칸,
//      날짜 = 하루 화면, 달 이름 = 월간, 학기 칩 = 여섯 달씩.
//   3) 년간 자세히: 일정이 있는 날만, 기간은 처음 날 한 번 '(1~5/5)', 칩 = 완료(기간 줄 칩 = 기간 전체), 📝 n, + 일정, Ctrl로 기간 = 그 달의 날 모두 고르기,
//      고른 보기는 이 기기에 남는다(새로고침 뒤에도).
//   4) 오늘로: 다른 학년도에서 둘째 줄 날짜를 누르면 오늘의 학년도로 가서 오늘 칸이 화면 안에.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-month-year.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 항목(insp_my…)을 심고 끝에 지운다. 날짜는 2026-10(오늘 칸은 이 기기의 오늘).
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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
const academicYearOf = (d) => (Number(d.slice(5, 7)) >= 3 ? Number(d.slice(0, 4)) : Number(d.slice(0, 4)) - 1);
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const labelRef = (id) => doc(em.db, 'spaces', sid, 'labels', id);
const read = async (id) => {
  const s = await getDoc(itemRef(id));
  return s.exists() ? s.data() : null;
};
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid };
const ITEMS = {
  insp_my1: { kind: 'event', date: '2026-10-06', text: '점검달력 상담', labelIds: ['insp_myl'], order: 'Zz1' },
  // 목 10.15 ~ 수 10.21, 주말 빼기 = 5일 (15·16 / 19·20·21) - 공휴일이 끼지 않는 주 (10.9 한글날은 빠진다 - P5-3)
  //   라벨 + 첫날만 끝냄 - 막대의 라벨 칩 = 기간 전체 완료, 풀면 첫날 표시도 걷힌다 (10-30 사용자 보고)
  insp_my2: { kind: 'event', date: '2026-10-15', endDate: '2026-10-21', workdays: true, text: '점검달력 수학여행 준비', labelIds: ['insp_myl'], doneDates: ['2026-10-15'], order: 'Zz2' },
  // 10.29 ~ 11.3 = 6일 (다음 달로 이어진다)
  insp_my3: { kind: 'event', date: '2026-10-29', endDate: '2026-11-03', text: '점검달력 중간고사', labelIds: [], order: 'Zz3' },
  // 토 10.24 ~ 일 10.25, 주말 빼기 - 모두 쉬는 날이라 빼지 않는다 (P14-7 - 옛 셈은 0일이라 어디에도 보이지 않았다)
  insp_my6: { kind: 'event', date: '2026-10-24', endDate: '2026-10-25', workdays: true, text: '점검달력 주말 캠프', labelIds: [], order: 'Zz2' },
  insp_my4: { kind: 'event', date: '2026-10-07', text: '점검달력 숨김', labelIds: ['insp_myh'], order: 'Zz1' },
  insp_my5: { kind: 'note', date: '2026-10-15', text: '점검달력 기록', labelIds: [], order: 'Zz1' },
  insp_my9: { kind: 'event', date: '2026-10-21', text: '점검달력 지울 일정', labelIds: [], order: 'Zz1' },
};

try {
  await setDoc(labelRef('insp_myl'), { kind: 'event', name: '점검달력라벨', color: 'green', parentId: null, order: 'Zz1', ...stamp });
  await setDoc(labelRef('insp_myh'), { kind: 'event', name: '점검달력끔', color: 'red', parentId: null, order: 'Zz2', props: { calendar: false }, ...stamp });
  undo.add(() => deleteDoc(labelRef('insp_myl')));
  undo.add(() => deleteDoc(labelRef('insp_myh')));
  for (const [id, data] of Object.entries(ITEMS)) {
    await setDoc(itemRef(id), { ...data, ...stamp });
    undo.add(() => deleteDoc(itemRef(id)));
  }
  // 수업 칩 (P9-3): 이틀만 쓰는 시간표 - 월 10.12·화 10.13 (다른 날 줄은 그대로라 아래 '일정이 있는 날만' 점검을 건드리지 않는다)
  const ttRef = doc(em.db, 'spaces', sid, 'timetables', 'insp_my_tt');
  await setDoc(ttRef, { name: '점검달력 시간표', from: '2026-10-12', to: '2026-10-13', grid: { '1': { '1': '점검국어', '3': '점검수학' }, '2': { '2': 'X' } }, ...stamp });
  undo.add(() => deleteDoc(ttRef));

  const { page, errors } = await newPage(browser);
  await open(page, '#/month/2026-10');
  await page.evaluate(() => localStorage.removeItem('sp5-year-view'));
  await page.reload();
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  const cell = (d) => page.locator(sel('month-day', d));
  const bars = (id) => page.locator(sel('period-bar', id));

  r.section('월간');
  r.check(await waitFor(cell('2026-10-06').locator(sel('month-event', 'insp_my1')), 8000), '하루짜리 일정은 그날 칸에');
  r.check((await page.locator(sel('month-week')).count()) === 5, '2026년 10월 = 다섯 주 줄');
  r.check((await cell('2026-09-27').count()) === 1 && (await cell('2026-10-31').count()) === 1, '앞뒤 달 날도 칸으로 (9.27 ~ 10.31)');
  r.check(await waitFor(async () => (await bars('insp_my2').count()) === 2), '기간 막대는 주마다 나뉜다 (두 막대)');
  const barTexts = await bars('insp_my2').allTextContents();
  r.check(barTexts[0].includes('1~2/5') && barTexts[1].includes('3~5/5'), `막대마다 며칠째 (${barTexts.map((t) => t.match(/\d~\d\/\d/)?.[0]).join(', ')})`);
  r.check((await bars('insp_my2').first().locator(sel('period-cell')).count()) === 2, '주말을 빼고 (첫 막대 = 목·금 두 조각)');
  const campBars = await bars('insp_my6').allTextContents();
  // 월간 줄은 일요일부터라 토·일이 두 줄에 하나씩
  r.check(campBars.length === 2 && campBars[0].includes('1/2') && campBars[1].includes('2/2'), `주말 빼기 토~일 기간은 그대로 이틀 (${campBars.join(' | ')})`);
  r.check((await page.locator(sel('month-event', 'insp_my4')).count()) === 0, "'달력'을 끈 라벨의 일정은 올리지 않는다");
  r.check((await cell('2026-10-15').locator(sel('month-notes')).getAttribute('data-month-notes')) === '1', '📝 1 (그날 기록 수)');

  await cell('2026-10-06').locator(sel('month-event-chip', 'insp_my1')).click();
  r.check((await serverUntil(() => read('insp_my1'), (d) => d?.done === true))?.done === true, '라벨 칩 = 완료 (서버)');
  r.check(await waitFor(async () => (await page.locator(sel('month-event', 'insp_my1')).getAttribute('data-month-event-done')) === '1'), '완료로 보인다');
  await cell('2026-10-06').locator(sel('month-event-chip', 'insp_my1')).click();
  r.check((await serverUntil(() => read('insp_my1'), (d) => !d?.done))?.done !== true, '한 번 더 = 완료 풀기');

  // 일정 글을 누른다 - 줄 가운데는 라벨 칩(= 완료)일 수 있다(#123 ✓ 자리를 늘 잡아 칩이 넓어졌다)
  await page.locator(`${sel('month-event', 'insp_my1')} ${sel('month-event-text')}`).click();
  r.check(await waitFor(page.locator(sel('event-panel', 'edit'))), '일정 = 오른쪽 일정 칸');
  await page.keyboard.press('Escape');
  await bars('insp_my2').nth(1).locator(sel('period-cell', '2026-10-20')).click();
  r.check(await waitFor(page.locator(sel('event-panel', 'edit'))), '막대 조각 = 그 일정 칸');
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await page.locator(sel('event-panel')).count()) === 0), '일정 칸 닫힘');
  // 막대의 라벨 칩 = 기간 전체 완료 (10-30 사용자 보고 - 칩이 누르기를 아래 조각으로 흘려보내 일정 칸만 열렸다)
  r.check((await bars('insp_my2').first().locator('[data-period-cell-done="1"]').count()) === 1, '첫날만 끝낸 기간 = 그 조각에만 ✓');
  await bars('insp_my2').nth(1).locator(sel('period-bar-chip', 'insp_my2')).click();
  const whole = await serverUntil(() => read('insp_my2'), (d) => d?.done === true);
  r.check(whole?.done === true && !whole?.doneDates, `막대 칩 = 기간 전체 완료 (서버 done, 날마다 표시는 걷음 - ${JSON.stringify(whole?.doneDates ?? null)})`);
  r.check(
    await waitFor(async () => (await bars('insp_my2').evaluateAll((els) => els.map((e) => e.getAttribute('data-period-bar-done')))).join() === '1,1'),
    '두 주 막대 모두 완료로',
  );
  r.check((await page.locator(`${sel('period-bar-chip', 'insp_my2')}[data-event-done-chip="1"]`).count()) === 2 && (await bars('insp_my2').first().locator(sel('event-check')).count()) === 1, '칩에 ✓');
  r.check((await page.locator(sel('event-panel')).count()) === 0, '칩은 일정 칸을 열지 않는다');
  await bars('insp_my2').first().locator(sel('period-bar-chip', 'insp_my2')).click();
  const undone = await serverUntil(() => read('insp_my2'), (d) => !d?.done);
  r.check(undone?.done !== true && !undone?.doneDates, '한 번 더 = 기간 전체 풀기 (첫날 표시도 걷힘)');
  r.check(await waitFor(async () => (await page.locator('[data-period-bar="insp_my2"] [data-period-cell-done="1"]').count()) === 0), '풀면 조각 ✓도 없다');
  await cell('2026-10-14').hover();
  await cell('2026-10-14').locator(sel('month-add')).click();
  r.check(await waitFor(page.locator(sel('event-panel', 'new'))), '+ = 새 일정 칸');
  r.check((await page.locator(sel('event-date')).inputValue()) === '2026-10-14', '날짜는 그날');
  await page.keyboard.press('Escape');
  await cell('2026-10-15').locator(sel('month-notes')).click();
  r.check(await waitFor(page.locator(sel('day-notes', '2026-10-15'))), '📝 = 그날 기록 창');
  r.check(hashOf(page).startsWith('#/month'), '하루 화면으로 가지 않는다');
  await page.keyboard.press('Escape');

  const del = page.locator(sel('month-event', 'insp_my9'));
  await del.hover();
  await del.locator(sel('month-event-delete')).click();
  r.check(!!(await serverUntil(() => read('insp_my9'), (d) => !!d?.deletedAt))?.deletedAt, '✕ = 지운 표시');
  await page.locator(sel('toast')).filter({ hasText: '삭제' }).locator('[data-toast-action="되돌리기"]').click();
  r.check(!(await serverUntil(() => read('insp_my9'), (d) => !d?.deletedAt))?.deletedAt, '안내의 되돌리기 = 되살린다');

  await page.locator(`${sel('month-event', 'insp_my1')} ${sel('month-event-text')}`).click({ modifiers: ['Control'] });
  r.check(await waitFor(page.locator(sel('event-picked', '1'))), 'Ctrl = 여러 개 고르기');
  r.check(await waitFor(page.locator(sel('multi-bar'))), '고르기 줄이 뜬다');
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await page.locator(sel('multi-bar')).count()) === 0), 'ESC = 고르기 끝');

  await page.locator(sel('view-toggle', 'showWeekend')).click();
  r.check(await waitFor(async () => (await page.locator(sel('month-week')).first().locator(sel('month-day')).count()) === 5), '주말을 끄면 한 줄에 다섯');
  r.check((await bars('insp_my2').count()) === 2, '주말을 꺼도 막대는 그대로');
  await page.locator(sel('view-toggle', 'showWeekend')).click();
  await page.waitForTimeout(2500); // 계정 설정은 1초 뒤 올라간다
  await cell('2026-10-23').click({ position: { x: 30, y: 60 } });
  r.check(await waitFor(async () => hashOf(page) === '#/day/2026-10-23'), `칸 빈 곳 = 그날 하루 화면 (${hashOf(page)})`);
  await page.goto(page.url().replace(/#.*$/, '#/month/2026-11'));
  r.check(await waitFor(bars('insp_my3'), 8000), '다음 달에도 막대');
  r.check((await bars('insp_my3').textContent()).includes('◂') && (await bars('insp_my3').textContent()).includes('4~6/6'), '앞 달에서 이어진다 (◂ 4~6/6)');

  r.section('월간 - 수업 칩');
  await page.goto(page.url().replace(/#.*$/, '#/month/2026-10'));
  const lessonsOf = (d) => page.locator(sel('month-lessons', d));
  r.check(await waitFor(lessonsOf('2026-10-12'), 8000), '시간표가 있는 날 칸에 수업 칩 (PC)');
  r.check(
    (await lessonsOf('2026-10-12').locator(sel('month-lesson')).allTextContents()).join(',') === '점검국어,점검수학',
    `든 교시만 글자 (${(await lessonsOf('2026-10-12').locator(sel('month-lesson')).allTextContents()).join(',')})`,
  );
  r.check((await lessonsOf('2026-10-12').locator(':scope > div').count()) >= 3, '빈 교시도 자리를 둔다 (교시가 나란히)');
  r.check((await lessonsOf('2026-10-13').count()) === 0 && (await lessonsOf('2026-10-14').count()) === 0, "과목 'X'뿐인 날·시간표 밖의 날은 칩이 없다");
  await lessonsOf('2026-10-12').locator(sel('month-lesson', 3)).click();
  r.check(await waitFor(page.locator(sel('lesson-panel'))), '칩 = 그 교시 수업 칸');
  r.check(((await page.locator(sel('lesson-panel-subject')).inputValue().catch(() => '')) || '') === '점검수학', '3교시 수업 칸');
  await page.keyboard.press('Escape');
  await page.locator(sel('view-toggle', 'showClass')).click();
  r.check(await waitFor(async () => (await lessonsOf('2026-10-12').count()) === 0), "둘째 줄 '수업'을 끄면 칩이 사라진다");
  await page.locator(sel('view-toggle', 'showClass')).click();
  r.check(await waitFor(lessonsOf('2026-10-12')), '다시 켜면 돌아온다');
  await page.waitForTimeout(3000); // 계정 설정이 올라갈 때까지

  r.section('년간 - 학사력');
  await page.goto(page.url().replace(/#.*$/, '#/year/2026'));
  const sheet = (m) => page.locator(sel('sheet-month', m));
  r.check(await waitFor(sheet('2027-02'), 8000), '학사력이 기본 (열두 달을 나눠 그린다)');
  r.check((await page.locator(sel('sheet-month')).count()) === 12, '열두 달 (3월 ~ 이듬해 2월)');
  r.check((await page.locator(sel('year-view', 'sheet')).getAttribute('aria-pressed')) === 'true', '📅 학사력 눌림');
  r.check((await page.locator(sel('sheet-date', '2026-10-06')).getAttribute('data-sheet-dots')) === '1', '하루짜리 = 점');
  r.check((await sheet('2026-10').locator(sel('sheet-bar', 'insp_my2')).count()) === 2, '기간 = 가는 막대 (주마다)');
  r.check((await page.locator(sel('sheet-date', '2026-10-07')).getAttribute('data-sheet-dots')) === null, "'달력'을 끈 일정은 점도 없다");
  const periodItem = sheet('2026-10').locator(`${sel('sheet-item', 'period')}[data-sheet-item-id="insp_my2"]`);
  r.check((await periodItem.count()) === 1 && (await periodItem.textContent()).includes('~10.21'), '달 아래 목록: 기간은 처음 날 한 번 (~10.21)');
  r.check((await sheet('2026-10').locator(`${sel('sheet-item', 'period')}[data-sheet-item-id="insp_my3"]`).textContent()).includes('▸'), '다음 달로 이어지는 기간 ▸');
  r.check((await sheet('2026-11').locator(`${sel('sheet-item', 'period')}[data-sheet-item-id="insp_my3"]`).textContent()).includes('◂'), '앞 달에서 이어진 기간 ◂');
  r.check(((await page.locator(sel('sheet-date', '2026-10-19')).getAttribute('title')) ?? '').includes('📆 점검달력 수학여행 준비'), '날짜 풍선 글에 기간');
  await sheet('2026-10').locator(`${sel('sheet-item', 'event')}[data-sheet-item-id="insp_my1"]`).click();
  r.check(await waitFor(page.locator(sel('event-panel', 'edit'))), '목록 = 오른쪽 일정 칸');
  await page.keyboard.press('Escape');
  await page.locator(sel('sheet-date', '2026-10-20')).click();
  r.check(await waitFor(async () => hashOf(page) === '#/day/2026-10-20'), '날짜 = 그날 하루 화면');
  await page.goto(page.url().replace(/#.*$/, '#/year/2026'));
  await waitFor(sheet('2026-10'), 8000);
  await sheet('2026-10').locator(sel('sheet-month-name')).click();
  r.check(await waitFor(async () => hashOf(page) === '#/month/2026-10'), `달 이름 = 그 달 월간 (${hashOf(page)})`);
  await page.goto(page.url().replace(/#.*$/, '#/year/2026'));
  await waitFor(sheet('2026-10'), 8000);
  await page.locator(sel('semester', '1')).click();
  r.check(await waitFor(async () => (await page.locator(sel('sheet-month')).count()) === 6) && (await sheet('2026-03').count()) === 1 && (await sheet('2026-09').count()) === 0, '1학기 = 3~8월');
  await page.locator(sel('semester', '2')).click();
  r.check(await waitFor(async () => (await page.locator(sel('sheet-month')).count()) === 6) && (await sheet('2027-02').count()) === 1 && (await sheet('2026-08').count()) === 0, '2학기 = 9~2월');
  await page.locator(sel('semester', 'all')).click();
  r.check(await waitFor(async () => (await page.locator(sel('sheet-month')).count()) === 12), '전체 = 열두 달');
  await page.waitForTimeout(2500);

  r.section('년간 - 자세히');
  await page.locator(sel('year-view', 'detail')).click();
  const card = (m) => page.locator(sel('year-month', m));
  r.check(await waitFor(card('2027-02'), 8000), '📋 자세히 = 달 카드');
  const days = await card('2026-10').locator(sel('year-day')).evaluateAll((els) => els.map((e) => e.dataset.yearDay));
  r.check(['2026-10-06', '2026-10-15', '2026-10-21', '2026-10-29'].every((d) => days.includes(d)) && !days.includes('2026-10-07') && !days.includes('2026-10-16'), `일정이 있는 날·공휴일만 (${days.join(', ')})`);
  r.check(days.includes('2026-10-12') && (await card('2026-10').locator(`${sel('year-lessons', '2026-10-12')} ${sel('year-lesson')}`).count()) === 2, '수업이 있는 날도 줄로 서고 교시 칩 (일정이 없어도)');
  await card('2026-10').locator(sel('year-lessons', '2026-10-12')).locator(sel('year-lesson', 1)).click();
  r.check(await waitFor(page.locator(sel('lesson-panel'))), '칩 = 그 교시 수업 칸');
  await page.keyboard.press('Escape');
  r.check((await card('2026-10').locator(sel('year-period', 'insp_my2')).count()) === 1, '기간은 처음 날 한 번');
  r.check((await card('2026-10').locator(`${sel('year-period', 'insp_my2')} ${sel('year-period-range')}`).textContent()).includes('(1~5/5)'), '기간 범위 (1~5/5)');
  r.check((await card('2026-10').locator(`${sel('year-period', 'insp_my6')} ${sel('year-period-range')}`).textContent()).includes('(1~2/2)'), '주말 빼기 토~일 기간도 (1~2/2)');
  r.check((await card('2026-11').locator(`${sel('year-period', 'insp_my3')} ${sel('year-period-range')}`).textContent()).includes('◂'), '다음 달 카드에 ◂ 이어짐');
  await card('2026-10').locator(sel('year-event-chip', 'insp_my1')).click();
  r.check((await serverUntil(() => read('insp_my1'), (d) => d?.done === true))?.done === true, '칩 = 완료 (서버)');
  await card('2026-10').locator(sel('year-event-chip', 'insp_my1')).click();
  await serverUntil(() => read('insp_my1'), (d) => !d?.done);
  // 기간 줄의 라벨 칩 = 기간 전체 (10-30 - P10-1은 보기만이었다)
  await card('2026-10').locator(sel('year-period-chip', 'insp_my2')).click();
  r.check((await serverUntil(() => read('insp_my2'), (d) => d?.done === true))?.done === true, '기간 줄 칩 = 기간 전체 완료 (서버)');
  r.check(await waitFor(async () => (await card('2026-10').locator(sel('year-period', 'insp_my2')).getAttribute('data-year-period-done')) === '1'), '기간 줄 완료로');
  await card('2026-10').locator(sel('year-period-chip', 'insp_my2')).click();
  r.check((await serverUntil(() => read('insp_my2'), (d) => !d?.done))?.done !== true, '한 번 더 = 기간 전체 풀기');
  await card('2026-10').locator(sel('year-notes')).click();
  r.check(await waitFor(page.locator(sel('day-notes', '2026-10-15'))), '📝 1 = 그날 기록 창');
  await page.keyboard.press('Escape');
  await card('2026-10').locator(sel('year-add', '2026-10-21')).click();
  r.check(await waitFor(page.locator(sel('event-panel', 'new'))) && (await page.locator(sel('event-date')).inputValue()) === '2026-10-21', '+ 일정 = 그날 새 일정 칸');
  await page.keyboard.press('Escape');
  // 줄 가운데가 아니라 범위 글을 누른다 (칩 = 완료)
  await card('2026-10').locator(`${sel('year-period', 'insp_my2')} ${sel('year-period-range')}`).click({ modifiers: ['Control'] });
  r.check(await waitFor(async () => (await page.locator(sel('multi-bar')).getAttribute('data-multi-bar')) === '5'), 'Ctrl로 기간 = 그 달의 날 모두 (5)');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  r.check(await waitFor(card('2026-10'), 8000), '고른 보기는 이 기기에 남는다 (새로고침 뒤에도 자세히)');
  await page.locator(sel('year-view', 'sheet')).click();

  r.section('오늘로');
  await page.locator(sel('date-prev')).click();
  r.check(await waitFor(async () => hashOf(page) === '#/year/2025'), '◀ = 앞 학년도');
  await page.locator(sel('date-label')).click();
  const ay = academicYearOf(TODAY);
  r.check(await waitFor(async () => hashOf(page) === `#/year/${ay}`), `날짜 = 오늘의 학년도 (${ay})`);
  const todayCell = page.locator(`${sel('sheet-date', TODAY)}[data-today="true"]`);
  r.check(await waitFor(todayCell, 8000), `오늘 칸 표시 (${TODAY})`);
  r.check(
    await waitFor(async () => {
      const box = await todayCell.boundingBox();
      return !!box && box.y >= 0 && box.y + box.height <= 900;
    }, 5000),
    '오늘 칸이 화면 안에',
  );

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
