// tools/inspect-attach.mjs - P4-2: 구글 토큰·첨부·캡처·표·클립보드 칸·사진 보기·링크 미리보기를 실제 크롬에서 본다.
// 구글 API(tokeninfo·드라이브)는 page.route로 흉내 낸다 - 실제 계정 확인은 사용자 부탁(PLAN P4-2 ■4).
//   1) 토큰이 만료(tokeninfo 400)인 채 캡처 붙여넣기 → '구글 로그인이 필요합니다' 창(누른 때가 아니라 로그인 창을 바로 못 띄운다)
//      → 닫기 = 올리지 않고 까닭 안내. 창의 '구글 로그인'은 누른 자리에서 로그인 창을 연다(막히지 않는다).
//   2) 토큰이 살아 있으면 캡처 Ctrl+V = 드라이브에 원본으로(School_Planner 폴더·공개 읽기) → 그림 첨부, 📎 파일 첨부 = 제 이름.
//      올리는 동안 저장하지 않는다. 엑셀 표 붙여넣기 = 표(함께 온 그림은 올리지 않는다) → 칸 글자 고치기·행 넣기.
//   3) 저장 = 서버 문서 하나에 attachments(driveId·thumbnail 주소)·tables. 카드: 그림·표·주소 미리보기, 그림 누르기 = 크게 보기(넘기기·ESC는 사진 창만).
//   4) 클립보드 칸: 📋 열기·Ctrl+C 한 글자가 모인다·누르면 글 쓰던 칸에·⤓ 가져오기(밖에서 복사한 글자·캡처 그림)·그림 누르기 = 올려 붙임·✕ = 휴지통·폭 끌기.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-attach.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 기록('점검첨부…')을 만들고 끝에 지운다.
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
  return snap.docs.filter((d) => (d.data().createdAt ?? 0) >= startedAt && String(d.data().text).includes('점검첨부'));
};
undo.add(async () => {
  for (const d of await madeHere()) await deleteDoc(d.ref);
});

// ── 구글 흉내 ─────────────────────────────────────────────
const google = { tokenOk: false, uploads: [], permissions: 0, folderLookups: 0 };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Location' };
// 1x1 PNG (드라이브 thumbnail 대신)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
async function mockGoogle(ctx) {
  await ctx.route(/oauth2\.googleapis\.com\/tokeninfo/, (route) => route.fulfill({ status: google.tokenOk ? 200 : 400, headers: CORS, json: google.tokenOk ? { expires_in: 3000 } : { error: 'invalid_token' } }));
  await ctx.route(/www\.googleapis\.com\/(upload\/)?drive\/v3\/files/, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = req.url();
    if (url.includes('/permissions')) {
      google.permissions += 1;
      return route.fulfill({ status: 200, headers: CORS, json: { id: 'anyone' } });
    }
    if (url.includes('uploadType=resumable')) {
      const meta = JSON.parse(req.postData() || '{}');
      google.uploads.push({ name: meta.name, mimeType: meta.mimeType, parents: meta.parents });
      return route.fulfill({ status: 200, headers: { ...CORS, Location: `https://upload.mock.test/s/${google.uploads.length}` }, body: '' });
    }
    if (req.method() === 'GET' && url.includes('q=')) {
      google.folderLookups += 1;
      return route.fulfill({ status: 200, headers: CORS, json: { files: [{ id: 'FOLDER_SP' }] } });
    }
    return route.fulfill({ status: 404, headers: CORS, json: {} });
  });
  await ctx.route(/upload\.mock\.test\/s\/(\d+)/, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const n = route.request().url().split('/').pop();
    const up = google.uploads[Number(n) - 1];
    return route.fulfill({ status: 200, headers: CORS, json: { id: `DRIVE${n}`, name: up?.name, webViewLink: `https://drive.google.com/file/d/DRIVE${n}/view` } });
  });
  await ctx.route(/drive\.google\.com\/thumbnail/, (route) => route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'image/png' }, body: PNG }));
  await ctx.route(/img\.youtube\.com|google\.com\/s2\/favicons/, (route) => route.fulfill({ status: 200, headers: { 'Content-Type': 'image/png' }, body: PNG }));
}

