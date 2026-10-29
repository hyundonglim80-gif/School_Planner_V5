// tools/inspect-dev-holidays.mjs - P14-3 공휴일 받기(환경설정 '개발자' 탭)를 크롬으로 본다.
//   1) 개발자 계정(?as=5) 개발자 탭 '공휴일'에 키(admin/config)와 올해·내년·내후년 줄이 보인다.
//   2) [받기] → 특일정보(가짜 - page.route) 열두 달을 받아 holidays/{연도}에 V4와 같은 모양으로 쓰고, 줄과 이 기기 표가 바뀐다.
//   3) 다시 받은 것이 더 적으면 묻고, 아니오면 서버를 덮지 않는다.
//   4) 년간 화면: 올해(9월부터 내년도) 표가 없으면 개발자에게만 '⚠️ …년 공휴일 표가 없습니다' - 누르면 개발자 탭, 받으면 사라진다(■3).
//
//   npm run emu · npm run seed(개발자 계정 ?as=5) · npm run dev:emu (켜 둔다) → node tools/inspect-dev-holidays.mjs
// ⚠️ 에뮬레이터만. 내후년·경고할 해의 표와 admin/config는 끝에 처음대로 되돌린다.
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
await em.signIn('hyundonglim80@gmail.com');
const undo = restorer();

const now = new Date();
const YEAR = now.getFullYear() + 2;
// 년간 경고를 볼 해 = domain/holidays holidayYearsToWarn의 마지막
const WARN_YEAR = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
const keep = async (path) => {
  const ref = doc(em.db, ...path.split('/'));
  const snap = await getDoc(ref);
  const old = snap.exists() ? snap.data() : null;
  undo.add(() => (old ? setDoc(ref, old) : deleteDoc(ref)));
  return ref;
};
const cfgRef = await keep('admin/config');
const yearRef = await keep(`holidays/${YEAR}`);
const warnRef = await keep(`holidays/${WARN_YEAR}`);
await setDoc(cfgRef, { govApiKey: 'INSPECT%2BKEY' });
await deleteDoc(yearRef);

