// tools/inspect-gcal.mjs - P8-1 ■1: 일정 라벨 속성 '구글 캘린더' 자동 보내기를 실제 크롬에서 본다.
// 구글 캘린더 API·tokeninfo는 page.route로 흉내 낸다(클라우드 컨테이너는 googleapis에 닿지 못한다) - 실제 구글 캘린더 확인은 사용자 부탁.
//   1) 만들기 → 구글에 하나(같은 표시·sp_auto·sp_item) · 큐가 빈다
//   2) 완료 → ✅ · 날짜 옮기기 → 옛 날 것을 지우고 새 날에 · 이 일정만 끄기 → 지움 · 다시 켜기 → 넣기 · 지우기 → 지움
//   3) 가져온 일정 → V4가 보낸 것을 이어 맡는다(두 벌이 되지 않는다)
//   4) 이월 중인 일정 → 오늘로
//   5) 토큰이 없을 때 저장 → '구글 로그인이 필요합니다' · 닫으면 '📅 못 보낸 일정 1' → 누르면 보낸다
//   6) 라벨의 '구글 캘린더'를 끄면 그 라벨로 보낸 것을 지운다
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-gcal.mjs
// teacher 계정 - 점검 라벨·일정·큐는 끝에 지운다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const browser = await launch();
const ref = (c, id) => doc(em.db, 'spaces', sid, c, id);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = ymd(new Date());
const YESTERDAY = ymd(new Date(Date.now() - 86400000));
const DAY = '2027-05-04';
const DAY_NEXT = '2027-05-05';
const DAY_V4 = '2027-05-06';
const DAY_P = '2027-05-10';
const LABEL = 'inspGcalLabel';
const startedAt = Date.now();

// ── 구글 캘린더 흉내 ──
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
const google = { tokenOk: true, events: new Map(), seq: 0, calls: 0 };
const all = () => [...google.events.values()];
const ofItem = (id) => all().filter((e) => e.extendedProperties?.private?.sp_item === id);
const bare = (s) => String(s ?? '').replace(/^[‌‍]+/, '');
async function mockGoogle(ctx) {
  await ctx.route(/oauth2\.googleapis\.com\/tokeninfo/, (route) =>
    route.fulfill({ status: google.tokenOk ? 200 : 400, headers: CORS, json: google.tokenOk ? { expires_in: 3000 } : { error: 'invalid_token' } }),
  );
  await ctx.route(/www\.googleapis\.com\/calendar\/v3\//, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    google.calls += 1;
    if (!google.tokenOk) return route.fulfill({ status: 401, headers: CORS, json: { error: { message: 'Invalid Credentials' } } });
    const url = new URL(req.url());
    if (url.pathname.endsWith('/users/me/calendarList')) return route.fulfill({ status: 200, headers: CORS, json: { items: [{ id: 'CAL_WORK', summary: 'SP(work)' }] } });
    const m = url.pathname.match(/\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
    if (!m) return route.fulfill({ status: 404, headers: CORS, json: {} });
    const id = m[2] && decodeURIComponent(m[2]);
    if (req.method() === 'GET') {
      const want = url.searchParams.getAll('privateExtendedProperty').map((p) => p.split('='));
      const items = all().filter((e) => want.every(([k, v]) => e.extendedProperties?.private?.[k] === v));
      return route.fulfill({ status: 200, headers: CORS, json: { items } });
    }
    if (req.method() === 'POST') {
      const ev = { ...JSON.parse(req.postData() || '{}'), id: `G${++google.seq}` };
      google.events.set(ev.id, ev);
      return route.fulfill({ status: 200, headers: CORS, json: ev });
    }
    if (!google.events.has(id)) return route.fulfill({ status: 404, headers: CORS, json: { error: { message: 'Not Found' } } });
    if (req.method() === 'PUT') {
      const ev = { ...JSON.parse(req.postData() || '{}'), id };
      google.events.set(id, ev);
      return route.fulfill({ status: 200, headers: CORS, json: ev });
    }
    if (req.method() === 'DELETE') {
      google.events.delete(id);
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    }
    return route.fulfill({ status: 405, headers: CORS, json: {} });
  });
}

const base = { deletedAt: null, v: 1, updatedAt: serverTimestamp() };
/** 라벨 고르기 - 이미 골라져 있으면 그대로 (일정 라벨이 하나뿐이면 기본 라벨로 골라져 있다) */
const pickLabel = async (page) => {
  const chip = page.locator(sel('label-pick', LABEL));
  if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click();
};
const queueIds = async () => (await getDocs(collection(em.db, 'spaces', sid, 'gcalQueue'))).docs.map((d) => d.id);
const madeItems = async () =>
  (await getDocs(collection(em.db, 'spaces', sid, 'items'))).docs.map((d) => ({ ...d.data(), id: d.id })).filter((d) => String(d.text ?? '').startsWith('구글점검'));

