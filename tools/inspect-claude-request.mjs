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

  const { page, errors, dialogs } = await newPage(browser);
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
  // 결과 글은 카드 아래에도 글로 (10-19 사용자 의견 - '바꾼 것 없음'만으로는 왜인지 몰랐다)
  const cardNote = page.locator(`${sel('entry-card', id)} ${sel('entry-claude-note')}`);
  c('카드 아래 결과 글', await waitFor(async () => ((await cardNote.textContent().catch(() => '')) ?? '').includes('글자를 키웠습니다.'), 8000), await cardNote.textContent().catch(() => ''));
  await admin.set(path, { state: 'nochange', issue: 9999, url, note: '바꾸지 않았습니다: 그 기능은 이미 있습니다.\n다시 요청할 때는 어느 화면인지 적어 주세요.' });
  c('바꾼 것 없음 - 까닭이 카드에 글로', await waitFor(async () => (await cardNote.getAttribute('data-entry-claude-note').catch(() => '')) === 'nochange' && ((await cardNote.textContent()) ?? '').includes('이미 있습니다'), 8000), await cardNote.textContent().catch(() => ''));
  c('까닭 글이 보인다 (높이)', ((await cardNote.boundingBox())?.height ?? 0) > 10);

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
  // 🤖 요청 단추 = 메모 수정 칸 아래(삭제 옆) - 저장으로는 보내지 않는다, 잠긴 라벨이 저장된 메모에만, 한 번 보내면 진행 표시만(다시 요청 없음)
  await page.keyboard.press('Escape');
  const ask = page.locator(sel('note-claude-ask'));
  const openPanel = async () => {
    await page.locator(sel('entry-card', id)).click();
    await waitFor(page.locator(sel('note-panel', 'edit')), 8000);
  };
  await openPanel();
  c('라벨이 없는 메모에는 단추가 없다', (await ask.count()) === 0);
  await setDoc(doc(db, 'spaces', sid, 'items', id), { labelIds: [labelId], updatedAt: serverTimestamp() }, { merge: true });
  c('잠긴 라벨이 붙으면 수정 칸에 🤖 요청', await waitFor(ask, 8000));
  c('카드에는 단추가 없다', (await page.locator(`${sel('entry-card', id)} ${sel('note-claude-ask')}`).count()) === 0);
  c('저장만으로는 보내지 않는다 (claudeAskAt 없음)', !(await admin.get(`spaces/${sid}/items/${id}`))?.claudeAskAt);
  await page.locator(sel('note-text-input')).press('End');
  await page.locator(sel('note-text-input')).type(' 더');
  c('저장하지 않은 고침이 있으면 누를 수 없다', await waitFor(async () => await ask.isDisabled(), 4000));
  await page.locator(sel('note-save')).click();
  c('저장하면 누를 수 있다', await waitFor(async () => (await ask.count()) === 1 && (await ask.isEnabled()), 8000));
  dialogs.answer = false;
  await ask.click();
  await page.waitForTimeout(800);
  c('묻는 창에서 아니오 = 보내지 않음', !(await admin.get(`spaces/${sid}/items/${id}`))?.claudeAskAt);
  dialogs.answer = true;
  await ask.click();
  c('예 = claudeAskAt 적음', await waitFor(async () => typeof (await admin.get(`spaces/${sid}/items/${id}`))?.claudeAskAt === 'number', 8000));
  c('보낸 뒤 단추 대신 🤖 요청함', await waitFor(async () => (await ask.count()) === 0 && (await page.locator(sel('note-claude-asked')).count()) === 1, 8000));
  await admin.set(path, { state: 'failed', issue: 9999, url, note: '고치지 못했습니다(확인 실패 또는 오류) - 실행 기록 https://github.com/a/b/actions/runs/1\n\n테스트가 깨졌습니다.' });
  c('끝나도 다시 요청 단추는 없다 - 수정 칸에 진행 표시', await waitFor(async () => (await ask.count()) === 0 && (await page.locator(`${sel('note-panel')} ${sel('entry-claude', 'failed')}`).count()) === 1, 8000));
  const panelNote = page.locator(`${sel('note-panel')} ${sel('entry-claude-note', 'failed')}`);
  const panelText = (await panelNote.textContent().catch(() => '')) ?? '';
  c('수정 칸에 결과 글 다 (주소는 빼고)', panelText.includes('테스트가 깨졌습니다.') && panelText.includes('고치지 못했습니다') && !panelText.includes('https'), panelText);
  c('카드에는 진행 표시 그대로', (await page.locator(`${sel('entry-card', id)} ${sel('entry-claude', 'failed')}`).count()) === 1);
  dialogs.answer = true;
  await page.keyboard.press('Escape');
  await admin.remove(path);
  await page.evaluate(() => window.sp5.openWindow('labels', { tab: 'note' }));
  await waitFor(row, 10000);

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
