// tools/inspect-chat.mjs - P19-2: 💬 대화를 실제 크롬에서 본다 (teacher = A 화면, teacher2 = B는 서버로 보낸다).
//   ■1 대화 창: 목록(1:1 묶음 · 그룹 묶음의 그룹 전체 · 안 읽음 굵게 + 수 · 마지막 글 '이름: 글') · 방(최근 50개 · 맨 아래에서 시작 ·
//      날짜 나눔 줄 · 잇단 글은 이름 한 번 · 내 글 오른쪽 · 위로 올리면 50개씩 더(자리 그대로) · 위를 보는 동안 새 글 = '↓ 새 글' ·
//      맨 아래면 따라 내려감) · 1:1 '1'(상대가 읽기 전 내 글) · ← 목록 · 끊긴 채 열면 '인터넷이 필요합니다' → 이어지면 글
//
//   그룹·지난 글은 관리자 쓰기로 심는다(B 주인·A 구성원 - 규칙은 그룹장이 남을 넣지 못한다, 지난 날 시각은 규칙이 막는다). 새 글은 B 클라이언트로(규칙 통과).
//   대화는 지우기 규칙이 없다 - 끝에 관리자 지우기. npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-chat.mjs
import { doc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { emulator, emulatorAdmin, launch, newPage, open, report, restorer, sel, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uidA = await em.signIn('teacher@example.com');
const emB = emulator('inspectB');
const uidB = await emB.signIn('teacher2@example.com');
const admin = emulatorAdmin();
const browser = await launch();
const DAY = '2027-10-04';
const SID = 'g_chatprobe';
const GROUP = '대화점검 그룹';
const ALL_KEY = `${SID}~all`;
const PAIR = uidA < uidB ? `d_${uidA}_${uidB}` : `d_${uidB}_${uidA}`;
const OLD = 62; // 심는 지난 글 - 처음 50 + 위로 올려 12
const YEAR = 365 * 86_400_000;
// SHOT=<폴더> - 목록·방 그림을 남긴다(눈으로 볼 때)
const shot = (page, name) => process.env.SHOT && page.screenshot({ path: `${process.env.SHOT}/chat-${name}.png` });

// ── 관리자 REST (시각 칸 - emulatorAdmin은 글·수·객체만) ──
const BASE = 'http://127.0.0.1:8080/v1/projects/schoolplannerv3/databases/(default)/documents';
const HEADERS = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const at = (ms) => ({ timestampValue: new Date(ms).toISOString() });
const val = (v) =>
  v && typeof v === 'object' && 'timestampValue' in v
    ? v
    : typeof v === 'string'
      ? { stringValue: v }
      : typeof v === 'number'
        ? { integerValue: String(v) }
        : typeof v === 'boolean'
          ? { booleanValue: v }
          : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } };
async function plant(path, data) {
  const res = await fetch(`${BASE}/${path}`, { method: 'PATCH', headers: HEADERS, body: JSON.stringify({ fields: val(data).mapValue.fields }) });
  if (!res.ok) throw new Error(`관리자 쓰기 실패 ${path}: ${res.status}`);
}
/** 상자 안 문서를 모두 지운다 (관리자) */
async function wipe(collectionPath) {
  for (;;) {
    const res = await fetch(`${BASE}/${collectionPath}?pageSize=300`, { headers: HEADERS });
    const docs = (await res.json()).documents ?? [];
    if (!docs.length) return;
    for (const d of docs) await fetch(`http://127.0.0.1:8080/v1/${d.name}`, { method: 'DELETE', headers: HEADERS });
  }
}
async function cleanAll() {
  await wipe(`v5Chat/${SID}/chatRooms/all/chatMsgs`);
  await admin.remove(`v5Chat/${SID}/chatRooms/all`);
  await wipe(`v5Dm/${PAIR}/chatMsgs`);
  await admin.remove(`v5Dm/${PAIR}`);
  await admin.remove(`v5ChatReads/${uidA}`);
}

