// tools/inspect-handwriting.mjs - 메모 쓰는 칸 ✏️ 손글씨를 실제 크롬에서 본다.
//   1) ✏️ 손글씨 = 화면 가득 그림판. 마우스로 긋기 · 펜(CDP pointerType pen, 누르는 힘)으로 긋기 · 펜을 쓴 뒤의 손가락(손바닥)은 그리지 않는다 ·
//      펜 옆 단추(오른쪽 단추)를 누른 채 = 지우개 · ↶ 되돌리기 · Ctrl+Z.
//   2) ESC = 그림판만 닫고(쓰는 칸은 그대로) 그리던 것은 남는다 → 다시 열면 이어진다.
//   3) ✓ 첨부 = '손글씨_….png'로 드라이브에(흉내) → 그림 첨부 → 저장하면 서버 문서의 attachments에.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-handwriting.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 메모('점검손글씨…')를 만들고 끝에 지운다.
import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();
const DAY = '2026-10-08';
const startedAt = Date.now();

const madeHere = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return snap.docs.filter((d) => (d.data().createdAt ?? 0) >= startedAt && String(d.data().text).includes('점검손글씨'));
};
undo.add(async () => {
  for (const d of await madeHere()) await deleteDoc(d.ref);
});

// ── 구글 흉내 (inspect-attach와 같다) ─────────────────────
const google = { uploads: [] };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Location' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
async function mockGoogle(ctx) {
  await ctx.route(/oauth2\.googleapis\.com\/tokeninfo/, (route) => route.fulfill({ status: 200, headers: CORS, json: { expires_in: 3000 } }));
  await ctx.route(/www\.googleapis\.com\/(upload\/)?drive\/v3\/files/, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = req.url();
    if (url.includes('/permissions')) return route.fulfill({ status: 200, headers: CORS, json: { id: 'anyone' } });
    if (url.includes('uploadType=resumable')) {
      const meta = JSON.parse(req.postData() || '{}');
      google.uploads.push({ name: meta.name, mimeType: meta.mimeType });
      return route.fulfill({ status: 200, headers: { ...CORS, Location: `https://upload.mock.test/s/${google.uploads.length}` }, body: '' });
    }
    if (req.method() === 'GET' && url.includes('q=')) return route.fulfill({ status: 200, headers: CORS, json: { files: [{ id: 'FOLDER_SP' }] } });
    return route.fulfill({ status: 404, headers: CORS, json: {} });
  });
  await ctx.route(/upload\.mock\.test\/s\/(\d+)/, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const n = route.request().url().split('/').pop();
    const up = google.uploads[Number(n) - 1];
    // 올린 몸 크기도 본다 (그린 둘레만 잘랐나)
    if (up) up.bytes = route.request().postDataBuffer()?.length ?? 0;
    return route.fulfill({ status: 200, headers: CORS, json: { id: `DRIVE${n}`, name: up?.name, webViewLink: `https://drive.google.com/file/d/DRIVE${n}/view` } });
  });
  await ctx.route(/drive\.google\.com\/thumbnail/, (route) => route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'image/png' }, body: PNG }));
}

