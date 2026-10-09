// tools/inspect-import-labels.mjs - P2-4: V4 라벨·설정 가져오기를 실제 크롬에서 본다
// (끝 조건: V4 seed → 가져오기 → 라벨 이름·색·속성·상위가 같다, 두 번째 가져오기는 '바뀐 것 0').
//   1) 가져온 적이 없으면 본문 맨 위에 'V4 자료 가져오기' 띠가 뜬다.
//   2) 띠의 '가져오기' → 환경설정 '가져오기' 탭이 열리고 결과 표가 나온다.
//   3) 서버의 V5 라벨이 V4와 같다: 이름·색·속성(V3 이름 먼저·구글 캘린더)·상위. 라벨 관리 창에도 그대로 보인다.
//   4) V4 설정(글자 크기·창 위치·이월 기간)이 V5 설정 문서에 들어오고 이 기기에 입혀진다.
//   5) 두 번째 가져오기는 바뀐 것 0 - 라벨 문서의 updatedAt이 그대로.
//   6) 가져온 뒤에는 띠가 없다. 가져오지 않고 '닫기'를 눌러도 계정에 남아 다시 뜨지 않는다.
//
//   npm run emu · V4 저장소 npm run seed · npm run seed · npm run dev:emu (켜 둔다) → node tools/inspect-import-labels.mjs
// 에뮬레이터 teacher 계정의 V4 설정 문서를 고쳐 심고(V4 seed 라벨 + 트리·구글 캘린더·V3 속성 이름·설정), 끝에 V4·V5 문서를 모두 되돌린다.
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const v4Ref = (id) => doc(em.db, 'users', uid, 'settings', id);
const v5Settings = (id) => doc(em.db, 'spaces', sid, 'settings', id);
const readDoc = async (ref) => {
  const s = await getDoc(ref);
  return s.exists() ? s.data() : null;
};
const v5Labels = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'labels'));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
};
/** 문서를 끝에 원래대로 (없던 것은 지운다) */
async function keep(ref) {
  const before = await readDoc(ref);
  undo.add(() => (before ? setDoc(ref, before) : deleteDoc(ref)));
  return before;
}

// V4 seed 라벨에 더한다: V3 속성 이름(이월을 V3에서 끔), 메모 라벨 상위/하위, 구글 캘린더, PC 설정
const V4_LABELS = {
  eventLabels: [
    { id: 'ev_1', name: '달력', color: 'red', calendar: true, skip: false, forward: false, period: false, recur: false },
    { id: 'ev_2', name: '수업X', color: 'orange', calendar: true, skip: true, forward: false, period: false, recur: false },
    { id: 'ev_3', name: '이월', color: 'green', calendar: false, skip: false, forward: true, period: false, recur: false, isForward: false },
    { id: 'ev_4', name: '기간', color: 'indigo', calendar: false, skip: false, forward: false, period: true, recur: false },
    { id: 'ev_5', name: '반복', color: 'purple', calendar: false, skip: false, forward: false, period: false, recur: true },
  ],
  journalLabels: [
    { id: 'j_1', name: '학급활동', color: 'green' },
    { id: 'j_2', name: '학생상담', color: 'yellow' },
    { id: 'j_3', name: '업무전달', color: 'blue' },
    { id: 'j_4', name: '수업기록', color: 'purple' },
  ],
  memoLabels: ['긴급', '중요', '업무', '개인', '기타', '점검학교', { name: '점검A초', color: 'pink' }],
};
const V4_TREE = { entry: { 점검A초: '점검학교' }, memo: {}, journal: {} };
const V4_GCAL = { labels: { ev_4: true } };
const V4_PC = { fontScale: 'lg', popupStyle: 'center', showWeekend: false, forwardLookbackDays: 21 };

const PROP_OF = (l) => ({
  calendar: typeof l.showInCalendar === 'boolean' ? l.showInCalendar : l.calendar !== false,
  forward: typeof l.isForward === 'boolean' ? l.isForward : !!l.forward,
  skip: !!l.skip,
  period: !!l.period,
  recur: !!l.recur,
  gcal: V4_GCAL.labels[l.id] === true,
});