try {
  // 점검 라벨: 구글 캘린더 + 이월
  await setDoc(ref('labels', LABEL), { kind: 'event', name: '구글점검', color: 'sky', order: 'zz', props: { gcal: true, forward: true }, ...base });
  undo.add(async () => {
    for (const d of await madeItems()) await deleteDoc(ref('items', d.id));
    for (const id of await queueIds()) await deleteDoc(ref('gcalQueue', id));
    await deleteDoc(ref('labels', LABEL));
  });
  // 이월 중인 일정 (어제 - 앱을 열면 오늘로 보낸다) · 가져온 일정 (V4가 이미 보낸 것)
  await setDoc(ref('items', 'inspGcalCarried'), { kind: 'event', date: YESTERDAY, text: '구글점검 이월', labelIds: [LABEL], order: 'a0', createdAt: Date.now(), authorId: uid, ...base });
  await setDoc(ref('items', 'inspGcalV4'), {
    kind: 'event',
    date: DAY_V4,
    text: '구글점검 가져온 일정',
    labelIds: [LABEL],
    order: 'a0',
    createdAt: Date.now(),
    authorId: uid,
    src: { from: 'v4', path: `events/${DAY_V4}`, id: 'ev_insp_v4', h: 'x' },
    ...base,
  });
  // 기간 일정 (월~수) - 보이는 날마다 하나
  await setDoc(ref('items', 'inspGcalPeriod'), { kind: 'event', date: DAY_P, endDate: '2027-05-12', text: '구글점검 기간', labelIds: [LABEL], order: 'a0', createdAt: Date.now(), authorId: uid, ...base });
  google.events.set('V4SENT', {
    id: 'V4SENT',
    summary: '구글점검 가져온 일정 [구글점검]',
    description: '📌 School Planner에서 관리되는 일정입니다.',
    start: { date: DAY_V4 },
    end: { date: '2027-05-07' },
    extendedProperties: { private: { app: 'SchoolPlannerV3', type: 'event', dateStr: DAY_V4, sp_id: 'ev_insp_v4', sp_auto: 'true', completed: 'false', labelStr: '구글점검' } },
  });

  const { ctx, page, errors } = await newPage(browser);
  await mockGoogle(ctx);
  await ctx.addInitScript(() => sessionStorage.setItem('sp5-google-token', 'tok'));
  await open(page, `#/day/${DAY}`);

  r.section('이월 중인 일정 = 오늘로');
  r.check(await waitFor(() => ofItem('inspGcalCarried').some((e) => e.start?.date === TODAY), 15000), `앱을 열면 어제 일정이 구글에 오늘(${TODAY})로`);

  r.section('만들기 → 구글에 하나');
  await page.evaluate(([s, d]) => window.sp5.openWindow('event', { sid: s, date: d }), [sid, DAY]);
  await page.locator(sel('event-text-input')).fill('구글점검 일정');
  await pickLabel(page);
  r.check(await page.locator(sel('event-attr', 'gcal')).isChecked(), "라벨을 고르면 '구글 캘린더' 속성이 켜진다");
  await page.locator(sel('event-save')).click();
  const made = await serverUntil(madeItems, (l) => l.some((d) => d.text === '구글점검 일정'));
  const id = made.find((d) => d.text === '구글점검 일정')?.id;
  r.check(await waitFor(() => ofItem(id).length === 1, 10000), '저장하면 구글에 하나 (1.2초 모았다가)');
  const [g1] = ofItem(id);
  r.check(g1?.start?.date === DAY && g1.end?.date === DAY_NEXT, '종일 일정 (끝 = 다음 날)');
  r.check(bare(g1?.summary) === '구글점검 일정 [구글점검]', `제목 = 내용 [라벨] (${bare(g1?.summary)})`);
  r.check(g1?.extendedProperties?.private?.app === 'SchoolPlannerV3' && g1.extendedProperties.private.sp_auto === 'true' && g1.extendedProperties.private.sp_id === id, 'V4와 같은 표시 + 자동 표시');
  r.check((await serverUntil(queueIds, (l) => !l.includes(id))).includes(id) === false, '보낸 항목은 큐에서 빠진다');

  r.section('완료·옮기기·끄기·지우기');
  await page.keyboard.press('Escape');
  const card = page.locator(sel('event-card', id));
  await waitFor(card, 8000);
  await card.locator(sel('event-complete')).click();
  r.check(await waitFor(() => bare(ofItem(id)[0]?.summary).startsWith('✅ ') && ofItem(id)[0]?.extendedProperties?.private?.completed === 'true', 10000), '완료 → ✅');
  const openEdit = async () => {
    await page.evaluate(([s, d, i]) => window.sp5.openWindow('event', { sid: s, date: d, id: i }), [sid, DAY, id]);
    await waitFor(page.locator(sel('event-panel', 'edit')), 8000);
  };
  await openEdit();
  await page.locator(sel('event-date-next')).click();
  await page.locator(sel('event-save')).click();
  r.check(await waitFor(() => ofItem(id).length === 1 && ofItem(id)[0].start?.date === DAY_NEXT, 10000), '날짜 옮기기 → 새 날 하나 (옛 날 것은 지움)');
  await page.locator(sel('event-attr', 'gcal')).uncheck();
  await page.locator(sel('event-save')).click();
  r.check(await waitFor(() => ofItem(id).length === 0, 10000), "이 일정만 '구글 캘린더' 끄기 → 구글에서 지움");
  await page.locator(sel('event-attr', 'gcal')).check();
  await page.locator(sel('event-save')).click();
  r.check(await waitFor(() => ofItem(id).length === 1, 10000), '다시 켜기 → 넣기');
  await page.locator(sel('event-delete')).click();
  r.check(await waitFor(() => ofItem(id).length === 0, 10000), '지우기 → 구글에서 지움');

  r.section('가져온 일정 = V4가 보낸 것을 이어 맡는다');
  await page.goto(page.url().replace(/#.*$/, `#/day/${DAY_V4}`));
  const v4card = page.locator(sel('event-card', 'inspGcalV4'));
  await waitFor(v4card, 8000);
  await v4card.locator(sel('event-complete')).click();
  r.check(await waitFor(() => google.events.get('V4SENT')?.extendedProperties?.private?.sp_item === 'inspGcalV4', 10000), 'V4 것을 고쳐 V5가 맡는다(sp_item)');
  const twins = all().filter((e) => e.start?.date === DAY_V4 && bare(e.summary).includes('구글점검 가져온 일정'));
  r.check(twins.length === 1 && bare(twins[0].summary).startsWith('✅'), `두 벌이 되지 않는다 (${twins.length}) · 완료 ✅`);

  r.section('기간 일정 = 보이는 날마다 (k/n)');
  await page.goto(page.url().replace(/#.*$/, `#/day/${DAY_P}`));
  const pcard = page.locator(sel('event-card', 'inspGcalPeriod'));
  await waitFor(pcard, 8000);
  await pcard.locator(sel('event-complete')).click();
  r.check(await waitFor(() => ofItem('inspGcalPeriod').length === 3, 10000), `사흘 = 셋 (${ofItem('inspGcalPeriod').length})`);
  const ps = ofItem('inspGcalPeriod').sort((a, b) => a.start.date.localeCompare(b.start.date));
  r.check(ps.map((e) => bare(e.summary)).join(' | ') === '✅ 구글점검 기간 (1/3) [구글점검] | 구글점검 기간 (2/3) [구글점검] | 구글점검 기간 (3/3) [구글점검]', `그날만 완료 ✅ (${ps.map((e) => bare(e.summary)).join(' | ')})`);

  r.section('토큰이 없을 때');
  google.tokenOk = false;
  await page.evaluate(([s, d]) => window.sp5.openWindow('event', { sid: s, date: d }), [sid, DAY]);
  await page.locator(sel('event-text-input')).fill('구글점검 로그인');
  await pickLabel(page);
  await page.locator(sel('event-save')).click();
  const prompt = page.locator(sel('google-login-prompt'));
  r.check(await waitFor(prompt, 10000), "저장하면 '구글 로그인이 필요합니다' (로그인이 없다)");
  r.check(((await page.locator(sel('google-login-reason')).textContent()) ?? '').includes('구글 캘린더'), '까닭 = 구글 캘린더');
  await page.locator(sel('google-login-close')).click();
  const pending = page.locator(sel('gcal-pending'));
  r.check(await waitFor(pending, 10000), "닫으면 머리줄 '📅 못 보낸 일정'");
  r.check((await pending.getAttribute('data-gcal-pending')) === '1', '못 보낸 일정 1');
  const loginId = (await madeItems()).find((d) => d.text === '구글점검 로그인')?.id;
  r.check(ofItem(loginId).length === 0, '아직 보내지 않았다');
  google.tokenOk = true;
  await page.evaluate(() => sessionStorage.setItem('sp5-google-token', 'tok2'));
  await pending.click();
  r.check(await waitFor(() => ofItem(loginId).length === 1, 10000), '누르면 보낸다');
  r.check(await waitFor(async () => (await pending.count()) === 0, 8000), '보내면 단추가 사라진다');

  r.section("라벨의 '구글 캘린더' 끄기");
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.sp5.openWindow('labels', { tab: 'event' }));
  const row = page.locator(sel('label-row', LABEL));
  await waitFor(row, 8000);
  await row.locator(sel('label-prop', 'gcal')).uncheck();
  await page.locator(sel('label-save')).click();
  r.check(await waitFor(() => ofItem(loginId).length === 0 && ofItem('inspGcalV4').length === 0 && ofItem('inspGcalCarried').length === 0 && ofItem('inspGcalPeriod').length === 0, 15000), '그 라벨로 보낸 일정을 구글에서 모두 지운다');
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
  const lbl = (await getDoc(ref('labels', LABEL))).data();
  r.check(lbl?.props?.gcal === false || lbl?.props?.gcal === undefined, '라벨 문서 = 끔');
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