/** B가 그룹 전체 방에 한 글 (앱 data/chat sendChat과 같은 모양 - 글 + 방 미리 보기 한 묶음) */
async function sendAsB(text) {
  const id = doc(collectionRef()).id;
  const expireAt = Timestamp.fromMillis(Date.now() + YEAR);
  const b = writeBatch(emB.db);
  b.set(doc(emB.db, 'v5Chat', SID, 'chatRooms', 'all', 'chatMsgs', id), { from: uidB, fromName: '이점검', text, at: serverTimestamp(), expireAt, v: 1 });
  b.set(
    doc(emB.db, 'v5Chat', SID, 'chatRooms', 'all'),
    { kind: 'all', lastId: id, lastAt: serverTimestamp(), lastFrom: uidB, lastFromName: '이점검', lastText: text, expireAt, v: 1 },
    { merge: true },
  );
  await b.commit();
  return id;
}
const collectionRef = () => doc(emB.db, 'x', 'y').parent;

/** 방 본문 스크롤(창 본문) - 맨 아래인가 · 위로 */
const scrollState = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-chat-room-view]')?.closest('[data-scroll-lock]');
    return el ? { top: el.scrollTop, gap: el.scrollHeight - el.scrollTop - el.clientHeight, height: el.scrollHeight } : null;
  });
const scrollTo = (page, where) =>
  page.evaluate((where) => {
    const el = document.querySelector('[data-chat-room-view]')?.closest('[data-scroll-lock]');
    if (el) el.scrollTop = where === 'top' ? 0 : el.scrollHeight;
  }, where);
/** 그 글이 창 본문 안에 보이나 */
const inView = (page, id) =>
  page.evaluate((id) => {
    const m = document.querySelector(`[data-chat-msg="${id}"]`);
    const el = m?.closest('[data-scroll-lock]');
    if (!m || !el) return false;
    const a = m.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return a.bottom > b.top && a.top < b.bottom;
  }, id);

undo.add(async () => {
  await cleanAll();
  for (const uid of [uidA, uidB]) await admin.remove(`spaces/${SID}/people/${uid}`);
  await admin.remove(`spaces/${SID}`);
});

