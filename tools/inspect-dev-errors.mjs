// tools/inspect-dev-errors.mjs - P14-2 오류 알림을 크롬으로 본다.
//   1) 일반 계정(teacher) 화면에서 잡지 못한 오류·오류 안내(showErrorToast + 오류)가 나면 v5Errors에 문서가 생긴다 - 같은 오류를 또 내도 늘지 않는다.
//      문서에 메모 글·메일이 없다. (에뮬레이터 빌드는 보내기가 꺼져 있어 enableErrorReports(true)로 켠다)
//   2) 개발자 계정(?as=5)의 환경설정 '개발자' 탭 '오류 기록'에 묶여 보이고, 누르면 스택, [모두 지우기]로 지운다.
//
//   npm run emu · npm run seed(개발자 계정 ?as=5) · npm run dev:emu (켜 둔다) → node tools/inspect-dev-errors.mjs
// ⚠️ 에뮬레이터만. 점검이 만든 오류 문서는 끝에 개발자 계정으로 지운다(다른 점검이 남긴 v5Errors도 함께 - 에뮬레이터에서는 이 점검만 쓴다).
import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
await em.signIn('hyundonglim80@gmail.com');
const undo = restorer();
const serverErrors = async () => (await getDocs(collection(em.db, 'v5Errors'))).docs.map((d) => ({ id: d.id, ...d.data() }));
const clearServer = async () => {
  for (const d of (await getDocs(collection(em.db, 'v5Errors'))).docs) await deleteDoc(d.ref);
};
await clearServer();
undo.add(clearServer);

const browser = await launch();
try {
  r.section('일반 계정 화면의 오류 → v5Errors');
  const t = await newPage(browser);
  await open(t.page, '#/day/2026-10-08');
  await t.page.evaluate(async () => {
    const m = await import(window.__appModule('/src/data/errorReport.ts'));
    m.resetErrorReportsForTest();
    m.enableErrorReports(true);
  });
  // 잡지 못한 오류 (같은 것을 두 번) + 오류를 넘긴 안내 하나 + 입력 확인 안내(오류 없음) 하나
  await t.page.evaluate(async () => {
    const same = new TypeError('점검 오류 김철수 메모');
    for (let i = 0; i < 2; i++) setTimeout(() => { throw same; });
    const toast = await import(window.__appModule('/src/app/toast.ts'));
    toast.showErrorToast("'김철수 상담' 저장하지 못했습니다.", Object.assign(new Error('Quota teacher@example.com'), { name: 'FirebaseError', code: 'resource-exhausted' }));
    toast.showErrorToast('같은 조합을 두 기능이 쓰고 있습니다');
  });
  const docs = await serverUntil(serverErrors, (d) => d.length >= 2);
  await new Promise((res) => setTimeout(res, 1500));
  const all = await serverErrors();
  r.check(all.length === 2, `오류 둘 = 문서 둘 (같은 오류 두 번·입력 확인 안내는 빠짐) (${all.length}: ${all.map((d) => d.kind).join(',')})`);
  const err = all.find((d) => d.kind === 'error');
  const toast = all.find((d) => d.kind === 'toast');
  // 코드가 낸 오류 문장은 따옴표 밖 글을 그대로 둔다(코드 오류에 사용자 글이 끼는 일은 드물다 - domain/errorReport scrubText)
  r.check(err?.message === 'TypeError: 점검 오류 김철수 메모', `잡지 못한 오류 문장 (${err?.message})`);
  r.check(toast?.message === '… 저장하지 못했습니다.' && toast?.note === 'FirebaseError resource-exhausted', `안내 = 앱 글(따옴표 안 지움) + 오류 이름·코드 (${toast?.message} / ${toast?.note})`);
  r.check(!JSON.stringify(toast).includes('김철수') && !JSON.stringify(all).includes('teacher@example.com'), '안내 문서에 사용자 글·메일 없음');
  r.check(err?.scope === 'day' && err?.device === 'pc' && err?.build && err?.at, `화면·기기·판·서버 시각 (${err?.scope}·${err?.device}·${err?.build})`);
  r.check(docs.length >= 2, '서버에 올라간다');

  r.section("개발자 계정 - 환경설정 '개발자' 탭 '오류 기록'");
  const d = await newPage(browser);
  await open(d.page, '#/day/2026-10-08', { as: 5 });
  await d.page.evaluate(() => window.sp5.openWindow('settings', { tab: 'dev' }));
  r.check(await waitFor(d.page.locator(sel('settings-panel', 'dev'))), '개발자 탭으로 열린다');
  r.check(await waitFor(async () => (await d.page.locator(sel('error-group')).count()) === 2), '묶음 둘');
  r.check((await d.page.locator(sel('errors-total')).getAttribute('data-errors-total')) === '2', '모두 2건');
  await d.page.locator(sel('error-toggle')).first().click();
  const stack = await d.page.locator(sel('error-stack')).textContent();
  r.check(/at /.test(stack ?? ''), `누르면 스택 (${(stack ?? '').split('\n')[0]})`);
  d.dialogs.answer = true;
  await d.page.click(sel('errors-clear'));
  r.check(await waitFor(d.page.locator(sel('errors-empty'))), '모두 지우기 → 오류 기록이 없습니다');
  r.check(d.dialogs.seen.some((m) => m.includes('오류 기록 2건을 지울까요?')), '지우기 전에 묻는다');
  r.check((await serverUntil(serverErrors, (x) => x.length === 0)).length === 0, '서버에서도 지워진다');

  r.section('일반 계정은 개발자 탭이 없다');
  await t.page.evaluate(() => window.sp5.openWindow('settings', { tab: 'dev' }));
  await waitFor(t.page.locator(sel('settings-window')));
  r.check((await t.page.locator(sel('settings-tab', 'dev')).count()) === 0, '탭 없음 (dev로 열어도)');

  // t 화면 오류는 일부러 낸 것뿐
  const unexpected = t.errors.filter((e) => !e.includes('점검 오류'));
  r.check(unexpected.length + d.errors.length === 0, '화면 오류 없음 (일부러 낸 것 빼고)', `화면 오류: ${[...unexpected, ...d.errors].join(' | ')}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
