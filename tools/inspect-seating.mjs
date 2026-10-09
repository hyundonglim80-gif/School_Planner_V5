// tools/inspect-seating.mjs - P7-3: 🪑 자리표·🎯 발표자 뽑기·👥 모둠을 실제 크롬에서 본다.
//   1) 열기: 학급 도구 카드 🪑 → 그 학급 · + 자리표 만들기(번호 차례, seating 문서 하나 - 학생 sid)
//   2) 자리 고치기: 두 자리 바꾸기 · 🔒 고정 · 책상 없애기 · 끌어서 비우기·앉히기 - 고칠 때마다 서버
//   3) 🚫 떨어뜨릴 학생(classHub.apart 'a|b') · ⚠️ · 🎲 섞기(고정 그대로·지난 짝 기록·떨어뜨림) · 안내의 되돌리기
//   4) ⚙️ 모양: 이름·줄·교탁 아래·🔢 번호 차례
//   5) 학생 칸: 지각·교시 = 출석부 문서의 그 학생 칸 · 자리에 '지각' · 관찰 한 줄 = 오늘 기록(studentIds) · 관찰 문구 · 문구 고치기(계정 설정) · 출석
//   6) 🎯 발표자 뽑기: 뽑기(결석 빼고)·되돌리기·크게 보기(Enter로 다음)·한 판 다 뽑으면 새 판·🔄 새 판(classHub.draw)
//   7) 👥 모둠: 무작위 2모둠(떨어뜨릴 학생은 다른 모둠)·자리에 모둠 색·💾 저장(groupSets.{id})·지우기(되돌리기)
//   8) 하루 수업 머리줄 🎯 뽑기(담임) · 단축키 · 교과 전담 교시 카드의 반 도구(🪑·🎯 = 그 반) · 자리표 지우기 → 휴지통 → 되살리기
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-seating.mjs
// 에뮬레이터 teacher·teacher3의 classes를 비우고 점검 학급을 심었다가 끝에 되돌린다. 점검 학급의 자리표·학급 허브·출석부·관찰 기록은 끝에 지운다.
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
const year = (() => {
  const d = new Date();
  return d.getMonth() + 1 >= 3 ? d.getFullYear() : d.getFullYear() - 1;
})();
const CLASS_ID = `${year}-5-2`;
const sorted = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const charts = async (space = sid, db = em.db, cls = CLASS_ID) =>
  (await getDocs(collection(db, 'spaces', space, 'seating'))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => d.classId === cls && !d.deletedAt);
const hubDoc = async () => {
  const s = await getDoc(ref('classHub', CLASS_ID));
  return s.exists() ? s.data() : null;
};
const attDoc = async () => {
  const s = await getDoc(ref('attendance', `${CLASS_ID}_${TODAY}`));
  return s.exists() ? s.data() : null;
};
const st = (s, num, name, gender, out = false) => ({ sid: s, num, name, gender, status: out ? 'out' : 'active' });

