// tools/inspect-search-trash.mjs - P5-4: 검색·휴지통을 실제 크롬에서 본다.
//   1) 검색: 🔍 → 창, 치는 대로(글·표 칸 글·첨부 이름), 갈래(일정만)·기간(직접 지정)·라벨로 거르기, 빈 검색어 + 첨부파일 = 파일 모아 보기,
//      결과 = 그날 하루 화면으로 가서 카드를 짚는다(접힌 기록 칸을 편다), 메모 = 메모 화면, ✏️ = 쓰는 칸.
//   2) 휴지통: 🗑️ → 창, 탭·수, 'V4에서 지움', 복원(되돌리기 = 다시 지움), 영구 삭제(묻고 - 문서가 사라지고 V5에서 올린 첨부는 드라이브에서),
//      탭을 바꾸면 고른 것이 풀린다, 일괄 복원, D-Day 되살리기, ⚙️ 자동 비우기 7일 = 계정 설정 + 열 때 지난 것을 비운다.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-search-trash.mjs
// 에뮬레이터 teacher 계정에 점검 항목(insp_se…·insp_tr…)을 심고 끝에 지운다. 계정 설정 common(trashDays·ddays)은 끝에 되돌린다.
// 구글 API(tokeninfo·드라이브 지우기)는 page.route로 흉내 낸다.
import { Timestamp, deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { emulator, hashOf, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const DAY = 86_400_000;
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const labelRef = (id) => doc(em.db, 'spaces', sid, 'labels', id);
const commonRef = doc(em.db, 'spaces', sid, 'settings', 'common');
const read = async (ref) => {
  const s = await getDoc(ref);
  return s.exists() ? s.data() : null;
};
const now = Date.now();
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: now, authorId: uid };
const gone = (ms) => ({ deletedAt: Timestamp.fromMillis(now - ms), deletedBy: uid });
const ITEMS = {
  insp_se1: { kind: 'event', date: '2026-09-15', text: '점검찾기 현장체험학습', labelIds: ['insp_sel'], order: 'Zz1' },
  insp_se2: { kind: 'note', date: '2026-09-16', text: '점검찾기 상담 기록', labelIds: [], order: 'Zz1', tables: [{ id: 't1', rows: [{ cells: [{ v: '점검찾기표칸' }, { v: '버스' }] }], createdAt: 1 }] },
  insp_se3: { kind: 'note', date: null, text: '점검찾기 준비물 메모', labelIds: [], order: 'Zz0', attachments: [{ name: '점검찾기안내.pdf', url: 'https://example.com/a.pdf', type: 'application/pdf' }] },
  insp_tr1: { kind: 'event', date: '2026-09-20', text: '점검휴지통 일정', labelIds: [], order: 'Zz1', ...gone(2 * DAY) },
  insp_tr2: { kind: 'note', date: null, text: '점검휴지통 V4 메모', labelIds: [], order: 'Zz1', ...gone(3 * DAY), deletedBy: 'v4-import' },
  insp_tr3: { kind: 'note', date: '2026-09-21', text: '점검휴지통 오래된 기록', labelIds: [], order: 'Zz1', ...gone(10 * DAY) },
  insp_tr4: { kind: 'note', date: null, text: '점검휴지통 첨부 메모', labelIds: [], order: 'Zz2', ...gone(DAY), attachments: [{ name: '사진.png', url: 'https://drive.google.com/uc?export=download&id=DRV_TR4', type: 'image/png', driveId: 'DRV_TR4' }] },
};
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
const driveDeletes = [];

try {
  await setDoc(labelRef('insp_sel'), { kind: 'event', name: '점검찾기라벨', color: 'green', parentId: null, order: 'Zz1', ...stamp });
  await setDoc(labelRef('insp_trl'), { kind: 'note', name: '점검휴지통라벨', color: 'red', parentId: null, order: 'Zz9', ...stamp, ...gone(4 * DAY) });
  undo.add(() => deleteDoc(labelRef('insp_sel')));
  undo.add(() => deleteDoc(labelRef('insp_trl')));
  for (const [id, data] of Object.entries(ITEMS)) {
    await setDoc(itemRef(id), { ...stamp, createdAt: id === 'insp_se3' ? new Date('2026-09-20T09:00:00').getTime() : now, ...data });
    undo.add(() => deleteDoc(itemRef(id)));
  }
  const commonBefore = await read(commonRef);
  undo.add(async () => {
    if (!(await getDoc(commonRef)).exists()) return;
    await updateDoc(commonRef, { ddays: commonBefore?.ddays ?? deleteField(), ddayPick: commonBefore?.ddayPick ?? deleteField(), trashDays: commonBefore?.trashDays ?? deleteField() });
  });
  await setDoc(commonRef, { ddays: [...(commonBefore?.ddays ?? []), { id: 'insp_dd', title: '점검휴지통 D-Day', date: '2026-12-01', deletedAt: now - 5 * DAY }], updatedAt: serverTimestamp(), v: 1 }, { merge: true });

  const { page, errors, dialogs } = await newPage(browser);
  const ctx = page.context();
  await ctx.route(/oauth2\.googleapis\.com\/tokeninfo/, (route) => route.fulfill({ status: 200, headers: CORS, json: { expires_in: 3000 } }));
  await ctx.route(/www\.googleapis\.com\/drive\/v3\/files\//, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.method() === 'DELETE') driveDeletes.push(req.url().split('/files/')[1]);
    return route.fulfill({ status: 204, headers: CORS, body: '' });
  });
  await ctx.addInitScript(() => sessionStorage.setItem('sp5-google-token', 'fake-token'));
  // 영구 삭제의 묻는 창 = 확인 (probe.newPage가 받는다)
  dialogs.answer = true;
  await open(page, '#/day/2026-09-10');
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  const hit = (key) => page.locator(sel('search-hit', key));
  const hitKeys = async () => page.locator(sel('search-hit')).evaluateAll((els) => els.map((e) => e.dataset.searchHit));

  r.section('검색');
  await page.locator(sel('header-search')).click();
  r.check(await waitFor(page.locator(sel('search-window'))), '🔍 = 검색 창');
  await page.locator(sel('search-input')).fill('점검찾기');
  r.check(await waitFor(hit('insp_se1'), 8000), '치는 대로 찾는다 (일정)');
  let keys = await hitKeys();
  r.check(keys.includes('insp_se2') && keys.includes('insp_se3') && keys.includes('insp_se3#0'), `기록·메모·첨부도 (${keys.join(', ')})`);
  r.check(keys.indexOf('insp_se3') < keys.indexOf('insp_se2') && keys.indexOf('insp_se2') < keys.indexOf('insp_se1'), '날짜 내림차순 (메모는 만든 날 9.20)');
  await page.locator(sel('search-input')).fill('점검찾기표칸');
  r.check(await waitFor(async () => (await hitKeys()).join() === 'insp_se2'), '붙인 표의 칸 글도 찾는다');
  await page.locator(sel('search-input')).fill('점검찾기');
  await page.locator(sel('search-kind', 'event')).click();
  r.check(await waitFor(async () => (await hitKeys()).join() === 'insp_se1'), '갈래: 일정만');
  await page.locator(sel('search-kind', 'all')).click();
  await page.locator(sel('search-label')).selectOption('insp_sel');
  r.check(await waitFor(async () => (await hitKeys()).join() === 'insp_se1'), '라벨로 거르기');
  await page.locator(sel('search-label')).selectOption('');
  await page.locator(sel('search-scope')).selectOption('custom');
  await page.locator(sel('search-range', 'start')).fill('2026-09-16');
  await page.locator(sel('search-range', 'end')).fill('2026-09-16');
  r.check(await waitFor(async () => (await hitKeys()).join() === 'insp_se2'), '기간 직접 지정 (9.16 - 메모는 만든 날로 빠진다)');
  await page.locator(sel('search-scope')).selectOption('all');
  await page.locator(sel('search-input')).fill('');
  await page.locator(sel('search-kind', 'attachment')).click();
  r.check(await waitFor(hit('insp_se3#0')), '빈 검색어 + 첨부파일 = 파일 모아 보기');
  r.check(await page.locator(sel('search-hit-kind', 'attachment')).count() === (await page.locator(sel('search-hit')).count()), '첨부파일만 나온다');
  await page.locator(sel('search-kind', 'all')).click();
  await page.locator(sel('search-input')).fill('점검찾기');
  await hit('insp_se1').click();
  r.check(await waitFor(async () => hashOf(page) === '#/day/2026-09-15', 5000), `결과 = 그날 하루 화면 (${hashOf(page)})`);
  r.check(await waitFor(page.locator('[data-event-card="insp_se1"][data-search-focus="1"]'), 5000), '찾은 일정 카드를 짚는다');
  r.check(await waitFor(page.locator(sel('search-window'))), '검색 창은 오른쪽 칸에 그대로');
  await hit('insp_se2').click();
  await waitFor(async () => hashOf(page) === '#/day/2026-09-16', 5000);
  await waitFor(page.locator('[data-entry-card="insp_se2"]'), 5000);
  await page.locator(sel('journal-collapse')).click();
  await waitFor(async () => (await page.locator('[data-entry-card="insp_se2"]').count()) === 0);
  await hit('insp_se2').click();
  r.check(await waitFor(page.locator('[data-entry-card="insp_se2"][data-search-focus="1"]'), 5000), '접힌 기록 칸을 펴고 짚는다');
  await hit('insp_se3').click();
  r.check(await waitFor(async () => hashOf(page) === '#/memo', 5000), '메모 = 메모 화면');
  r.check(await waitFor(page.locator('[data-entry-card="insp_se3"][data-search-focus="1"]'), 6000), '찾은 메모 카드를 짚는다 (가려 있으면 거르개를 푼다)');
  await page.locator(sel('search-open', 'insp_se1')).click();
  r.check(await waitFor(page.locator(sel('event-panel', 'edit'))), '✏️ = 그 일정 칸');
  await page.keyboard.press('Escape');

  r.section('휴지통');
  await page.goto(page.url().replace(/#.*$/, '#/day/2026-09-10'));
  await page.locator(sel('header-trash')).click();
  r.check(await waitFor(page.locator(sel('trash-window'))), '🗑️ = 휴지통 창');
  const row = (key) => page.locator(sel('trash-row', key));
  r.check(await waitFor(row('event:insp_tr1'), 8000), '지운 일정이 보인다');
  r.check((await row('memo:insp_tr2').locator(sel('trash-v4')).count()) === 1, "V4에서 지워진 것 = 'V4에서 지움'");
  r.check((await row('label:insp_trl').count()) === 1 && (await row('dday:insp_dd').count()) === 1, '라벨·D-Day도 (기타)');
  await page.locator(sel('trash-tab', 'etc')).click();
  r.check(await waitFor(async () => (await row('label:insp_trl').count()) === 1 && (await row('event:insp_tr1').count()) === 0), '기타 탭 = 라벨·D-Day');
  await page.locator(sel('trash-tab', 'all')).click();
  await row('event:insp_tr1').locator(sel('trash-restore')).click();
  r.check(!(await serverUntil(() => read(itemRef('insp_tr1')), (d) => !d?.deletedAt))?.deletedAt, '복원 = 지운 표시 걷기 (서버)');
  r.check(await waitFor(async () => (await row('event:insp_tr1').count()) === 0), '휴지통에서 빠진다');
  await page.locator(sel('toast')).filter({ hasText: '복원' }).locator('[data-toast-action="되돌리기"]').click();
  r.check(!!(await serverUntil(() => read(itemRef('insp_tr1')), (d) => !!d?.deletedAt))?.deletedAt, '안내의 되돌리기 = 다시 지운다');
  r.check(await waitFor(row('event:insp_tr1')), '다시 휴지통에');
  await row('memo:insp_tr4').locator(sel('trash-purge')).click();
  r.check((await serverUntil(() => read(itemRef('insp_tr4')), (d) => d === null)) === null && dialogs.seen.some((m) => m.includes('영구 삭제')), '영구 삭제 = 묻고 문서가 사라진다');
  r.check(await waitFor(() => driveDeletes.includes('DRV_TR4'), 6000), `V5에서 올린 첨부는 드라이브에서도 (${driveDeletes.join(',')})`);
  await page.locator(sel('trash-tab', 'memo')).click();
  await page.locator(sel('trash-pick-all')).check();
  r.check((await page.locator(`${sel('trash-pick')}:checked`).count()) >= 1, '전체 선택 = 보는 탭');
  await page.locator(sel('trash-tab', 'journal')).click();
  r.check(await waitFor(async () => (await page.locator(`${sel('trash-pick')}:checked`).count()) === 0), '탭을 바꾸면 고른 것이 풀린다');
  await page.locator(sel('trash-tab', 'all')).click();
  await page.locator(sel('trash-pick', 'event:insp_tr1')).check();
  await page.locator(sel('trash-pick', 'dday:insp_dd')).check();
  await page.locator(sel('trash-restore-picked')).click();
  r.check(!(await serverUntil(() => read(itemRef('insp_tr1')), (d) => !d?.deletedAt))?.deletedAt, '일괄 복원 (일정)');
  const dd = await serverUntil(() => read(commonRef), (d) => d?.ddays?.some((x) => x.id === 'insp_dd' && !x.deletedAt), 8000);
  r.check(dd?.ddays?.some((x) => x.id === 'insp_dd' && !x.deletedAt), '일괄 복원 (D-Day - 계정 설정)');

  r.section('자동 비우기');
  await page.locator(sel('trash-settings')).click();
  await page.locator(sel('trash-days', '7')).click();
  r.check((await serverUntil(() => read(commonRef), (d) => d?.trashDays === 7, 8000))?.trashDays === 7, '⚙️ 7일 = 계정 설정 trashDays');
  r.check((await page.locator(sel('trash-auto')).getAttribute('data-trash-auto')) === '7', '안내 줄에 7일');
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await waitFor(async () => (await page.locator(sel('trash-window')).count()) === 0);
  await page.locator(sel('header-trash')).click();
  r.check((await serverUntil(() => read(itemRef('insp_tr3')), (d) => d === null, 8000)) === null, '열 때 7일이 지난 것은 비운다 (10일 전 기록)');
  r.check((await read(itemRef('insp_tr2')))?.deletedAt, '아직 안 지난 것은 남는다 (3일 전)');
  await page.locator(sel('trash-settings')).click();
  await page.locator(sel('trash-days', '0')).click();
  r.check((await serverUntil(() => read(commonRef), (d) => !d?.trashDays, 8000))?.trashDays === undefined, '끄기 = 기본값이라 칸이 빠진다');
  await page.waitForTimeout(2500);

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
