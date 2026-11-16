// tools/inspect-gcal.mjs - P8-1 ■1: 일정 라벨 속성 '구글 캘린더' 자동 보내기를 실제 크롬에서 본다.
// 구글 캘린더 API·tokeninfo는 page.route로 흉내 낸다(클라우드 컨테이너는 googleapis에 닿지 못한다) - 실제 구글 캘린더 확인은 사용자 부탁.
//   1) 만들기 → 구글에 하나(같은 표시·sp_auto·sp_item) · 큐가 빈다
//   2) 완료 → ✅ · 날짜 옮기기 → 옛 날 것을 지우고 새 날에 · 이 일정만 끄기 → 지움 · 다시 켜기 → 넣기 · 지우기 → 지움
//   3) 가져온 일정 → V4가 보낸 것을 이어 맡는다(두 벌이 되지 않는다)
//   4) 이월 중인 일정 → 오늘로
//   5) 토큰이 없을 때 저장 → '구글 로그인이 필요합니다' · 닫으면 '📅 못 보낸 일정 1' → 누르면 보낸다
//   6) 라벨의 '구글 캘린더'를 끄면 그 라벨로 보낸 것을 지운다
//
//   7) 겹쳐 보기(P36-3 고르기·받아 담기) · 겹쳐 그리기(P36-4 하루·주간·월간 막대·년간·한눈에·창·끄고 켜기·인쇄에는 없다 - ONLY=draw면 이 묶음만)
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → TZ=Asia/Seoul node tools/inspect-gcal.mjs (흉내 일정이 +09:00 - 시각 글을 서울 시각으로 견준다, CI도 서울)
// teacher 계정 - 점검 라벨·일정·큐는 끝에 지운다.
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, noUserActivation, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

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
const DAY_M = '2027-05-17';
const LABEL = 'inspGcalLabel';