try {
  // ── 심기: 그룹(B 주인·A 구성원) · 그룹 전체 방 지난 글 62(그제 10 · 어제 52, 7번째마다 A) · 1:1 셋(B는 둘째까지 읽음) ──
  await cleanAll();
  await admin.set(`spaces/${SID}`, { kind: 'group', name: GROUP, ownerId: uidB, members: { [uidA]: 'member', [uidB]: 'owner' } });
  await admin.set(`spaces/${SID}/people/${uidA}`, { name: '김점검' });
  await admin.set(`spaces/${SID}/people/${uidB}`, { name: '이점검' });
  const day = (back, h) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    d.setHours(h, 0, 0, 0);
    return d.getTime();
  };
  const ids = [];
  let lastAt = 0;
  for (let i = 0; i < OLD; i++) {
    const id = `chatprobe${String(i).padStart(3, '0')}`;
    const mine = i % 7 === 6;
    lastAt = i < 10 ? day(2, 9) + i * 60_000 : day(1, 9) + (i - 10) * 60_000;
    await plant(`v5Chat/${SID}/chatRooms/all/chatMsgs/${id}`, {
      from: mine ? uidA : uidB,
      fromName: mine ? '김점검' : '이점검',
      text: `대화점검 ${i + 1}번`,
      at: at(lastAt),
      expireAt: at(lastAt + YEAR),
      v: 1,
    });
    ids.push(id);
  }
  // 마지막 글(62번째, i = 61)은 B - 61 % 7 = 5
  await plant(`v5Chat/${SID}/chatRooms/all`, {
    kind: 'all',
    lastId: ids[OLD - 1],
    lastAt: at(lastAt),
    lastFrom: uidB,
    lastFromName: '이점검',
    lastText: `대화점검 ${OLD}번`,
    expireAt: at(lastAt + YEAR),
    v: 1,
  });
  const dmAt = day(0, 0) + 60_000;
  const dm = [
    ['dmprobe1', uidA, '김점검', '1:1 첫 글', dmAt],
    ['dmprobe2', uidB, '이점검', '1:1 답', dmAt + 60_000],
    ['dmprobe3', uidA, '김점검', '1:1 마지막 (B가 아직 안 읽음)', dmAt + 120_000],
  ];
  for (const [id, from, fromName, text, t] of dm) await plant(`v5Dm/${PAIR}/chatMsgs/${id}`, { from, fromName, text, at: at(t), expireAt: at(t + YEAR), v: 1 });
  await plant(`v5Dm/${PAIR}`, {
    kind: 'dm',
    members: { [uidA]: true, [uidB]: true },
    sid: SID,
    names: { [uidA]: '김점검', [uidB]: '이점검' },
    lastId: 'dmprobe3',
    lastAt: at(dmAt + 120_000),
    lastFrom: uidA,
    lastFromName: '김점검',
    lastText: '1:1 마지막 (B가 아직 안 읽음)',
    reads: { [uidB]: at(dmAt + 90_000), [uidA]: at(dmAt + 120_000) },
    expireAt: at(dmAt + 120_000 + YEAR),
    v: 1,
  });

  const A = await newPage(browser);
  const page = A.page;
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sp5_theme', 'light');
    } catch {
      /* about:blank */
    }
  });
  await open(page, `#/day/${DAY}`);

  r.section('■1 목록');
  await page.evaluate(() => window.sp5.openWindow('chat'));
  r.check(await waitFor(page.locator(sel('chat-window', 'list')), 8000), '💬 대화 창 - 목록');
  const allRow = page.locator(sel('chat-room', ALL_KEY));
  const dmRow = page.locator(sel('chat-room', PAIR));
  r.check(await waitFor(allRow, 8000), "그룹 묶음에 '그룹 전체' 줄");
  r.check(((await page.locator(sel('chat-section', SID)).textContent()) ?? '').includes(GROUP), `묶음 머리 = 👥 ${GROUP}`);
  r.check(await waitFor(dmRow, 8000), '1:1 묶음에 B와의 방');
  r.check(((await dmRow.textContent()) ?? '').includes('이점검') && ((await dmRow.textContent()) ?? '').includes(GROUP), '1:1 줄 = 상대 이름 · 함께 든 그룹');
  r.check(((await dmRow.locator(sel('chat-preview')).textContent()) ?? '').startsWith('나: '), "내 마지막 글은 '나: '");
  r.check((await dmRow.getAttribute('data-chat-unread')) === 'no', '내 글이 마지막인 1:1은 안 읽음 아님');
  r.check((await allRow.getAttribute('data-chat-unread')) === 'yes', '읽음 칸이 없는 그룹 방 = 안 읽음');
  r.check(((await allRow.locator(sel('chat-preview')).textContent()) ?? '') === `이점검: 대화점검 ${OLD}번`, "마지막 글 '이름: 글'");
  r.check(await waitFor(allRow.locator(sel('chat-unread-count', OLD)), 8000), `안 읽은 수 ${OLD} (서버에서 셈)`);
  await shot(page, 'list');

  r.section('■1 방 - 처음');
  await allRow.click();
  r.check(await waitFor(page.locator(sel('chat-window', 'room')), 5000), '줄을 누르면 방');
  r.check(((await page.locator(sel('chat-room-title')).textContent()) ?? '').includes(`${GROUP} 전체`), '방 머리 = 그룹 전체');
  r.check(await waitFor(page.locator(sel('chat-msgs', 50)), 8000), `최근 50개 (${await page.locator(sel('chat-msg')).count()})`);
  r.check(await waitFor(async () => (await scrollState(page))?.gap < 5, 3000), `맨 아래에서 시작 (${JSON.stringify(await scrollState(page))})`);
  r.check(await inView(page, ids[OLD - 1]), '마지막 글이 보인다');
  r.check((await page.locator(sel('chat-day')).count()) === 1, '날짜 나눔 줄 하나 (50개 모두 어제)');
  const mineCount = await page.locator(sel('chat-mine', 'yes')).count();
  r.check(mineCount === ids.slice(OLD - 50).filter((_, i) => (i + OLD - 50) % 7 === 6).length, `내 글 ${mineCount}개는 오른쪽(data-chat-mine)`);
  const names = await page.locator(sel('chat-name')).count();
  r.check(names > 0 && names < 50 - mineCount, `잇단 글은 이름 한 번 (이름 ${names}개)`);
  const mineBox = await page.locator(sel('chat-mine', 'yes')).last().locator(sel('chat-text')).boundingBox();
  const otherBox = await page.locator(sel('chat-mine', 'no')).last().locator(sel('chat-text')).boundingBox();
  r.check(!!mineBox && !!otherBox && mineBox.x > otherBox.x + 50, '내 글은 오른쪽, 남의 글은 왼쪽');
  await shot(page, 'room');

  r.section('■1 위로 올려 더 받기');
  const firstBefore = ids[OLD - 50];
  await scrollTo(page, 'top');
  r.check(await waitFor(page.locator(sel('chat-msgs', OLD)), 8000), `위로 올리면 더 → ${OLD}개`);
  r.check(await waitFor(async () => (await page.locator(sel('chat-more')).count()) === 0, 3000), '끝까지 받으면 더 보기가 없다');
  r.check((await page.locator(sel('chat-day')).count()) === 2, '날짜 나눔 줄 둘 (그제·어제)');
  const after = await scrollState(page);
  r.check(after.top > 100 && (await inView(page, firstBefore)), `받은 뒤 보던 자리 그대로 (top ${after.top})`);

  r.section("■1 '↓ 새 글'");
  const n1 = await sendAsB('위를 보는 동안 온 새 글');
  r.check(await waitFor(page.locator(sel('chat-msg', n1)), 8000), '새 글이 방에 들어온다');
  r.check(await waitFor(page.locator(sel('chat-new')), 3000), "위를 보는 동안 = '↓ 새 글' 단추");
  await shot(page, 'new');
  r.check(!(await inView(page, n1)), '자리는 그대로 (새 글은 아직 안 보인다)');
  await page.locator(sel('chat-new')).click();
  r.check(await waitFor(async () => (await scrollState(page)).gap < 5, 3000) && (await inView(page, n1)), "'↓ 새 글' → 맨 아래");
  r.check(await waitFor(async () => (await page.locator(sel('chat-new')).count()) === 0, 2000), '단추가 사라진다');
  const n2 = await sendAsB('맨 아래를 보는 동안 온 새 글');
  r.check(await waitFor(page.locator(sel('chat-msg', n2)), 8000), '또 새 글');
  r.check(await waitFor(async () => (await scrollState(page)).gap < 5 && (await inView(page, n2)), 3000), '맨 아래를 보고 있으면 따라 내려간다');
  r.check((await page.locator(sel('chat-new')).count()) === 0, "그때는 '↓ 새 글' 없음");

  r.section("■1 1:1 '1' · ← 목록");
  await page.locator(sel('chat-back')).click();
  r.check(await waitFor(page.locator(sel('chat-window', 'list')), 3000), '← 목록');
  r.check(await waitFor(allRow.locator(sel('chat-unread-count', OLD + 2)), 8000), `새 글 둘을 더해 다시 셈 (${OLD + 2})`);
  await dmRow.click();
  r.check(await waitFor(page.locator(sel('chat-msgs', 3)), 8000), '1:1 방 - 글 셋');
  r.check(((await page.locator(sel('chat-room-title')).textContent()) ?? '').includes('이점검'), '방 머리 = 상대 이름');
  await shot(page, 'dm');
  r.check((await page.locator(sel('chat-unseen')).count()) === 1 && (await page.locator(sel('chat-msg', 'dmprobe3')).locator(sel('chat-unseen')).count()) === 1, "상대가 읽기 전 내 글에만 '1'");

  r.section('■1 끊김');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await A.ctx.setOffline(true);
  await page.evaluate((room) => window.sp5.openWindow('chat', { room }), ALL_KEY);
  r.check(await waitFor(page.locator(sel('chat-offline')), 15000), "끊긴 채 열면 '인터넷이 필요합니다'");
  await A.ctx.setOffline(false);
  r.check(await waitFor(async () => (await page.locator(sel('chat-offline')).count()) === 0 && (await page.locator(sel('chat-msg')).count()) >= 50, 20000), '이어지면 글이 뜬다');

  r.check(A.errors.length === 0, `페이지 오류 없음 ${A.errors.slice(0, 2).join(' / ')}`);
} catch (e) {
  r.bad(`멈춤: ${String(e?.message || e).split('\n')[0]}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