try {
  const { ctx, page, errors } = await newPage(browser);
  await mockGoogle(ctx);
  await ctx.addInitScript(() => sessionStorage.setItem('sp5-google-token', 'ok-token'));
  const cdp = await ctx.newCDPSession(page);
  await open(page, `#/day/${DAY}`);
  await page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });

  await page.locator(sel('journal-add')).click();
  const panel = page.locator(sel('note-panel'));
  await waitFor(panel);
  await page.keyboard.type('점검손글씨 메모');

  r.section('그림판 열기·긋기');
  await page.locator(sel('note-handwriting')).click();
  const pad = page.locator(sel('handwriting-pad'));
  r.check(await waitFor(pad), '✏️ 손글씨 = 그림판이 뜬다');
  r.check(await waitFor(page.locator(sel('pen-hint'))), '빈 그림판에는 쓰는 법 안내');
  const box = await page.locator(sel('pen-canvas')).boundingBox();
  r.check(box && box.width > 1000 && box.height > 600, `화면 가득 (${Math.round(box?.width)}×${Math.round(box?.height)})`);
  const count = async () => Number(await pad.getAttribute('data-pen-count'));

  // 마우스로 한 줄
  const ox = box.x + 200;
  const oy = box.y + 150;
  await page.mouse.move(ox, oy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(ox + i * 20, oy + Math.sin(i) * 20);
  await page.mouse.up();
  r.check((await count()) === 1, `마우스로 그은 줄 하나 (${await count()})`);
  r.check((await page.locator(sel('pen-hint')).count()) === 0, '그으면 안내가 사라진다');

  // 펜 (CDP - pointerType pen, 누르는 힘)
  const pen = async (type, x, y, extra = {}) => cdp.send('Input.dispatchMouseEvent', { type, x, y, pointerType: 'pen', button: 'left', buttons: 1, force: 0.8, clickCount: 1, ...extra });
  await pen('mousePressed', ox, oy + 120);
  for (let i = 1; i <= 10; i++) await pen('mouseMoved', ox + i * 25, oy + 120 + i * 5, { force: 0.2 + i * 0.07 });
  await pen('mouseReleased', ox + 250, oy + 170, { buttons: 0, force: 0 });
  r.check((await count()) === 2, `펜으로 그은 줄 (${await count()})`);

  // 펜을 쓴 뒤의 손가락(손바닥)은 그리지 않는다 - 손가락 pointer를 흉내 낸다
  await page.locator(sel('pen-canvas')).evaluate((el, { x, y }) => {
    const ev = (type, dx) => new PointerEvent(type, { pointerId: 77, pointerType: 'touch', clientX: x + dx, clientY: y, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true });
    el.dispatchEvent(ev('pointerdown', 0));
    el.dispatchEvent(ev('pointermove', 40));
    el.dispatchEvent(ev('pointerup', 80));
  }, { x: ox, y: oy + 300 });
  r.check((await count()) === 2, `펜을 쓴 뒤 손가락(손바닥)은 그리지 않는다 (${await count()})`);

  // 펜 옆 단추 = 지우개 - 지운 자리의 그림이 비었나
  const inkAt = (x, y) =>
    page.locator(sel('pen-canvas')).evaluate((el, { x, y }) => {
      const rect = el.getBoundingClientRect();
      const dpr = el.width / rect.width;
      const d = el.getContext('2d').getImageData(Math.round((x - rect.left) * dpr), Math.round((y - rect.top) * dpr), 1, 1).data;
      return d[3];
    }, { x, y });
  const ex = ox + 100;
  const ey = oy + Math.sin(5) * 20;
  r.check((await inkAt(ex, ey)) > 0, '지우기 전 그 자리에 잉크가 있다');
  await pen('mousePressed', ex - 20, ey, { button: 'right', buttons: 2 });
  for (let i = 1; i <= 8; i++) await pen('mouseMoved', ex - 20 + i * 5, ey, { button: 'right', buttons: 2 });
  await pen('mouseReleased', ex + 20, ey, { button: 'right', buttons: 0, force: 0 });
  r.check((await count()) === 3, `펜 옆 단추로 그은 줄 (${await count()})`);
  r.check((await inkAt(ex, ey)) === 0, '펜 옆 단추를 누른 채 그으면 지운다');

  await page.screenshot({ path: process.env.SHOT || '/tmp/handwriting-pad.png' });

  r.section('되돌리기·닫기·이어 그리기');
  await page.locator(sel('pen-undo')).click();
  r.check((await count()) === 2 && (await inkAt(ex, ey)) > 0, '↶ 되돌리기 = 지우개 줄이 빠지고 잉크가 돌아온다');
  await page.keyboard.press('Control+z');
  r.check((await count()) === 1, `Ctrl+Z = 마지막 줄 지우기 (${await count()})`);
  r.check((await panel.count()) === 1, 'Ctrl+Z는 그림판만 (쓰는 칸은 그대로)');
  await page.keyboard.press('Escape');
  r.check(await pad.waitFor({ state: 'detached', timeout: 3000 }).then(() => true, () => false), 'ESC = 그림판만 닫는다');
  r.check((await panel.count()) === 1 && (await page.locator(sel('note-text-input')).inputValue()).includes('점검손글씨'), '쓰는 칸과 적던 글은 그대로');
  r.check((await page.locator(sel('note-handwriting')).getAttribute('data-pen-dirty')) !== null, "단추가 '손글씨 (그리던 것)'");
  await page.locator(sel('note-handwriting')).click();
  r.check((await waitFor(pad)) && (await count()) === 1, `다시 열면 그리던 것이 이어진다 (${await count()})`);

  r.section('✓ 첨부 → 저장');
  await page.locator(sel('pen-done')).click();
  const img = panel.locator(sel('note-attachment-image'));
  r.check(await waitFor(img, 8000), '✓ 첨부 = 그림 첨부가 붙는다');
  r.check((await page.locator(sel('handwriting-pad')).count()) === 0, '첨부하면 그림판이 닫힌다');
  const up = google.uploads[0];
  r.check(up && /^손글씨_\d{8}_\d{6}\.png$/.test(up.name) && up.mimeType === 'image/png', `이름 '손글씨_….png' · PNG (${up?.name})`);
  r.check((await page.locator(sel('note-handwriting')).getAttribute('data-pen-dirty')) === null, '올라가면 그리던 것을 비운다');
  await page.locator(sel('note-handwriting')).click();
  r.check((await waitFor(pad)) && (await count()) === 0, '다시 열면 빈 그림판');
  await page.keyboard.press('Escape');
  await page.locator(sel('note-save')).click();
  const saved = await serverUntil(madeHere, (docs) => docs.length === 1 && (docs[0].data().attachments ?? []).some((a) => /^손글씨_/.test(a.name)));
  r.check(saved, '저장 = 서버 문서의 attachments에 손글씨 그림');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' / ')}`);
} catch (e) {
  console.error(e);
  r.check(false, `점검 중 오류: ${e.message}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
