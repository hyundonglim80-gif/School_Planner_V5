// 메모로 Claude 요청 - 메모 카드 진행 표시 점검 (10-16). 서버 함수가 적는 spaces/{sid}/claudeRequests/{itemId}를 관리자로 심고
// 카드에 🤖 표시가 뜨고 상태를 따라 바뀌는지·GitHub 주소로 이어지는지·지우면 사라지는지 본다. 심은 것은 끝에 지운다.
//   node tools/inspect-claude-request.mjs   (에뮬레이터 + npm run dev:emu + seed) · 그림을 보려면 SHOT_PC·SHOT_PHONE=<파일>
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
  // 🤖 요청 단추 = 메모 수정 칸 아래(삭제 옆) - 저장으로는 보내지 않는다, 잠긴 라벨이 저장된 메모에만, 묻지 않고 곧바로 보낸다(#76),
  // 보낸 뒤로는 메모 칸 안 대화에서 (P23 - #69 '다시 요청'을 글 칸으로)
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
  // 모델·노력 고르기 (11-08 사용자 요청) - 단추 옆, 보낼 때 메모에 함께
  const runBox = page.locator(`${sel('note-panel')} ${sel('claude-run')}`);
  c('🤖 요청 옆에 모델·노력 고르기', (await runBox.count()) === 1 && (await runBox.locator('[data-claude-run-model]').getAttribute('data-claude-run-model')) === 'default');
  await runBox.locator('[data-claude-run-model]').selectOption('opus');
  await runBox.locator('[data-claude-run-effort]').selectOption('high');
  const seen0 = dialogs.seen.length;
  await ask.click();
  c(
    '누르면 묻지 않고 곧바로 claudeAskAt 적음 (#76)',
    (await waitFor(async () => typeof (await admin.get(`spaces/${sid}/items/${id}`))?.claudeAskAt === 'number', 8000)) && dialogs.seen.length === seen0,
    dialogs.seen.slice(seen0).join(' | '),
  );
  c('고른 모델·노력이 짝(at)과 함께 메모에', await waitFor(async () => {
    const it = await admin.get(`spaces/${sid}/items/${id}`);
    return it?.claudeRun?.model === 'opus' && it.claudeRun.effort === 'high' && it.claudeRun.at === it.claudeAskAt;
  }, 8000), JSON.stringify((await admin.get(`spaces/${sid}/items/${id}`))?.claudeRun));
  c('보낸 뒤 단추 대신 🤖 요청함', await waitFor(async () => (await ask.count()) === 0 && (await page.locator(sel('note-claude-asked')).count()) === 1, 8000));
  await admin.set(path, { state: 'failed', issue: 9999, url, note: '고치지 못했습니다(확인 실패 또는 오류) - 실행 기록 https://github.com/a/b/actions/runs/1\n\n테스트가 깨졌습니다.' });
  // ─── 메모 칸 안 대화 (P23) ───
  const followBox = page.locator(`${sel('note-panel')} ${sel('claude-follow')}`);
  const followInput = followBox.locator(sel('chat-input'));
  const followSend = followBox.locator(sel('chat-send'));
  c('보낸 뒤에는 글 칸이 뜨고 🤖 요청 단추는 없다', await waitFor(followInput, 8000) && (await ask.count()) === 0);
  const turnRow = (n) => page.locator(`${sel('note-panel')} ${sel('claude-turn', String(n))}`);
  const panelNote = turnRow(1).locator(sel('claude-turn-note'));
  c('턴이 없는 옛 메모는 부모로 한 턴', await waitFor(async () => (await page.locator(sel('claude-thread', '1')).count()) === 1 && (await turnRow(1).getAttribute('data-claude-turn-state')) === 'failed', 8000));
  const panelText = (await panelNote.textContent().catch(() => '')) ?? '';
  c('말풍선에 결과 글 다 (주소는 빼고)', panelText.includes('테스트가 깨졌습니다.') && panelText.includes('고치지 못했습니다') && !panelText.includes('https'), panelText);
  c('옛 메모의 내 글 자리', ((await turnRow(1).locator(sel('claude-turn-ask')).textContent()) ?? '').includes('메모 글을 보냈습니다'));
  c('카드에는 진행 표시 그대로', (await page.locator(`${sel('entry-card', id)} ${sel('entry-claude', 'failed')}`).count()) === 1);

  const turnsAt = (n) => `${path}/turns/${n}`;
  for (const n of [1, 2, 3, 4]) undo.add(() => admin.remove(turnsAt(n)));
  const long = ['첫 요청 첫 줄입니다', ...Array.from({ length: 8 }, (_, i) => `둘째 뒤 ${i} 번째 줄`)].join('\n');
  const issue = (n) => `https://github.com/hyundonglim80-gif/School_Planner_V5/issues/${n}`;
  await admin.set(turnsAt(1), { n: 1, askText: long, askAt: 10, state: 'deployed', issue: 1001, url: issue(1001), note: '버튼을 오른쪽으로 옮겼습니다.', sha: 'abc' });
  await admin.set(turnsAt(2), { n: 2, askText: '조금 더 작게 해 줘', askAt: 20, state: 'nochange', issue: 1002, url: issue(1002), note: '어느 버튼인지 알려 주세요?', sha: null });
  await admin.set(turnsAt(3), { n: 3, askText: '머리줄 저장 단추', askAt: 30, state: 'working', issue: 1003, url: issue(1003), note: '', sha: null });
  await admin.set(turnsAt(4), { n: 4, askText: '다른 기기에서 보낸 글', askAt: 40, state: 'dropped', issue: null, url: null, note: '앞 요청이 도는 동안 보낸 글이라 보내지 못했습니다.', sha: null });
  c('턴 넷이 차례로', await waitFor(async () => (await page.locator(`${sel('note-panel')} [data-claude-turn]`).evaluateAll((els) => els.map((e) => e.dataset.claudeTurn).join())) === '1,2,3,4', 8000));
  const fold = turnRow(1).locator(sel('claude-turn-ask'));
  c('첫 요청은 접혀 있다 - 글이 있고 한 줄 높이', (await fold.getAttribute('data-claude-turn-fold')) === 'closed' && ((await fold.textContent()) ?? '').includes('첫 요청 첫 줄') && ((await fold.boundingBox())?.height ?? 99) < 44, String((await fold.boundingBox())?.height));
  await fold.click();
  c('누르면 다 보인다', (await fold.getAttribute('data-claude-turn-fold')) === 'open' && ((await fold.textContent()) ?? '').includes('둘째 뒤 7 번째 줄') && ((await fold.boundingBox())?.height ?? 0) > 80);
  await fold.click();
  c('이어 쓴 글은 그대로', ((await turnRow(2).locator(sel('claude-turn-ask')).textContent()) ?? '').includes('조금 더 작게 해 줘'));
  c('내 글은 오른쪽·Claude는 왼쪽', await page.evaluate(() => {
    const row = document.querySelector('[data-note-panel] [data-claude-turn="2"]');
    const mine = row.querySelector('[data-claude-turn-ask]').getBoundingClientRect();
    const claude = row.querySelector('[data-claude-turn-note]').getBoundingClientRect();
    return mine.right > claude.right && mine.left > claude.left;
  }));
  const badgeOf = (n) => turnRow(n).locator(sel('claude-turn-badge'));
  c('표시를 누르면 그 턴의 이슈', (await badgeOf(2).getAttribute('href')) === issue(1002) && ((await badgeOf(2).textContent()) ?? '').includes('바꾼 것 없음'));
  const toneOf = (n) => badgeOf(n).locator('xpath=..').getAttribute('class');
  c('바꾼 것 없음은 실패 색이 아니다', !(await toneOf(2)).includes('rose') && (await toneOf(2)).includes('violet'), await toneOf(2));
  c('도는 턴은 답 없이 표시만', ((await badgeOf(3).textContent()) ?? '').includes('고치는 중') && (await turnRow(3).locator(sel('claude-turn-note')).count()) === 0);
  c('⚠ 보내지 못한 턴 - 글이 남고 까닭이 보인다', ((await badgeOf(4).textContent()) ?? '').includes('보내지 못함') && ((await turnRow(4).textContent()) ?? '').includes('다른 기기에서 보낸 글') && ((await turnRow(4).textContent()) ?? '').includes('도는 동안'));
  c('⚠ 턴은 실패 색', (await toneOf(4)).includes('rose'));
  await admin.set(turnsAt(3), { n: 3, askText: '머리줄 저장 단추', askAt: 30, state: 'deployed', issue: 1003, url: issue(1003), note: '저장 단추를 줄였습니다.', sha: 'def' });
  c('상태·답이 바뀌면 그 턴만 따라간다', await waitFor(async () => ((await turnRow(3).locator(sel('claude-turn-note')).textContent().catch(() => '')) ?? '').includes('저장 단추를 줄였습니다.'), 8000));
  await page.keyboard.press('Escape');
  await waitFor(async () => (await page.locator(sel('note-panel')).count()) === 0, 8000);
  // 메모 글이 길어도 답이 보이게 - 턴이 둘 이상이면 열 때 맨 아래
  await setDoc(doc(db, 'spaces', sid, 'items', id), { text: Array.from({ length: 80 }, (_, i) => `긴 메모 ${i}`).join('\n'), updatedAt: serverTimestamp() }, { merge: true });
  // 글이 앱에 닿은 뒤에 연다. 두 번째 열기라 턴이 캐시에서 곧바로 온다 - 글 칸이 한 프레임 뒤에 늘어나도 맨 아래를 지키는지 본다
  await waitFor(async () => ((await page.locator(sel('entry-card', id)).textContent()) ?? '').includes('긴 메모 1'), 8000);
  await openPanel();
  await waitFor(page.locator(sel('claude-thread', '4')), 8000);
  const scrollGap = () => page.evaluate(() => {
    const box = document.querySelector('[data-note-panel] [data-scroll-lock]');
    return Math.round(box.scrollHeight - box.scrollTop - box.clientHeight);
  });
  c('열면 맨 아래 답이 보인다', await waitFor(async () => (await scrollGap()) < 80, 4000), String(await scrollGap()));

  // ─── 글 칸 ───
  const itemNow = () => admin.get(`spaces/${sid}/items/${id}`);
  const followState = () => followBox.getAttribute('data-claude-follow').catch(() => null);
  const inView = async (loc) => {
    const box = await loc.boundingBox();
    return !!box && box.y >= 0 && box.y + box.height <= page.viewportSize().height;
  };
  c('글이 길어도 글 칸·저장 단추가 밀려나지 않는다', (await inView(followInput)) && (await inView(page.locator(sel('note-save')))));
  c('안내 - 공개 이슈', ((await followBox.textContent()) ?? '').includes('공개 이슈로 올라갑니다'));
  c('첨부가 없다', (await followBox.locator(sel('chat-attach')).count()) === 0);
  c('끝난 요청이면 보낼 수 있다', (await followState()) === 'ready');

  await turnRow(4).locator(sel('claude-turn-refill')).click();
  c('⚠ 턴 - 글 칸에 다시 넣기', (await followInput.inputValue()) === '다른 기기에서 보낸 글', await followInput.inputValue());
  await followInput.fill('');

  // 메모를 고치던 중에 보낸다 - 메모 글은 가지 않고, 칸은 그대로
  await page.locator(sel('note-text-input')).press('Control+End');
  await page.locator(sel('note-text-input')).type(' 고치던 글');
  await followInput.fill('단추를 더 키워 줘');
  const before = await itemNow();
  await followInput.press('Enter');
  c('보내면 글 칸이 비고 곧바로 보내는 중', await waitFor(async () => (await followInput.inputValue()) === '' && (await turnRow(5).getAttribute('data-claude-turn-state').catch(() => '')) === 'asking', 4000));
  c('보내는 중 글자가 있다', ((await turnRow(5).textContent()) ?? '').includes('보내는 중') && ((await turnRow(5).textContent()) ?? '').includes('단추를 더 키워 줘'));
  c('턴이 늘면 맨 아래로', await waitFor(async () => (await scrollGap()) < 80, 4000), String(await scrollGap()));
  c('메모에 짝이 맞는 claudeFollow', await waitFor(async () => {
    const it = await itemNow();
    return it?.claudeFollow?.text === '단추를 더 키워 줘' && it.claudeFollow.at === it.claudeAskAt && it.claudeAskAt !== before.claudeAskAt;
  }, 8000));
  c('저장 안 한 메모 글은 가지 않았다', !((await itemNow())?.text ?? '').includes('고치던 글'));
  c('메모 칸의 고치던 글은 그대로', (await page.locator(sel('note-text-input')).inputValue()).includes('고치던 글'));
  c('보내는 동안은 보내지 못한다', (await followState()) === 'hold');

  // 쓰기는 되고 보내지는 못한다
  const at = (await itemNow()).claudeAskAt;
  await followInput.fill('다음 요청');
  await followInput.press('Enter');
  c('도는 동안 Enter는 보내지 않고 글이 남는다', (await followInput.inputValue()) === '다음 요청' && (await itemNow()).claudeAskAt === at);
  c('➤가 막히고 까닭이 보인다', (await followSend.isDisabled()) && ((await followBox.locator(sel('chat-hold')).textContent()) ?? '').includes('앞 요청이 끝나면'));

  // Ctrl+S는 메모 저장 - 보내기가 아니다
  await followInput.press('Control+s');
  c('Ctrl+S = 메모 저장', await waitFor(async () => ((await itemNow())?.text ?? '').includes('고치던 글'), 8000));
  c('Ctrl+S로 보내지 않는다', (await itemNow()).claudeAskAt === at && (await followInput.inputValue()) === '다음 요청');

  // 함수가 턴을 쓰면 '보내는 중'이 그 턴이 된다
  for (const n of [5, 6]) undo.add(() => admin.remove(turnsAt(n)));
  await admin.set(turnsAt(5), { n: 5, askText: '단추를 더 키워 줘', askAt: at, state: 'queued', issue: null, url: null, note: '', sha: null });
  await admin.set(path, { state: 'queued', issue: null, url: null, note: '' });
  c('서버 턴이 들어오면 보내는 중을 뺀다', await waitFor(async () => (await page.locator(`${sel('note-panel')} [data-claude-turn]`).count()) === 5 && (await turnRow(5).getAttribute('data-claude-turn-state').catch(() => '')) === 'queued', 8000));
  await admin.set(turnsAt(5), { n: 5, askText: '단추를 더 키워 줘', askAt: at, state: 'merged', issue: 1005, url: issue(1005), note: '단추를 키웠습니다.', sha: 'ghi' });
  await admin.set(path, { state: 'merged', issue: 1005, url: issue(1005), note: '단추를 키웠습니다.' });
  c('배포 중에도 보내지 못한다', await waitFor(async () => ((await badgeOf(5).textContent().catch(() => '')) ?? '').includes('배포 중'), 8000) && (await followState()) === 'hold');
  await admin.set(turnsAt(5), { n: 5, askText: '단추를 더 키워 줘', askAt: at, state: 'deployed', issue: 1005, url: issue(1005), note: '단추를 키웠습니다.', sha: 'ghi' });
  await admin.set(path, { state: 'deployed', issue: 1005, url: issue(1005), note: '단추를 키웠습니다.' });
  c('배포가 끝나면 쓰던 글을 보낼 수 있다', await waitFor(async () => (await followState()) === 'ready' && (await followSend.isEnabled()), 8000));

  // 글 칸 아래에도 고르기 - 고른 값이 이 기기에 남아 있다
  const followRun = followBox.locator(sel('claude-run'));
  c('이어서 요청 칸에도 모델·노력 (고른 값 그대로)', (await followRun.locator('[data-claude-run-model]').getAttribute('data-claude-run-model')) === 'opus');
  await followRun.locator('[data-claude-run-model]').selectOption('');
  await followRun.locator('[data-claude-run-effort]').selectOption('max');
  await followSend.click();
  c('➤로 보낸다', await waitFor(async () => (await itemNow())?.claudeFollow?.text === '다음 요청', 8000));
  c('이어서 보낼 때도 고른 값 (모델 기본 · 노력 최대)', await waitFor(async () => {
    const it = await itemNow();
    return it?.claudeRun?.model === '' && it.claudeRun.effort === 'max' && it.claudeRun.at === it.claudeAskAt;
  }, 8000), JSON.stringify((await itemNow())?.claudeRun));
  await admin.set(turnsAt(6), { n: 6, askText: '다음 요청', askAt: (await itemNow()).claudeAskAt, model: '', effort: 'max', state: 'failed', issue: 1006, url: issue(1006), note: '확인을 통과하지 못했습니다.', sha: null });
  await admin.set(path, { state: 'failed', issue: 1006, url: issue(1006), note: '확인을 통과하지 못했습니다.' });
  c('❌ 턴 - 글 칸에 다시 넣기', await waitFor(turnRow(6).locator(sel('claude-turn-refill')), 8000));
  await turnRow(6).locator(sel('claude-turn-refill')).click();
  c('보낸 글이 글 칸에', (await followInput.inputValue()) === '다음 요청');
  c('말풍선에 고른 노력', ((await turnRow(6).locator(sel('claude-turn-run')).textContent().catch(() => '')) ?? '') === '노력 최대');
  c('기본으로 보낸 턴에는 적지 않는다', (await turnRow(5).locator(sel('claude-turn-run')).count()) === 0);
  c('성공한 턴에는 다시 넣기가 없다', (await turnRow(5).locator(sel('claude-turn-refill')).count()) === 0);

  // 쓰던 글 - 닫았다 열어도 남고, 앱 위 '저장하지 않은 글' 띠에는 들지 않는다
  await page.keyboard.press('Escape');
  await waitFor(async () => (await page.locator(sel('note-panel')).count()) === 0, 8000);
  await openPanel();
  c('쓰던 글이 닫았다 열어도 남는다', await waitFor(async () => (await followInput.inputValue().catch(() => '')) === '다음 요청', 8000));
  await page.reload();
  await waitFor(page.locator(sel('entry-card', id)), 15000);
  c("'저장하지 않은 글' 띠에 들지 않는다", (await page.locator(sel('drafts-banner')).count()) === 0);
  await openPanel();

  // ↗ 새 창 - 말풍선·쓰던 글이 따라간다
  await waitFor(followInput, 8000);
  const [pop] = await Promise.all([page.context().waitForEvent('page', { timeout: 10000 }), page.locator(`#side-column ${sel('popout-open')}`).click()]);
  c('↗ 새 창 - 말풍선', await waitFor(pop.locator(sel('claude-thread')), 20000));
  const popInput = pop.locator(`${sel('note-panel')} ${sel('claude-follow')} ${sel('chat-input')}`);
  c('↗ 새 창 - 쓰던 글이 글 칸에', await waitFor(async () => (await popInput.inputValue().catch(() => '')) === '다음 요청', 8000));
  await pop.close();
  await openPanel();

  // 라벨을 떼면 지난 대화만
  await setDoc(doc(db, 'spaces', sid, 'items', id), { labelIds: [], updatedAt: serverTimestamp() }, { merge: true });
  c('라벨을 떼면 글 칸은 없고 대화는 남는다', await waitFor(async () => (await followBox.count()) === 0 && (await page.locator(sel('claude-thread')).count()) === 1, 8000));
  c('라벨이 없으면 다시 넣기도 없다', (await turnRow(6).locator(sel('claude-turn-refill')).count()) === 0);
  await setDoc(doc(db, 'spaces', sid, 'items', id), { labelIds: [labelId], updatedAt: serverTimestamp() }, { merge: true });
  await waitFor(followInput, 8000);

  // 휴대폰 390px 한 번 - 이 기능은 휴대폰에서 읽는다
  const phone = await newPage(browser, { width: 390, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await open(phone.page, '#/memo');
  await waitFor(phone.page.locator(sel('entry-card', id)), 15000);
  await phone.page.locator(`${sel('entry-card', id)} ${sel('entry-preview')}`).first().tap();
  const phoneBox = phone.page.locator(`${sel('note-panel')} ${sel('claude-follow')}`);
  c('휴대폰 - 칸에 글 칸', await waitFor(phoneBox, 10000));
  const phoneInput = phoneBox.locator(sel('chat-input'));
  await phoneInput.tap();
  c('휴대폰 - 글 칸·➤가 화면 안', await phone.page.evaluate(() => {
    const seen = (el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return r.bottom <= innerHeight && (el === hit || el.contains(hit));
    };
    const box = document.querySelector('[data-note-panel] [data-claude-follow]');
    return seen(box.querySelector('[data-chat-input]')) && seen(box.querySelector('[data-chat-send]'));
  }));
  await phoneInput.fill('휴대폰 글');
  await phoneInput.press('Enter');
  c('휴대폰 - Enter는 줄 바꿈', (await phoneInput.inputValue()).includes('휴대폰 글') && (await itemNow()).claudeFollow?.text === '다음 요청');
  c('휴대폰 - 글 칸이 늘어도 맨 아래 답이 가리지 않는다', await waitFor(() => phone.page.evaluate(() => {
    const box = document.querySelector('[data-note-panel] [data-scroll-lock]');
    return box.scrollHeight - box.scrollTop - box.clientHeight < 2;
  }), 4000));
  c('휴대폰 - 말풍선이 넘치지 않는다', await phone.page.evaluate(() => {
    const box = document.querySelector('[data-note-panel] [data-scroll-lock]');
    return box.scrollWidth <= box.clientWidth + 1;
  }));
  if (process.env.SHOT_PHONE) await phone.page.screenshot({ path: process.env.SHOT_PHONE });
  await phone.page.context().close();
  if (process.env.SHOT_PC) await page.screenshot({ path: process.env.SHOT_PC });
  dialogs.answer = true;
  await page.keyboard.press('Escape');
  await admin.remove(path);
  // ─── 새 답 (P23-3) ───
  const idA = 'inspectClaudeNewA001';
  const idB = 'inspectClaudeNewB001';
  const pathA = `spaces/${sid}/claudeRequests/${idA}`;
  const pathB = `spaces/${sid}/claudeRequests/${idB}`;
  for (const [x, text] of [[idA, '새 답 점검 가'], [idB, '새 답 점검 나']]) {
    await setDoc(doc(db, 'spaces', sid, 'items', x), { kind: 'note', date: null, text, labelIds: [labelId], order: '!', deletedAt: null, v: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), authorId: uid });
    undo.add(() => admin.remove(`spaces/${sid}/items/${x}`));
  }
  undo.add(() => admin.remove(pathA));
  undo.add(() => admin.remove(pathB));
  const newChip = (x) => page.locator(`${sel('entry-card', x)} ${sel('entry-claude-new')}`);
  const answer = (at, seen) => ({ state: 'deployed', issue: 1, url, note: '답', answeredAt: at, ...(seen ? { seenAt: seen } : {}) });
  const seenOf = async (p) => (await admin.get(p))?.seenAt;
  const openNote = (x) => page.evaluate(({ sid, x }) => window.sp5.openWindow('note', { sid, date: null, id: x }), { sid, x });
  c('새 답 - 점검 메모 둘', await waitFor(page.locator(sel('entry-card', idB)), 10000));

  await admin.set(pathA, answer(100));
  c('안 본 답 = 카드에 새 답', await waitFor(newChip(idA), 8000));
  c('새 답 글자가 있다', ((await newChip(idA).textContent()) ?? '').includes('새 답'));
  await admin.set(pathB, { state: 'working', issue: 2, url, note: '', answeredAt: 100 });
  await waitFor(page.locator(`${sel('entry-card', idB)} ${sel('entry-claude', 'working')}`), 8000);
  c('이어 보내 도는 동안은 없다', (await newChip(idB).count()) === 0);
  await admin.set(pathB, { state: 'deployed', issue: 2, url, note: '옛 답' });
  await waitFor(page.locator(`${sel('entry-card', idB)} ${sel('entry-claude', 'deployed')}`), 8000);
  c('옛 문서(답한 때 없음)는 없다', (await newChip(idB).count()) === 0);

  await openNote(idA);
  c('메모 칸을 보면 새 답이 사라진다', await waitFor(async () => (await newChip(idA).count()) === 0, 8000));
  c('서버에 본 값 그대로', await waitFor(async () => (await seenOf(pathA)) === 100, 8000), String(await seenOf(pathA)));
  await admin.set(pathA, answer(200, 100));
  c('보고 있는 칸에 온 답은 곧바로 본 것', await waitFor(async () => (await seenOf(pathA)) === 200, 8000), String(await seenOf(pathA)));

  // 다른 앱을 보는 동안은 안 본 것
  const pageShown = (state) =>
    page.evaluate((v) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await pageShown('hidden');
  await admin.set(pathA, answer(250, 200));
  c('다른 앱을 보는 동안 온 답 = 새 답', await waitFor(newChip(idA), 8000));
  c('그동안은 앱 안내도 없다 (OS 알림이 뜬다)', (await page.locator(sel('toast'), { hasText: 'Claude 답이 왔습니다' }).count()) === 0);
  await page.waitForTimeout(800);
  c('그동안은 본 것으로 적지 않는다', (await seenOf(pathA)) === 200, String(await seenOf(pathA)));
  await pageShown('visible');
  c('돌아오면 본 것', await waitFor(async () => (await seenOf(pathA)) === 250, 8000), String(await seenOf(pathA)));

  // 숨은 탭은 안 본 것 (B를 열면 A는 숨은 탭)
  await openNote(idB);
  await waitFor(page.locator(sel('side-tab')).nth(1), 8000);
  await admin.set(pathA, answer(300, 250));
  c('숨은 탭의 메모에 온 답 = 새 답', await waitFor(newChip(idA), 8000));
  await page.waitForTimeout(800);
  c('숨은 탭은 본 것으로 적지 않는다', (await seenOf(pathA)) === 250, String(await seenOf(pathA)));
  await page.locator(sel('side-tab')).first().click();
  c('그 탭을 보면 본 것', await waitFor(async () => (await seenOf(pathA)) === 300, 8000), String(await seenOf(pathA)));
  await page.keyboard.press('Escape');

  // ─── 답 알림 (P23-3 ■2) ───
  const toastOf = (text) => page.locator(sel('toast'), { hasText: text });
  const told = toastOf('Claude 답이 왔습니다');
  const working = (at) => ({ state: 'working', issue: 1, url, note: '', answeredAt: at, seenAt: at });
  const badgeA = page.locator(`${sel('entry-card', idA)} ${sel('entry-claude', 'working')}`);
  await admin.set(pathA, working(300));
  await waitFor(badgeA, 8000);
  // 앞 묶음의 숨은 탭 안내가 사라진 뒤에
  await waitFor(async () => (await told.count()) === 0, 8000);
  await admin.set(pathA, answer(400, 300));
  c('앱을 연 뒤 온 답 = 안내', await waitFor(told, 8000));
  c('안내에 결과 표시', ((await told.textContent()) ?? '').includes('✅ 배포됨'), await told.textContent());
  await told.locator(sel('toast-action', '보기')).click();
  c('보기 = 그 메모 칸', await waitFor(async () => (await page.locator(sel('note-text-input')).inputValue().catch(() => '')) === '새 답 점검 가', 8000));
  c('보기로 열어도 본 것', await waitFor(async () => (await seenOf(pathA)) === 400, 8000), String(await seenOf(pathA)));

  await admin.set(pathA, working(400));
  await waitFor(badgeA, 8000);
  await admin.set(pathA, { ...answer(500, 400), state: 'failed' });
  await waitFor(async () => (await seenOf(pathA)) === 500, 8000);
  await page.waitForTimeout(600);
  c('보고 있는 메모의 답은 안내 없음', (await toastOf('❌ 실패').count()) === 0);
  await page.keyboard.press('Escape');

  await admin.set(pathA, answer(600, 500));
  await waitFor(newChip(idA), 8000);
  await page.reload();
  c('다시 열어도 새 답은 남는다', await waitFor(newChip(idA), 15000));
  await page.waitForTimeout(800);
  c('앱을 열 때 있던 답은 안내하지 않는다', (await told.count()) === 0);

  // 서비스 워커 - inspect-chat 'chat' 푸시와 같은 길
  const origin = new URL(page.url()).origin;
  const swCtx = page.context();
  await swCtx.grantPermissions(['notifications'], { origin });
  const cdp = await swCtx.newCDPSession(page);
  const regs = [];
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => regs.push(...e.registrations.filter((x) => !x.isDeleted)));
  await cdp.send('ServiceWorker.enable');
  c('서비스 워커가 등록돼 있다', await waitFor(() => regs.length > 0, 10000));
  const reg = regs.find((x) => x.scopeURL.startsWith(origin)) ?? regs[0];
  // functions/claudePlan.js claudePushData 모양 - 글은 없다
  const push = (item, state) => cdp.send('ServiceWorker.deliverPushMessage', { origin, registrationId: reg.registrationId, data: JSON.stringify({ data: { type: 'claude', item, state } }) });
  const sw = swCtx.serviceWorkers().find((w) => w.url().startsWith(origin));
  const osNotes = (tag) => sw.evaluate(async (t) => (await self.registration.getNotifications(t ? { tag: t } : undefined)).map((n) => ({ title: n.title, body: n.body, tag: n.tag, data: n.data })), tag);
  const clickNote = (tag) =>
    sw.evaluate(async (t) => {
      const [n] = await self.registration.getNotifications({ tag: t });
      self.dispatchEvent(new NotificationEvent('notificationclick', { notification: n }));
    }, tag);
  await sw.evaluate(async () => (await self.registration.getNotifications()).forEach((n) => n.close()));
  const tagA = `sp5-claude-${idA}`;
  const tagB = `sp5-claude-${idB}`;
  await push(idA, 'deployed');
  await page.waitForTimeout(1500);
  c('보는 앱 창이 있으면 OS 알림을 띄우지 않는다 (앱 안내)', (await osNotes(tagA)).length === 0);
  await page.goto('about:blank');
  await push(idA, 'deployed');
  c('앱 창이 없으면 메모마다 OS 알림 하나', await waitFor(async () => (await osNotes(tagA)).length === 1, 8000));
  let osNote = (await osNotes(tagA))[0];
  c('알림 = 제목 · 결과 · 메모 id (메모 글은 없다)', osNote?.title === '🤖 Claude 답이 왔습니다' && osNote?.body === '✅ 배포됨' && osNote?.data?.claude === idA, JSON.stringify(osNote));
  await push(idA, 'failed');
  c('같은 메모의 다음 답은 그 알림을 바꾼다', await waitFor(async () => (await osNotes(tagA))[0]?.body === '❌ 실패', 8000));
  c('알림은 하나 그대로', (await osNotes(tagA)).length === 1);
  await push(idB, 'nochange');
  c('다른 메모는 알림 따로', await waitFor(async () => (await osNotes(tagB))[0]?.body === '🤖 바꾼 것 없음', 8000));
  await push('../x', 'deployed');
  await page.waitForTimeout(800);
  c('메모 id 모양이 아니면 알림 없음', (await osNotes()).length === 2, String((await osNotes()).length));

  // 앱 창이 없을 때 누름 = ?claude= (진짜 누르기는 CDP로 못 한다 - 같은 알림으로 notificationclick을 흉내, 새 창 열기만 잡는다)
  await sw.evaluate(() => {
    self.clients.openWindow = async (u) => {
      self.sp5Opened = u;
      return null;
    };
  });
  await clickNote(tagB);
  c('앱 창이 없으면 ?claude=로 연다', await waitFor(async () => (await sw.evaluate(() => self.sp5Opened)) === `${origin}/?claude=${idB}`, 5000), String(await sw.evaluate(() => self.sp5Opened)));
  c('누른 알림은 닫힌다', await waitFor(async () => (await osNotes(tagB)).length === 0, 5000));
  await open(page, '#/memo');
  await waitFor(newChip(idA), 15000);
  c('앱을 열어도 칸을 보기 전에는 알림이 남는다', (await osNotes(tagA)).length === 1);
  await clickNote(tagA);
  c('열린 앱 창에서 누르면 그 메모 칸', await waitFor(async () => (await page.locator(sel('note-text-input')).inputValue().catch(() => '')) === '새 답 점검 가', 8000));
  c('누른 답도 본 것', await waitFor(async () => (await seenOf(pathA)) === 600, 8000), String(await seenOf(pathA)));
  await page.keyboard.press('Escape');

  // 다른 기기에서 이미 봤어도 칸을 보면 이 기기 알림을 닫는다
  await page.goto('about:blank');
  await push(idA, 'deployed');
  await waitFor(async () => (await osNotes(tagA)).length === 1, 8000);
  await open(page, '#/memo');
  await waitFor(page.locator(sel('entry-card', idA)), 15000);
  await openNote(idA);
  c('그 메모 칸을 보면 그 알림이 닫힌다 (새 답이 없어도)', await waitFor(async () => (await osNotes(tagA)).length === 0, 8000));
  await page.keyboard.press('Escape');

  // 알림을 눌러 연 앱 - 사본이 빈 기기에서도 칸이 채워지는지
  await admin.set(pathA, answer(700, 600));
  const cold = await newPage(browser);
  await open(cold.page, `?claude=${idA}#/memo`);
  const coldInput = cold.page.locator(sel('note-text-input'));
  c('?claude= → 그 메모 칸 (빈 사본에서도 글이 채워진다)', await waitFor(async () => (await coldInput.inputValue().catch(() => '')) === '새 답 점검 가', 20000), await coldInput.inputValue().catch(() => '없음'));
  const coldUrl = new URL(cold.page.url());
  c('주소에서 ?claude=만 지운다 (# 뒤는 그대로)', !coldUrl.searchParams.has('claude') && coldUrl.hash.startsWith('#/memo'), cold.page.url());
  c('?claude=로 열어도 본 것', await waitFor(async () => (await seenOf(pathA)) === 700, 8000), String(await seenOf(pathA)));
  c('받는 쪽 콘솔 오류 없음', cold.errors.length === 0, cold.errors.join(' | '));
  await cold.page.context().close();

  await page.evaluate(() => window.sp5.openWindow('labels', { tab: 'note' }));
  await waitFor(row, 10000);

  const prune = page.locator(sel('label-prune'));
  if (await prune.isEnabled()) {
    await prune.click();
    c('빈 라벨 정리 목록에 없다', (await page.locator(sel('label-prune-item', labelId)).count()) === 0);
  } else c('빈 라벨 정리 수에 넣지 않는다 (빈 라벨이 이것뿐)', true);
  c('콘솔 오류 없음', errors.length === 0, errors.join(' | '));
} catch (e) {
  // 끝까지 돌지 못하면 통과가 아니다 - 그냥 두면 finally가 삼켜 '모두 통과'로 끝난다(P23-2)
  c('점검이 끝까지 돌았다', false, String(e));
} finally {
  await undo.run();
  await browser.close();
  done();
  process.exit();
}