/** 글 칸에 붙여넣기 (html·그림 파일) - 크롬의 진짜 붙여넣기처럼 ClipboardEvent */
const paste = (page, { html = '', image = false } = {}) =>
  page.locator(sel('note-text-input')).evaluate(
    async (el, { html, image }) => {
      const dt = new DataTransfer();
      if (html) dt.setData('text/html', html);
      if (image) {
        const c = document.createElement('canvas');
        c.width = 4;
        c.height = 3;
        c.getContext('2d').fillRect(0, 0, 4, 3);
        const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
        dt.items.add(new File([blob], 'image.png', { type: 'image/png' }));
      }
      el.focus();
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    { html, image },
  );

const EXCEL = `<html><head><style>.xl65 {font-weight:700; background:#FFFF00; border:.5pt solid windowtext;}</style></head><body>
<table><col width=72 span=2><tr><td class=xl65>이름</td><td class=xl65>점수</td></tr><tr><td>가</td><td x:num>90</td></tr></table></body></html>`;

try {
  const { ctx, page, errors } = await newPage(browser);
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(process.env.SITE || 'http://localhost:5175/').origin });
  await mockGoogle(ctx);
  // 계정 설정의 창 위치가 남아 있어도 쓰는 칸은 오른쪽 - 그대로 둔다. 토큰은 만료된 것을 챙겨 둔 채로 시작
  await ctx.addInitScript(() => sessionStorage.setItem('sp5-google-token', 'old-token'));
  await open(page, `#/day/${DAY}`);
  await page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });

  r.section('구글 로그인이 필요합니다');
  await page.locator(sel('journal-add')).click();
  const panel = page.locator(sel('note-panel'));
  await waitFor(panel);
  await page.keyboard.type('점검첨부 기록');
  await paste(page, { image: true });
  const prompt = page.locator(sel('google-login-prompt'));
  r.check(await waitFor(prompt), '토큰이 만료돼 있으면 붙여넣기 뒤 묻는 창이 뜬다 (로그인 창을 바로 띄우지 않는다)');
  r.check(google.uploads.length === 0, '아직 올리지 않았다');
  const popupP = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
  await page.locator(sel('google-login')).click();
  const popup = await popupP;
  // 클라우드 컨테이너는 apis.google.com에 닿지 못해 Firebase가 로그인 창을 열기 전에 auth/internal-error로 멈춘다 - PC에서만 본다
  if (!popup && consoleErrors.some((t) => t.includes('auth/internal-error'))) console.log("  - '구글 로그인' 단추 = 로그인 창: 이 컴퓨터는 apis.google.com에 닿지 못해 건너뜀 (PC에서 확인)");
  else r.check(!!popup, "'구글 로그인' 단추 = 누른 자리에서 로그인 창이 열린다 (막히지 않는다)");
  await popup?.close();
  r.check(await waitFor(page.locator(sel('google-login-error')), 8000), `로그인 창을 닫으면 묻는 창에 까닭이 남는다 (${await page.locator(sel('google-login-error')).textContent().catch(() => '')})`);
  await page.locator(sel('google-login-close')).click();
  const failToast = page.locator(sel('toast')).filter({ hasText: '업로드에 실패' });
  r.check(await waitFor(failToast), '닫기 = 올리지 않고 안내');
  r.check((await failToast.textContent()).includes('구글 로그인을 하지 않아'), `까닭이 붙는다 (${(await failToast.textContent()).trim().slice(0, 60)})`);
  r.check((await panel.locator(sel('note-attachment')).count()) === 0 && google.uploads.length === 0, '첨부는 붙지 않았다');

  r.section('캡처 붙여넣기·파일 첨부 (드라이브)');
  google.tokenOk = true;
  await paste(page, { image: true });
  r.check(await waitFor(panel.locator(sel('note-attachment-image')), 8000), '캡처 Ctrl+V = 그림 첨부');
  const up1 = google.uploads[0];
  r.check(up1 && /^붙여넣은_이미지_\d{8}_\d{6}\.png$/.test(up1.name) && up1.mimeType === 'image/png', `이름 '붙여넣은_이미지_…' (${up1?.name})`);
  r.check(up1?.parents?.[0] === 'FOLDER_SP' && google.permissions >= 1, 'School_Planner 폴더에 올리고 공개 읽기');
  r.check(google.folderLookups === 1, `폴더는 한 번만 찾는다 (${google.folderLookups})`);
  await page.locator(sel('note-file-input')).setInputFiles([
    { name: '가정통신문.hwp', mimeType: 'application/x-hwp', buffer: Buffer.from('hwp') },
    { name: '사진.png', mimeType: 'image/png', buffer: PNG },
  ]);
  r.check(await waitFor(panel.locator(sel('note-attachment', '가정통신문.hwp')), 8000), '📎 파일 첨부 = 제 이름으로');
  r.check((await panel.locator(sel('note-attachment-image')).count()) === 2, '그림 파일은 그림으로 크게');
  r.check(google.folderLookups === 1, '폴더를 다시 찾지 않는다');

  r.section('엑셀 표 붙여넣기');
  await paste(page, { html: EXCEL, image: true });
  const table = panel.locator(sel('note-table'));
  r.check(await waitFor(table), '표로 붙는다');
  await page.waitForTimeout(300);
  r.check(google.uploads.length === 3, `함께 온 그림은 올리지 않는다 (올린 수 ${google.uploads.length})`);
  r.check((await table.locator('td').first().evaluate((td) => getComputedStyle(td).backgroundColor)) === 'rgb(255, 255, 0)', '서식째 (배경색)');
  await table.locator('[data-cell="1-1"]').click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('95');
  await page.keyboard.press('Enter');
  await table.locator('[data-cell="1-0"]').click();
  await page.keyboard.press('Escape');
  r.check(await panel.isVisible(), '칸 고치기의 ESC는 칸만 멈춘다 (쓰는 칸은 그대로)');
  await table.locator(sel('table-op', 'row-below')).click();
  r.check((await table.locator('tr').count()) === 3, '↓ 행 = 한 행 더');

  r.section('저장 = 문서 하나');
  await page.locator(sel('note-text-input')).click();
  await page.locator(sel('note-text-input')).press('End');
  await page.keyboard.type(' https://youtu.be/abc123');
  r.check(await waitFor(panel.locator(sel('link-preview', 'youtube'))), '글 안 주소 = 미리보기 카드');
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.getAttribute('data-note-panel')) === 'edit', 8000), '저장 → 수정 칸');
  const id = await panel.getAttribute('data-note-id');
  const saved = await serverUntil(async () => (await madeHere()).find((d) => d.id === id)?.data(), (d) => !!d);
  const atts = saved?.attachments ?? [];
  r.check(atts.length === 3, `서버: 첨부 3 (${atts.map((a) => a.name).join(', ')})`);
  r.check(atts[0]?.driveId === 'DRIVE1' && atts[0]?.url === 'https://drive.google.com/thumbnail?id=DRIVE1&sz=w1000' && atts[0]?.type === 'image/png', '그림 = thumbnail 주소·driveId');
  r.check(atts[1]?.url === 'https://drive.google.com/uc?export=download&id=DRIVE2', '파일 = 내려받기 주소');
  r.check(JSON.stringify(saved?.tables?.[0]?.rows?.map((row) => row.cells.map((c) => c.v))) === '[["이름","점수"],["가","95"],["",""]]', '서버: 표(고친 칸·넣은 행)');

  r.section('카드·사진 크게 보기');
  await page.keyboard.press('Escape');
  const card = page.locator(sel('entry-card', id));
  r.check(await waitFor(card), '기록 카드');
  r.check((await card.locator(sel('entry-image')).count()) === 2, '카드에 그림 둘');
  r.check((await card.locator(sel('entry-table')).count()) === 1 && (await card.locator(sel('link-preview')).count()) === 1, '카드에 표·주소 미리보기');
  await card.locator(sel('entry-image', 1)).click();
  const viewer = page.locator(sel('image-viewer'));
  r.check(await waitFor(viewer), '그림 누르기 = 크게 보기');
  r.check((await viewer.locator(sel('image-viewer-title')).textContent()).includes('(2/2)'), '누른 그림부터 (2/2)');
  await viewer.locator(sel('image-viewer-next')).click();
  r.check((await viewer.locator(sel('image-viewer-title')).textContent()).includes('(1/2)'), '› = 넘기기 (끝에서 처음으로)');
  await card.evaluate(() => {}); // 카드는 그대로
  await page.locator(sel('entry-edit')).first().evaluate(() => {});
  await page.evaluate(([s, d, i]) => window.sp5.openWindow('note', { sid: s, date: d, id: i }), [sid, DAY, id]);
  await page.locator(sel('image-viewer-close')).click();
  await panel.locator(sel('note-attachment-view')).first().click();
  r.check(await waitFor(viewer), '쓰는 칸의 그림도 크게 보기');
  await page.keyboard.press('Escape');
  r.check((await viewer.count()) === 0 && (await panel.isVisible()), 'ESC는 사진 창만 닫는다 (쓰는 칸은 그대로)');

  r.section('클립보드 칸');
  await page.locator(sel('clipboard-toggle')).click();
  const column = page.locator(sel('clipboard-panel'));
  r.check(await waitFor(column), '📋 = 왼쪽 클립보드 칸');
  // 화면 여백은 0.2초에 걸쳐 바뀐다
  const mainLeft = () => page.locator('main').evaluate((m) => m.getBoundingClientRect().left);
  r.check(await waitFor(async () => (await mainLeft()) >= (await column.boundingBox()).width - 1), `넓은 화면에서는 화면을 오른쪽으로 민다 (본문 왼쪽 ${Math.round(await mainLeft())})`);
  const text = page.locator(sel('note-text-input'));
  await text.click();
  await text.press('Control+Home');
  await page.keyboard.press('Shift+End');
  await page.keyboard.press('Control+c');
  const firstLine = (await text.inputValue()).split('\n')[0];
  r.check(await waitFor(column.locator(sel('clip-item', 'text')).filter({ hasText: firstLine })), `Ctrl+C 한 글자가 모인다 (${firstLine.slice(0, 20)})`);
  await text.press('Control+End');
  await page.keyboard.type(' / ');
  await column.locator(sel('clip-item', 'text')).first().locator(sel('clip-paste')).click();
  r.check((await text.inputValue()).endsWith(` / ${firstLine}`), '항목 누르기 = 글 쓰던 칸의 커서 자리에');
  await page.evaluate(() => navigator.clipboard.writeText('점검첨부 밖에서 복사'));
  await column.locator(sel('clipboard-fetch')).click();
  r.check(await waitFor(column.locator(sel('clip-item', 'text')).filter({ hasText: '밖에서 복사' })), '⤓ 가져오기 = 다른 프로그램에서 복사한 글자');
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 5;
    c.height = 5;
    c.getContext('2d').fillRect(0, 0, 5, 5);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  });
  await column.locator(sel('clipboard-fetch')).click();
  const imgClip = column.locator(sel('clip-item', 'image')).first();
  r.check(await waitFor(imgClip), '캡처 그림도 모인다 (🖼️)');
  const before = google.uploads.length;
  await text.click();
  await imgClip.locator(sel('clip-paste')).click();
  r.check(await waitFor(async () => (await panel.locator(sel('note-attachment-image')).count()) === 3, 8000), '그림 항목 누르기 = 쓰는 칸에 올려 붙인다');
  r.check(google.uploads.length === before + 1, '드라이브에 하나 더 올렸다');
  const n = await column.locator(sel('clip-item')).count();
  await column.locator(sel('clip-item')).first().hover();
  await column.locator(sel('clip-remove')).first().click();
  r.check(await waitFor(async () => (await column.locator(sel('clip-item')).count()) === n - 1), '✕ = 목록에서 뺀다 (이 기기 휴지통으로)');
  const kept = await page.evaluate(async (u) => {
    const db = await new Promise((res, rej) => {
      const q = indexedDB.open(`sp5-clipboard-${u}`);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    const count = (s) => new Promise((res) => (db.transaction(s).objectStore(s).count().onsuccess = (e) => res(e.target.result)));
    const out = { items: await count('items'), trash: await count('trash') };
    db.close();
    return out;
  }, uid);
  r.check(kept.items === n - 1 && kept.trash >= 1, `이 기기 IndexedDB에 (목록 ${kept.items} · 휴지통 ${kept.trash})`);
  const resizer = page.locator(sel('column-resizer', 'left'));
  const w0 = (await column.boundingBox()).width;
  const g = await resizer.boundingBox();
  await page.mouse.move(g.x + 4, 400);
  await page.mouse.down();
  await page.mouse.move(g.x + 100, 400, { steps: 5 });
  await page.mouse.up();
  const w1 = (await column.boundingBox()).width;
  await resizer.dblclick();
  const w2 = (await column.boundingBox()).width;
  r.check(w1 > w0 + 60 && Math.abs(w2 - w0) < 2, `폭 끌기 ${Math.round(w0)} → ${Math.round(w1)}, 두 번 누르면 ${Math.round(w2)}`);
  await page.locator(sel('clipboard-toggle')).click();
  r.check((await column.count()) === 0, '◀ = 닫기');

  await page.keyboard.press('Escape');
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
  // 점검이 남긴 클립보드 목록을 지운다 (이 프로필은 끝나면 사라지지만 같은 계정의 다른 점검에 섞이지 않게)
  await page.evaluate((u) => new Promise((res) => {
    const q = indexedDB.deleteDatabase(`sp5-clipboard-${u}`);
    q.onsuccess = q.onerror = q.onblocked = () => res();
  }), uid);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