// ── 구글 캘린더 흉내 ──
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
const google = { tokenOk: true, events: new Map(), seq: 0, calls: 0, cals: new Map([['SP(work)', 'CAL_WORK']]) };
/** 자동 보내기가 보는 SP(work)의 일정 */
const all = () => [...google.events.values()].filter((e) => e._cal === 'CAL_WORK');
const inCal = (name) => [...google.events.values()].filter((e) => e._cal === google.cals.get(name));
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
    if (url.pathname.endsWith('/users/me/calendarList'))
      return route.fulfill({ status: 200, headers: CORS, json: { items: [...google.cals].map(([summary, id]) => ({ id, summary })) } });
    if (url.pathname.endsWith('/calendars') && req.method() === 'POST') {
      const { summary } = JSON.parse(req.postData() || '{}');
      const id = `CAL_${google.cals.size + 1}`;
      google.cals.set(summary, id);
      return route.fulfill({ status: 200, headers: CORS, json: { id, summary } });
    }
    const m = url.pathname.match(/\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
    if (!m) return route.fulfill({ status: 404, headers: CORS, json: {} });
    const cal = decodeURIComponent(m[1]);
    const id = m[2] && decodeURIComponent(m[2]);
    if (req.method() === 'GET') {
      const want = url.searchParams.getAll('privateExtendedProperty').map((p) => p.split('='));
      const items = [...google.events.values()].filter((e) => e._cal === cal && want.every(([k, v]) => e.extendedProperties?.private?.[k] === v));
      return route.fulfill({ status: 200, headers: CORS, json: { items } });
    }
    if (req.method() === 'POST') {
      const ev = { ...JSON.parse(req.postData() || '{}'), id: `G${++google.seq}`, _cal: cal };
      google.events.set(ev.id, ev);
      return route.fulfill({ status: 200, headers: CORS, json: ev });
    }
    if (!google.events.has(id)) return route.fulfill({ status: 404, headers: CORS, json: { error: { message: 'Not Found' } } });
    if (req.method() === 'PUT') {
      const ev = { ...JSON.parse(req.postData() || '{}'), id, _cal: cal };
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

// ── 겹쳐 보기 흉내 (P36-3) - 내 캘린더 목록·기간 일정 (진짜 주소 꼴 - CSP connect-src *.googleapis.com) ──
const ov = {
  tokenOk: true,
  /** 일정을 503으로 (끊김·구글 고장) */
  down: false,
  /** 일정 요청 [캘린더, timeMin, timeMax] */
  asks: [],
  cals: [
    { id: 'me@example.com', summary: 'me@example.com', summaryOverride: '내 캘린더', primary: true, backgroundColor: '#9fe1e7' },
    { id: 'CAL_WORK', summary: 'SP(work)', backgroundColor: '#000000' },
    { id: 'grade@group.calendar.google.com', summary: '학년 협의', backgroundColor: '#16a765' },
    { id: 'gone@group.calendar.google.com', summary: '지운 캘린더', backgroundColor: '#ff7537' },
  ],
  /** 학년 협의의 일정 (반복은 펼친 것 - singleEvents) */
  events: [
    { id: 'ov_allday', summary: '점검 학년 협의회', start: { date: '2027-05-04' }, end: { date: '2027-05-05' }, htmlLink: 'https://www.google.com/calendar/event?eid=ov1' },
    { id: 'ov_timed', summary: '점검 공개 수업', start: { dateTime: '2027-05-20T09:00:00+09:00' }, end: { dateTime: '2027-05-20T10:00:00+09:00' }, location: '5-2' },
    { id: 'ov_rep_1', summary: '점검 주간 회의', start: { dateTime: '2027-05-11T15:00:00+09:00' }, end: { dateTime: '2027-05-11T16:00:00+09:00' } },
    { id: 'ov_rep_2', summary: '점검 주간 회의', start: { dateTime: '2027-05-18T15:00:00+09:00' }, end: { dateTime: '2027-05-18T16:00:00+09:00' } },
    { id: 'ov_cancel', status: 'cancelled', summary: '점검 취소된 것', start: { date: '2027-05-06' }, end: { date: '2027-05-07' } },
    { id: 'ov_long', summary: '점검 체험 학습 주간', start: { date: '2027-06-28' }, end: { date: '2027-07-03' } },
  ],
};
async function mockOverlay(ctx) {
  await ctx.route(/oauth2\.googleapis\.com\/tokeninfo/, (route) =>
    route.fulfill({ status: ov.tokenOk ? 200 : 400, headers: CORS, json: ov.tokenOk ? { expires_in: 3000 } : { error: 'invalid_token' } }),
  );
  await ctx.route(/www\.googleapis\.com\/calendar\/v3\//, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (!ov.tokenOk) return route.fulfill({ status: 401, headers: CORS, json: { error: { message: 'Invalid Credentials' } } });
    const url = new URL(req.url());
    if (url.pathname.endsWith('/users/me/calendarList')) return route.fulfill({ status: 200, headers: CORS, json: { items: ov.cals } });
    const m = url.pathname.match(/\/calendars\/([^/]+)\/events$/);
    if (!m || req.method() !== 'GET') return route.fulfill({ status: 405, headers: CORS, json: {} });
    const cal = decodeURIComponent(m[1]);
    const timeMin = url.searchParams.get('timeMin');
    const timeMax = url.searchParams.get('timeMax');
    ov.asks.push([cal, timeMin, timeMax]);
    if (cal.startsWith('gone@')) return route.fulfill({ status: 404, headers: CORS, json: { error: { message: 'Not Found' } } });
    if (ov.down) return route.fulfill({ status: 503, headers: CORS, json: { error: { message: 'Backend Error' } } });
    const lo = Date.parse(timeMin);
    const hi = Date.parse(timeMax);
    const at = (t) => Date.parse(t.dateTime ?? `${t.date}T00:00:00+09:00`);
    const items = cal.startsWith('grade@') ? ov.events.filter((e) => at(e.end) > lo && at(e.start) < hi) : [];
    return route.fulfill({ status: 200, headers: CORS, json: { items } });
  });
}
/** 이 기기 시각 그 달 1일 0시 (앱이 묻는 timeMin·timeMax 꼴) */
const monthStart = (y, m) => new Date(y, m - 1, 1).toISOString();

async function overlayBundle() {
  r.section('구글 캘린더 겹쳐 보기 (P36-3) - 고르기 · 받아 담기');
  const commonRef = doc(em.db, 'spaces', sid, 'settings', 'common');
  const before = (await getDoc(commonRef)).data()?.gcalOverlay;
  undo.add(() => setDoc(commonRef, { gcalOverlay: before === undefined ? deleteField() : before }, { merge: true }));
  await setDoc(commonRef, { gcalOverlay: deleteField() }, { merge: true });
  const picked = async () => ((await getDoc(commonRef)).data()?.gcalOverlay ?? []).map((c) => c.id);

  const { ctx, page, errors } = await newPage(browser);
  await mockOverlay(ctx);
  await ctx.addInitScript(() => sessionStorage.setItem('sp5-google-token', 'tok'));
  await open(page, `#/day/${DAY}`);
  const idbRows = () =>
    page.evaluate(
      (u) =>
        new Promise((res) => {
          const rq = indexedDB.open(`sp5-gcal-${u}`);
          rq.onsuccess = () => {
            const db = rq.result;
            if (!db.objectStoreNames.contains('months')) return (db.close(), res([]));
            const all = db.transaction('months').objectStore('months').getAll();
            all.onsuccess = () => (db.close(), res(all.result.map((x) => ({ key: x.key, ids: x.events.map((e) => e.id) }))));
          };
          rq.onerror = () => res([]);
        }),
      uid,
    );
  const openView = async () => {
    await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'view' }));
    await waitFor(page.locator(sel('settings-section', 'gcalOverlay')), 8000);
  };
  const GRADE = 'grade@group.calendar.google.com';
  const GONE = 'gone@group.calendar.google.com';
  const countNow = async () => Number(await page.locator(sel('gcal-overlay-count')).getAttribute('data-gcal-overlay-count'));

  await openView();
  r.check((await page.locator(sel('gcal-overlay-status')).count()) === 0 && (await page.locator(sel('gcal-overlay-list')).count()) === 0, '처음 = 목록 받기 단추만');
  r.check(ov.asks.length === 0, '고른 것이 없으면 구글에 일정을 묻지 않는다');
  await page.locator(sel('gcal-overlay-load')).click();
  r.check(await waitFor(page.locator(sel('gcal-overlay-pick', GRADE)), 8000), '📋 내 캘린더 목록 받기 → 줄');
  const rowIds = await page.locator('[data-gcal-overlay-pick]').evaluateAll((els) => els.map((e) => e.getAttribute('data-gcal-overlay-pick')));
  r.check(rowIds[0] === 'me@example.com' && !rowIds.includes('CAL_WORK') && rowIds.length === 3, `기본 캘린더 먼저 · 앱이 보내는 SP(work)는 없다 (${rowIds.join(', ')})`);
  r.check(((await page.locator(sel('gcal-overlay-row', 'me@example.com')).textContent()) ?? '').includes('(기본)'), '내 캘린더 (기본)');

  await page.locator(sel('gcal-overlay-pick', GRADE)).check();
  r.check((await serverUntil(picked, (l) => l.includes(GRADE))).includes(GRADE), '고르면 계정 칸 common gcalOverlay에');
  // 4~6월 = 5월 넷 + 6월 말에 시작하는 체험 학습 주간 (취소된 것은 빼고)
  r.check(await waitFor(async () => (await countNow()) === 5, 10000), `고르면 곧바로 받는다 - 받아 둔 일정 5개 (취소된 것은 빼고 · ${await countNow()})`);
  const first = ov.asks.find(([c]) => c === GRADE);
  r.check(first?.[1] === monthStart(2027, 4) && first?.[2] === monthStart(2027, 7), `보는 달 ±1 = 4~6월 한 번에 (${first?.[1]} ~ ${first?.[2]})`);
  r.check(await waitFor(async () => (await idbRows()).length === 3, 8000), '이 기기 IndexedDB에 달 칸 셋');
  const may = (await idbRows()).find((x) => x.key === `${GRADE}|2027-05`);
  r.check(may && may.ids.length === 4 && may.ids.includes('ov_rep_2') && !may.ids.includes('ov_cancel'), `5월 칸 = 펼친 반복 둘 포함 넷 (${may?.ids.join(', ')})`);
  r.check((await page.locator(sel('gcal-overlay-status')).textContent())?.includes('에 받음'), '받은 때가 보인다');
  const titles = new Set(ov.events.map((e) => e.summary));
  r.check(!(await getDocs(collection(em.db, 'spaces', sid, 'items'))).docs.some((d) => titles.has(String(d.data().text ?? ''))), '앱 자료(items)에는 쓰지 않는다');

  r.section('겹쳐 보기 - 화면을 옮기면 없는 달만 · 15분 안에는 다시 묻지 않음');
  await page.keyboard.press('Escape');
  const asked = ov.asks.length;
  await page.evaluate(() => (location.hash = '#/month/2027-07'));
  r.check(await waitFor(() => ov.asks.length > asked, 8000), '월간 7월로 옮기면 묻는다');
  const next = ov.asks.slice(asked).filter(([c]) => c === GRADE);
  r.check(next.length === 1 && next[0][1] === monthStart(2027, 7) && next[0][2] === monthStart(2027, 9), `받아 둔 6월은 빼고 7~8월만 (${next.map((a) => `${a[1]}~${a[2]}`).join(' | ')})`);
  const jul = await waitFor(async () => (await idbRows()).find((x) => x.key === `${GRADE}|2027-07`)?.ids.includes('ov_long'), 8000);
  r.check(jul, '6월 말~7월 초 걸친 일정은 7월 칸에도');
  const asked2 = ov.asks.length;
  await page.evaluate(() => (location.hash = '#/month/2027-06'));
  await page.waitForTimeout(1500);
  r.check(ov.asks.length === asked2, '돌아온 6월(5~7월 모두 받음)은 15분 안이라 묻지 않는다');

  r.section('겹쳐 보기 - 로그인 끊김 · 끊김 · 지운 캘린더');
  ov.tokenOk = false;
  const asked3 = ov.asks.length;
  await page.evaluate(() => (location.hash = '#/month/2027-10'));
  await openView();
  r.check(await waitFor(page.locator(sel('gcal-overlay-login')), 8000), '토큰이 없으면 로그인 창 없이 안내 (전에 받은 것을 보인다)');
  r.check(ov.asks.length === asked3 && (await page.locator(sel('google-login-prompt')).count()) === 0, "구글에 일정을 묻지 않고 '구글 로그인이 필요합니다' 창도 띄우지 않는다");
  r.check((await countNow()) >= 5, `받아 둔 것은 그대로 (${await countNow()})`);
  ov.tokenOk = true;
  await page.evaluate(() => sessionStorage.setItem('sp5-google-token', 'tok2'));
  await page.locator(sel('gcal-overlay-refresh')).click();
  r.check(await waitFor(async () => (await page.locator(sel('gcal-overlay-login')).count()) === 0, 8000), '🔄 다시 받기 → 받고 안내가 사라진다');
  r.check(ov.asks.slice(asked3).some(([c, lo]) => c === GRADE && lo === monthStart(2027, 9)), '10월 ±1(9~11월)을 받았다');
  const kept = await countNow();
  ov.down = true;
  await page.locator(sel('gcal-overlay-refresh')).click();
  r.check(await waitFor(page.locator(sel('gcal-overlay-error')), 8000), '구글이 503 → 안내 글');
  r.check((await countNow()) === kept && (await idbRows()).some((x) => x.key === `${GRADE}|2027-10`), `받아 둔 것은 지우지 않는다 (${kept})`);
  ov.down = false;
  await page.locator(sel('gcal-overlay-load')).click();
  await waitFor(page.locator(sel('gcal-overlay-pick', GONE)), 8000);
  await page.locator(sel('gcal-overlay-pick', GONE)).check();
  r.check(await waitFor(page.locator(sel('gcal-overlay-missing', GONE)), 8000), '404 캘린더 = 구글에서 찾을 수 없음');
  // 설정은 1초 뒤 올라간다 - 올라간 뒤에도 404 때문에 빠지지 않는지
  await serverUntil(picked, (l) => l.includes(GONE));
  await page.waitForTimeout(2000);
  r.check((await picked()).includes(GONE) && (await page.locator(sel('gcal-overlay-pick', GONE)).isChecked()), '고른 것은 지우지 않는다 (계정 칸·체크 그대로)');

  r.section('겹쳐 보기 - 빼기');
  await page.locator(sel('gcal-overlay-pick', GRADE)).uncheck();
  r.check(!(await serverUntil(picked, (l) => !l.includes(GRADE))).includes(GRADE), '빼면 계정 칸에서 빠진다');
  r.check(await waitFor(async () => !(await idbRows()).some((x) => x.key.startsWith(`${GRADE}|`)), 8000), '그 캘린더의 받은 것을 이 기기에서 지운다');
  await page.locator(sel('gcal-overlay-pick', GONE)).uncheck();
  await serverUntil(picked, (l) => l.length === 0);
  await page.waitForTimeout(2500);
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
  await ctx.close();
}

