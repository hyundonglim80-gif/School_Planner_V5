// tools/inspect-mail.mjs - P15-2: ✉ 쪽지를 실제 크롬에서 본다 (teacher = A 화면, teacher2 = B는 서버로 보낸다).
//   ■1 쪽지 창: 받은 쪽지 30개씩·더 보기 · 안 읽음(data-mail-read=no) · 펼치면 읽음(서버 readAt) · 지우기 = 바로 숨김 + 되돌리기 ·
//      7초 뒤 진짜 지우기 · 보낸 쪽지 탭 · 끊기면 '인터넷이 필요합니다' + 다시 받기
//   ■2 쓰기: 그룹 → 구성원 칩(나 빼고·이름) → 받는 사람 없으면 안내 · Ctrl+S는 보내지 않음 · Ctrl+Enter = 보내기(받는 쪽 칸·사본) → 보낸 탭 ·
//      ↩ 답장(replyTo) · 쓰던 글 보관(되살리기, 앱 위 띠에는 없음) · 그룹 창 구성원 ✉ · 끊긴 채 보내기 = 기다리는 저장 띠 → 연결되면 간다
//
//   그룹은 관리자 쓰기로 심는다(B 주인·A 구성원 - 규칙은 그룹장이 남을 넣지 못한다, CLAUDE.md 2장). 쪽지는 각 계정 클라이언트로(서버 시각·규칙 통과).
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-mail.mjs
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { emulator, emulatorAdmin, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uidA = await em.signIn('teacher@example.com');
const emB = emulator('inspectB');
const uidB = await emB.signIn('teacher2@example.com');
const admin = emulatorAdmin();
const browser = await launch();
const DAY = '2027-10-04';
const SID = 'g_mailprobe';
const GROUP = '쪽지점검 그룹';
const COUNT = 32;

/** 그 계정의 두 상자를 비운다 (주인만 지운다) */
async function emptyBoxes(e, uid) {
  for (const box of ['mailIn', 'mailSent']) for (const d of (await getDocs(collection(e.db, 'v5Mail', uid, box))).docs) await deleteDoc(d.ref);
}

/** from 계정이 to에게 한 통 (앱 data/mail sendMail과 같은 모양 - 받는 쪽 + 보낸 사본 한 묶음) */
async function send(e, from, fromName, to, text) {
  const id = doc(collection(e.db, 'x')).id;
  const common = { sid: SID, groupName: GROUP, to: [to], toNames: to === uidA ? '김점검' : '이점검', text, at: serverTimestamp(), replyTo: null, expireAt: Timestamp.fromMillis(Date.now() + 365 * 86_400_000), v: 1 };
  const b = writeBatch(e.db);
  b.set(doc(e.db, 'v5Mail', to, 'mailIn', id), { from, fromName, ...common, readAt: null });
  b.set(doc(e.db, 'v5Mail', from, 'mailSent', id), common);
  await b.commit();
  return id;
}

undo.add(async () => {
  await emptyBoxes(em, uidA);
  await emptyBoxes(emB, uidB);
  for (const uid of [uidA, uidB]) await admin.remove(`spaces/${SID}/people/${uid}`);
  await admin.remove(`spaces/${SID}`);
});

try {
  // ── 심기: 그룹(B 주인·A 구성원) · B → A 32통 · A → B 1통 ──
  await emptyBoxes(em, uidA);
  await emptyBoxes(emB, uidB);
  await admin.set(`spaces/${SID}`, { kind: 'group', name: GROUP, ownerId: uidB, members: { [uidA]: 'member', [uidB]: 'owner' } });
  await admin.set(`spaces/${SID}/people/${uidA}`, { name: '김점검' });
  await admin.set(`spaces/${SID}/people/${uidB}`, { name: '이점검' });
  const ids = [];
  for (let i = 1; i <= COUNT; i++) ids.push(await send(emB, uidB, '이점검', uidA, `쪽지점검 ${i}번\n둘째 줄 ${i}`));
  const newest = ids[COUNT - 1];
  const oldest = ids[0];
  await send(em, uidA, '김점검', uidB, '보낸 쪽지 점검');

  const A = await newPage(browser);
  A.dialogs.answer = true;
  const page = A.page;
  await page.addInitScript(() => localStorage.setItem('sp5_theme', 'light'));
  await open(page, `#/day/${DAY}`);
  const rows = (box) => page.locator(`${sel('mail-list', box)} ${sel('mail-row')}`);

  r.section('■1 받은 쪽지');
  await page.evaluate(() => window.sp5.openWindow('mail'));
  r.check(await waitFor(page.locator(sel('mail-window', 'in')), 8000), '✉ 쪽지 창 - 받은 쪽지 탭');
  r.check(await waitFor(async () => (await rows('in').count()) === 30, 10000), `처음 30개 (${await rows('in').count()})`);
  r.check(((await rows('in').first().getAttribute('data-mail-row')) ?? '') === newest, '최근 것이 맨 위');
  r.check((await page.locator(`${sel('mail-list', 'in')} ${sel('mail-read', 'no')}`).count()) === 30, '모두 안 읽음 (data-mail-read=no)');
  r.check(((await rows('in').first().textContent()) ?? '').includes(`쪽지점검 ${COUNT}번`) && ((await rows('in').first().textContent()) ?? '').includes('이점검'), '줄 = 보낸 사람 · 첫 줄');
  r.check(!((await rows('in').first().textContent()) ?? '').includes('둘째 줄'), '접힌 줄에는 첫 줄만');
  await page.locator(sel('mail-more', 'in')).click();
  r.check(await waitFor(async () => (await rows('in').count()) === COUNT, 8000), `더 보기 → ${COUNT}개`);
  r.check(await waitFor(async () => (await page.locator(sel('mail-more', 'in')).count()) === 0, 3000), '끝까지 받으면 더 보기가 없다');
  r.check((await page.locator(sel('mail-row', oldest)).count()) === 1, '가장 오래된 것도');

  r.section('■1 펼치면 읽음');
  const row = page.locator(sel('mail-row', newest));
  await row.locator(sel('mail-open')).click();
  r.check(await waitFor(row.locator(sel('mail-body')), 3000), '누르면 펼침');
  r.check(((await row.locator(sel('mail-text')).textContent()) ?? '').includes('둘째 줄'), '펼치면 글 전체');
  r.check((await row.getAttribute('data-mail-read')) === 'yes', '화면은 곧바로 읽음');
  const readAt = await serverUntil(async () => (await getDoc(doc(em.db, 'v5Mail', uidA, 'mailIn', newest))).data()?.readAt, (v) => !!v);
  r.check(!!readAt, '서버 readAt (서버 시각)');
  await row.locator(sel('mail-open')).click();
  r.check(await waitFor(async () => (await row.locator(sel('mail-body')).count()) === 0, 3000), '다시 누르면 접힘');

  r.section('■1 지우기 · 되돌리기');
  const del = page.locator(sel('mail-row', ids[COUNT - 2]));
  await del.locator(sel('mail-open')).click();
  await del.locator(sel('mail-delete')).click();
  r.check(await waitFor(async () => (await page.locator(sel('mail-row', ids[COUNT - 2])).count()) === 0, 3000), '지우면 바로 사라진다');
  await page.locator(sel('toast-action', '되돌리기')).click();
  r.check(await waitFor(page.locator(sel('mail-row', ids[COUNT - 2])), 3000), '되돌리기 → 다시 보인다');
  await page.waitForTimeout(8000);
  r.check((await getDoc(doc(em.db, 'v5Mail', uidA, 'mailIn', ids[COUNT - 2]))).exists(), '되돌린 것은 서버에 남는다');
  await page.locator(sel('mail-row', ids[COUNT - 2])).locator(sel('mail-open')).click();
  await page.locator(sel('mail-row', ids[COUNT - 2])).locator(sel('mail-delete')).click();
  r.check((await getDoc(doc(em.db, 'v5Mail', uidA, 'mailIn', ids[COUNT - 2]))).exists(), '안내가 떠 있는 동안은 서버에 있다');
  const gone = await serverUntil(async () => (await getDoc(doc(em.db, 'v5Mail', uidA, 'mailIn', ids[COUNT - 2]))).exists(), (x) => !x, 12000);
  r.check(!gone, '안내가 닫히면(7초) 서버에서 지운다');
  r.check((await getDoc(doc(emB.db, 'v5Mail', uidB, 'mailSent', ids[COUNT - 2]))).exists(), '보낸 사람 사본은 그대로');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.evaluate(() => window.sp5.openWindow('mail'));
  r.check(await waitFor(async () => (await rows('in').count()) === 30, 10000), '다시 열면 30개 (지운 것 빼고 처음부터)');
  r.check((await page.locator(sel('mail-row', ids[COUNT - 2])).count()) === 0, '지운 것은 없다');

  r.section('■1 보낸 쪽지');
  await page.locator(sel('mail-tab-btn', 'sent')).click();
  r.check(await waitFor(page.locator(sel('mail-window', 'sent')), 3000), '보낸 쪽지 탭');
  r.check(await waitFor(async () => (await rows('sent').count()) === 1, 8000), '보낸 것 1');
  r.check(((await rows('sent').first().textContent()) ?? '').includes('→ 이점검'), '줄 = → 받는 사람');
  r.check((await page.locator(`${sel('mail-list', 'sent')} ${sel('mail-read')}`).count()) === 0, '보낸 쪽지에는 읽음 표시가 없다');

  r.section('■1 끊김');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await A.ctx.setOffline(true);
  await page.evaluate(() => window.sp5.openWindow('mail'));
  r.check(await waitFor(page.locator(sel('mail-offline')), 15000), "끊긴 채 열면 '인터넷이 필요합니다'");
  await A.ctx.setOffline(false);
  await page.waitForTimeout(1500);
  await page.locator(sel('mail-retry')).first().click();
  r.check(await waitFor(async () => (await page.locator(sel('mail-offline')).count()) === 0 && (await rows('in').count()) > 0, 15000), '다시 받기 → 목록');

  r.section('■2 쓰기');
  const inboxB = async () => (await getDocs(collection(emB.db, 'v5Mail', uidB, 'mailIn'))).docs.map((d) => ({ id: d.id, ...d.data() }));
  const before = (await inboxB()).length;
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.evaluate(() => window.sp5.openWindow('mail', { tab: 'write' }));
  r.check(await waitFor(page.locator(sel('mail-compose')), 8000), '✏️ 쓰기 탭');
  await page.locator(sel('mail-group')).selectOption(SID);
  r.check(await waitFor(page.locator(sel('mail-to', uidB)), 5000), '그룹을 고르면 구성원 칩 (나 빼고)');
  r.check((await page.locator(sel('mail-to', uidA)).count()) === 0, '내 칩은 없다');
  r.check(await waitFor(async () => ((await page.locator(sel('mail-to', uidB)).textContent()) ?? '').includes('이점검'), 5000), '칩 = 구성원 이름 (people)');
  const box = page.locator(sel('mail-text-input'));
  await box.fill('보내기 점검 - 첫 줄\n둘째 줄');
  await page.locator(sel('mail-send')).click();
  r.check(await waitFor(page.locator(sel('toast'), { hasText: '받는 사람을 골라' }), 3000), '받는 사람 없이 보내면 안내');
  await page.locator(sel('mail-to', uidB)).click();
  r.check((await page.locator(sel('mail-to', uidB)).getAttribute('aria-pressed')) === 'true', '칩을 누르면 고름');
  await box.press('Control+s');
  await page.waitForTimeout(1500);
  r.check((await inboxB()).length === before && (await box.inputValue()).includes('보내기 점검'), 'Ctrl+S는 보내지 않는다 (글 그대로)');
  await box.press('Control+Enter');
  const got = await serverUntil(inboxB, (l) => l.some((x) => x.text === '보내기 점검 - 첫 줄\n둘째 줄'), 10000);
  const m1 = got.find((x) => x.text === '보내기 점검 - 첫 줄\n둘째 줄');
  r.check(!!m1, 'Ctrl+Enter = 보내기 → B 받은 쪽지');
  r.check(m1?.from === uidA && m1?.fromName === '김점검' && m1?.toNames === '이점검' && m1?.sid === SID && m1?.groupName === GROUP && m1?.readAt === null && m1?.replyTo === null, '받는 쪽 칸 (보낸 사람 이름 = 그룹 people 이름)');
  r.check(!!m1 && (await getDoc(doc(em.db, 'v5Mail', uidA, 'mailSent', m1.id))).exists(), '내 보낸 사본 (같은 id)');
  r.check(await waitFor(page.locator(sel('mail-window', 'sent')), 5000), '보내면 보낸 쪽지 탭으로');
  r.check(await waitFor(async () => ((await rows('sent').first().getAttribute('data-mail-row')) ?? '') === m1?.id, 8000), '보낸 쪽지 맨 위에 방금 것');
  await page.locator(sel('mail-tab-btn', 'write')).click();
  r.check((await box.inputValue()) === '', '보낸 뒤 글 칸은 빈다');

  r.section('■2 답장');
  await page.locator(sel('mail-tab-btn', 'in')).click();
  const top = page.locator(sel('mail-row', newest));
  await top.locator(sel('mail-open')).click();
  await top.locator(sel('mail-reply')).click();
  r.check(await waitFor(page.locator(sel('mail-reply-to', newest)), 3000), '↩ 답장 → 쓰기 탭에 답장 표시');
  r.check((await page.locator(sel('mail-to', uidB)).getAttribute('aria-pressed')) === 'true' && (await page.locator(sel('mail-to')).count()) >= 1, '받는 사람 = 보낸 선생님');
  await box.fill('답장 점검');
  await page.locator(sel('mail-send')).click();
  const rep = (await serverUntil(inboxB, (l) => l.some((x) => x.text === '답장 점검'), 10000)).find((x) => x.text === '답장 점검');
  r.check(rep?.replyTo === newest, '답장 = replyTo (받은 쪽지 id)');

  r.section('■2 쓰던 글 보관');
  await page.locator(sel('mail-tab-btn', 'write')).click();
  await box.fill('보관 점검 글');
  await page.waitForTimeout(2600);
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.evaluate(() => window.sp5.openWindow('mail', { tab: 'write' }));
  r.check(await waitFor(page.locator(sel('draft-offer')), 5000), "다시 열면 '저장하지 않은 글이 있습니다'");
  await page.locator(sel('draft-restore')).click();
  r.check((await box.inputValue()) === '보관 점검 글', '되살리기 → 글');
  await box.fill('');
  // 보관에는 아직 남아 있다(되살린 뒤 비웠을 뿐) - 앱을 다시 열어도 띠에는 나오지 않는다
  await page.reload();
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  r.check((await page.locator(sel('drafts-banner')).count()) === 0, "앱 위 '저장하지 않은 글' 띠에는 넣지 않는다 (다시 열어 봄)");

  r.section('■2 그룹 창 구성원 ✉');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.evaluate(() => window.sp5.openWindow('group'));
  const chip = page.locator(`${sel('group-row', SID)} ${sel('group-mail', uidB)}`);
  r.check(await waitFor(chip, 8000), '구성원 칩에 ✉ (나 말고)');
  r.check((await page.locator(`${sel('group-row', SID)} ${sel('group-mail', uidA)}`).count()) === 0, '내 칩에는 없다');
  await chip.click();
  r.check(await waitFor(page.locator(sel('mail-compose')), 5000), '✉ → 쪽지 쓰기');
  r.check((await page.locator(sel('mail-group')).inputValue()) === SID && (await page.locator(sel('mail-to', uidB)).getAttribute('aria-pressed')) === 'true', '그 그룹·그 사람이 골라져 있다');

  r.section('■2 끊긴 채 보내기');
  await box.fill('끊김 점검');
  await A.ctx.setOffline(true);
  await page.locator(sel('mail-send')).click();
  r.check(await waitFor(page.locator(sel('pending-writes')), 5000), "끊기면 '저장을 기다립니다' 띠");
  r.check(((await page.locator(sel('mail-send')).textContent()) ?? '').includes('보내는 중'), '단추는 보내는 중…');
  await A.ctx.setOffline(false);
  const off = await serverUntil(inboxB, (l) => l.some((x) => x.text === '끊김 점검'), 20000);
  r.check(off.some((x) => x.text === '끊김 점검'), '연결되면 간다');
  r.check(await waitFor(async () => (await page.locator(sel('pending-writes')).count()) === 0, 8000), '띠가 사라진다');

  r.check(A.errors.length === 0, `페이지 오류 없음 ${A.errors.slice(0, 2).join(' / ')}`);
} catch (e) {
  r.bad(`멈춤: ${String(e?.message || e).split('\n')[0]}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
