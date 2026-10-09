// tools/inspect-neis.mjs - P6-3 ■3: 우리 학교(나이스) - 학교 찾기·급식·학사일정·D-Day로·일정으로 담기·방학 채우기를 실제 크롬에서 본다.
//   나이스(open.neis.go.kr)는 page.route로 흉내 낸다(키 없이 5건씩 - 기간을 나눠 받는지까지). 컨테이너는 나이스에 닿지 않는다.
//   1) 환경설정 '학교' 탭: 이름으로 찾기 → 고르기 = 계정 설정 common.school(학년 0), 학사일정 학년
//   2) 하루: 수업 칸 아래 🍚 급식(알레르기 번호)·📚 학사, 학년으로 거르기
//   3) 주간·월간·년간(학사력·자세히) 날짜 옆 청록색 이름 → 학사일정 창: ⏳ D-Day로(계정 설정 ddays)·📅 일정으로 담기(새 일정 칸에 이름)
//   4) 시간표 창 '학기·방학': 📚 학사일정으로 채우기 = 방학식 다음 날 ~ 개학식 전날 (저장은 💾)
//   5) 지우기 = 급식·학사일정이 사라진다
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-neis.mjs
// 에뮬레이터 teacher 계정의 계정 설정 common을 끝에 통째로 되돌린다.
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const browser = await launch();
const commonRef = doc(em.db, 'spaces', `u_${uid}`, 'settings', 'common');
const readCommon = async () => {
  const s = await getDoc(commonRef);
  return s.exists() ? s.data() : null;
};