try {
  // ── 점검 학급 (classes를 비우고 끝에 되돌린다) ──
  const before = (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before) await deleteDoc(ref('classes', id));
  undo.add(async () => {
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before) await setDoc(ref('classes', id), data);
  });
  const clean = async () => {
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'seating'))).docs) if (d.data().classId === CLASS_ID) await deleteDoc(d.ref);
    await deleteDoc(ref('classHub', CLASS_ID));
    await deleteDoc(ref('attendance', `${CLASS_ID}_${TODAY}`));
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'items'))).docs) if ((d.data().studentIds ?? []).some((k) => k.startsWith(`${CLASS_ID}/`))) await deleteDoc(d.ref);
  };
  await clean();
  undo.add(clean);
  // 관찰 문구는 계정 설정 - 끝에 되돌린다
  const common = await getDoc(ref('settings', 'common'));
  undo.add(async () => (common.exists() ? setDoc(ref('settings', 'common'), common.data()) : deleteDoc(ref('settings', 'common'))));

  await setDoc(ref('classes', CLASS_ID), {
    year,
    grade: 5,
    num: 2,
    students: [
      st('a1', 1, '김하나', 'M'),
      st('a2', 2, '이두리', 'F'),
      st('a3', 3, '박세나', 'F'),
      st('a4', 4, '최네모', 'M'),
      st('a5', 5, '정다섯', 'M'),
      st('a6', 6, '강여섯', 'F'),
      st('a7', 7, '조일곱', 'M'),
      st('a8', 8, '윤여덟', 'F'),
      st('a9', 9, '전출생', 'M', true),
    ],
    authorId: uid,
    deletedAt: null,
    updatedAt: serverTimestamp(),
    v: 1,
    createdAt: Date.now(),
  });

  const { page, errors, dialogs } = await newPage(browser);
  dialogs.answer = true;
  // 뽑기가 이름을 굴리지 않고 곧바로 멈추게
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const win = page.locator(sel('seating-window', CLASS_ID));
  const seat = (k) => win.locator(sel('seat', k));
  const seatSid = async (k) => seat(k).getAttribute('data-seat-sid');
  const tool = (t) => win.locator(sel('seating-tool', t));
  const toastUndo = () => page.locator(sel('toast-action', '되돌리기')).last();

  r.section('🪑 열기·만들기');
  await open(page, '#/class');
  const card = page.locator(sel('class-tool', 'seating'));
  r.check(await waitFor(card, 8000), '학급 도구 카드 🪑 자리표');
  await card.click();
  r.check(await waitFor(win, 8000), '자리표 창 = 그 학급');
  r.check(await waitFor(win.locator(sel('seating-empty')), 8000), '자리표가 없으면 + 자리표 만들기');
  await win.locator(sel('seating-create')).click();
  let list = await serverUntil(() => charts(), (l) => l.length === 1);
  const chartId = list[0]?.id;
  const chart = async () => (await getDoc(ref('seating', chartId))).data();
  r.check(list.length === 1 && list[0].rows === 2 && list[0].cols === 6 && list[0].name === '자리표 1', '서버 문서 하나 - 2줄 6열 · 자리표 1');
  r.check(list[0].seats?.['0-0'] === 'a1' && list[0].seats?.['1-1'] === 'a8' && !Object.values(list[0].seats ?? {}).includes('a9'), '번호 차례로 앞줄부터 (학생 sid · 전출 학생은 빼고)');
  r.check(await waitFor(win.locator(sel('seating-grid', chartId))), '자리 그림');
  r.check((await seatSid('0-0')) === 'a1' && ((await seat('0-0').textContent()) ?? '').includes('김하나'), '0-0 = 1 김하나');

  r.section('✏️ 자리 고치기');
  await tool('edit').click();
  await seat('0-0').click();
  await seat('0-1').click();
  let c = await serverUntil(chart, (d) => d.seats?.['0-0'] === 'a2');
  r.check(c.seats['0-0'] === 'a2' && c.seats['0-1'] === 'a1', '두 자리를 차례로 누르면 바뀐다 (서버)');
  await seat('0-0').click();
  await win.locator(sel('seat-action', 'lock')).click();
  c = await serverUntil(chart, (d) => d.locked?.includes('0-0'));
  r.check(c.locked?.includes('0-0'), '🔒 고정 = locked');
  r.check(await waitFor(win.locator(`${sel('seat', '0-0')}[data-seat-locked]`)), '자리에 🔒');
  await seat('1-5').click();
  await win.locator(sel('seat-action', 'off')).click();
  c = await serverUntil(chart, (d) => d.off?.includes('1-5'));
  r.check(c.off?.includes('1-5'), '책상 없애기 = off');
  await tool('edit').click();
  // 끌어서 비우기 → 자리 없는 학생 → 끌어서 앉히기
  await seat('1-1').dragTo(win.locator('[data-unseated]'));
  c = await serverUntil(chart, (d) => !Object.values(d.seats ?? {}).includes('a8'));
  r.check(!Object.values(c.seats).includes('a8'), '자리를 아래로 끌면 비운다');
  r.check(await waitFor(win.locator(sel('unseated-sid', 'a8'))), "'자리 없는 학생'에 8 윤여덟");
  await win.locator(sel('unseated-sid', 'a8')).dragTo(seat('1-2'));
  c = await serverUntil(chart, (d) => d.seats?.['1-2'] === 'a8');
  r.check(c.seats['1-2'] === 'a8', '자리 없는 학생을 자리로 끌면 앉는다');

  r.section('🚫 떨어뜨릴 학생 · 🎲 섞기');
  await tool('apart').click();
  await win.locator('[data-apart-a]').selectOption('a1');
  await win.locator('[data-apart-b]').selectOption('a2');
  await win.locator('[data-apart-add]').click();
  let hub = await serverUntil(hubDoc, (d) => d?.apart?.length === 1);
  r.check(same(hub?.apart, ['a1|a2']), "학급 허브 apart = ['a1|a2']");
  r.check(await waitFor(win.locator('[data-seating-warn]')), '붙어 앉아 있으면 ⚠️');
  const beforeShuffle = (await chart()).seats;
  await tool('shuffle').click();
  c = await serverUntil(chart, (d) => (d.history ?? []).length === 1);
  r.check(c.seats['0-0'] === 'a2', '🔒 고정 칸은 그대로');
  r.check(c.history?.[0]?.pairs?.length > 0, '섞기 전 짝을 지난 짝 기록에');
  r.check(Object.values(c.seats).filter((v) => v.startsWith('a')).length === 8, '재학생 여덟 모두 앉는다');
  r.check(await waitFor(async () => (await win.locator('[data-seating-warn]').count()) === 0), '떨어뜨릴 학생이 떨어져 앉아 ⚠️가 없다');
  await toastUndo().click();
  c = await serverUntil(chart, (d) => same(d.seats, beforeShuffle));
  r.check(same(c.seats, beforeShuffle), '안내의 되돌리기 = 섞기 전 자리');
  await win.locator(sel('apart-remove', 'a1|a2')).click();
  hub = await serverUntil(hubDoc, (d) => (d?.apart ?? []).length === 0);
  r.check((hub?.apart ?? []).length === 0, '✕ = 쌍 빼기');

  r.section('⚙️ 모양');
  await tool('shape').click();
  await win.locator('[data-seating-name]').fill('1학기');
  await win.locator('[data-seating-name]').press('Enter');
  c = await serverUntil(chart, (d) => d.name === '1학기');
  r.check(c.name === '1학기' && (await win.locator(sel('seating-tab', chartId)).textContent()) === '1학기', '이름 = 서버·탭');
  await win.locator(sel('seating-size-up', 'rows')).click();
  c = await serverUntil(chart, (d) => d.rows === 3);
  r.check(c.rows === 3 && (await win.locator(sel('seating-size', 'rows')).textContent()) === '3', '줄 + = 3줄');
  await win.locator(sel('seating-front', 'bottom')).click();
  c = await serverUntil(chart, (d) => d.front === 'bottom');
  r.check(c.front === 'bottom' && (await win.locator(sel('seating-grid', chartId)).getAttribute('data-front')) === 'bottom', '교탁 아래 = 돌려 그린다');
  await win.locator('[data-seating-number-order]').click();
  c = await serverUntil(chart, (d) => d.seats?.['0-1'] === 'a1');
  r.check(c.seats['0-0'] === 'a2' && c.seats['0-1'] === 'a1' && c.seats['0-2'] === 'a3', '🔢 번호 차례 (고정 칸은 그대로)');
  await tool('shape').click();

  r.section('학생 칸 (자리를 누르면)');
  const a3Seat = Object.entries(c.seats).find(([, v]) => v === 'a3')?.[0];
  await seat(a3Seat).click();
  const card3 = win.locator(sel('seat-student', 'a3'));
  r.check(await waitFor(card3), '학생 칸 = 3 박세나');
  await card3.locator(sel('seat-att-kind', 'late')).click();
  let att = await serverUntil(attDoc, (d) => d?.records?.a3?.kind === 'late');
  r.check(same(att?.records?.a3, { kind: 'late', reason: 'sick' }) && att?.classId === CLASS_ID, '지각 = 출석부 문서의 그 학생 칸 (질병)');
  await card3.locator(sel('seat-att-period', 2)).click();
  att = await serverUntil(attDoc, (d) => d?.records?.a3?.periods?.length === 1);
  r.check(same(att?.records?.a3?.periods, [2]), '교시 2');
  r.check(await waitFor(seat(a3Seat).locator(sel('seat-att', 'late'))), "자리에 '지각'");
  await card3.locator('[data-seat-observe-input]').fill('모둠 활동에서 친구를 도움');
  await card3.locator('[data-seat-observe-input]').press('Enter');
  const notes = async () => (await getDocs(collection(em.db, 'spaces', sid, 'items'))).docs.map((d) => d.data()).filter((d) => (d.studentIds ?? []).includes(`${CLASS_ID}/a3`) && !d.deletedAt);
  let ns = await serverUntil(notes, (l) => l.length === 1);
  r.check(ns.length === 1 && ns[0].kind === 'note' && ns[0].date === TODAY && ns[0].text === '모둠 활동에서 친구를 도움', '관찰 한 줄 = 오늘 기록 (글 그대로 · studentIds)');
  await card3.locator(sel('observation-phrase', '발표를 잘함')).click();
  ns = await serverUntil(notes, (l) => l.length === 2);
  r.check(ns.some((n) => n.text === '발표를 잘함'), '관찰 문구 단추 = 곧바로 한 줄');
  r.check(await waitFor(card3.locator(sel('seat-student-lines', 2))), '오늘 남긴 줄 둘이 칸 아래에');
  await card3.locator('[data-observation-phrases-edit]').click();
  await card3.locator('[data-observation-phrase-input]').fill('정리를 잘함');
  await card3.locator('[data-observation-phrase-input]').press('Enter');
  const phrases = async () => (await getDoc(ref('settings', 'common'))).data()?.phrases;
  const ph = await serverUntil(phrases, (p) => Array.isArray(p) && p.includes('정리를 잘함'));
  r.check(Array.isArray(ph) && ph.at(-1) === '정리를 잘함', '✏️ 문구 더하기 = 계정 설정 phrases');
  await card3.locator('[data-observation-phrases-edit]').click();
  await card3.locator(sel('seat-att-kind', 'present')).click();
  att = await serverUntil(attDoc, (d) => !d?.records?.a3);
  r.check(!att?.records?.a3, '출석 = 그 학생 칸 지우기');
  await card3.locator('[data-seat-student-close]').click();
  r.check(await waitFor(async () => (await card3.count()) === 0), '✕ = 학생 칸 닫기');

  r.section('🎯 발표자 뽑기');
  // 오늘 결석 한 명 (뽑지 않는다)
  await seat(Object.entries(c.seats).find(([, v]) => v === 'a5')?.[0]).click();
  await win.locator(sel('seat-student', 'a5')).locator(sel('seat-att-kind', 'absent')).click();
  await serverUntil(attDoc, (d) => d?.records?.a5?.kind === 'absent');
  await win.locator('[data-seat-student-close]').click();
  await tool('draw').click();
  const box = win.locator(sel('seating-box', 'draw'));
  r.check(await waitFor(box), '뽑기 칸');
  await box.locator('[data-draw-pick]').click();
  hub = await serverUntil(hubDoc, (d) => d?.draw?.picked?.length === 1);
  const first = hub?.draw?.picked?.[0];
  r.check(!!first && first !== 'a5' && first !== 'a9', '뽑은 학생을 판에 (결석·전출 빼고)');
  r.check(await waitFor(win.locator(`${sel('seat-sid', first)}[data-seat-drawn-now]`)), '뽑힌 자리를 짚는다');
  await box.locator('[data-draw-undo]').click();
  hub = await serverUntil(hubDoc, (d) => d?.draw?.picked?.length === 0);
  r.check(hub?.draw?.picked?.length === 0, '↩️ 되돌리기 = 안 뽑힌 학생으로');
  await box.locator('[data-draw-big-open]').click();
  const big = page.locator('[data-draw-big]');
  r.check(await waitFor(big), '🔍 크게 보기');
  await page.keyboard.press('Enter');
  hub = await serverUntil(hubDoc, (d) => d?.draw?.picked?.length === 1);
  r.check(hub?.draw?.picked?.length === 1, '크게 보기에서 Enter = 다음 학생');
  r.check(await waitFor(async () => ((await big.locator('[data-draw-big-name]').textContent()) ?? '').length > 0), '크게 보기에 이름');
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await big.count()) === 0) && (await win.count()) === 1, 'ESC = 크게 보기만 닫는다');
  for (let i = 0; i < 6; i++) {
    await box.locator('[data-draw-pick]').click();
    await serverUntil(hubDoc, (d) => d?.draw?.picked?.length === i + 2);
  }
  hub = await hubDoc();
  r.check(hub?.draw?.picked?.length === 7 && !hub.draw.picked.includes('a5') && new Set(hub.draw.picked).size === 7, '한 판 = 결석 빼고 일곱이 한 번씩');
  await box.locator('[data-draw-pick]').click();
  hub = await serverUntil(hubDoc, (d) => d?.draw?.round === 2);
  r.check(hub?.draw?.round === 2 && hub.draw.picked.length === 1, '다 뽑으면 새 판 (2번째 판)');
  await box.locator('[data-draw-new-round]').click();
  hub = await serverUntil(hubDoc, (d) => d?.draw?.round === 3);
  r.check(hub?.draw?.round === 3 && hub.draw.picked.length === 0, '🔄 새 판');

  r.section('👥 모둠');
  await tool('apart').click();
  await win.locator('[data-apart-a]').selectOption('a1');
  await win.locator('[data-apart-b]').selectOption('a2');
  await win.locator('[data-apart-add]').click();
  await serverUntil(hubDoc, (d) => d?.apart?.length === 1);
  await tool('groups').click();
  const gbox = win.locator(sel('seating-box', 'groups'));
  r.check(await waitFor(gbox), '모둠 칸');
  await gbox.locator('[data-group-count]').fill('2');
  await gbox.locator('[data-group-random]').click();
  r.check(await waitFor(gbox.locator(sel('group-index', 1))), '무작위 2모둠');
  const g0 = await gbox.locator(sel('group-index', 0)).locator('[data-group-member]').evaluateAll((els) => els.map((e) => e.getAttribute('data-group-member')));
  r.check(g0.includes('a1') !== g0.includes('a2'), '떨어뜨릴 학생은 다른 모둠');
  r.check((await win.locator('[data-seating-grid] [data-seat-group]').count()) === 8, '자리마다 모둠 색');
  await gbox.locator('[data-group-name]').fill('과학 모둠');
  await gbox.locator('[data-group-save]').click();
  hub = await serverUntil(hubDoc, (d) => Object.keys(d?.groupSets ?? {}).length === 1);
  const set = Object.values(hub?.groupSets ?? {})[0];
  r.check(set?.name === '과학 모둠' && set.groups.length === 2 && set.groups.flatMap((g) => g.members).length === 8, '💾 저장 = groupSets.{id} (2모둠 8명)');
  r.check(await waitFor(gbox.locator('[data-group-set]')), '저장한 모둠이 위에');
  await gbox.locator('[data-group-delete]').click();
  hub = await serverUntil(hubDoc, (d) => Object.keys(d?.groupSets ?? {}).length === 0);
  r.check(Object.keys(hub?.groupSets ?? {}).length === 0, '🗑️ 지우기');
  await toastUndo().click();
  hub = await serverUntil(hubDoc, (d) => Object.keys(d?.groupSets ?? {}).length === 1);
  r.check(Object.values(hub?.groupSets ?? {})[0]?.name === '과학 모둠', '안내의 되돌리기 = 모둠이 돌아온다');

  r.section('여는 길 · 휴지통');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await open(page, `#/day/${TODAY}`);
  const head = page.locator(sel('lessons-tool', 'drawStudent'));
  r.check(await waitFor(head, 8000), '하루 수업 머리줄 🎯 뽑기 (담임)');
  await head.click();
  r.check(await waitFor(win.locator(sel('seating-box', 'draw')), 8000), '🎯 = 자리표가 뽑기 칸을 펴서 열린다');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.evaluate(() => window.sp5.runShortcut('seating'));
  r.check(await waitFor(win, 8000), "단축키 '자리표'");
  await tool('shape').click();
  await win.locator('[data-seating-delete]').click();
  list = await serverUntil(() => charts(), (l) => l.length === 0);
  r.check(list.length === 0, '🗑️ 이 자리표 지우기 = 지운 표시');
  r.check(await waitFor(win.locator(sel('seating-empty'))), '지우면 + 자리표 만들기');
  await page.evaluate(() => window.sp5.openWindow('trash'));
  const trashRow = page.locator(sel('trash-row', `seating:${chartId}`));
  r.check(await waitFor(trashRow, 8000), "휴지통에 '🪑 1학기'");
  await trashRow.locator(sel('trash-restore', `seating:${chartId}`)).click();
  list = await serverUntil(() => charts(), (l) => l.length === 1);
  r.check(list.length === 1 && list[0].name === '1학기', '되살리기');
  r.check(errors.length === 0, '화면 오류 없음', errors.join(' | '));

  // ── 교과 전담 (teacher3): 교시 카드의 반 도구 ──
  r.section('교과 전담 - 교시 카드 반 도구');
  const em3 = emulator('inspect3');
  const uid3 = await em3.signIn('teacher3@example.com');
  const sid3 = `u_${uid3}`;
  const ref3 = (c0, id) => doc(em3.db, 'spaces', sid3, c0, id);
  const C3 = `${year}-5-1`;
  const D3 = `${year}-11-04`;
  const before3 = (await getDocs(collection(em3.db, 'spaces', sid3, 'classes'))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before3) await deleteDoc(ref3('classes', id));
  undo.add(async () => {
    for (const d of (await getDocs(collection(em3.db, 'spaces', sid3, 'classes'))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before3) await setDoc(ref3('classes', id), data);
  });
  await setDoc(ref3('classes', C3), {
    year,
    grade: 5,
    num: 1,
    students: [st('t1', 1, '가람', 'M'), st('t2', 2, '나래', 'F')],
    authorId: uid3,
    deletedAt: null,
    updatedAt: serverTimestamp(),
    v: 1,
    createdAt: Date.now(),
  });
  const ld = await getDoc(ref3('lessonDays', D3));
  undo.add(async () => (ld.exists() ? setDoc(ref3('lessonDays', D3), ld.data()) : deleteDoc(ref3('lessonDays', D3))));
  await setDoc(ref3('lessonDays', D3), { periods: { '3': { subject: '5-1 과학' } }, updatedAt: serverTimestamp(), v: 1 });
  const p3 = await newPage(browser);
  await open(p3.page, `#/day/${D3}`, { as: 3 });
  const tools3 = p3.page.locator(sel('class-tools', C3));
  r.check(await waitFor(tools3, 8000), "교시 카드 '5-1 과학'에 반 도구");
  r.check(!(await p3.page.locator(sel('lessons-tool', 'drawStudent')).count()), '전담은 머리줄 🎯가 없다');
  await tools3.locator(sel('class-tool-btn', 'drawStudent')).click();
  const win3 = p3.page.locator(sel('seating-window', C3));
  r.check(await waitFor(win3, 8000), '🎯 뽑기 = 그 반 자리표');
  r.check(await waitFor(win3.locator(sel('seating-box', 'draw'))), '뽑기 칸이 펴져 있다 (자리표가 없어도 명렬표로)');
  r.check(p3.errors.length === 0, '화면 오류 없음', p3.errors.join(' | '));
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
