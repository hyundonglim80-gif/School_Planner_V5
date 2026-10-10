// tools/inspect-backup.mjs - P8-3 ■1: '💾 백업 · 가져오기 · 보내기' 창을 실제 크롬에서 본다.
//   1) ⋮ 자료 → 창 · 탭 셋(백업·가져오기·보내기) · 단축키 '구글 캘린더로 보내기' = '보내기' 탭 · 가져오기 탭 = V4 자료 가져오기
//   2) 🗄️ JSON 백업 받기 → V5 모양(version·colls·시각 $ts) · 고른 갈래만 · 지운 것은 없다
//   3) 📄 CSV 받기 → V4 모양 머리줄
//   4) 되살리기: 지운 일정은 돌아오고, 백업 뒤에 고친 일정은 덮지 않는다
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-backup.mjs
import { readFileSync } from 'node:fs';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
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
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
