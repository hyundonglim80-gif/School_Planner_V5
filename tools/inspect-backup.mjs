// tools/inspect-backup.mjs - P8-3 ■1: '💾 백업 · 가져오기 · 보내기' 창을 실제 크롬에서 본다.
//   1) ⋮ 자료 → 창 · 탭 셋(백업·가져오기·보내기) · 단축키 '구글 캘린더로 보내기' = '보내기' 탭 · 가져오기 탭 = V4 자료 가져오기
//   2) 🗄️ JSON 백업 받기 → V5 모양(version·colls·시각 $ts) · 고른 갈래만 · 지운 것은 없다
//   3) 📄 CSV 받기 → V4 모양 머리줄
//   4) 되살리기: 지운 일정은 돌아오고, 백업 뒤에 고친 일정은 덮지 않는다
//   5) ☁️ 드라이브 자동 백업(드라이브는 page.route 흉내): 할 때면 열자마자 조용히 · 공개하지 않음 · 최근 8개만(V4 파일은 그대로) ·
//      주기 고르기 = 계정 설정 · 지금 백업 = 같은 날 둘째는 시각을 붙인다 · 토큰이 없으면 띠 · 나중에 = 하루 숨김
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-backup.mjs
import { readFileSync } from 'node:fs';
import { deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const DAYMS = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const browser = await launch();
const ref = (id) => doc(em.db, 'spaces', sid, 'items', id);
const DAY = '2027-06-07';
const base = { kind: 'event', date: DAY, labelIds: [], order: 'a0', createdAt: Date.now(), authorId: uid, deletedAt: null, v: 1, updatedAt: serverTimestamp() };

try {
  await setDoc(ref('inspBkGone'), { ...base, text: '백업점검 지울 일정' });
  await setDoc(ref('inspBkEdit'), { ...base, text: '백업점검 고칠 일정', order: 'a1' });
  await setDoc(ref('inspBkMemo'), { ...base, kind: 'note', date: null, text: '백업점검 메모' });
  undo.add(async () => {
    for (const id of ['inspBkGone', 'inspBkEdit', 'inspBkMemo']) await deleteDoc(ref(id));
  });

  const { page, errors } = await newPage(browser);
  await open(page, `#/day/${DAY}`);
  await waitFor(page.locator(sel('event-card', 'inspBkEdit')), 10000);

  r.section('창 · 탭');
  await page.locator(sel('more-menu')).click();
  await page.locator(sel('menu-item', 'backup')).click();
  const win = page.locator(sel('backup-window'));
  r.check(await waitFor(win, 8000), '⋮ 자료 → 백업 · 가져오기 · 보내기 창');
  const tabs = await page.locator('[data-backup-tab-btn]').evaluateAll((els) => els.map((e) => e.getAttribute('data-backup-tab-btn')));
  r.check(tabs.join() === 'backup,import,send', `탭 셋 (${tabs.join()})`);
  await page.locator(sel('backup-tab-btn', 'import')).click();
  r.check(await page.locator(sel('import-run')).isVisible(), "'가져오기' 탭 = V4 자료 가져오기");
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.evaluate(() => window.sp5.runShortcut('calendar'));
  r.check(await waitFor(async () => (await page.locator(sel('backup-window')).getAttribute('data-backup-window')) === 'send', 8000), "단축키 '구글 캘린더로 보내기' = '보내기' 탭");
  r.check(await page.locator(sel('calendar-sync-window')).isVisible(), '보내기 탭 = 구글 캘린더로 보내기');
  await page.locator(sel('backup-tab-btn', 'backup')).click();

  r.section('🗄️ JSON 백업 받기');
  await page.locator(sel('backup-include', 'lessons')).uncheck();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.locator(sel('backup-json')).click()]);
  const json = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  // 컨테이너 Chromium은 한글 파일 이름을 'download'로 바꾼다(inspect-progress) - 이름은 PC 크롬에서만
  const name = dl.suggestedFilename();
  r.check(name === 'download' || (name.startsWith('School_Planner_V5_백업_개인_') && name.endsWith('.json')), `파일 이름 (${name})`);
  r.check(json.version === 'SP5-BACKUP' && json.sid === sid && json.period === 'all', 'V5 모양 (version·공간·전체 기간)');
  r.check(json.colls.items?.inspBkGone?.text === '백업점검 지울 일정' && json.colls.items?.inspBkMemo, '일정·메모가 담긴다');
  r.check(Array.isArray(json.colls.items.inspBkGone.updatedAt?.$ts), '시각 = $ts 모양');
  r.check(!json.colls.lessonDays && !json.colls.timetables && !json.include.includes('lessons'), '고르지 않은 수업은 없다');
  r.check(Object.keys(json.colls.settings ?? {}).every((id) => ['common', 'pc', 'mobile'].includes(id)), '설정은 common·pc·mobile만');
  r.check(Object.values(json.colls.items).every((d) => !d.deletedAt), '지운 것은 담지 않는다');

  r.section('📄 CSV 받기');
  const [csv] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator(sel('backup-csv')).click()]);
  const text = readFileSync(await csv.path(), 'utf8').replace(/^﻿/, '');
  r.check(text.startsWith('#구분,날짜/작성일,시간/교시/라벨,내용,비고/상세'), 'V4 머리줄');
  r.check(text.includes('백업점검 고칠 일정') && text.includes('백업점검 메모'), '일정·메모 줄');

  r.section('되살리기');
  // 백업 뒤에: 하나는 지우고(휴지통), 하나는 고친다
  await setDoc(ref('inspBkGone'), { deletedAt: serverTimestamp(), deletedBy: uid, updatedAt: serverTimestamp() }, { merge: true });
  await setDoc(ref('inspBkEdit'), { text: '백업점검 고친 뒤', updatedAt: serverTimestamp() }, { merge: true });
  await page.locator(sel('restore-file')).setInputFiles(await dl.path());
  r.check(await waitFor(page.locator(sel('restore-preview')), 5000), '파일을 고르면 미리보기 (담긴 수)');
  await page.locator(sel('restore-run')).click();
  r.check(await waitFor(page.locator(sel('restore-result')), 60000), '되살리면 결과 줄');
  const gone = await serverUntil(async () => (await getDoc(ref('inspBkGone'))).data(), (d) => d && !d.deletedAt);
  r.check(gone && !gone.deletedAt && gone.text === '백업점검 지울 일정', '지운 일정이 돌아온다');
  r.check((await getDoc(ref('inspBkEdit'))).data()?.text === '백업점검 고친 뒤', '백업 뒤에 고친 것은 덮지 않는다');
  r.check(((await page.locator(sel('restore-result')).textContent()) ?? '').includes('그대로 두었습니다'), '지금 있는 것은 그대로 둔 수');
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
  await page.close();

  // ── 드라이브 흉내 ──
  r.section('☁️ 드라이브 자동 백업');
  const logRef = doc(em.db, 'spaces', sid, 'settings', 'backupLog');
  const commonRef = doc(em.db, 'spaces', sid, 'settings', 'common');
  const seededLog = (await getDoc(logRef)).data();
  undo.add(async () => {
    await setDoc(logRef, seededLog ?? { lastAt: Date.now() + 365 * DAYMS, updatedAt: serverTimestamp(), v: 1 });
    await setDoc(commonRef, { autoBackup: deleteField(), updatedAt: serverTimestamp() }, { merge: true });
  });
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Location' };
  const drive = { tokenOk: true, files: new Map(), uploads: [], permissions: 0, seq: 0 };
  const old = (i) => new Date(Date.now() - (20 - i) * DAYMS).toISOString();
  drive.files.set('FOLDER_BK', { name: '백업', folder: true, parents: ['FOLDER_SP'] });
  for (let i = 0; i < 8; i++) drive.files.set(`OLD${i}`, { name: `SP5_자동백업_2027-01-0${i + 1}.json`, parents: ['FOLDER_BK'], createdTime: old(i) });
  drive.files.set('V4FILE', { name: 'SP4_자동백업_2027-01-09.json', parents: ['FOLDER_BK'], createdTime: old(9) });
  const sp5Live = () => [...drive.files.entries()].filter(([, f]) => !f.trashed && f.name.startsWith('SP5_자동백업_'));
  async function mockDrive(ctx) {
    await ctx.route(/oauth2\.googleapis\.com\/tokeninfo/, (route) => route.fulfill({ status: drive.tokenOk ? 200 : 400, headers: CORS, json: drive.tokenOk ? { expires_in: 3000 } : { error: 'invalid_token' } }));
    await ctx.route(/www\.googleapis\.com\/(upload\/)?drive\/v3\/files/, async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      const url = new URL(req.url());
      if (url.pathname.endsWith('/permissions')) {
        drive.permissions += 1;
        return route.fulfill({ status: 200, headers: CORS, json: {} });
      }
      if (url.searchParams.get('uploadType') === 'resumable') {
        drive.uploads.push(JSON.parse(req.postData() || '{}'));
        return route.fulfill({ status: 200, headers: { ...CORS, Location: `https://upload.mock.test/b/${drive.uploads.length}` }, body: '' });
      }
      const m = url.pathname.match(/\/files\/([^/]+)$/);
      if (m && req.method() === 'PATCH') {
        const f = drive.files.get(m[1]);
        if (f) f.trashed = JSON.parse(req.postData() || '{}').trashed === true;
        return route.fulfill({ status: 200, headers: CORS, json: { id: m[1] } });
      }
      if (req.method() === 'POST') {
        const meta = JSON.parse(req.postData() || '{}');
        const id = `F${++drive.seq}`;
        drive.files.set(id, { name: meta.name, folder: true, parents: meta.parents });
        return route.fulfill({ status: 200, headers: CORS, json: { id, webViewLink: `https://drive.google.com/drive/folders/${id}` } });
      }
      const q = url.searchParams.get('q') || '';
      if (q.includes("name='School_Planner'")) return route.fulfill({ status: 200, headers: CORS, json: { files: [{ id: 'FOLDER_SP' }] } });
      const inFolder = q.match(/'([^']+)' in parents/)?.[1];
      const named = q.match(/ name='([^']+)'/)?.[1];
      const contains = q.match(/name contains '([^']+)'/)?.[1];
      const files = [...drive.files.entries()]
        .filter(([, f]) => !f.trashed && (!inFolder || f.parents?.includes(inFolder)) && (!named || f.name === named) && (!contains || f.name.includes(contains)))
        .sort((a, b) => String(b[1].createdTime).localeCompare(String(a[1].createdTime)))
        .map(([id, f]) => ({ id, name: f.name, createdTime: f.createdTime, webViewLink: `https://drive.google.com/drive/folders/${id}` }));
      return route.fulfill({ status: 200, headers: CORS, json: { files } });
    });
    await ctx.route(/upload\.mock\.test\/b\/(\d+)/, (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      const n = Number(req.url().split('/').pop());
      const meta = drive.uploads[n - 1];
      const id = `UP${n}`;
      drive.files.set(id, { name: meta.name, parents: meta.parents, createdTime: new Date(Date.now() + n).toISOString(), body: req.postData() });
      return route.fulfill({ status: 200, headers: CORS, json: { id, name: meta.name } });
    });
  }

  // 할 때가 된 계정(마지막 백업 8일 전) + 토큰이 있는 탭 → 열자마자 조용히
  await setDoc(logRef, { lastAt: Date.now() - 8 * DAYMS, updatedAt: serverTimestamp(), v: 1 });
  const startedAt = Date.now();
  const b = await newPage(browser);
  await mockDrive(b.ctx);
  await b.ctx.addInitScript(() => sessionStorage.setItem('sp5-google-token', 'tok'));
  await open(b.page, `#/day/${DAY}`);
  const log1 = await serverUntil(async () => (await getDoc(logRef)).data(), (d) => (d?.lastAt ?? 0) >= startedAt, 30000);
  const today = ymd(new Date());
  r.check(log1?.lastName === `SP5_자동백업_${today}.json`, `열자마자 자동 백업 → 마지막 백업 기록 (${log1?.lastName})`);
  const up1 = drive.files.get('UP1');
  const body1 = up1?.body ? JSON.parse(up1.body) : null;
  r.check(drive.uploads[0]?.parents?.[0] === 'FOLDER_BK' && drive.uploads[0]?.mimeType === 'application/json', 'School_Planner/백업 폴더에 JSON으로');
  r.check(body1?.version === 'SP5-BACKUP' && body1?.auto === true && !!body1?.colls?.items?.inspBkMemo, '파일 = V5 백업(자동 표시·개인 공간 전체)');
  r.check(drive.permissions === 0, '공개하지 않는다 (공유 설정을 부르지 않음)');
  r.check(sp5Live().length === 8 && drive.files.get('OLD0').trashed && !drive.files.get('OLD1').trashed, '최근 8개만 남기고 가장 오래된 것은 드라이브 휴지통으로');
  r.check(!drive.files.get('V4FILE').trashed, 'V4 자동 백업 파일은 건드리지 않는다');
  r.check(await waitFor(b.page.locator('[data-toast]', { hasText: '드라이브에 자동 백업했습니다' }), 8000), '자동 백업 안내');

  // 백업 탭의 칸
  await b.page.evaluate(() => window.sp5.openWindow('backup', { tab: 'backup' }));
  const last = b.page.locator(sel('auto-backup-last'));
  r.check(await waitFor(async () => ((await last.textContent()) ?? '').includes(`SP5_자동백업_${today}.json`), 8000), "백업 탭 '마지막 백업' 줄");
  await b.page.locator('[data-choice="auto-backup-interval:14"]').click();
  const c14 = await serverUntil(async () => (await getDoc(commonRef)).data(), (d) => d?.autoBackup?.intervalDays === 14);
  r.check(c14?.autoBackup?.intervalDays === 14 && c14?.autoBackup?.enabled === true, '주기 14일 = 계정 설정 common.autoBackup');
  await b.page.locator('[data-choice="auto-backup-interval:7"]').click();
  const c7 = await serverUntil(async () => (await getDoc(commonRef)).data(), (d) => d && !('autoBackup' in d));
  r.check(c7 && !('autoBackup' in c7), '기본값(7일)으로 되돌리면 칸이 빠진다');

  // 지금 백업 - 같은 날 둘째 파일은 시각을 붙인다
  await b.page.locator(sel('auto-backup-now')).click();
  const log2 = await serverUntil(async () => (await getDoc(logRef)).data(), (d) => d?.lastName && d.lastName !== log1?.lastName, 30000);
  r.check(/^SP5_자동백업_\d{4}-\d{2}-\d{2}_\d{4}\.json$/.test(log2?.lastName ?? ''), `지금 백업 - 같은 날 둘째는 시각을 붙인다 (${log2?.lastName})`);
  r.check(sp5Live().length === 8 && drive.files.get('OLD1').trashed, '지금 백업도 8개만 남긴다');
  r.check(b.errors.length === 0, `화면 오류 없음 ${b.errors.join(' | ')}`);
  await b.ctx.close();

  // 토큰이 없고 3일 넘게 밀림 → 띠 · 나중에 = 이 기기에서 하루
  await setDoc(logRef, { lastAt: Date.now() - 20 * DAYMS, updatedAt: serverTimestamp(), v: 1 });
  const uploadsBefore = drive.uploads.length;
  const c = await newPage(browser);
  await mockDrive(c.ctx);
  drive.tokenOk = false;
  await open(c.page, `#/day/${DAY}`);
  const banner = c.page.locator(sel('auto-backup-banner'));
  r.check(await waitFor(banner, 15000), '토큰 없이 밀리면 띠 (자동 백업은 하지 않는다)');
  r.check(((await banner.textContent()) ?? '').includes('13일 밀렸습니다'), '며칠 밀렸나 (20일 전 - 7일 주기 = 13일)');
  r.check(drive.uploads.length === uploadsBefore, '권한 창을 띄우지 않고 올리지도 않는다');
  await c.page.locator(sel('auto-backup-banner-later')).click();
  r.check(await waitFor(async () => (await banner.count()) === 0, 5000), "'나중에' → 띠가 숨는다");
  await c.page.reload();
  await c.page.locator(sel('event-card', 'inspBkEdit')).waitFor({ timeout: 15000 });
  await c.page.waitForTimeout(1500);
  r.check((await banner.count()) === 0, '다시 열어도 하루 동안 숨는다 (이 기기)');
  r.check(c.errors.length === 0, `화면 오류 없음 ${c.errors.join(' | ')}`);
  await c.ctx.close();
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
