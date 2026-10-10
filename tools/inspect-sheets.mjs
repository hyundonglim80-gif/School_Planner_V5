// tools/inspect-sheets.mjs - P8-3 ■4: 백업 창 '보내기' 탭의 📊 구글 시트를 실제 크롬에서 본다(시트 API는 page.route 흉내).
//   보내기 = V5만의 시트 파일(공간 settings/sheets) · '일정기록'(줄·메타데이터 id·교시 칸) · '조사표_학급' 탭 · '메모' 탭
//   되읽기 = 고친 글·완료·라벨(새 라벨) · 손으로 더한 줄은 새로 · 교시 칸 = 수업 칸 · 조사표 점수 · 메모 · 시트에서 지운 줄은 앱에 남는다 · 두 번 되읽어도 그대로
//   명렬표 '📊 시트' = 학급 탭의 번호·이름·성별 → 명단(학생 id·전출 잇기, 💾 저장 전까지 고치는 중) · 탭이 없으면 머리말 탭을 만든다
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-sheets.mjs
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const browser = await launch();
const DAY = '2027-08-02';
const DAY2 = '2027-08-03';
const CLS = '2027-5-9';
const ref = (c, id) => doc(em.db, 'spaces', sid, c, id);
const tracked = { createdAt: Date.now(), authorId: uid, deletedAt: null, v: 1, updatedAt: serverTimestamp() };
const item = (over) => ({ kind: 'event', date: DAY, labelIds: [], order: 'a0', ...tracked, ...over });

const madeItems = async () => (await getDocs(collection(em.db, 'spaces', sid, 'items'))).docs.filter((d) => String(d.data().text ?? '').startsWith('시트점검'));
const madeLabels = async () => (await getDocs(collection(em.db, 'spaces', sid, 'labels'))).docs.filter((d) => d.data().name === '시트라벨');

// ── 시트 흉내 ──
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
const sheets = new Map(); // id → { title, tabs: Map(title → values) }
let seq = 0;
async function mockSheets(ctx) {
  await ctx.route(/oauth2\.googleapis\.com\/tokeninfo/, (route) => route.fulfill({ status: 200, headers: CORS, json: { expires_in: 3000 } }));
  await ctx.route(/sheets\.googleapis\.com\/v4\/spreadsheets/, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const path = decodeURIComponent(url.pathname.replace(/^\/v4\/spreadsheets\/?/, ''));
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    if (!path && req.method() === 'POST') {
      const id = `SHEETMOCK${++seq}`.padEnd(24, 'x');
      sheets.set(id, { title: body.properties?.title, tabs: new Map((body.sheets ?? []).map((s) => [s.properties.title, []])) });
      return route.fulfill({ status: 200, headers: CORS, json: { spreadsheetId: id } });
    }
    const [idPart, rest] = path.split('/values/');
    const id = idPart.replace(/:batchUpdate$/, '');
    const sh = sheets.get(id);
    if (!sh) return route.fulfill({ status: 404, headers: CORS, json: { error: { message: 'not found' } } });
    if (idPart.endsWith(':batchUpdate')) {
      for (const q of body.requests ?? []) if (q.addSheet) sh.tabs.set(q.addSheet.properties.title, []);
      return route.fulfill({ status: 200, headers: CORS, json: {} });
    }
    if (!rest) {
      if (url.searchParams.get('fields')?.startsWith('sheets')) return route.fulfill({ status: 200, headers: CORS, json: { sheets: [...sh.tabs.keys()].map((title) => ({ properties: { title } })) } });
      return route.fulfill({ status: 200, headers: CORS, json: { spreadsheetId: id } });
    }
    const tab = rest.replace(/:clear$/, '').split('!')[0];
    if (rest.endsWith(':clear')) {
      sh.tabs.set(tab, []);
      return route.fulfill({ status: 200, headers: CORS, json: {} });
    }
    if (req.method() === 'PUT') {
      sh.tabs.set(tab, body.values ?? []);
      return route.fulfill({ status: 200, headers: CORS, json: {} });
    }
    if (!sh.tabs.has(tab)) return route.fulfill({ status: 400, headers: CORS, json: { error: { message: 'Unable to parse range' } } });
    return route.fulfill({ status: 200, headers: CORS, json: { values: sh.tabs.get(tab) } });
  });
}

