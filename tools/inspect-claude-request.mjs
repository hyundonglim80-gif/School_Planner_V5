// 메모로 Claude 요청 - 메모 카드 진행 표시 점검 (10-16). 서버 함수가 적는 spaces/{sid}/claudeRequests/{itemId}를 관리자로 심고
// 카드에 🤖 표시가 뜨고 상태를 따라 바뀌는지·GitHub 주소로 이어지는지·지우면 사라지는지 본다. 심은 것은 끝에 지운다.
//   node tools/inspect-claude-request.mjs   (에뮬레이터 + npm run dev:emu + seed)
import { emulator, emulatorAdmin, launch, newPage, open, report, restorer, sel, waitFor } from './lib/probe.mjs';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

const { check, done } = report();
const c = (what, good, detail = '') => check(good, what, detail ? `${what} - ${detail}` : what);
const admin = emulatorAdmin();
const undo = restorer();
const browser = await launch();
try {
  const { db, signIn } = emulator();
  const uid = await signIn('teacher@example.com');
  const sid = `u_${uid}`;
  // 점검 메모 하나 (저장 도우미가 붙이는 칸 그대로 - 규칙 validTracked)
  const id = 'inspectClaudeReq0001';
  await setDoc(doc(db, 'spaces', sid, 'items', id), {
    kind: 'note',
    date: null,
    text: '점검 - Claude 요청 표시',
    labelIds: [],
    order: '!',
    deletedAt: null,
    v: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    authorId: uid,
  });
  undo.add(() => admin.remove(`spaces/${sid}/items/${id}`));

  const { page, errors } = await newPage(browser);
  await open(page, '#/memo');
  c('점검 메모 카드가 뜬다', await waitFor(page.locator(sel('entry-card', id)), 15000));
  const path = `spaces/${sid}/claudeRequests/${id}`;
  undo.add(() => admin.remove(path));
  c('처음에는 표시가 없다', (await page.locator(sel('entry-claude')).count()) === 0);

  const url = 'https://github.com/hyundonglim80-gif/School_Planner_V5/issues/9999';
  await admin.set(path, { state: 'working', issue: 9999, url, note: '' });
  const badge = page.locator(`${sel('entry-card', id)} ${sel('entry-claude')}`);
  c('🤖 고치는 중 표시', await waitFor(() => badge.getAttribute('data-entry-claude').then((s) => s === 'working').catch(() => false), 8000));
  c('글자가 있다', ((await badge.textContent()) ?? '').includes('고치는 중'), await badge.textContent());
  c('GitHub 이슈로 이어진다', (await badge.getAttribute('href')) === url && (await badge.getAttribute('target')) === '_blank');
  c('마우스를 올리면 이슈 번호', ((await badge.getAttribute('title')) ?? '').includes('#9999'));

  await admin.set(path, { state: 'deployed', issue: 9999, url, note: '글자를 키웠습니다.' });
  c('✅ 배포됨으로 바뀐다', await waitFor(() => badge.getAttribute('data-entry-claude').then((s) => s === 'deployed').catch(() => false), 8000));
  c('결과 글이 title에', ((await badge.getAttribute('title')) ?? '').includes('글자를 키웠습니다.'));

  await admin.set(path, { state: 'failed', issue: 9999, url: 'javascript:alert(1)', note: '' });
  c('GitHub가 아닌 주소는 이어지지 않는다', await waitFor(async () => (await badge.getAttribute('data-entry-claude').catch(() => '')) === 'failed' && (await badge.getAttribute('href').catch(() => 'x')) === null, 8000));

  await admin.set(path, { state: 'queued', issue: null, url: null, note: '' });
  c('🤖 차례 기다림 (앞 요청 뒤 - 이슈 전이라 주소 없음)', await waitFor(async () => ((await badge.textContent().catch(() => '')) ?? '').includes('차례 기다림') && (await badge.getAttribute('href').catch(() => 'x')) === null, 8000));

  await admin.remove(path);
  c('지우면 사라진다', await waitFor(async () => (await page.locator(sel('entry-claude')).count()) === 0, 8000));

  // 서버가 만든 'Claude요청' 라벨은 지우지 못한다 (라벨 관리 - 🔒, 이름 읽기만, 빈 라벨 정리에서 빠짐)
  const labelId = 'inspectClaudeLabel01';
  const labelPath = `spaces/${sid}/labels/${labelId}`;
  undo.add(() => admin.remove(labelPath));
  await setDoc(doc(db, 'spaces', sid, 'labels', labelId), {
    kind: 'note',
    name: 'Claude요청',
    color: 'indigo',
    parentId: null,
    order: 'zz',
    system: 'claudeRequest',
    deletedAt: null,
    v: 1,
    createdAt: Date.now(),
    updatedAt: serverTimestamp(),
    authorId: uid,
  });
  await page.evaluate(() => window.sp5.openWindow('labels', { tab: 'note' }));
  const row = page.locator(sel('label-row', labelId));
  c('라벨 관리에 Claude요청 줄', await waitFor(row, 10000));
  c('🔒 표시, ✕ 없음', (await row.locator(sel('label-locked')).count()) === 1 && (await row.locator(sel('label-delete')).count()) === 0);
  c('이름 칸은 읽기만', (await row.locator(sel('label-name')).getAttribute('readonly')) !== null);
  const prune = page.locator(sel('label-prune'));
  if (await prune.isEnabled()) {
    await prune.click();
    c('빈 라벨 정리 목록에 없다', (await page.locator(sel('label-prune-item', labelId)).count()) === 0);
  } else c('빈 라벨 정리 수에 넣지 않는다 (빈 라벨이 이것뿐)', true);
  c('콘솔 오류 없음', errors.length === 0, errors.join(' | '));
} finally {
  await undo.run();
  await browser.close();
  done();
  process.exit();
}