try {
  // 심기 (V4·V5 문서를 끝에 되돌린다)
  const beforeIds = new Set((await v5Labels()).map((l) => l.id));
  undo.add(async () => {
    for (const l of await v5Labels()) if (!beforeIds.has(l.id)) await deleteDoc(doc(em.db, 'spaces', sid, 'labels', l.id));
  });
  // 가져오기는 일정·기록·수업도 함께 들여온다 - 끝에 걷는다(남기면 inspect-import-items·lessons가 '이미 있음'으로 센다)
  for (const c of ['items', 'series', 'timetables', 'lessonDays', 'progress']) {
    const ref = collection(em.db, 'spaces', sid, c);
    const had = new Set((await getDocs(ref)).docs.map((d) => d.id));
    undo.add(async () => {
      const extra = (await getDocs(ref)).docs.filter((d) => !had.has(d.id));
      for (let i = 0; i < extra.length; i += 400) {
        const b = writeBatch(em.db);
        for (const d of extra.slice(i, i + 400)) b.delete(d.ref);
        await b.commit();
      }
    });
  }
  for (const id of ['labels', 'v4_labelTree', 'v4_gcal', 'v4_preferences_pc']) await keep(v4Ref(id));
  for (const id of ['pc', 'mobile', 'common', 'import']) await keep(v5Settings(id));
  await setDoc(v4Ref('labels'), V4_LABELS);
  await setDoc(v4Ref('v4_labelTree'), V4_TREE);
  await setDoc(v4Ref('v4_gcal'), V4_GCAL);
  await setDoc(v4Ref('v4_preferences_pc'), V4_PC);
  for (const id of ['pc', 'common', 'import']) await deleteDoc(v5Settings(id));

  const { page, errors } = await newPage(browser);
  await open(page, '#/day/2026-10-08');
  const banner = page.locator(sel('import-banner'));

  r.section('처음 로그인 띠');
  r.check(await waitFor(banner, 8000), "가져온 적이 없으면 'V4 자료 가져오기' 띠가 뜬다");

  r.section('띠의 가져오기 → 환경설정 가져오기 탭');
  await page.locator(sel('import-banner-run')).click();
  r.check(await waitFor(page.locator(sel('settings-panel', 'import'))), '환경설정 가져오기 탭이 열린다');
  r.check(await waitFor(page.locator(sel('import-result')), 15000), '결과 표가 나온다');
  const count = async (kind, what) => Number(await page.locator(`${sel('import-row', kind)} ${sel('import-count', what)}`).textContent());
  const nNote = V4_LABELS.journalLabels.length + V4_LABELS.memoLabels.length;
  r.check((await count('labels.event', 'added')) === 5, '일정 라벨 새로 5', `새로 ${await count('labels.event', 'added')}`);
  r.check((await count('labels.note', 'added')) === nNote, `메모·기록 라벨 새로 ${nNote}`, `새로 ${await count('labels.note', 'added')}`);
  r.check(!(await banner.isVisible()), '가져오면 띠가 없어진다');

  r.section('서버 라벨 = V4 (이름·색·속성·상위)');
  const all = await serverUntil(v5Labels, (ls) => ls.filter((l) => !beforeIds.has(l.id)).length >= 5 + nNote);
  const mine = all.filter((l) => !beforeIds.has(l.id) && !l.deletedAt);
  const byName = (kind, name) => mine.find((l) => l.kind === kind && l.name === name);
  const evBad = V4_LABELS.eventLabels.filter((v) => {
    const l = byName('event', v.name);
    return !l || l.color !== v.color || JSON.stringify(l.props) !== JSON.stringify({ ...l.props, ...PROP_OF(v) }) || l.src?.id !== v.id;
  });
  r.check(evBad.length === 0, '일정 라벨 다섯의 이름·색·속성이 같다', `다른 것: ${evBad.map((v) => v.name).join()}`);
  r.check(byName('event', '이월')?.props?.forward === false, '속성은 V3 이름 먼저 (V3에서 끈 이월)');
  r.check(byName('event', '기간')?.props?.gcal === true, "v4_gcal → '구글 캘린더' 속성");
  const evOrder = mine.filter((l) => l.kind === 'event').sort((a, b) => (a.order < b.order ? -1 : 1)).map((l) => l.name);
  r.check(evOrder.join() === V4_LABELS.eventLabels.map((l) => l.name).join(), 'V4 차례 그대로', evOrder.join());
  const school = byName('note', '점검학교');
  const a = byName('note', '점검A초');
  r.check(!!school && a?.parentId === school.id, '상위/하위: 점검A초의 상위 = 점검학교');
  r.check(a?.color === 'pink' && byName('note', '학생상담')?.color === 'yellow', '메모·기록 라벨 색 (메모 객체 색·기록 색)');
  const noteNames = V4_LABELS.journalLabels.map((l) => l.name).concat(V4_LABELS.memoLabels.map((m) => (typeof m === 'string' ? m : m.name)));
  r.check(
    noteNames.every((n) => byName('note', n)),
    `메모·기록 라벨 ${nNote}개 (이름으로 합침)`,
    `없는 것: ${noteNames.filter((n) => !byName('note', n)).join()}`,
  );

  r.section('설정');
  const pc = await serverUntil(() => readDoc(v5Settings('pc')), (d) => d?.fontScale === 'lg');
  r.check(pc?.fontScale === 'lg' && pc?.popupStyle === 'center' && pc?.showWeekend === false, 'V5 settings/pc = V4 PC 설정', JSON.stringify(pc));
  const common = await readDoc(v5Settings('common'));
  r.check(common?.forwardDays === 21, 'V4 이월 기간 → common.forwardDays', JSON.stringify(common));
  r.check(
    await waitFor(async () => (await page.evaluate(() => document.documentElement.style.fontSize)) === '115%', 5000),
    '이 기기에 입혀진다 (글자 크게)',
  );
  const record = await readDoc(v5Settings('import'));
  r.check(typeof record?.at === 'number' && record?.labelMap?.note?.점검A초 === a?.id, '가져오기 기록 (때·짝 표)');

  r.section('라벨 관리 창에도 그대로');
  await page.keyboard.press('Escape');
  await page.locator(sel('more-menu')).click();
  await page.locator(sel('menu-item', 'labels')).click();
  const lrow = (id) => page.locator(sel('label-row', id));
  const ev3 = byName('event', '이월');
  r.check(await waitFor(lrow(ev3.id)), '가져온 일정 라벨이 보인다');
  r.check(
    (await lrow(ev3.id).locator(sel('label-name')).inputValue()) === '이월' &&
      (await lrow(ev3.id).locator(sel('label-color')).getAttribute('data-color')) === 'green' &&
      !(await lrow(ev3.id).locator(sel('label-prop', 'forward')).isChecked()),
    '이름·색·속성이 같다',
  );
  await page.locator(sel('label-tab', 'note')).click();
  r.check(await waitFor(lrow(a.id)), '메모·기록 탭에 하위가 보인다');
  r.check((await lrow(a.id).getAttribute('data-depth')) === '1', '하위는 제 상위 밑에 들여 보인다');
  await page.keyboard.press('Escape');

  r.section('두 번째 가져오기 = 바뀐 것 0');
  const stamps = Object.fromEntries(mine.map((l) => [l.id, l.updatedAt.toMillis()]));
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'import' }));
  await page.locator(sel('settings-panel', 'import')).waitFor();
  await page.locator(sel('import-run')).click();
  r.check(await waitFor(async () => (await page.locator(sel('import-run')).textContent())?.includes('다시'), 15000), '다시 가져오기 끝');
  const changed = [];
  for (const kind of ['labels.event', 'labels.note', 'settings']) {
    const n = (await count(kind, 'added')) + (await count(kind, 'changed')) + (await count(kind, 'removed'));
    if (n) changed.push(`${kind} ${n}`);
  }
  r.check(changed.length === 0, "결과 표: 새로·바뀜·지움 모두 0", changed.join());
  const after = await v5Labels();
  const rewritten = after.filter((l) => stamps[l.id] !== undefined && l.updatedAt.toMillis() !== stamps[l.id]);
  r.check(rewritten.length === 0, '라벨 문서를 다시 쓰지 않았다 (updatedAt 그대로)', `다시 쓴 것 ${rewritten.length}`);

  r.section('띠 닫기');
  // 주소의 # 뒤만 같으면 goto가 새로 읽지 않는다 - 새로고침
  const reopen = async () => {
    await page.reload();
    await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  };
  await reopen();
  await page.waitForTimeout(1500);
  r.check(!(await banner.isVisible()), '가져온 뒤에는 새로 열어도 띠가 없다');
  await deleteDoc(v5Settings('import'));
  await reopen();
  r.check(await waitFor(banner, 8000), '기록이 없으면 다시 뜬다');
  await page.locator(sel('import-banner-close')).click();
  const dismissed = await serverUntil(() => readDoc(v5Settings('import')), (d) => d?.dismissed === true);
  r.check(dismissed?.dismissed === true && !(await banner.isVisible()), "'닫기'는 계정에 남는다 (dismissed)");
  await reopen();
  await page.waitForTimeout(1500);
  r.check(!(await banner.isVisible()), '닫은 뒤에는 새로 열어도 띠가 없다');

  r.check(errors.length === 0, '화면 오류 없음', errors.join(' | '));
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