try {
  await setDoc(ref('items', 'inspShE'), item({ text: '시트점검 일정' }));
  await setDoc(ref('items', 'inspShN'), item({ kind: 'note', text: '시트점검 기록' }));
  await setDoc(ref('items', 'inspShM'), item({ kind: 'note', date: null, text: '시트점검 메모' }));
  await setDoc(ref('lessonDays', DAY), { periods: { 1: { subject: '국어' } }, v: 1, updatedAt: serverTimestamp() });
  const students = [
    { sid: 's1', num: 1, name: '가', gender: 'M', status: 'active' },
    { sid: 's2', num: 2, name: '나', gender: 'F', status: 'active' },
  ];
  await setDoc(ref('classes', CLS), { year: 2027, grade: 5, num: 9, students, ...tracked });
  await setDoc(ref('evaluations', 'inspShEv'), {
    date: DAY,
    period: 2,
    classId: CLS,
    title: '시트점검 받아쓰기',
    type: 'eval',
    indiv: true,
    students: students.map(({ sid: s, num, name }) => ({ sid: s, num, name })),
    values: { s1: { indiv: '상' } },
    ...tracked,
  });
  undo.add(async () => {
    for (const d of await madeItems()) await deleteDoc(d.ref);
    for (const d of await madeLabels()) await deleteDoc(d.ref);
    for (const [c, id] of [['lessonDays', DAY], ['classes', CLS], ['evaluations', 'inspShEv'], ['settings', 'sheets']]) await deleteDoc(ref(c, id));
  });

  const { ctx, page, errors, dialogs } = await newPage(browser);
  await mockSheets(ctx);
  await ctx.addInitScript(() => sessionStorage.setItem('sp5-google-token', 'tok'));
  await open(page, `#/day/${DAY}`);
  await page.locator(sel('event-card', 'inspShE')).waitFor({ timeout: 15000 });
  await page.evaluate(() => window.sp5.openWindow('backup', { tab: 'send' }));
  await page.locator(sel('sheets')).waitFor({ timeout: 10000 });

  r.section('📊 시트로 보내기');
  await page.locator(sel('sheets-period', 'custom')).click();
  await page.locator(sel('sheets-start')).fill(DAY);
  await page.locator(sel('sheets-end')).fill(DAY2);
  await page.locator(sel('sheets-export')).click();
  r.check(await waitFor(page.locator(sel('sheets-result')), 20000), '보내기 결과 줄');
  const [sheetId, sh] = [...sheets.entries()][0] ?? [];
  r.check(sh?.title === 'School Planner V5 시트', `V5만의 시트 파일을 만든다 (${sh?.title})`);
  const rec = await serverUntil(async () => (await getDoc(ref('settings', 'sheets'))).data(), (x) => x?.spreadsheetId === sheetId);
  r.check(rec?.spreadsheetId === sheetId, '시트 파일 id = 공간 settings/sheets');
  const sched = sh?.tabs.get('일정기록') ?? [];
  const head = sched[0] ?? [];
  const row = sched.find((x) => x[0] === DAY) ?? [];
  const col = (name) => head.findIndex((h) => h === name);
  r.check(sched.length === 3 && head[1] === '일정' && head.includes('일정 메타데이터 (수정금지)'), `날마다 한 줄 + 머리말 (${sched.length}줄)`);
  r.check(row[col('일정')] === '[일정] 시트점검 일정' && row[col('일정 메타데이터 (수정금지)')] === '[{"id":"inspShE"}]', '일정 줄 · 메타데이터 = 항목 id');
  r.check(row[col('기록')] === '[기록] 시트점검 기록', '기록 줄');
  r.check(row[2] === '[국어]', `1교시 칸 = 수업 칸 (${row[2]})`);
  r.check((row[col('조사표')] ?? '').includes('시트점검 받아쓰기 (2교시)'), '조사표 칸 = 제목');
  const evTab = sh?.tabs.get(`조사표_${CLS}`) ?? [];
  r.check(evTab[1]?.[3] === 'inspShEv' && evTab[8]?.slice(0, 4).join() === '1,가,M,상', '학급 탭 = 조사표 id · 학생 줄 점수');
  const memoTab = sh?.tabs.get('메모') ?? [];
  r.check(memoTab.some((x) => x[1] === 'inspShM' && x[2] === '시트점검 메모'), '메모 탭');
  r.check(await page.locator(sel('sheets-open')).isVisible(), '🔗 구글 시트 열기');

  r.section('📥 시트에서 되읽기');
  // 시트에서 사람이 고친다
  row[col('일정')] = '[v] [시트라벨] 시트점검 고친 일정\n[일정] 시트점검 새 일정';
  row[col('기록')] = '';
  row[2] = '[수학] 받아쓰기';
  evTab[9][3] = '중';
  memoTab.find((x) => x[1] === 'inspShM')[2] = '시트점검 메모 고침';
  dialogs.answer = true;
  await page.locator(sel('sheets-import')).click();
  r.check(await waitFor(async () => ((await page.locator(sel('sheets-result')).textContent()) ?? '').includes('되읽었습니다'), 20000), '되읽기 결과 줄');
  const e = await serverUntil(async () => (await getDoc(ref('items', 'inspShE'))).data(), (x) => x?.text === '시트점검 고친 일정');
  const lab = (await madeLabels())[0];
  r.check(e?.text === '시트점검 고친 일정' && e?.done === true, '고친 글 · 완료 [v]');
  r.check(!!lab && lab.data().kind === 'event' && e?.labelIds?.includes(lab.id), '시트에 적은 라벨 = 일정 라벨로 새로 · 붙는다');
  const fresh = (await madeItems()).map((d) => d.data()).filter((x) => x.text === '시트점검 새 일정');
  r.check(fresh.length === 1 && fresh[0].date === DAY && fresh[0].kind === 'event', '손으로 더한 줄 = 그날 새 일정');
  r.check(!(await getDoc(ref('items', 'inspShN'))).data()?.deletedAt, '시트에서 지운 기록 줄은 앱에 남는다');
  const ld = (await getDoc(ref('lessonDays', DAY))).data();
  r.check(ld?.periods?.['1']?.subject === '수학' && ld?.periods?.['1']?.memo === '받아쓰기', `교시 칸 → 수업 칸 (${JSON.stringify(ld?.periods?.['1'])})`);
  const ev = (await getDoc(ref('evaluations', 'inspShEv'))).data();
  r.check(ev?.values?.s2?.indiv === '중' && ev?.values?.s1?.indiv === '상', '조사표 점수 (고친 학생만)');
  r.check((await getDoc(ref('items', 'inspShM'))).data()?.text === '시트점검 메모 고침', '메모 탭에서 고친 글');
  r.check(dialogs.seen.some((m) => m.includes('지운 줄은 앱에서 지우지 않습니다')), '되읽기 전에 묻는다');

  await page.locator(sel('sheets-import')).click();
  r.check(await waitFor(async () => ((await page.locator(sel('sheets-result')).textContent()) ?? '').includes('고친 것 0건 · 새로 0건'), 20000), '두 번 되읽어도 그대로 (고친 것 0 · 새로 0)');
  r.check((await madeItems()).filter((d) => d.data().text === '시트점검 새 일정').length === 1, '손으로 더한 줄이 두 번 들어가지 않는다');

  r.section('명렬표 📊 시트');
  // 학급 탭 = 조사표 탭과 같은 탭 - 아래에 학생 하나를 더 적고 성별을 고친다
  evTab.push(['3', '다', '남', '새로 전입']);
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.goto(page.url().replace(/#.*$/, '#/class'));
  await page.locator(sel('class-mode', 'roster')).click();
  await page.locator(sel('roster')).waitFor({ timeout: 10000 });
  if ((await page.locator(sel('roster-edit')).getAttribute('aria-pressed')) !== 'true') await page.locator(sel('roster-edit')).click();
  dialogs.seen.length = 0;
  await page.locator(sel('roster-sheet')).click();
  r.check(await waitFor(() => dialogs.seen.some((m) => m.includes('3명을 찾았습니다')), 15000), `학급 탭에서 3명을 찾아 묻는다 (${dialogs.seen.at(-1) ?? ''})`);
  const names = async () => page.locator('[data-roster-row] [data-student-field="name"]').evaluateAll((els) => els.map((e) => e.value));
  r.check(await waitFor(async () => (await names()).join() === '가,나,다', 8000), '명단 = 시트 (가·나·다)');
  r.check(await waitFor(page.locator(sel('roster-dirty')), 5000), '💾 저장 전까지 고치는 중');
  await page.locator(sel('roster-save')).click();
  const cls = await serverUntil(async () => (await getDoc(ref('classes', CLS))).data(), (x) => x?.students?.length === 3);
  r.check(cls?.students?.[0]?.sid === 's1' && cls?.students?.[1]?.sid === 's2', '같은 학생은 학생 id를 잇는다 (기록이 따라간다)');
  r.check(cls?.students?.[2]?.name === '다' && cls?.students?.[2]?.gender === 'M' && cls?.students?.[2]?.note === '새로 전입', '새 학생 · 성별 · 넷째 칸 = 특이사항');
  // 탭이 없는 학급
  sh.tabs.delete(`조사표_${CLS}`);
  dialogs.seen.length = 0;
  const popup = ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  await page.locator(sel('roster-sheet')).click();
  r.check(await waitFor(() => sh.tabs.get(`조사표_${CLS}`)?.[0]?.join() === '번호,이름,성별', 15000), '탭이 없으면 묻고 머리말 탭을 만든다');
  r.check(dialogs.seen.some((m) => m.includes('탭이 시트에 없습니다')) && !!(await popup), '만들고 시트를 연다');
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