// 특일정보 흉내: 1월 둘(설·대체 - item 배열), 5월 하나(item 하나), 나머지 빈 달
let full = true;
const monthBody = (y, mm) => {
  const item = (m, d, name) => ({ dateKind: '01', dateName: name, isHoliday: 'Y', locdate: Number(`${y}${m}${d}`), seq: 1 });
  const items = mm === '01' ? { item: full ? [item('01', '27', '설날'), item('01', '29', '대체공휴일')] : item('01', '27', '설날') } : mm === '05' ? { item: item('05', '02', '부처님오신날') } : '';
  return JSON.stringify({ response: { header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' }, body: { items, numOfRows: 100, pageNo: 1, totalCount: 0 } } });
};
const asked = [];

const browser = await launch();
try {
  r.section("개발자 탭 '공휴일'");
  const d = await newPage(browser);
  await d.page.route('https://apis.data.go.kr/**', (route) => {
    const url = route.request().url();
    asked.push(url);
    route.fulfill({ status: 200, contentType: 'application/json', body: monthBody(/solYear=(\d{4})/.exec(url)[1], /solMonth=(\d\d)/.exec(url)[1]) });
  });
  await open(d.page, '#/day/2026-10-08', { as: 5 });
  await d.page.evaluate(() => window.sp5.openWindow('settings', { tab: 'dev' }));
  const row = d.page.locator(sel('dev-holiday-year', YEAR));
  r.check(await waitFor(row), `${YEAR}년 줄`);
  r.check((await d.page.locator(sel('dev-holiday-year')).count()) === 3, '줄 셋 (올해·내년·내후년)');
  r.check(/⚠️ 없음/.test((await row.textContent()) ?? ''), `없는 해는 ⚠️ 없음 (${await row.textContent()})`);
  r.check(await waitFor(async () => (await d.page.locator(sel('dev-holidays-key')).inputValue()) === 'INSPECT%2BKEY'), '키 칸 = admin/config (V4와 같은 칸)');

  await d.page.click(sel('dev-holiday-fetch', YEAR));
  const saved = await serverUntil(async () => (await getDoc(yearRef)).data(), (x) => !!x);
  r.check(asked.length === 12 && asked.every((u) => u.includes(`solYear=${YEAR}`) && u.includes('ServiceKey=INSPECT%2BKEY&')), `열두 달 부름·키 한 번만 인코딩 (${asked.length})`);
  r.check(
    JSON.stringify(Object.keys(saved ?? {}).sort()) === '["days","updatedAt","updatedBy","year"]' && saved.year === YEAR && saved.updatedBy === 'hyundonglim80@gmail.com',
    `서버 문서 모양 = V4 (${Object.keys(saved ?? {}).sort().join(',')})`,
  );
  r.check(Object.keys(saved?.days ?? {}).length === 3 && saved.days[`${YEAR}-01-29`] === '대체공휴일', `받은 3건 (${JSON.stringify(saved?.days)})`);
  r.check(await waitFor(async () => /3건/.test((await row.textContent()) ?? '')), `줄이 3건으로 (${await row.textContent()})`);
  r.check((await row.locator(sel('dev-holiday-fetch')).textContent())?.includes('다시 받기'), '단추 = 다시 받기');
  const local = await d.page.evaluate(async (y) => {
    const m = await import(window.__appModule('/src/data/holidays.ts'));
    for (let i = 0; i < 40 && !m.useHolidayStore.getState().shared[y]?.[`${y}-05-02`]; i++) await new Promise((res) => setTimeout(res, 100));
    return m.holidayName(`${y}-05-02`);
  }, YEAR);
  r.check(local === '부처님오신날', `이 기기 표도 바로 (${local})`);

  r.section('더 적게 받으면 묻는다');
  full = false;
  d.dialogs.answer = false;
  await d.page.click(sel('dev-holiday-fetch', YEAR));
  r.check(await waitFor(async () => d.dialogs.seen.some((m) => m.includes('지금 3건 → 받은 것 2건'))), `덮어쓰기 전에 묻는다 (${d.dialogs.seen.at(-1)})`);
  await waitFor(async () => !(await d.page.locator(sel('dev-holiday-fetch', YEAR)).isDisabled()));
  r.check(Object.keys((await getDoc(yearRef)).data()?.days ?? {}).length === 3, '아니오 → 서버는 그대로 3건');

  r.section(`년간 화면 - ${WARN_YEAR}년 표가 없으면 개발자에게만 경고 (■3)`);
  await deleteDoc(warnRef);
  const t = await newPage(browser);
  await open(t.page, `#/year/${now.getFullYear()}`);
  r.check(await waitFor(t.page.locator('[data-screen="year"]')), '일반 계정 년간 화면');
  await t.page.waitForTimeout(1500);
  r.check((await t.page.locator(sel('holiday-missing')).count()) === 0, '일반 계정에는 경고 줄이 없다');

  const y = await newPage(browser);
  await y.page.route('https://apis.data.go.kr/**', (route) => {
    const url = route.request().url();
    route.fulfill({ status: 200, contentType: 'application/json', body: monthBody(/solYear=(\d{4})/.exec(url)[1], /solMonth=(\d\d)/.exec(url)[1]) });
  });
  await open(y.page, `#/year/${now.getFullYear()}`, { as: 5 });
  const note = y.page.locator(sel('holiday-missing'));
  r.check(await waitFor(note), '개발자 계정에는 경고 줄');
  r.check(((await note.getAttribute('data-holiday-missing')) ?? '').split(',').includes(String(WARN_YEAR)), `${WARN_YEAR}년이 든다 (${await note.textContent()})`);
  await note.click();
  r.check(await waitFor(y.page.locator(sel('settings-panel', 'dev'))), '누르면 환경설정 개발자 탭');
  full = true;
  await y.page.locator(sel('dev-holiday-fetch', WARN_YEAR)).click();
  await serverUntil(async () => (await getDoc(warnRef)).data(), (x) => !!x);
  r.check(
    await waitFor(async () => {
      const line = y.page.locator(sel('holiday-missing'));
      return (await line.count()) === 0 || !((await line.getAttribute('data-holiday-missing')) ?? '').split(',').includes(String(WARN_YEAR));
    }),
    '받으면 그 해 경고가 사라진다',
  );

  r.check(d.errors.length + t.errors.length + y.errors.length === 0, '화면 오류 없음', `화면 오류: ${[...d.errors, ...t.errors, ...y.errors].join(' | ')}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