// ── 나이스 흉내 ──
const ALL = { ONE_GRADE_EVENT_YN: 'Y', TW_GRADE_EVENT_YN: 'Y', THREE_GRADE_EVENT_YN: 'Y', FR_GRADE_EVENT_YN: 'Y', FIV_GRADE_EVENT_YN: 'Y', SIX_GRADE_EVENT_YN: 'Y' };
const ONLY3 = { ...ALL, ONE_GRADE_EVENT_YN: 'N', TW_GRADE_EVENT_YN: 'N', FR_GRADE_EVENT_YN: 'N', FIV_GRADE_EVENT_YN: 'N', SIX_GRADE_EVENT_YN: 'N' };
const sched = (ymd, name, extra = {}) => ({ AA_YMD: ymd, EVENT_NM: name, EVENT_CNTNT: '', SBTR_DD_SC_NM: '해당없음', ...ALL, ...extra });
const DATA = {
  schoolInfo: [
    { ATPT_OFCDC_SC_CODE: 'B10', ATPT_OFCDC_SC_NM: '서울특별시교육청', SD_SCHUL_CODE: '7091375', SCHUL_NM: '서울점검초등학교', SCHUL_KND_SC_NM: '초등학교', ORG_RDNMA: '서울특별시 강남구 점검로 1' },
    { ATPT_OFCDC_SC_CODE: 'B10', ATPT_OFCDC_SC_NM: '서울특별시교육청', SD_SCHUL_CODE: '7130001', SCHUL_NM: '점검중학교', SCHUL_KND_SC_NM: '중학교', ORG_RDNMA: '' },
  ],
  SchoolSchedule: [
    sched('20260724', '여름방학식'),
    sched('20260817', '2학기 개학식'),
    sched('20261009', '한글날', { SBTR_DD_SC_NM: '공휴일' }),
    sched('20261010', '토요휴업일'),
    sched('20261012', '점검 현장체험학습', { EVENT_CNTNT: '도시락' }),
    sched('20261014', '3학년 점검 수학여행', ONLY3),
    ...Array.from({ length: 6 }, (_, i) => sched(`202610${20 + i}`, `점검 행사 ${i + 1}`)),
    sched('20270108', '겨울방학식'),
    sched('20270202', '개학식'),
  ],
  mealServiceDietInfo: [{ MLSV_YMD: '20261012', MMEAL_SC_NM: '중식', DDISH_NM: '현미밥 <br/>점검된장국 (5.6)<br/>급식우유 (2)', CAL_INFO: '700.1 Kcal' }],
};
let neisCalls = 0;
async function fakeNeis(route) {
  neisCalls++;
  const url = new URL(route.request().url());
  const service = url.pathname.split('/').pop();
  const p = url.searchParams;
  const [fromP, toP, dateF] = service === 'SchoolSchedule' ? ['AA_FROM_YMD', 'AA_TO_YMD', 'AA_YMD'] : ['MLSV_FROM_YMD', 'MLSV_TO_YMD', 'MLSV_YMD'];
  const rows = (DATA[service] || []).filter((row) =>
    service === 'schoolInfo' ? row.SCHUL_NM.includes(p.get('SCHUL_NM') || '') : row[dateF] >= (p.get(fromP) || '') && row[dateF] <= (p.get(toP) || ''),
  );
  const body = rows.length
    ? { [service]: [{ head: [{ list_total_count: rows.length }, { RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' } }] }, { row: rows.slice(0, p.get('KEY') ? 1000 : 5) }] }
    : { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } };
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
}

try {
  const before = await readCommon();
  undo.add(async () => {
    if (before) await setDoc(commonRef, before);
    else await deleteDoc(commonRef);
  });
  const { school: _drop, ...rest } = before ?? {};
  void _drop;
  await setDoc(commonRef, { ...rest, ddays: (rest.ddays ?? []).filter((d) => !String(d.title).includes('점검')), updatedAt: Date.now() });

  const { page, errors, dialogs } = await newPage(browser);
  await page.route('https://open.neis.go.kr/hub/**', fakeNeis);

  r.section('우리 학교 고르기');
  await open(page, '#/day/2026-10-12');
  r.check(!(await page.locator(sel('day-meals')).count()), '학교를 고르기 전에는 급식 줄이 없다');
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'school' }));
  r.check(await waitFor(page.locator(sel('school-setting'))), "환경설정 '학교' 탭에 우리 학교");
  await page.locator(sel('school-query')).fill('점검');
  await page.keyboard.press('Enter');
  r.check(await waitFor(page.locator(sel('school-result')).first()), '이름으로 찾기 (Enter)');
  r.check((await page.locator(sel('school-result')).count()) === 2, '찾은 학교 둘');
  await page.locator(sel('school-result', '7091375')).click();
  const saved = await serverUntil(readCommon, (d) => d?.school?.schoolCode === '7091375');
  r.check(saved?.school?.officeCode === 'B10' && saved.school.name === '서울점검초등학교' && saved.school.grade === 0, '고르기 = 계정 설정 common.school (학년 0 = 전 학년)');
  r.check(await waitFor(page.locator(sel('school-name', '7091375'))), '고른 학교 이름');
  r.check((await page.locator(sel('school-grade')).count()) === 7, '초등학교 = 전 학년 + 1~6학년');

  r.section('하루 - 급식·학사');
  await page.keyboard.press('Escape');
  const meals = page.locator(sel('day-meals'));
  r.check(await waitFor(meals, 8000), '수업 칸 아래 🍚 급식');
  const mealText = (await meals.textContent()) ?? '';
  r.check(mealText.includes('중식') && mealText.includes('점검된장국') && mealText.includes('5.6'), `음식 이름 · 알레르기 번호 (${mealText})`);
  r.check((await page.locator(`${sel('day-meals')} sup`).first().getAttribute('title')) === '대두, 밀', '알레르기 번호에 이름');
  r.check(((await page.locator(sel('day-school-events')).textContent()) ?? '').includes('점검 현장체험학습'), '📚 학사 줄');
  await page.goto(page.url().replace(/#.*$/, '#/day/2026-10-09'));
  await waitFor(page.locator(sel('day-lessons', '2026-10-09')), 8000);
  await page.waitForTimeout(500);
  r.check(!(await page.locator(sel('day-school-events')).count()), '공휴일(한글날) 학사일정은 뺀다 - 공휴일 이름은 따로');
  await page.goto(page.url().replace(/#.*$/, '#/day/2026-10-14'));
  r.check(await waitFor(page.locator(sel('day-school-events')), 8000), '학년 행사도 전 학년이면 보인다');
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'school' }));
  await page.locator(sel('school-grade', 5)).click();
  await serverUntil(readCommon, (d) => d?.school?.grade === 5);
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => !(await page.locator(sel('day-school-events')).count()), 8000), '5학년을 고르면 3학년 행사는 빠진다');
  r.check(neisCalls > 3, `키 없이 5건씩 - 기간을 나눠 받는다 (${neisCalls}번)`);

  r.section('날짜 옆 학사일정 · 학사일정 창');
  await page.goto(page.url().replace(/#.*$/, '#/week/2026-10-12'));
  const nameIn = page.locator(sel('school-event', '2026-10-12')).first();
  r.check(await waitFor(nameIn, 8000), '주간 요일 카드에 청록색 이름');
  r.check(((await nameIn.textContent()) ?? '') === '점검 현장체험학습', '이름 그대로');
  await nameIn.click();
  const win = page.locator(sel('school-event-window', '2026-10-12'));
  r.check(await waitFor(win), '누르면 그날 학사일정 창');
  r.check(((await win.textContent()) ?? '').includes('도시락'), '내용도 보인다');
  r.check(page.url().includes('#/week/'), '날짜를 눌러도 하루 화면으로 가지 않는다');
  await win.locator(sel('school-event-dday')).click();
  const dd = await serverUntil(readCommon, (d) => (d?.ddays ?? []).some((x) => x.title === '점검 현장체험학습'));
  r.check((dd?.ddays ?? []).some((x) => x.title === '점검 현장체험학습' && x.date === '2026-10-12'), '⏳ D-Day로 = D-Day 목록에 (계정 설정 ddays)');
  r.check(await waitFor(async () => ((await win.locator(sel('school-event-dday')).textContent()) ?? '').includes('D-Day에 있음')), '✓ D-Day에 있음');
  await win.locator(sel('school-event-to-event')).click();
  const panel = page.locator(sel('event-panel', 'new'));
  r.check(await waitFor(panel), '📅 일정으로 담기 = 새 일정 칸');
  r.check((await panel.locator(sel('event-text-input')).inputValue()) === '점검 현장체험학습', '이름을 적어 둔 채');
  dialogs.answer = true;
  await page.keyboard.press('Escape');
  await waitFor(async () => !(await panel.count()));

  await page.goto(page.url().replace(/#.*$/, '#/month/2026-10'));
  r.check(await waitFor(page.locator(`${sel('month-day', '2026-10-12')} ${sel('school-event')}`), 8000), '월간 날짜 칸에도');
  await page.goto(page.url().replace(/#.*$/, '#/year/2026'));
  await page.locator(sel('year-view', 'sheet')).click();
  r.check(await waitFor(page.locator(`${sel('sheet-month', '2026-10')} [data-sheet-item="school"]`).first(), 8000), '년간 학사력에 🏫 줄');
  await page.locator(sel('year-view', 'detail')).click();
  r.check(await waitFor(page.locator(`${sel('year-day', '2026-10-12')} ${sel('school-event')}`), 8000), '년간 자세히 날짜 줄에도');

  r.section('📚 학사일정으로 채우기');
  await page.evaluate(() => window.sp5.openWindow('timetable', { tab: 'terms' }));
  r.check(await waitFor(page.locator(sel('terms-tab'))), '시간표 창 학기·방학 탭');
  await page.locator(sel('terms-this')).click().catch(() => {});
  const yearNow = await page.locator(sel('terms-year')).getAttribute('data-terms-year');
  if (yearNow !== '2026') {
    for (let i = 0; i < 3 && (await page.locator(sel('terms-year')).getAttribute('data-terms-year')) !== '2026'; i++) {
      await page.locator(Number(await page.locator(sel('terms-year')).getAttribute('data-terms-year')) > 2026 ? sel('terms-prev') : sel('terms-next')).click();
    }
  }
  await page.locator(sel('terms-fill')).click();
  r.check(await waitFor(page.locator(sel('terms-fill-note'))), '채웠다는 안내');
  const val = (k) => page.locator(`[data-terms="${k}"]`).inputValue();
  r.check((await val('summer-from')) === '2026-07-25' && (await val('summer-to')) === '2026-08-16', '여름 = 방학식 다음 날 ~ 개학식 전날');
  r.check((await val('winter-from')) === '2027-01-09' && (await val('winter-to')) === '2027-02-01', '겨울 = 방학식 다음 날 ~ 개학식 전날');
  r.check(await waitFor(page.locator(sel('timetable-dirty'))), '저장은 💾로 (아직 저장하지 않음)');
  dialogs.answer = true;
  await page.keyboard.press('Escape');
  await waitFor(async () => !(await page.locator(sel('terms-tab')).count()));

  r.section('지우기');
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'school' }));
  await page.locator(sel('school-clear')).click();
  const cleared = await serverUntil(readCommon, (d) => !d?.school);
  r.check(!cleared?.school, '지우기 = 계정 설정에서 빠진다');
  r.check(await waitFor(page.locator(sel('school-query'))), '다시 찾기 칸');
  await page.keyboard.press('Escape');
  await page.goto(page.url().replace(/#.*$/, '#/day/2026-10-12'));
  await waitFor(page.locator(sel('day-lessons', '2026-10-12')), 8000);
  await page.waitForTimeout(500);
  r.check(!(await page.locator(sel('day-meals')).count()), '학교가 없으면 급식·학사도 없다');
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