// ── 겹쳐 그리기 (P36-4) - 하루·주간·월간(막대)·년간(학사력·자세히)·한눈에 · 창 · 끄고 켜기 · 인쇄에는 없다 ──
async function drawBundle() {
  r.section('구글 캘린더 겹쳐 그리기 (P36-4) - 하루');
  const GRADE = 'grade@group.calendar.google.com';
  const commonRef = doc(em.db, 'spaces', sid, 'settings', 'common');
  const before = (await getDoc(commonRef)).data()?.gcalOverlay;
  undo.add(() => setDoc(commonRef, { gcalOverlay: before === undefined ? deleteField() : before }, { merge: true }));
  await setDoc(commonRef, { gcalOverlay: [{ id: GRADE, name: '학년 협의', color: '#16a765' }] }, { merge: true });
  // 그리기 점검 일정 셋 더 (종일 하루 ov_allday는 있다): 종일 여러 날(설명에 HTML) · 시각 하루 · 밤을 넘는 시각
  ov.events.push(
    { id: 'ov_trip', summary: '점검 수학여행', start: { date: '2027-05-04' }, end: { date: '2027-05-07' }, description: '준비물<br><b>도시락</b> &amp; 물병', location: '경주', htmlLink: 'https://www.google.com/calendar/event?eid=ov2' },
    { id: 'ov_talk', summary: '점검 교과 협의', start: { dateTime: '2027-05-04T14:00:00+09:00' }, end: { dateTime: '2027-05-04T15:30:00+09:00' }, location: '3층 회의실' },
  );
  // 앱 기간 일정 (같은 주 - 막대 줄이 겹치지 않는지)
  // 이 묶음만 돌 때(ONLY=draw)도 지운다 - 남으면 다음 전체 점검의 하루 칸에 카드가 하나 더 서서 🗑️ 찾기가 둘을 만난다
  undo.add(() => deleteDoc(ref('items', 'inspGcalDrawPeriod')));
  await setDoc(ref('items', 'inspGcalDrawPeriod'), { kind: 'event', date: '2027-05-03', endDate: '2027-05-05', text: '구글점검 앱 기간', labelIds: [], order: 'a0', createdAt: Date.now(), authorId: uid, ...base });

  const { ctx, page, errors } = await newPage(browser);
  await mockOverlay(ctx);
  await ctx.addInitScript(() => sessionStorage.setItem('sp5-google-token', 'tok'));
  await open(page, `#/day/${DAY}`);
  const at = (where, id) => page.locator(`[data-gcal-at="${where}"]${id ? `[data-gcal-event="${id}"]` : ''}`);
  const ids = (loc) => loc.evaluateAll((els) => els.map((e) => e.getAttribute('data-gcal-event')));
  r.check(await waitFor(async () => (await at('day').count()) === 3, 10000), `하루 일정 칸에 구글 일정 셋 (${await at('day').count()})`);
  const dayIds = await ids(at('day'));
  r.check(dayIds.join(',') === 'ov_allday,ov_trip,ov_talk' || dayIds.join(',') === 'ov_trip,ov_allday,ov_talk', `차례 = 시각 없는 것(종일) 먼저, 그다음 시각 (${dayIds.join(', ')})`);
  r.check((await page.locator(sel('gcal-group-count')).getAttribute('data-gcal-group-count')) === '3', "구분 줄 '📅 구글 캘린더 3'");
  const talk = at('day', 'ov_talk');
  r.check((await talk.locator('[data-gcal-time]').textContent()) === '14:00~15:30' && (await talk.locator('[data-gcal-chip]').textContent()) === '학년 협의', '시각 일정 = 이름 칩 + 14:00~15:30');
  const dash = await talk.evaluate((el) => getComputedStyle(el).borderTopStyle);
  r.check(dash === 'dashed', `점선 테두리 - 색만으로 가르지 않는다 (${dash})`);
  r.check((await page.locator(`${sel('day-events', DAY)} [data-event-done-chip]`).count()) === (await page.locator(`${sel('day-events', DAY)} [data-event-card]`).count()), '완료 칩은 앱 일정에만 (구글 카드에는 없다)');

  r.section('겹쳐 그리기 - 누르면 그 일정 창');
  await talk.click();
  const win = page.locator(sel('gcal-window'));
  r.check(await waitFor(win, 8000), "누르면 '📅 구글 캘린더 일정' 창");
  r.check((await page.locator(sel('gcal-window-when')).textContent())?.includes('5월 4일 (화) 14:00 ~ 15:30'), `때 = 5월 4일 (화) 14:00 ~ 15:30 (${await page.locator(sel('gcal-window-when')).textContent()})`);
  r.check((await page.locator(sel('gcal-window-location')).textContent())?.includes('3층 회의실'), '장소');
  r.check((await page.locator(sel('gcal-window-open')).count()) === 0, '구글 주소가 없으면 열기 단추도 없다');
  await at('day', 'ov_trip').click();
  r.check(await waitFor(async () => (await page.locator(sel('gcal-window-title')).textContent()) === '점검 수학여행', 8000), '다른 것을 누르면 그 창이 그것으로 바뀐다 (창 하나)');
  r.check((await page.locator(sel('gcal-window')).count()) === 1, '창은 하나');
  r.check((await page.locator(sel('gcal-window-when')).textContent())?.includes('5월 4일 (화) ~ 5월 6일 (목) · 3일'), '종일 여러 날 = 끝 날은 하루 빼고 · 3일');
  const desc = await page.locator(sel('gcal-window-description')).innerText();
  r.check(desc === '준비물\n도시락 & 물병', `설명 = HTML을 걷은 글 (${JSON.stringify(desc)})`);
  r.check((await page.locator(`${sel('gcal-window-description')} b`).count()) === 0, '설명을 HTML로 그리지 않는다');
  const link = page.locator(sel('gcal-window-open'));
  r.check((await link.getAttribute('href')) === 'https://www.google.com/calendar/event?eid=ov2' && (await link.getAttribute('target')) === '_blank', '↗ 구글 캘린더에서 열기 = 구글 주소 새 탭');
  await page.locator(sel('gcal-window-to-event')).click();
  const panel = page.locator(sel('event-panel'));
  r.check(await waitFor(panel, 8000), '📅 일정으로 담기 → 새 일정 칸');
  r.check(
    await waitFor(async () => (await page.locator('[data-event-text-input]').inputValue().catch(() => '')) === '점검 수학여행', 5000),
    `제목을 적어 둔 채 (${await page.locator('[data-event-text-input]').inputValue().catch(() => '?')})`,
  );
  r.check((await page.locator(sel('gcal-window')).count()) === 0, '구글 일정 창은 닫힌다');
  await page.keyboard.press('Escape');
  await waitFor(async () => (await panel.count()) === 0, 5000);

  r.section("겹쳐 그리기 - 둘째 줄 '📅 구글' (이 기기)");
  const toggle = page.locator(sel('gcal-toggle'));
  r.check((await toggle.getAttribute('aria-pressed')) === 'true', '고른 캘린더가 있으면 토글이 서고 켜져 있다');
  await toggle.click();
  r.check(await waitFor(async () => (await at('day').count()) === 0, 5000), '끄면 구글 일정이 사라진다');
  r.check((await page.evaluate(() => localStorage.getItem('sp5-gcal-view')))?.includes('"on":false'), '이 기기에 기억 (sp5-gcal-view)');
  await toggle.click();
  r.check(await waitFor(async () => (await at('day').count()) === 3, 5000), '켜면 다시');

  r.section('겹쳐 그리기 - 주간·월간(막대)');
  await page.evaluate(() => (location.hash = '#/week/2027-05-04'));
  r.check(await waitFor(async () => (await page.locator(`${sel('week-day', '2027-05-04')} [data-gcal-at="week"]`).count()) === 3, 8000), '주간 화요일 칸에 셋');
  r.check((await page.locator(`${sel('week-day', '2027-05-06')} [data-gcal-at="week"][data-gcal-event="ov_trip"]`).count()) === 1, '여러 날 일정은 이어지는 날 칸에도 (목)');
  r.check((await page.locator(`${sel('week-day', '2027-05-07')} [data-gcal-at="week"]`).count()) === 0, '종일 끝 날(구글은 다음 날 0시)에는 없다 (금)');
  await page.locator(`${sel('week-day', '2027-05-04')} [data-gcal-event="ov_talk"]`).click();
  r.check(await waitFor(win, 5000), '주간에서 눌러도 그 창 (하루 화면으로 가지 않는다)');
  r.check(hashOf(page).startsWith('#/week/'), `주간 그대로 (${hashOf(page)})`);
  await page.keyboard.press('Escape');

  await page.evaluate(() => (location.hash = '#/month/2027-05'));
  const bar = page.locator('[data-gcal-bar][data-gcal-event="ov_trip"]');
  r.check(await waitFor(bar, 8000), '월간 = 여러 날은 막대');
  r.check((await page.locator(`${sel('month-day', '2027-05-04')} [data-gcal-at="month"][data-gcal-event="ov_allday"]`).count()) === 1, '하루짜리 종일은 그날 칸 안 줄');
  r.check((await page.locator(`${sel('month-day', '2027-05-11')} [data-gcal-event="ov_rep_1"] [data-gcal-time]`).textContent()) === '15:00', '시각 일정은 시작 시각만');
  const appBar = page.locator(sel('period-bar', 'inspGcalDrawPeriod')).first();
  r.check(await waitFor(appBar, 5000), '앱 기간 막대도 있다');
  const [a, b] = [await appBar.boundingBox(), await bar.first().boundingBox()];
  const overlap = a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  r.check(a && b && !overlap, `앱 막대와 구글 막대가 겹치지 않는다 (한 막대 줄 배치 - 앱 y${Math.round(a?.y ?? 0)} 구글 y${Math.round(b?.y ?? 0)})`);
  await page.locator('[data-gcal-bar-cell="2027-05-05"]').click();
  r.check(await waitFor(win, 5000), '막대를 누르면 그 창');
  r.check((await page.locator(sel('gcal-window-title')).textContent()) === '점검 수학여행' && hashOf(page) === '#/month/2027-05', '하루 화면으로 가지 않는다');
  await page.keyboard.press('Escape');

  r.section('겹쳐 그리기 - 년간(학사력·자세히)·한눈에');
  await page.evaluate(() => (location.hash = '#/year/2027'));
  const sheetItem = page.locator('[data-gcal-at="sheet-month"][data-gcal-event="ov_allday"]');
  r.check(await waitFor(sheetItem, 10000), '학사력 달 아래 목록에 구글 일정 줄');
  r.check((await page.locator('[data-sheet-bar][data-gcal-bar]').count()) >= 1, '학사력 날짜 칸의 가는 막대 (여러 날)');
  await page.locator(sel('year-view', 'detail')).click();
  const yearTrip = page.locator('[data-gcal-at="year"][data-gcal-event="ov_trip"]');
  r.check(await waitFor(yearTrip, 8000), '자세히 - 여러 날은 첫날 한 번');
  r.check((await yearTrip.count()) === 1 && ((await yearTrip.locator('[data-gcal-range]').textContent()) ?? '').includes('5.4 ~ 5.6'), `범위와 함께 (${await yearTrip.locator('[data-gcal-range]').textContent()})`);
  r.check((await page.locator(`${sel('year-day', '2027-05-20')} [data-gcal-event="ov_timed"]`).count()) === 1, '구글 일정만 있는 날도 줄로 선다 (5/20)');
  await page.locator(sel('year-view', 'sheet')).click();

  await page.evaluate(() => (location.hash = '#/board/2027-05-04'));
  const boardRow = page.locator('[data-gcal-at="board"][data-gcal-event="ov_talk"]');
  r.check(await waitFor(boardRow, 10000), '한눈에 달 목록에 구글 일정 줄');
  r.check((await page.locator(`${sel('board-cal-day', '2027-05-20')}`).getAttribute('data-board-cal-count')) === '1', '달력 날 점도 센다 (구글 일정만 있는 5/20)');
  r.check((await page.locator(`${sel('week-day', '2027-05-04')} [data-gcal-at="week"]`).count()) === 3, '한눈에 요일 칸에도');
  await page.locator(sel('board-cal-day', '2027-05-11')).click();
  await boardRow.click();
  r.check(await waitFor(win, 5000), '목록 줄을 누르면 그날 고르기 + 그 창');
  r.check(hashOf(page) === '#/board/2027-05-04', `그날을 고른다 (${hashOf(page)})`);
  await page.keyboard.press('Escape');

  r.section('겹쳐 그리기 - 인쇄에는 없다');
  await page.evaluate(() => (location.hash = '#/month/2027-05'));
  await waitFor(bar, 8000);
  await page.keyboard.press('Control+p');
  const paper = page.locator('[data-print-paper]');
  r.check(await waitFor(paper.filter({ hasText: '구글점검 앱 기간' }), 8000), '인쇄 미리보기에 앱 일정은 있다');
  r.check((await paper.locator('[data-gcal-event]').count()) === 0, '구글 일정은 인쇄 쪽에 없다');
  r.check((await page.locator('[data-gcal-bar]').count()) > 0, '화면에는 그대로');
  await page.keyboard.press('Escape');
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
  await ctx.close();
}
const hashOf = (page) => new URL(page.url()).hash;

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
  // ONLY=draw = 겹쳐 그리기 묶음만 (P36-4)
  if (process.env.ONLY === 'draw') throw Object.assign(new Error('draw only'), { drawOnly: true });
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
  // 손으로 보내기: 라벨 없는 일정·기록·그날 바꾼 수업 칸
  await setDoc(ref('items', 'inspGcalManualEv'), { kind: 'event', date: DAY_M, text: '구글점검 손 일정', labelIds: [], order: 'a0', createdAt: Date.now(), authorId: uid, ...base });
  await setDoc(ref('items', 'inspGcalManualNote'), { kind: 'note', date: DAY_M, text: '구글점검 손 기록', labelIds: [], order: 'a0', createdAt: Date.now(), authorId: uid, ...base });
  const dayRef = ref('lessonDays', DAY_M);
  const oldDay = await getDoc(dayRef);
  await setDoc(dayRef, { periods: { '1': { subject: '점검국어' } }, updatedAt: serverTimestamp(), v: 1 });
  undo.add(() => (oldDay.exists() ? setDoc(dayRef, oldDay.data()) : deleteDoc(dayRef)));
  // 기간 일정 (월~수) - 보이는 날마다 하나
  await setDoc(ref('items', 'inspGcalPeriod'), { kind: 'event', date: DAY_P, endDate: '2027-05-12', text: '구글점검 기간', labelIds: [LABEL], order: 'a0', createdAt: Date.now(), authorId: uid, ...base });
  google.events.set('V4SENT', {
    id: 'V4SENT',
    _cal: 'CAL_WORK',
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
  await card.locator(sel('event-done-chip')).click();
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
  await v4card.locator(sel('event-done-chip')).click();
  r.check(await waitFor(() => google.events.get('V4SENT')?.extendedProperties?.private?.sp_item === 'inspGcalV4', 10000), 'V4 것을 고쳐 V5가 맡는다(sp_item)');
  const twins = all().filter((e) => e.start?.date === DAY_V4 && bare(e.summary).includes('구글점검 가져온 일정'));
  r.check(twins.length === 1 && bare(twins[0].summary).startsWith('✅'), `두 벌이 되지 않는다 (${twins.length}) · 완료 ✅`);

  r.section('기간 일정 = 보이는 날마다 (k/n)');
  await page.goto(page.url().replace(/#.*$/, `#/day/${DAY_P}`));
  const pcard = page.locator(sel('event-card', 'inspGcalPeriod'));
  await waitFor(pcard, 8000);
  await pcard.locator(sel('event-done-chip')).click();
  r.check(await waitFor(() => ofItem('inspGcalPeriod').length === 3, 10000), `사흘 = 셋 (${ofItem('inspGcalPeriod').length})`);
  const ps = ofItem('inspGcalPeriod').sort((a, b) => a.start.date.localeCompare(b.start.date));
  r.check(ps.map((e) => bare(e.summary)).join(' | ') === '✅ 구글점검 기간 (1/3) [구글점검] | 구글점검 기간 (2/3) [구글점검] | 구글점검 기간 (3/3) [구글점검]', `그날만 완료 ✅ (${ps.map((e) => bare(e.summary)).join(' | ')})`);

  r.section('토큰이 없을 때');
  google.tokenOk = false;
  await page.evaluate(([s, d]) => window.sp5.openWindow('event', { sid: s, date: d }), [sid, DAY]);
  await page.locator(sel('event-text-input')).fill('구글점검 로그인');
  await pickLabel(page);
  // 방금 누르지 않은 것처럼 (방금 누른 때면 로그인 창을 바로 연다 - PC 크롬)
  await noUserActivation(page);
  await page.locator(sel('event-save')).click();
  const prompt = page.locator(sel('google-login-prompt'));
  r.check(await waitFor(prompt, 10000), "저장하면 '구글 로그인이 필요합니다' (로그인이 없다)");
  await noUserActivation(page, false);
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

  r.section('손으로 보내기 (병합·교체)');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.sp5.runShortcut('calendar'));
  const win = page.locator(sel('calendar-sync-window'));
  r.check(await waitFor(win, 8000), "단축키 '구글 캘린더로 보내기' = 창");
  await page.locator(sel('cal-start')).fill(DAY_M);
  await page.locator(sel('cal-end')).fill(DAY_M);
  await page.locator(sel('cal-include', 'journal')).check();
  await page.locator(sel('cal-send')).click();
  r.check(await waitFor(page.locator(sel('cal-result')), 15000), '끝나면 결과 줄');
  const work = () => inCal('SP(work)').filter((e) => e.start?.date === DAY_M);
  r.check(work().length === 1 && bare(work()[0].summary) === '구글점검 손 일정 [일정]' && !work()[0].extendedProperties.private.sp_auto, '일정 → SP(work) (자동 표시 없음)');
  r.check(inCal('SP(class)').some((e) => e.start?.date === DAY_M && bare(e.summary) === '[1교시] 점검국어'), '수업 → SP(class) [1교시] 과목');
  r.check(inCal('SP(commentary)').some((e) => e.start?.date === DAY_M && bare(e.summary) === '구글점검 손 기록 [기록]'), '기록 → SP(commentary)');
  const before = google.events.size;
  await page.locator(sel('cal-send')).click();
  await waitFor(async () => !(await page.locator(sel('cal-send')).isDisabled()), 15000);
  await page.waitForTimeout(500);
  r.check(google.events.size === before, `병합을 다시 해도 두 벌이 되지 않는다 (${before} → ${google.events.size})`);
  await setDoc(ref('items', 'inspGcalManualNote'), { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  await page.waitForTimeout(1500);
  await page.locator(sel('cal-mode', 'overwrite')).click();
  await page.locator(sel('cal-send')).click();
  r.check(await waitFor(() => !inCal('SP(commentary)').some((e) => e.start?.date === DAY_M), 15000), '교체: 지운 기록은 구글에서도 지운다');
  await waitFor(async () => !(await page.locator(sel('cal-send')).isDisabled()), 15000);
  await page.locator(sel('cal-start')).fill(TODAY);
  await page.locator(sel('cal-end')).fill(TODAY);
  await page.locator(sel('cal-send')).click();
  await waitFor(async () => (await page.locator(sel('cal-send')).isDisabled()) === false && google.calls > 0, 15000);
  await page.waitForTimeout(1000);
  r.check(ofItem('inspGcalCarried').length === 1 && ofItem('inspGcalCarried')[0].start?.date === TODAY, '오늘을 교체해도 이월 중인 일정(자동)은 남는다 (자동 표시도 그대로)');
  await page.evaluate(() => window.sp5.closeAllWindows());

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
  await ctx.close();

  await overlayBundle();
  await drawBundle();
} catch (e) {
  if (e?.drawOnly) {
    try {
      await drawBundle();
    } catch (e2) {
      r.bad(`점검이 멈췄다: ${e2?.stack ?? e2}`);
    }
  } else r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
