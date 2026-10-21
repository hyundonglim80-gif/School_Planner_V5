# School Planner V5 — Claude 작업 규칙과 기억

이 파일은 V5를 여러 기기에서 같은 규칙으로 만들기 위한 **공유 기억**이다. 저장소에 들어 있어 `git pull`로 기기끼리 맞춰진다.
기기마다 따로 쌓이는 Claude 기억(그 기기의 `~/.claude/projects/<작업 폴더>/memory/`)과는 아래 0장 절차로 하나로 맞춘다.

> 저장소 `hyundonglim80-gif/School_Planner_V5`. 계획·설계 문서는 `docs/`(PLAN·DESIGN·MENU·PARITY). P1-1(10-08)에 V4 저장소 `docs/V5/`에서 옮겨 왔다 - 이것이 정본.
> **이 파일이 정본 기억**이다(10-14 P9-4 - V4는 '보관 - 고칠 때만', V4 화면에 'V5로 옮겼습니다' 띠, V4 알림 함수 넷은 10-14 지웠다).

마지막 합침: 2026-10-19 (클라우드) - Claude 요청 결과 글 (처음 씀 10-08 영-전-3-현동림 PC)

---

## 0. 대화를 시작하면 먼저 할 일 — 기억 합치기

1. `git pull`로 이 파일을 최신으로 만든다(옆의 V4 저장소도). 고친 것이 있으면 먼저 알린다.
2. 이 기기의 기억 폴더(`MEMORY.md`와 그 옆의 `*.md`)를 읽는다. 없으면 3~4를 건너뛴다.
3. 기억을 이 파일과 견준다. 이 파일에 없는 기억 → 알맞은 장에 더한다. 이 파일에만 있는 것 → 기억에도 적어 둔다.
   같은 주제인데 내용이 다르면 두 내용을 나란히 보여 주고 사용자에게 고르게 한다(이 파일 / 기기 기억 / 둘 다 합치기 / 새로). 고르기 전에는 어느 쪽도 지우지 않는다.
4. 바뀐 것이 있으면 위 '마지막 합침' 줄을 고치고 커밋·푸시(`CLAUDE.md 기억 합침 - <기기>`), 무엇을 더하고 골랐는지 짧게 알린다. 없으면 조용히 넘어간다.
- 1장(사용자)·2장(작업 방식)은 **V4 `CLAUDE.md`와 같게** 둔다 - 한쪽을 고치면 다른 쪽도.
- V4를 고치는 대화면 `../School_Planner_V4/CLAUDE.md`도 읽고 그 규칙(V4 자료 쓰기 규칙)을 따른다.
- Claude Code는 두 저장소의 위 폴더(예 `D:\gody5\Git`)나 이 폴더로 연다. 위 폴더로 열 때는 그 폴더 `CLAUDE.md`(기기마다 따로)에
  "School_Planner_V5/CLAUDE.md를 먼저 읽는다"를 적어 둔다.

작업 중에 새로 기억할 만한 것(사용자의 결정, 선호, 같은 실수를 막는 교훈)은 기기 기억과 이 파일에 **함께** 적고, 그 작업 커밋에 이 파일도 넣는다.

## 지금 상태 (진행 중인 것·사용자에게 부탁한 것만 - 세션마다 2줄 이하)

- **P13-1 끝(10-16)** 메모로 Claude 요청 - 끝 조건 모두 확인 - 세 계정 🔒 'Claude요청' · 잇달아 보내기 차례대로(#43 끝난 뒤 #45). 문제가 있으면 다시 요청.
- **10-19 결과 글**(바꾸지 않은 까닭을 카드에) - 화면·워크플로·함수(1000자까지) 모두 배포 끝(함수는 10-19 PC에서 `--only functions:v5`).
- 부탁(P12): 휴대폰 설치 앱은 완전히 닫았다 다시 열기.

## 작업 저장과 이어 하기 (요약 - 자세히는 `docs/PLAN.md` 0·1장)

- 세션 = 대화 하나 = `docs/PLAN.md`의 P○-○ 하나. 세션은 조각(■)으로 나뉘고 **조각마다 커밋·푸시**한다(끊겨도 잃는 것은 하던 조각 하나).
- 사용자가 **'저장'·'90%'**라고 하면: 하던 조각을 main(빌드가 되면) 또는 `wip/P○-○-n` 브랜치에 푸시 → 지금 상태에 세 줄(브랜치·한 것·남은 것) → 멈춘다.
- 기기를 바꾸면: `git pull` → 지금 상태 → wip가 있으면 checkout → 체크되지 않은 첫 조각부터. `git status`에 남은 변경은 그 기기에서 끊긴 것.
- 세션이 끝나면 `docs/PLAN.md` 1-3 '세션 끝 정리'를 그대로 하고 "P○-○ 끝. 새 대화에서 '이어서'"라고 알린다.

## 1. 사용자

- School Planner(V3·V4·V5)를 혼자 만들고 관리한다. 초·중등 선생님용 플래너(일정·기록·메모·시간표·이월·학급 명렬표·알림장·출석부·진도·조사표).
- **한국어로** 소통한다. 답변·커밋 메시지·코드 주석 모두 한국어. 쉬운 말을 좋아한다(설명서 없이 · 쉬운 말 · 같은 것은 같은 말 · 한두 번에).
- 버그는 짧은 증상 목록("-D-Day 정보가 사라짐")으로 알린다. 원인은 코드와 커밋 기록에서 찾기를 기대한다.
- 한 번의 요청으로 **진단 → 수정 → 확인 → 커밋·푸시**까지 원한다. 그 요청 안의 푸시는 허락된 것으로 본다.
- Pro 계정이라 5시간 사용 한도가 있다. 사용량은 Claude가 볼 수 없으므로 사용자가 '저장'·'90%'라고 알린다.
- **V5 (2026-10-08)**: V3·V4와 자료를 함께 쓰지 않고 효율적으로 다시 짠다. V4의 디자인·기능은 최대한 그대로.
  **정해야 하는 것은 Claude 권장안을 따른다** - 권장안을 고르고 `docs/PLAN.md` 5장에 까닭과 함께 적는다.
  다만 운영 규칙·함수 배포, 실제 자료를 지우거나 바꾸는 일, V4 동작을 바꾸는 일, 돈이 드는 설정, V4에서 사용자가 정한 것을 바꾸는 일은 묻는다.
  메뉴는 기능 기준으로 합치고 나누기(사용자 요청 10-08) - `docs/MENU.md`.

## 2. 작업 방식 — 빠른 확인 (V4 2026-09-29 사용자가 고름)

- 조각마다: 단위 테스트(`npx vitest run`) → 타입·lint → 빌드 → **바뀐 부분만** 실제 크롬으로 확인하는 짧은 점검(1~2분) → 커밋·푸시.
  전체 점검은 단계 끝에만(사용자가 원하면 그때).
- 브라우저는 **크롬 하나, PC 1400px 하나**만 본다. Firefox·WebKit이나 다른 폭을 기본으로 돌리지 않는다. 휴대폰 390px는 P9-3에서 한 번,
  또는 사용자가 따로 요청할 때만(V4 2026-09-28 사용자 결정 - 여러 브라우저·폭을 돌려 30~50분씩 걸렸다).
- 에뮬레이터와 개발 서버는 **끄지 않고 계속** 쓴다. 켜기 전에 켜져 있는지 본다(Firestore `127.0.0.1:8080`, Auth 9099). **V4와 한 벌을 같이 쓴다.**
  자료는 모를 때·에뮬레이터를 다시 켰을 때만 넣는다(V4 seed → V5 seed). JDK 경로는 기기마다 다르다(V4 `CLAUDE.md` 2장 - `C:\HDL` PC는 Temurin 21 JRE).
- 점검 스크립트(`tools/inspect-*.mjs`):
  - 화면 글자가 아니라 **`data-*`로 찾는다**(V4는 title을 바꿔 4항목이 며칠 깨진 채 남았다). 새 단추에는 `data-…`.
  - 심은 자료는 끝에 되돌린다. 점검이 이상하게 깨지면 앱보다 먼저 자료(라벨·설정 문서)를 본다.
  - 계정에 저장되는 설정을 바꾸면 2~3초 기다린 뒤 닫는다(1초 뒤 올라간다).
  - 정한 시간만 기다리지 않고 보려는 것이 뜰 때까지 기다린다(`waitFor`). 서버 확인은 기다려 읽는다(`serverUntil`).
  - 늘 움직이는 것(깜빡이는 ⏰ 알림 창)은 Playwright가 '멈춘 단추'를 끝없이 기다린다 → 그 단추만 `click({ force: true })`(P3-1).
  - 보던 화면이 기억되므로 묶음 시작에서 화면을 정한다(주소 `#/day/…`로 열면 된다). 같은 주소(# 뒤만 같은 것)를 `goto`하면 새로 읽지 않는다 - 앱을 처음부터 보려면 `page.reload()`(P2-4).
  - 창을 닫은 바로 뒤 주소를 바꾸면 창 층의 뒤로가기가 주소를 되돌릴 수 있다 → 그 화면이 뜰 때까지 다시 간다(`inspect-groups` `go()` - P3-3). 서버를 읽어 셀 때 지운 표시(`deletedAt`)를 빼는지 본다.
  - 같은 `data-*` 이름을 두 곳(카드 표시·칸 안내)에 쓰지 않는다 - Playwright가 둘을 찾아 멈춘다(P3-3 `event-series`/`event-series-info`).
  - `ModalShell`의 `headerExtra`·`footer` 단추(저장·삭제·+ 새로)는 창 본문의 `data-*` 상자 밖에 그려진다 - 본문 상자로 좁혀 찾지 말고 page에서(그 창 하나만 연 채로 - P7-4).
  - 정한 날(`DAY`)에 심는 점검은 **날이 지나면 깨질 수 있다**: 이월 라벨 일정은 그날이 지나면 오늘로 따라와 ForwardMarks가 `carrying`을 한 번 쓴다 - '바뀐 문서 하나'를 세는 점검이면 `carrying: true`로 심는다(P8-2 inspect-events).
  - Playwright `route.fulfill` 흉내 응답은 **CORS를 보지 않는다** - 막힌 내려받기(버킷 CORS)는 `route.abort('failed')`로 흉내 낸다(P8-3 첨부 모으기). 컨테이너 Chromium은 한글 내려받기 이름을 'download'로 바꾼다(이름은 PC에서).
  - 서비스 워커·오프라인은 개발 서버가 아니라 **빌드 + preview(4175)**로 본다(`SITE=http://localhost:4175/` - inspect-offline). 응답이 `Vary: Origin`이라 캐시 짝 찾기는 `ignoreVary`(P8-3).
  - 지운(없는) 공간 문서는 규칙이 읽기를 막는다(`resource`가 없어 members를 못 본다) - 점검에서 '없어졌나'는 읽기 거부도 없음으로 센다(P8-4 inspect-share-groups).
  - **계정에 올라가는 설정은 기기 저장소만 바꿔서 시험하지 않는다** - 다시 열면 계정 값이 이긴다. 계정 문서로 바꾸고 끝에 걷는다(P4-1 - inspect-shell이 '가운데 창'을 계정에 남겨 다른 점검이 깨졌다).
- **오늘에 따라 고르는 것(이월·지난 일정)의 단위 테스트는 날짜를 고정**한다: `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(…)`, 끝에 `vi.useRealTimers()`(P3-3 - 고정하지 않으면 다음 날 시험이 깨진다).
- **창 목록(`app/windowList`)이 부르는 `features/*/open.ts`는 `data/session`·`select`를 import하지 않는다** - windowConventions.test가 창 목록을 읽어 진짜 Firebase가 뜨고 CI에서 가끔 '처리하지 않은 오류'(P7-2 알림장 - 단축키는 `shortcuts.ts`로 나눴다).
- **단위 테스트가 `data/select`·`session`·`space`를 부르면 `vi.mock('…/data/firebase')`** - 진짜 Firebase 앱이 뜨면 시험이 끝난 뒤 IndexedDB를 열다
  '처리하지 않은 오류'가 가끔 남는다(P3-1 - 셋에 한 번). vitest가 'originated in <파일>'로 그 파일을 알려 준다. 끝에 `Errors`가 0인지도 본다.
- **IndexedDB(idb)는 트랜잭션을 열어 일과 `tx.done`을 함께 기다린다**(P3-2) - `db.get`·`db.put` 줄임은 읽기 트랜잭션의 done을 아무도 받지 않아, 트랜잭션이 끊기면 '처리하지 않은 오류'(AbortError)가 된다.
  쓰던 글 보관을 여는 칸을 그리는 시험 파일은 `afterAll`에서 `wipeDrafts`를 기다린다 - 마지막 시험이 연 DB가 환경이 걷힌 뒤 열리면 'IDBRequest is not defined'(P4-2).
- **클라우드 컨테이너는 apis.google.com·*.web.app에 닿지 못한다** - Firebase 팝업 로그인(다시 받기 포함)이 창을 열기 전에 `auth/internal-error`. 그 확인은 PC에서(P4-2 inspect-attach가 건너뛴다).
  거꾸로 **PC 크롬은 방금 누른(Playwright 클릭·타자) 때 로그인 창을 바로 연다** - '구글 로그인이 필요합니다' 창 갈래는 `noUserActivation(page)`로 '방금 누르지 않음'을 만들어 본다.
  진짜 로그인 창을 닫으면 Firebase가 8초쯤 기다린 뒤 닫힘을 알린다(P9-3 - 컨테이너에서만 통과하던 attach·gcal).
- **클라우드에서만 돌던 점검을 PC에서 돌리면**(P9-3): Windows 클립보드는 `\r\n`으로 돌려준다 · '오늘부터' 세는 것(진도 다음 수업 밀기)은 `page.clock.setFixedTime` ·
  가져오기 점검은 **V4 seed**가 있어야 한다(V4 `node tools/seed.mjs` → V5 `npm run seed` - 에뮬레이터를 새로 켰으면).
- **점검이 화면 안에서 앱 모듈을 부를 때는 `import(window.__appModule('/src/…'))`** - 개발 서버는 고친 파일(과 그것을 부르는 것) 뒤에 `?t=…`를 붙여 내려,
  `/src/…`를 그냥 부르면 다른 모듈(되돌리기 더미·사본 store가 따로)이 된다(P9-3 - 자료 층을 고친 뒤 inspect-data Ctrl+Z가 깨졌다. `newPage`가 심는다).
- **한꺼번에 심은 문서가 구독 겹침(1분, `OVERLAP_MS`) 안에 들면 구독이 그것을 다시 보내** 에뮬레이터 통로가 막힌다(`too many pending messagings (10001)` -
  `firestore-debug.log`가 300MB, 모든 점검이 느려졌다). 큰 자료를 심은 점검(`inspect-perf`)은 1분 넘게 기다린 뒤 표시 하나를 쓰고 연다. 점검이 갑자기 다 느리면 로그를 보고 에뮬레이터를 다시 켠다(→ V4 seed → V5 seed).
- **휴대폰 흉내(`isMobile`)는 글이 넘치면 화면 폭(innerWidth)째 넓힌다** - 넘침은 정한 폭(390)과 견준다(P9-3 inspect-mobile). 전체 화면 그림(`fullPage`)의 fixed(탭바·＋)는 엉뚱한 자리에 찍힌다 - 자리는 보이는 화면 그림으로.
- **저장소에 prettier가 없다 - `npx prettier --write`를 돌리지 않는다**(P6-1 - 따옴표·줄 폭을 통째로 바꿨다. 되돌리고 고친 것만 다시).
- **V4에서 옮긴 화면의 직접 만든 CSS 클래스(`no-spinner` 등)는 V5 `index.css`에 있는지 본다** - 없으면 Tailwind가 말없이 버린다(P10-2 - 명렬표 번호 칸의 숫자 화살표가 두 자리를 가렸다, `@utility no-spinner`로 넣음).
- **V4에서 옮긴 파일이 `new URL('./…', import.meta.url)`로 부르는 것(워커 등)은 개발 서버에서는 없어도 넘어가고 빌드에서만 깨진다** - 옮기면 `npm run build`까지(P7-1 `ui/shrinkWorker.ts`). 점검 스크립트는 끝에 `process.exit()`(에뮬레이터 Firebase가 노드를 붙잡는다).
- **`pkill -f <글자>`는 그 글자가 든 자기 명령 줄(셸)도 죽인다**(P7-3 - `pkill -f vite`로 Bash가 144로 끝났다). 에뮬레이터·개발 서버는 뒤에서(`run_in_background`) 켠다.
- **클라우드 백그라운드 명령은 기본 30분에 꺼진다** - 에뮬레이터·개발 서버는 `run_in_background` + `timeout: 7200000`(최대 2시간, 그 뒤에도 꺼진다 - 다시 켜고 seed, P9-1). 점검이 갑자기 다 깨지면 먼저 8080·5175가 살아 있나.
- 점검에서 칸을 닫는 `sp5.closeAllWindows()`는 저장 안 한 칸이 있으면 confirm으로 묻고 probe는 '아니오'라 **칸이 남는다** → 그때만 `dialogs.answer = true`(inspect-manual `closeAll`, P9-1).
- **크기·자리만 재는 점검은 빈 글자도 통과한다** - 칩·배지를 새로 그리면 글자(`textContent`)가 있는지도 본다(P12-1 - 휴대폰 월간 칩이 빈 채 '칩 폭 22px·넘침 없음'을 통과, 그림으로 찾았다.
  `parseSlot`은 반이 없으면 `cls: ''`라 `??`로는 과목으로 넘어가지 않는다 - `||`).
- **사용자 보고가 재현되지 않으면 V4의 같은 기능 코드와 견준다**(P12-1 이월 - V5 경로는 모두 맞았고, V4 `runAutoForwarding`의 겹침 규칙이 빠져 있었다).
- **점검이 개발 서버로 도는 동안 저장소 파일(.md 포함)을 고치지 않는다**(P10-5) - Tailwind가 다시 훑어 `index.css`·`Shell`이 HMR로 바뀌고 열린 칸이 사라져 점검이 틀린다. 문서는 점검 묶음 뒤에.
- **확인과 커밋을 한 줄에 잇지 않는다**(P3-2): `npx tsc -b && … ; git commit`은 앞이 실패해도 커밋한다, `grep -c`는 0이면 실패로 끝나 `&&` 사슬을 멈춘다. 확인 결과를 본 뒤 커밋한다.
- **운영을 지우는 명령(`functions:delete`, `git push --delete`)은 Claude 자동 권한이 막는다**(10-14) - 사용자에게 한 줄 명령을 주고 VS Code 터미널에서 돌리게 한 뒤, 결과는 사용자가 보낸 화면으로 확인한다.
  VS Code 터미널(PowerShell)은 `npx`가 실행 정책에 막힌다(`npx.ps1` 보안 오류) → **`npx.cmd`**로. `firebase login`은 `!`로는 안 된다(브라우저·질문) - 터미널에서.
- **C: 디스크가 차면 에뮬레이터가 죽는다**: `firebase-debug.log`·`firestore-debug.log`(git 무시)가 커진다. 긴 점검 전에 `df -h /c`, 차면 두 로그를 비우고 `npm run emu` → seed.
  클라우드 컨테이너는 두 로그를 `/dev/null` 링크로 둔다(`ln -s /dev/null firebase-debug.log` - P4-3에 30GB가 되어 Auth 에뮬레이터가 죽었다). 링크는 git 무시라 기기마다 한 번.
- 에뮬레이터에서 문서 하나 저장이 6~7초씩 걸리면 앱 버그가 아니라 남은 잠금이다(점검 브라우저를 저장 도중에 끈 탓) - 에뮬레이터를 다시 켜고 seed.
- 클라우드 세션(claude.ai/code): `docs/PLAN.md` 1-7(세션 브랜치 푸시 → PR, 준비 순서, Chromium, V4 받기). 운영 규칙·함수 배포는 PC에서(묻고).
  **PR은 CI가 통과하면 Claude가 곧바로 합친다 → main CI 뒤 화면이 저절로 배포된다**(사용자 결정 10-08 "앞으로는 자동으로 합치고 배포해" - 묻지 않는다, CI가 실패하면 고친 뒤에).
  컨테이너 에뮬레이터는 켜 둔 채 `firestore.rules`를 고치면 죽고 Firestore java만 포트를 쥔다 → 그 java를 끄고 `npm run emu`를 다시(P2-1).

## 3. V5 규칙 (자세히는 `docs/DESIGN.md`)

- **원칙 일곱**(`docs/DESIGN.md` 2장): 항목 하나 = 문서 하나 · id는 바뀌지 않는다 · 이름 대신 id · 계산할 수 있는 것은 저장하지 않는다 ·
  지우기 = 지운 표시 · 기기 사본 + 바뀐 것만 받기 · 화면은 자료 층만, 창은 창 목록 한 곳.
- 코드를 고치기 전에 `docs/DESIGN.md` 10장 체크리스트를 본다.
- **화면은 고르기(`data/select`)로만 읽고 저장 도우미(`data/repo`)로만 쓴다** - 그 사이에 기기 사본(`data/mirror`)이 선다. 화면에 새 컬렉션을 쓰면 `MIRRORED`에 더한다.
- **서버를 함께 쓰는 데서 오는 함정**(V5만의 것):
  - 기본 데이터베이스의 **규칙은 한 벌**이다 - V5 저장소 `firestore.rules`(V4 규칙 전부 + V5)가 정본, V4에서 규칙을 고치지 않는다. 배포는 사용자에게 묻고.
  - **함수는 codebase `v5`**로만 배포한다(`--only functions:v5`) - 빼면 V4 함수(default)를 지우려 한다.
    Windows PC는 함수 코드 읽기가 10초를 넘어 `FUNCTIONS_DISCOVERY_TIMEOUT=60`을 붙인다(배포·함수 에뮬레이터). Java가 PATH에 없으면 Android Studio의 `jbr`를 JAVA_HOME·PATH로.
  - V5는 V4 자료를 **읽기만** 한다(가져오기). V4·V3 경로에 쓰지 않는다.
  - **기기 사본**(P2-2): 받은 것은 메모리 먼저·사본은 뒤따라, 사본이 고장 나면 그 탭은 메모리로만(다시 열지 않는다). 구독은 내가 쓰는 동안 그 문서를 '빠짐'으로 준다 -
    영구 지우기로 믿지 않는다. **에뮬레이터는 색인을 보지 않는다** - 서버 쿼리는 칸 하나로 짓는다.

## 4. V4에서 배운 것 중 V5에도 남는 것

- **저장 실패를 삼키면 글이 사라진다**: 저장 함수는 `failWithToast`로 던지고, 칸은 실패하면 닫지 않는다(안내는 한 번만).
- **본문을 읽기·저장 길에서 바꾸지 않는다**(V4에서 `[v] 숙제`의 앞부분이 지워졌다). 보여 주는 것만 바꾼다.
- **칸을 연 순간의 공간·날짜에 저장한다**(지금 보는 공간이 아니라).
- **브라우저는 방금 누른 때가 아니면 구글 로그인 창을 막는다** → '구글 로그인이 필요합니다' 창의 단추에서 연다(앞에 await를 두면 다시 막힌다). 시키지 않은 일에서 로그인 창을 띄우지 않는다.
- **IndexedDB(V4 09-22)**: Firestore 오프라인 저장소는 쓰지 않는다(`memoryLocalCache`). V5 기기 사본은 앱이 따로 두고, 고장 나도 서버 구독은 멈추지 않게 짠다.
  이런 종류는 증상이 아니라 **구조**(IndexedDB가 생기나, 서버 구독이 도나)로 확인한다. 같은 것을 두 번 고쳐도 되살아나면 멈추고 원인부터.
- **매니페스트·서비스 워커를 바꾸면 설치된 앱은 늦게 받는다** → 사용자에게 '지우고 크롬에서 다시 설치'를 함께 알린다. 앱 아이콘은 PNG(SVG뿐이면 안드로이드가 바로가기로 깐다).
- **테스트에서 훅을 목으로 바꿀 때는 늘 같은 객체**를 돌려준다(그릴 때마다 새 객체면 effect가 끝없이 돌아 vitest가 아무 출력 없이 멈춘다).
- **쓰는 칸의 Ctrl+S**는 저장 함수를 ref로 들고 effect로 바꿔 끼운다(새 상태를 deps에 - 빠뜨리면 옛 값으로 저장한다).
- **글을 바꾼 뒤 커서는 `useLayoutEffect`에서** 둔다(requestAnimationFrame으로 미루면 그새 친 글자 앞으로 돌아가 '달걀'이 '걀달'이 된다).
- **엑셀은 표와 함께 그림도 복사한다** → 붙여넣기는 표를 먼저 보고, 표면 그림 올리기로 넘기지 않는다. Firestore는 배열 안 배열을 받지 않는다(`rows[].cells[]`).
- **화면 폭은 창이 아니라 본문 폭**(`@container`)으로 판단한다 - 오른쪽 칸이 열리면 좁아진다. 읽는 범위를 폭에 따라 바꾸지 않는다(주간은 늘 두 주 - 바꾸면 칸이 열릴 때 다시 읽어 창이 닫혔다).
- **`backdrop-blur`·`transform`·`filter`가 있는 조상 안의 `fixed`는 그 조상에 붙는다** - 화면에 붙일 것(둥근 ＋ 등)은 body로 portal(P9-3 - 머리줄 안의 ＋가 화면 맨 위에 걸렸다). portal한 것은 바깥 누르기 판정에서 안쪽으로 셈한다.
- **날짜 셈**: 한 달 더하기는 말일로 맞춘다(1/31 + 1달 = 2/28), 학년도는 3월~이듬해 2월(윤년 2월 29일), 학기 셈은 한 곳(`semester`)에서.

## 5. 화면 규칙 (사용자가 정한 것 - V4 그대로. 자리를 옮긴 것은 `docs/MENU.md`)

### 오른쪽 칸 (V4 2026-09-29 → 10-07)
- 창은 기본으로 **화면 오른쪽 칸**에 뜬다. 넓은 화면은 화면을 나눠 붙고, 휴대폰은 오른쪽에서 덮는다. 환경설정 '창 위치'에서 '가운데 창'으로 바꿀 수 있다(PC·휴대폰 따로).
- 오른쪽 칸은 **한 줄에 한 폭**. 경계선을 끌어 폭을 바꾸고, 두 번 누르면 기본 폭.
- 여러 개면 **위에 탭**. 새 칸은 탭 하나로 더해지고 보인다, 숨은 탭도 적던 글째 살아 있다, 탭 ×는 그 칸 닫기. 높이를 나누는 방식(62/38)은 사용자가 거절했다.
- **쓰는 칸(메모·기록·일정·알림장·출석부)도 탭**이다. 이미 열린 항목을 다시 열면 그 탭을 보인다. 닫기·뒤로가기·Ctrl+S는 그 칸 하나만.
- 왼쪽 목록 카드의 **파란 테두리 = 오른쪽에 보이는 탭의 항목 하나**(10-21 사용자 - 숨은 탭·메모 아닌 탭은 짚지 않는다). `useShownNoteId`·`useShownEventId` ← `windows.useShownWindowPick`(오른쪽 줄 칸마다 그린 창 key `SideOwnerContext`, 줄이 비면 맨 나중에 연 창).
- **ESC는 오른쪽 줄 전체**를 닫는다(저장 안 한 글이 있으면 먼저 묻는다). 화면 가운데를 덮는 크게 보기(사진·🎯 뽑기)는 ESC를 window capture에서 먼저 받아 그것만 닫는다(P7-3). **Ctrl+S**는 커서가 든 칸·창만, 커서가 없으면 보이는 탭.
  Ctrl+S는 저장 단추가 있는 모든 곳에서 저장한다. 좁은 화면에서 배경을 누르면 고친 것을 저장하고 닫는다(닫기·✕·ESC는 저장하지 않는다).
- 기록·메모를 여는 길은 모두 **하루·메모 화면과 같은 쓰는 칸**이다. 새 일정·기록·메모는 **저장한 뒤에도 적은 것이 남고** 그 항목의 수정 칸이 된다.
- 새 창은 반드시 `ModalShell` 또는 `PopupFrame`(테스트가 지킨다).

### 왼쪽 클립보드 칸
- 왼쪽 가장자리 📋로 여닫는다. 최신 복사가 위, 누르면 글 쓰던 칸에 붙여넣기. **이 기기에만**(IndexedDB) - 계정에 올리지 않는다(비밀번호·캡처가 지나간다). 지우면 이 기기의 휴지통으로.

### 하루 화면
- 일정·메모 머리줄: `▼ 제목 숫자 [+ 추가] ……… ⚙️`(라벨 설정은 오른쪽 끝). 메모 칸은 '📝 메모'(P10-3 - 옛 '📔 기록', '+ 메모' 없음), 라벨로 보기 칩 줄은 **접힌 채** 🏷️로 편다.
- 일정은 **휴대폰 2열 카드, PC 1열**. 메모는 휴대폰 2열, PC 2~4열.
- 수업 칸: 과목은 **굵고 크게**(PC 18px·휴대폰 16px, font-black), 과목이 있는 교시 카드는 왼쪽에 **교시 색 막대**. 카드에 **교시 시각은 적지 않는다**(P11-1 사용자 의견 - 수업 종에서만, title에만).
- **'바뀜' = 그날만 바꾼 과목**(주황 글자 배지 - P12-1 사용 의견: ✎는 휴대폰에서 뜻을 알 수 없었다): 적힌 과목이 그날 시간표와 다르고 과목이 보이는 칸만(P11-1 - 비운 칸은 '수업 없음', 시간표를 고쳐 같아지면 사라진다). 하루·주간 같게.
- **수업 칸 = 과목 + '비고(준비물)' 한 칸**(P10-2 사용자 의견 2a - 수업 메모 칸 없음, 옛 메모는 비고 아래 줄에 이어 보인다) · 교과 모드 반 도구(🪑·🎯)·🙋 출결은 📊🔗✏️처럼 **마우스를 올렸을 때만**(적힌 것이 있으면 늘, 휴대폰은 늘), 수정 칸에도 같은 단추 · 주간 교시 줄은 과목 뒤에 비고 첫 줄 '…'.

### 메모 하나 + 날짜 링크 (P10-3 사용자 의견 1 - V4 '메모 ↔ 기록 = 날짜 칸'을 바꿈)
- 기록·메모 → **'메모' 하나**. 쓰는 칸 머리 '📅 날짜' = **날짜 칩 여러 개**(+ 날짜 = 작은 달력, × = 그 날 빼기) - 이은 날마다 하루 '📝 메모' 칸에, 메모 화면에는 늘(날짜 없는 메모 → 날짜 링크 메모 최근 날부터).
- 하루 메모 칸 + 추가 = 그날 링크 하나로 새 메모. 카드 🗑️ = 메모 지우기(모든 날에서). **일정은 날짜 링크 없음**(라벨 속성·기간/반복 묶음 때문).
- 자료: `dates`는 둘 이상일 때만, `date` = 가장 이른 날(옛 기록 = 날짜 하나인 메모, 자료 옮기기 없음). '📅 10/6에서'(fromDate)는 적지도 보이지도 않는다.
- **그날 메모 칸에 이은 메모도**(P10-4 사용자 의견 2f·6c - 계산): 그날 일정(기간·이월)·수업 교시·진도 차시에 이은 메모가 겹치지 않게, 카드에 📌·🏫·📘. 진도 차시 링크는 **진도 쪽 그 행에만**(그 차시를 하는 모든 수업 칸에 🔗 n).
- 링크 창 탭 = 📌 일정 · 📝 메모 · 🏫 수업 + **메모에서 열면 📘 진도표**(P11-1 사용자 의견 - 그 차시를 하는 날로 찾고 진도 칩으로 좁힌다, 저장은 진도 쪽 그 행에만), 메모 카드 🔗 링크 추가(마우스를 올리면). 화면 글자 '기록'은 '메모'로(학생 기록·출결 기록 등 다른 뜻은 남김, 시트·백업 CSV·캘린더의 '기록'은 자료 모양이라 그대로).

### 라벨 상위/하위와 라벨로 보기
- 메모·기록 라벨만 2단계 트리(일정 라벨은 뺀다). 메모·기록 라벨은 한 목록.
- 라벨로 보기는 **여러 개** 고른다(하나라도 붙은 항목). **상위를 고르면 하위도 함께**, 하위 끝 가상 칩 **'기타'** = 하위 없이 상위만 붙은 항목. 하위는 화면을 열면 접혀 있다.
- 칩 고르기는 **윈도우 탐색기처럼**: 그냥 누르기 = 하나만, Ctrl = 더하기·빼기, Shift = 범위, ESC = 모두 떼기(오른쪽 칸도 닫힘). 라벨을 더할 때 상위 라벨도 고른다.
- 빈 라벨은 **저절로 지우지 않는다**(라벨 관리 '빈 라벨 정리 (N개)').
- 메모 화면 왼쪽 제목은 **'🏷️ 라벨 관리'**(누르면 라벨 관리 창 - P10-5 사용자 의견 5a, 옛 '📁 라벨로 보기'), 그 아래 칩과 하루 메모 칸 🏷️ 칩 줄의 이름은 '라벨로 보기' 그대로.
  칩 고르기 안내는 **보이는 글** 'Ctrl·Shift+누르기 = 여러 개'(P11-1 - 옛 '?'는 뜻을 몰랐다, PC만·마우스를 올리면 전부).

### 메모·기록의 표
- 엑셀·한셀·구글 시트에서 복사해 본문에 붙여넣으면 서식째 표. 붙인 뒤에는 **칸 글자와 행·열만** 고친다(서식 편집 없음). 표는 글 아래 첨부처럼.

### 기타
- 휴지통 자동 비우기: 끄기/7/14/30/60/90일(계정에 하나, **기본 끄기**). 휴대폰에서도 맨 위에 🗑️ 휴지통.
- 구글 로그인이 만료되면(첨부·사진·백업·캘린더) 오류 대신 '구글 로그인이 필요합니다' 창을 띄우고 그 단추에서 로그인 창을 연다.
- 진도표 차시 칸 = 그 내용의 차시 수. **행을 늘리지 않고 그 수만큼 잇단 수업에 되풀이**한다(10-21 사용자 #75·#79·#80 - '1, 2' = 1차시 + 2차시 = 3차시,
  작은 공 1/2·2/2). 계산 `domain/progress` `lessonPeriods`(차시 → 행 row·k/n) - 수업 칸·미리보기·현황 모두. 이은 메모는 행에(`mark.row`), 차시 번호는 `mark.index`.
  10-07~10-21에 늘려 저장한 표(차시 칸 n 행 뒤의 차시 칸이 빈 같은 내용 행)는 그 행들이 그 차시들(`repeatGroups` - 세는 것 같음), 진도 창은 한 행으로 열고 저장하면 한 행 + 메모를 모은다.
  진도 창이 저장하면 `noCount: true`(차시 칸 = 차시 수). 표시 없는 옛 1, 2, 3 … 차례 번호 표(10-07 전 - 셋 이상 모든 행이 하나씩 느는 번호·범위·10 넘는 수, `isOrderNumbered`)는 한 행 = 한 차시, 창 '차시 수로 세기'.
  사용자가 같은 것을 메모 요청으로 세 번 보냈다(자동 요청은 '구조가 바뀐다'며 하지 않음) - **진도 요청은 메모 요청 기록(#번호)부터 읽는다**.
- 체크리스트는 글 안의 `☐ `/`☑ `, 카드 '☑ n/m', 카드는 체크한 줄을 **보이기만** 아래로. **쓰는 칸은 글 차례를 실제로 바꾼다**(P10-5 사용자 의견 5b·5c): ☐ 누르기 = 체크하고 그 목록 맨 아래·줄긋기,
  풀면 체크 안 한 줄들의 맨 아래, 줄마다 ▲▼(같은 무리끼리) - 글 칸 하나 + 덧그림(`notes/CheckLinesOverlay`). 첫·마지막 줄 '#라벨'은 라벨로 떼고 그 줄을 지운다(숫자 8자리 학생 태그는 남긴다, '#AAA-BBB' = 상위 AAA 아래 하위 BBB - #55, 글이 그 줄뿐이면 제목·첨부·표가 있을 때만 떼고 글은 빈다 - 10-19).
- **메모 제목·글·첨부·표를 다 지우고 저장 = 그 메모 지우기**(제목만 남은 메모는 남긴다 - 10-19)(휴지통 + 되돌리기, P10-5 사용자 의견 5d - V4는 남겼다). 메모만(일정 칸은 그대로). 빈 새 칸은 만들지 않고 닫는다.
- 메모 화면 **카드/목록**: 머리줄 🔍 왼쪽 그림 단추(메모 화면에서만 ☰/▦, 이 기기 기억 - P10-5 5e). 목록 줄 맨 앞 ▶/▼ = 그 줄 아래에 본문 펴기·접기(P11-1, 처음은 접힘).
  **메모 화면에서 쓴 새 메모는 맨 위**(P11-1 사용자 의견 - V4 그대로, 날짜 없는 메모 맨 앞 차례, ▲▼로 바꾼다. 하루 메모 칸 + 추가는 그날 목록 맨 뒤). 오른쪽 칸·클립보드 칸 위의 휠은 그 칸만(가운데 화면·'스크롤로 페이지 이동' 날짜 넘기기를 하지 않는다 - 6e).
- **PC 머리줄 '＋ 새로' 없음**(P10-1 사용자 의견 6d - 칸마다 '+ 추가'·단축키, 휴대폰 둥근 ＋는 둔다) · **알림 소리 길이**는 환경설정 '알림'(한 번·10초(기본 - 3초마다 3번)·30초·1분·5분·확인할 때까지, 계정에 하나).
  앱을 닫았을 때 오는 기기 알림도 그 길이만큼 3초마다 다시 울린다(서비스 워커, 최대 2분 - P12-1 사용 의견 '알림은 뜨는데 알람이 안 울림'). 소리가 막힌 알림 창은 **🔔 소리 켜기**.
- **휴대폰 월간 칸에도 수업**(P12-1 사용 의견 - V4 ROADMAP 15는 칸에서 뺐다): 교시 둘씩 한 줄 작은 칩, 교과 모드는 반만('5-2'), 누르면 그날 목록.
- **반복 = 끝 날 + 요일**(P10-1 10-14 사용자 의견 6b): '📆 끝 날 · 🔁 반복' 줄 하나 - 요일을 안 고르면 기간 하나, 고르면 그 요일만 반복(새 일정만), 격주·매월·매일은 '더 보기'.
- **일정 완료 = 칩 앞에 ✓**(P10-1 10-14 사용자 의견): 끝낸 일정도 칩 색·글은 그대로(흑백·줄긋기 없음), 하루 카드의 ☐는 없앴다 - 라벨 칩을 누르면 완료, 라벨이 없으면 회색 ○ 칩.
- **이월은 같은 글을 오늘 칸에 하나만**(V4 겹침 규칙 - P12-1 사용 의견 '완료했는데 이월이 된다'): 오늘 날짜에 같은 글이 있으면(끝낸 것도) 지난 것은 따라오지 않고, 같은 글끼리는 가장 이른 것 하나.
- **메모로 Claude 요청**(P13 10-16 사용자 결정 - 추가 요금 없음·**완전 자동**): 라벨 'Claude요청' 메모 수정 칸 아래(삭제 옆) **🤖 요청**을 누르면(저장만으로는 보내지 않는다 - 보낼 때를 사용자가 정함, 저장된 글만, **한 번 보낸 메모는 다시 요청 없음**) → Claude가 고치고 확인을 통과하면 사람 확인 없이 합쳐 배포, 카드에 🤖 진행.
  보낼 수 있는 계정은 배포 값 `CLAUDE_OWNER_EMAILS`의 셋(공개 저장소라 코드에 적지 않는다) · 규칙·함수·워크플로 파일은 자동으로 올리지 않는다 · 요청 글은 공개 이슈. `docs/CLAUDE-REQUEST.md`.
  **결과 글**(10-19 사용자 의견): 바꾼 것·바꾸지 않은 까닭을 카드 아래 세 줄·수정 칸에 전부(옛날엔 '🤖 바꾼 것 없음' 표시뿐) - Claude가 summary 첫 줄에 결론, 함수가 1000자까지.
  그 셋에는 라벨 'Claude요청'이 저절로(함수가 만들고 되살린다 - 라벨 관리 🔒, 이름·지우기·빈 라벨 정리 막음) · **한 번에 하나**: 도는 동안 온 요청은 '🤖 차례 기다림' → 앞 것이 합쳐지면 먼저 온 것부터.
- 일정 라벨 속성 '구글 캘린더' - 켠 라벨의 일정은 저장·완료·옮기기·지우기를 구글 캘린더에도. 저장할 때 로그인이 없으면 로그인 창을 묻는다.
- 교사 유형은 시간표 창에서 고른다((초등) 담임 / 전담 / (중등) 전담 + 담임). 전담은 담임 도구(출석부·알림장)를 숨긴다. 수업 칸 글자는 '5-2 과학'.
- 명렬표는 학급 화면 안(⋮에 없다). 수업 종은 하루 '수업' 옆. 링크 연결 창은 저장하면 닫힌다.
- 화면 이름(UX-AUDIT 10-07 사용자 결정): 일정 속성 **'달력'·'수업X'은 그대로**, '조사표'로 통일(모아 보기도 '조사표 모아 보기'), 표는 '행/열', 메모 거르개는 '라벨로 보기'(메모 화면 제목은 '🏷️ 라벨 관리' - P10-5),
  '창 위치'(오른쪽 칸 / 가운데 창), '⏰ 시간표', '💾 저장', '지난 일정 오늘로 가져오기', '여러 개 고르기', '라벨 관리', '검색', '학생 기록(누가기록)', '앱으로 설치'.
- **하지 않기로 한 것**(V4 ROADMAP): 학부모 소통(알림 발송·설문·상담 예약 - 복사·공유로 잇기만), AI API 직접 연결(학생 개인정보가 밖으로 나간다).

## 6. 사용 설명서 = 기능 명세

- **P9-1부터 V5 설명서**(`src/features/help/chapters/*.ts`, 11장 68주제 - 차례는 `topics.ts`)가 명세다. 기능을 고치기 전에 그 주제 부분만 읽는다
  (`grep -rn "id: '<주제 id>'" src/features/help/chapters` - 주제 id는 `docs/PARITY.md`, 창 목록의 `help`). 대화 시작에 전부 읽지 않는다.
- **설명서 수정 멈춤(10-20 사용자 결정 - 메모 요청 #64)**: 당분간 동작·자리를 바꿔도 **설명서(`chapters/*.ts`)와 inspect-manual은 고치지 않는다.** 사용자가 "고칠 부분이 없다"고 판단하면 한 번에 고쳐 달라고 요청한다 - 그때까지 바뀐 것은 요청 글·커밋 기록으로 모은다. 멈춤이 풀리면 이 줄을 지운다.
- (멈춤 전 규칙) **동작·자리를 바꾸면 설명서도 같은 커밋에서** 고치고 `node tools/inspect-manual.mjs`(그 주제만 `MATCH=`)를 돌린다. 새 주제를 더하면 inspect-manual에도 한 묶음(모든 주제를 거쳤나 센다).
  바꿀 수 있는 값(단축키·이월 기간)은 자리표 `{key:…}`·`{lookback}`로만 - 키가 없는 기능은 '단축키 **이름**({key:…})' 꼴(시험이 지킨다).

## 7. V5 시스템 지도 (세션마다 채운다)

기능을 고치기 전에 이 지도로 자리를 찾는다. 세션 끝 정리에서 새 파일·자리를 한 줄씩 더하고, 단계 끝에 다듬는다.

- **도구**: `package.json`(dev 5175·dev:emu·build:emu·preview 4175·test·test:data·lint·emu·seed·check:rules, `allowScripts`) · `vite.config.ts`(base `/`, `__BUILD_ID__` 한국 시각, `__USE_EMULATOR__`) ·
  `vitest.config.ts`(jsdom·vmThreads, `__BUILD_ID__`='test') · `src/test/setup.ts`(jest-dom·fake-indexeddb·cleanup) · `.github/workflows/ci.yml`(lint → test → build - main·`wip/**`·`claude/**`·PR) ·
  `firebase-hosting-merge.yml`(main CI가 통과하면 그 커밋을 schoolplanner-v5에 배포, 비밀값 `FIREBASE_SERVICE_ACCOUNT_SCHOOLPLANNERV3`) · `firebase-hosting-pull-request.yml`(PR 미리 보기 - 로그인 안 됨).
  npm 11은 설치 스크립트를 허락 없이 돌리지 않는다 - 'not yet covered by allowScripts'가 나오면 `npm install-scripts approve|deny <패키지>`(`docs/PLAN.md` 5장).
- **들어가는 곳**: `index.html`(manifest 링크) → `src/main.tsx`(watchSession·리디렉션 로그인 마무리·에뮬레이터 자동 로그인·앱 설치 이벤트) → `src/app/App.tsx`(불러오는 중 `[data-session=loading]` /
  로그인 화면 / 로그인하면 'SP5' `[data-session=signed-in]`, 빌드 번호 `[data-build-id]`). 글자·간격 단계(`@theme`)는 `src/index.css`(V4 앞부분).
- **서버·규칙**: `firebase.json`(에뮬레이터 auth 9099·firestore 8080·ui 4000 · hosting 사이트 `schoolplanner-v5` = https://schoolplanner-v5.web.app, `dist`, 첫 주소·sw·manifest no-cache) · `.firebaserc` · `firestore.rules`(**정본** - V4 규칙 전부 + V5 블록, V4 저장소 것은 복사본) ·
  `tools/check-rules.mjs`(V4 35 + V5 76 - items·labels 모양·V4 그룹 가져오기 갈래 포함) · `tools/live-rules.cjs`(운영 규칙 = 파일인지, 읽기만) · `tools/seed.mjs`(V4 seed 계정의 V5 개인 공간 - 계정이 없으면 만든다) · `tools/inspect-login.mjs`(크롬: 로그인·개인 공간·Firestore IndexedDB 없음).
- **자료 층** `src/data/`: `firebase.ts`(앱 이름 SchoolPlannerV5, memoryLocalCache, googleProvider 범위) · `emulator.ts`(`?as=2|3`) ·
  `session.ts`(로그인 store `useSession` - 구독 하나) · `space.ts`(`personalSpaceId`·`ensurePersonalSpace`) ·
  `settingsSync.ts`(설정 문서 하나 맞추기 `startSettingsSync` - 구독 하나·1초 뒤·받기 전엔 안 올림, `settingsPort` = `spaces/u_{uid}/settings/{common|pc|mobile}`, 적기는 `writeOps`) ·
  `types.ts`(자료 모양 = DESIGN 4장, 컬렉션 표 `SpaceCollections`·`Editable<C>`·`DocPath`) · `id.ts`(`newId` 20자) ·
  `repo/`(저장 도우미 - `ops.ts` 무엇을 적나·되돌리는 쓰기(순수 - 순수 모듈은 `repo/ops`에서 import, `repo/index`는 Firebase째 끌고 온다), `index.ts` `create`·`patch`·`remove`(누가 - 가져오기만)·`restore`·`put`·`purge`·`batch`·`newPath`·`writeOps`, 모두 `Undo`를 돌려준다) ·
  `undo.ts`(`recordUndo` = 안내의 되돌리기 단추 + Ctrl+Z 더미(공간마다 20) - `quiet`면 안내 없이 더미에만, `undoLast` - `main.tsx`가 단축키 'undo'에 잇는다).
  `google/`(구글 API - `token.ts` 조용한 토큰 `getGoogleTokenQuietly`(화면 그리기용)·`getValidGoogleToken(reason)`(누른 일만)·`renewGoogleToken`(지금 계정으로)·`withGoogleToken`(거절되면 잊고 한 번 더)·`googleFetch`·`GoogleApiError` ·
  `prompt.ts` '구글 로그인이 필요합니다' 상태 · `drive.ts` `uploadToDrive`(School_Planner 폴더·공개 읽기)·`attachmentImageSrc`(thumbnail)·`driveUrlToStore`·`uploadFailReason`) ·
  `clipboard.ts`(클립보드 칸 목록·이 기기 휴지통 `useClipboard` - DB `sp5-clipboard-{uid}`, 로그아웃하면 지움, 시스템 클립보드 읽기).
  `mirror/`(기기 사본 - `db.ts` IndexedDB `sp5-mirror-{uid}` 저장소 docs·meta · `codec.ts` Timestamp 지키기 · `store.ts` 화면 store `useMirror`(서버 판 + 내 쓰기 덧칠 `beginLocalWrite`) ·
  `server.ts` Firestore 받는 길(흉내 서버로 시험 - 에뮬레이터 빌드는 읽기 수 `window.__sp5Reads`) · `sync.ts` `startMirror`·`useMirrorSync`(App)·`resetMirror`·`wipeMirror`(로그아웃)·받는 컬렉션 `MIRRORED`·
  처음 받기는 오늘 − 62일부터 먼저 `NEAR_DAYS`(P9-3 - 학년도 첫날부터면 1만 항목에 첫 카드 14초)) ·
  `select.ts`(화면이 고르는 곳 - `itemsOn`(메모는 날짜 링크마다)·`itemsBetween`·`noteDaysBetween`·`allNotes`·`itemsWithLabels`·`itemsOfKind`·`memos`·`trashOf`·`labelsOf` + `use…` 훅·`useDocs`·`useMirrorStatus`,
  라벨: `labelTreeOf`·`useLabelTree`(트리 차례·기본 라벨 `defaultId`)·`itemLabels`·라벨로 보기 `itemsMatching`·붙은 수 `labelUsageOf`·`emptyLabelsOf`·`missingLabelsOf`) ·
  `labels.ts`(라벨 쓰기 - 저장 = 바뀐 칸만 `labelSaveOps`·`createLabelOp`·이름으로 찾기·만들기 `ensureLabelOps`·`defaultLabelOps`·`labelNameProblem`, 적기 `addLabel`·`saveLabels`·`restoreLabels`·`addDefaultLabels`) ·
  `session.ts`의 `currentSpaceId`·`useCurrentSpaceId`(지금 공간 한 곳). 화면 문서 = `Stored<C>`(자리 id가 붙는다 - 저장 도우미는 id를 적지 않는다).
- **기능** `src/features/auth/`: `LoginScreen.tsx`(`[data-login-google]`) · `login.ts`(`useGoogleLogin`·`logout`·`finishRedirectLogin`, 구글 토큰 sessionStorage `sp5-google-token`).
  로그인한 화면은 `[data-session=signed-in][data-user=<메일>]`. `logout`은 기다리던 설정을 먼저 올리고, 나간 뒤 기기 사본·쓰던 글 보관을 지운다.
- **라벨** `src/features/labels/`: `LabelsWindow.tsx`(창 `labels` - ⋮ 일정, `{ tab: 'event'|'note' }`, 고친 것만 들고 사본 위에 얹는다, `[data-labels-window]`·
  `[data-label-tab|row|name|color|prop|parent|up|down|delete|save|add|new-name|new-parent|usage|prune|prune-item|prune-confirm|recover|defaults]`) · `ColorPicker.tsx`(`[data-color-option]`) ·
  `LabelChip.tsx`(`LabelChip`·`LabelChips` `[data-label-chip]`) · `LabelPicker.tsx`(쓰는 칸 - `[data-label-picker|pick|pick-new|pick-new-input|pick-pending|picker-settings]`).
- **환경설정** `src/features/settings/`: `SettingsWindow.tsx`(창 목록 `settings`, 탭 표 `ready` - 보기·알림·학교·단축키·앱(가져오기는 P8-3에서 백업 창으로), `{ tab }`로 열기 - 열린 창도 그 탭으로) · `ViewTab`(누르는 즉시) · `SchoolTab`(이월 기간 `[data-forward-days]` - common.forwardDays) ·
  `ShortcutsTab`(V4 ShortcutModal - 저장·겹침 막기·ESC 때 묻기) · `AppTab`(📱 앱으로 설치·이 기기 사본 `[data-mirror-state|count|reset]`·빌드 번호) · `parts`(Section·ToggleRow·Choices).
  `[data-settings-tab|panel|toggle]`·`[data-choice="이름:값"]`·`[data-shortcut-row|key|save|reset]`·`[data-install-pwa=ready|guide]`.
- **껍데기** `src/app/`: `App.tsx`(로그인 상태 → `Shell`) · `Shell.tsx`(틀: 머리줄·본문·탭바·창·오른쪽 줄 ▶·폭 끌기) · `Header.tsx`(첫 줄 - ⏳·🗑️·🔍·화면 탭·?·⋮·사진 - PC '＋ 새로'는 P10-1에서 뺐다, 휴대폰 둥근 ＋ `[data-new-fab]`만,
  `[data-header-*]`·`[data-scope-tab]`·`[data-more-menu]`·`[data-menu-item]`·`[data-new]`) · `SecondRow.tsx`(토글·◀ 날짜 ▶·📅·학기 칩, `[data-date-prev|next|label]`·`[data-view-toggle]`) ·
  계정 칸(사진 → `[data-account]`·`[data-account-panel]`·`[data-account-name|email]`·`[data-logout]`) · `MobileTabBar.tsx`(`[data-tabbar-tab]`) · `screens.ts`(화면 여섯 = 탭·단축키, 화면은 `features/<화면>/<Name>Screen.tsx` - 하루 말고는 아직 빈 자리 `ui/EmptyScreen` `[data-screen]`) ·
  `route.ts`(주소 ↔ 화면, 순수) · `nav.ts`(화면·날짜·토글 store `useNav` - 'YYYY-MM-DD', `stepDate`·`goToday`·`dateLabel`) ·
  `history.ts`(브라우저 기록 한 곳: 주소 맞물리기 `startRouting` + 창 층 `useModalLayer`·`useBackLayer`·`closeAllLayers`, 뒤로가기 표지판) ·
  `windows.ts`(창 목록 `registerWindow`·`openWindow`·`setWindowParams`(창의 `setParams`)·`closeAllWindows`·`registerUnsavedCheck`) · `windowList.ts`(창 등록 한 곳 - 창을 만드는 세션이 한 줄씩) · `WindowHost.tsx` ·
  `moreMenu.ts`(⋮ 4구역 8항목 표) · `keys.ts`(키 처리 한 곳 `runShortcut`·`setShortcutAction`·`runFromButton`·`useShortcutTitle`, 바꾼 키 `sp5-shortcuts`) ·
  `layoutPrefs.ts`(창 위치·글자 크기·줄 폭 `sp5-layout`) · `prefs.ts`(어느 설정을 어느 문서에 - `DEVICE_PREFS`·`COMMON_SETTINGS`·`useCommonSettings`·`usePrefsSync`·`stopPrefsSync`,
  값은 nav·layoutPrefs·keys store 그대로, 사본 주인 `sp5-settings-owner`) · `install.ts`(sw 등록·설치 이벤트 `installApp`·`useInstall`) · `theme.ts`(화면 밝기 `sp5_theme` - `index.html` 스크립트와 같은 규칙) · `todayScroll.ts` · `useGlobalGestures.ts` · `lazyWithReload.ts` ·
  `toast.ts`(`showToast`·`showErrorToast`·`failWithToast`·`ShownError`·`showToastAfterReload` - 안내 `[data-toast]`). 다크 색표 `src/dark.css` = `node tools/gen-dark-css.mjs`.
  Shell에 하나씩: '구글 로그인이 필요합니다' `features/auth/GoogleLoginPrompt.tsx` · 사진 크게 보기 `ui/ImageViewer.tsx`(`openImageViewer` - `ui/imageViewerStore.ts`, `[data-image-viewer|…-title|…-next|…-prev|…-close|…-original]`, ESC는 사진 창만) ·
  왼쪽 📋 클립보드 칸 `features/clipboard/`(`capture.ts` 열림·폭·모으기 · `paste.ts` 글 쓰던 칸에 · `ClipboardColumn.tsx`).
- **공통 부품** `src/ui/`: `ModalShell.tsx`(창 껍데기, ✕ `[data-close]`) · `PopupFrame.tsx`(오른쪽 칸/배너/가운데 `[data-popup-frame]`) · `SidePanelFrame.tsx`(쓰는 칸 `[data-panel-frame]`) ·
  `sideColumn.ts`(오른쪽 줄·탭 차례 `useSideSlot`·`useDocked`) · `SideTabs.tsx`(`[data-side-tab]`·`[data-side-tab-close]`) · `useSaveKey.ts`(Ctrl+S 받기) · `ColumnResizer.tsx` ·
  `MiniCalendarPicker.tsx`(`[data-date-picker]`·`[data-picker-day]`) · `LinkPreviewCards.tsx`(글 안 주소 카드 `[data-link-preview]`) · 훅 `useMinWidth`·`useIsMobile`·`useMainWidth`·`useVisualViewport`·`useBodyScrollLock`·`useBackdropClose` ·
  `AutoTextarea.tsx`(높이를 다시 잴 때 둘레 스크롤을 지키고 커서 줄을 보이게 - P10-5, 폭이 바뀌어도 다시 재고 테두리까지 더한다 - 10-21 긴 메모 마지막 줄 가려짐) · `containScroll.ts`(옆 칸 위 휠·밀기는 그 칸 안에서만 - 오른쪽 줄 `getSideColumn`·클립보드 칸, P10-5).
  '스크롤로 페이지 이동'(`app/useGlobalGestures`)은 옆 칸(`#side-column`·`[data-clipboard-panel]`) 안의 휠·밀기를 무시한다(P10-5 - 쓰는 칸은 창 층이 아니라 날짜가 넘어갔다).
- **순수 함수** `src/domain/`: `dateUtils.ts` · `order.ts`(차례 값 - 분수 인덱스 `orderBetween`·`ordersBetween`·`compareOrder`(같으면 id로)·다시 세운 줄 `rekeyOrders`(옮긴 것만)) ·
  `labelTree.ts`(V4 트리를 id로 - `parentMapOf`·`orderByTree`·라벨로 보기 `matchLabels`·탐색기식 `clickFilterLabel`·`filterChipOrder`·`otherKey`) ·
  `labels.ts`(색 표 `LABEL_COLORS`·`labelColor`·속성 읽기 `labelProps`·속성 칸 `EVENT_LABEL_PROPS`·기본 라벨 `DEFAULT_LABELS`·`cleanLabelName`) ·
  `entryTable.ts`(붙인 표 - V4 그대로: 붙여넣은 HTML 읽기·행/열·칸 서식) · `attachments.ts`(그림인가·파일 그림·크기·붙여넣은 이름·새 붙임) · `linkPreview.ts`(주소 → 카드) · `masonry.ts`(가장 짧은 열) · `shortcuts.ts`(V4 id + 새 id 다섯, `readShortcutOverrides`·`overridesFromBindings`) · `fontScale.ts` · `typeScale.ts` ·
  `settings.ts`(설정 칸 표 `SettingsSpec` - 기본값·읽기, `readSettings`·`sparseSettings`: 문서에는 기본값과 다른 칸만).
- **그날 메모 칸에 모이는 메모**(P10-4): 순수 `notes/dayNotes.ts`(`dayNoteSources` - 날짜 링크 → 일정 → 교시 → 진도, 겹치지 않게 · `noteFromLabel`) · `day/useDayNotes.ts`(하루 메모 칸·그날 메모 창이 함께) · 카드 `[data-entry-from=event:id|lesson:n|progress:n]`·`[data-entry-link-add]` ·
  진도 창 행 `[data-progress-row-link|progress-row-links]`·진도 줄 `[data-progress-links|progress-link-add]` · `progressDraft.lessonsToSave`(이은 메모는 지금 문서의 그 행 `_from`에서).
- **하루 화면** `src/features/day/`: `DayScreen.tsx`(맨 위 교사 유형 띠, 수업(`lessons/DayLessons` - P6-1)·일정 7:5 - 본문 폭 720px, 아래 기록 칸) · `DayJournal.tsx`(메모 칸 - `▼ 📝 메모 N [+ 추가] 📊 🏷️ … ⚙️`(P10-3), 그 날짜 링크가 있는 메모·즐겨찾기 먼저·본문 폭 2~4열, `[data-day-journal|journal-count|journal-add|journal-filter-toggle|journal-filter|journal-collapse|journal-empty|journal-waiting]`) ·
  `DayEvents.tsx`(일정 칸 - `▼ 📅 일정 N [+ 추가] … ⚙️`, 카드 PC 1열·휴대폰 2열, `[data-day-events|event-card|event-done|event-complete|event-chip|event-alarm|event-links|event-up|event-down|event-edit|event-delete|event-add|event-count]`).
- **일정** `src/features/events/`(하루·주간·월간·년간이 함께 쓴다): `open.ts`(쓰는 칸 `event` = `{ sid, date, id? }`·`openEventPanel`·`useEditingEventIds`·`closeEventPanelsFor`) ·
  `EventPanel.tsx`(일정 칸 - `[data-event-panel=new|edit]`·`[data-event-text-input|event-date|event-date-prev|next|event-move-note|event-due-input|event-alarm-open|event-attr|event-save|event-delete]`) ·
  `eventForm.ts`(순수 - 칸 ↔ 문서, 속성은 라벨과 다른 것만 `propsToStore`, 저장 = 바뀐 칸만 `editChanges`) · `eventOps.ts`(순수 - `reorderOps`·`doneChanges`·`orderAfter`·`itemPath`) ·
  `actions.ts`(`setEventDone`·`moveEventInList`·`createEvent`·`saveEvent`·`setEventAlarm`·`deleteEvent` - 되돌리기까지) · `EventAlarmWindow.tsx`(⏰ 시각 `[data-alarm-window|alarm-time|alarm-save|alarm-off]`) ·
  `EventAlarms.tsx`(Shell에 하나 - 앱 안 알림, 20초마다 사본) · `EventAlarmPopup.tsx`(`[data-alarm-popup|alarm-item|alarm-mute|alarm-unmute(🔔 소리 켜기 - P12-1)|alarm-dismiss]` - 소리 길이 = 계정 `common.alarmSound`(초, 0 한 번·-1 확인할 때까지, `eventAlarm.chimeCount` - P10-1)) · `QuickInputChips.tsx`(`[data-quick-chip]`) · `DueBadge.tsx`(`[data-due-badge]`) ·
  `EventDoneChip.tsx`(완료 칩 한 곳 - 라벨 칩·라벨 없으면 회색 ○, 끝내면 칩 앞 ✓ `[data-event-done-chip=0|1]`(✓를 단 칩)·`[data-event-check]`, 좁은 자리는 `DoneMark` - 하루·주간·작년·월간·그날 목록·년간·학사력·링크 보기, P10-1) ·
  `shortcuts.ts`(`newEvent` = 단축키·휴대폰 둥근 ＋ → 보는 날의 새 일정, `recurring` = 끝 날 줄을 펴고 시작 날 요일을 고른 새 일정 칸, `forwarding` = 오늘로 가서 지난 일정 줄). 순수 셈 `domain/eventDue.ts`·`eventAlarm.ts`(`normalizeTimeInput`·`dueAlarms`)·`quickInput.ts`(V4 테스트째). 소리 `app/sound.ts`. 자동 높이 글 칸 `ui/AutoTextarea.tsx`.
  - **이월(계산 - P3-3)**: `domain/forward.ts`(`forwardOn`·`isCarried`·`carriedOf`(같은 글은 하나 - P12-1)·`staleOf`·`carriedSince`) · `events/forward.ts`(`useCarried` = 오늘로 따라오는 일정·지난 일정, `usePastRow`·`staleCountNow`) · `ForwardMarks.tsx`(Shell - 처음 따라올 때 carrying 한 번, live에서만) ·
    `eventOps.carriedDoneChanges`(오늘 칸에서 끝내면 오늘로) · 하루 `DayEvents`(오늘 것 아래 `[data-event-carried|event-since]`, 지난 날 `[data-event-away|event-to-today]`) · `day/DayPastEvents.tsx`('📥 지난 일정 N개' `[data-past-*]`) · `ui/useToday.ts`(자정에 바뀌는 오늘).
  - **기간·반복·묶음(P3-3)**: `domain/period.ts`(보이는 날·'(k/n)'·doneDates·skipDates·끝 날 당기기 - 공휴일은 `HolidayCheck`로 P5-3) · `domain/recur.ts`(규칙·날짜·이름) · `events/seriesOps.ts`(순수 - 만들기·묶음 고치기·지우기)·`series.ts`(`useSeriesOf`) ·
    일정 칸 '📆 끝 날 · 🔁 반복' 줄 하나 `[data-event-period-*|event-end|event-workdays|event-end-clear]` 안에 `RecurRow.tsx`(새 일정만 - 요일 칩 `[data-recur-day]`·▸ 더 보기 `[data-recur-more|recur-kind]`, `[data-event-recur-row=none|weekly|…]` - 요일을 안 고르면 기간, 고르면 그 요일만 반복, 끝나는 날 = 끝 날 칸, 셈 `domain/recur` `toggleWeekday`·`toggleKind` - P10-1)·`[data-event-series-info]` · `EventScopeWindow.tsx`(세 갈래 창 `[data-scope-window|scope-choice]`)·`EventDeleteChooser.tsx` · 카드 '(k/n)' `[data-event-period]`·🔁 `[data-event-series]`.
  - **여러 개 고르기(P3-3)**: `events/multi.ts`(store `useMulti` - id + 그 날)·`multiOps.ts`(순수 - 한 일정 여러 날은 한 문서에 접는다)·`MultiSelectBar.tsx`(Shell - `[data-multi-*]`, ⋮ `multiSelect`·ESC) · 카드 `[data-event-picked]`·Ctrl·Shift·길게 누르기 · ESC에 함께 할 일 `app/keys.addEscapeAction`.
- **월간** `src/features/month/`(P5-2): `MonthScreen.tsx`(휴대폰은 날짜 → 그날 목록) · `MonthGrid.tsx`(한 주 한 줄 subgrid `[data-month-week|month-day|month-event|month-event-chip|month-add|month-notes]`) · `PeriodBar.tsx`(`[data-period-bar|period-cell]`) ·
  `MonthDaySheet.tsx`(`[data-month-day-sheet]`) · `calendarEvents.ts`('달력' 속성 일정만 - 년간도 쓴다). 순수 `domain/periodBars.ts`(`layoutWeekBars`·`periodsInDates`) · `dateUtils.monthGridDates`.
- **년간** `src/features/year/`(P5-2): `YearScreen.tsx`(📅 학사력 / 📋 자세히 `[data-year-view]` - `prefs.ts` `sp5-year-view` 이 기기, 세 달씩 그리기) · `YearSheetMonth.tsx`(`[data-sheet-month|sheet-date|sheet-bar|sheet-item]`) ·
  `YearMonthCard.tsx`(`[data-year-month|year-day|year-event|year-period|year-add|year-notes]`) · 순수 `domain/yearSheet.ts`(`academicMonths`·`monthWeeks`·`monthSheetItems`). 점검 `tools/inspect-month-year.mjs`(60).
- **끌어 옮기기·D-Day·공휴일**(P5-3): `features/events/drag.ts`(`useEventDrop`·`eventDragProps`·`dropTargetProps` - 주간 카드·월간 칸·년간 자세히 날 줄)·`moveOps.ts`(순수)·`EventMoveChooser.tsx`·`actions.moveEventTo` ·
  `features/dday/`(`DDayWindow` 창 `dday`·`actions` - `settings/common.ddays·ddayPick`, 순수 `domain/dday.ts`) · 머리줄 `[data-header-dday-text]`·둘째 줄 `[data-date-dday]` ·
  공휴일 `data/holidays.ts`(`holidays/{연도}`·이 기기 `sp5-holidays`·`useHolidayName`·`startHolidays` = `domain/period.setDefaultHolidayCheck`)·`domain/holidays.ts`(개인 → 공유 → 고정)·`ui/HolidayName.tsx`. 점검 `tools/inspect-move-dday.mjs`(41) · 관리자 쓰기 `probe.emulatorAdmin`.
- **검색·휴지통**(P5-4): `features/search/SearchWindow.tsx`(창 `search` - 치는 대로 `[data-search-*]`)·`focus.ts`(짚기 `requestFocus`·`useSearchFocusRunner`(Shell)·`useFocusReveal`(칸이 편다), `.search-focus`) · 순수 `domain/search.ts` ·
  `features/trash/`(`TrashWindow` 창 `trash` `[data-trash-*]`·`trashList.ts`(순수)·`actions.ts`(복원·영구 삭제·드라이브 정리)·`auto.ts`(`useTrashAutoEmpty` - Shell)) · `settings/common.trashDays`. 점검 `tools/inspect-search-trash.mjs`(43).
- **수업**(P6-1 - 계산, DESIGN 5-2): 순수 `domain/lessons.ts`(`lessonsOn`(lessonDays → 수업 없는 날 → 늦게 시작한 시간표)·`timetableOn`·`classOffReason`·`eventSkipsClass`·`subjectsBetween`·비고(준비물) `lessonNote`(supplies + 옛 memo - 수업 칸 `note`)·`firstLine` - P10-2) ·
  `domain/teachingSlot`('5-2 과학' 읽기·반 색·지난 시간·가르치는 반)·`teachingMode`(교사 유형 셋)·`periodTimes`(교시 `PeriodDef`·지금 몇 교시·빠르게 채우기)·`gridNav`(표 칸·엑셀 붙여넣기)·`hangul`(초성)·`semester`(학년도마다 방학 `readTerms`·`isVacation`·`termSemesters`) ·
  설정 `common.teaching`(null = 안 고름)·`periods`·`terms`(app/prefs, 받았나 `useCommonLoaded`) · 사본 `MIRRORED` += timetables·lessonDays · 저장 도우미 `merge`(날짜 문서 - 없으면 만든다) ·
  `features/lessons/`(`useLessons`(`useLessonSource`·`useLessonsOn`·`useLessonsFor`) · `teaching.ts`(`useTeaching`·`updateTeaching`·`useTeachingClasses`·`useSlotPairOptions`·`useClassColorOf`) · `lessonOps`(순수 - 시간표와 같은 과목은 빼기·비우기·맞바꾸기)·`actions`(`saveLesson`·`clearLesson`·`swapLessons`) ·
  `DayLessons`(하루 칸 `[data-day-lessons|lesson-card|lesson-id|lesson-subject|lesson-changed|lesson-note|lessons-off|now-line|lesson-up|down|link|links|edit|prev|lesson-editor|lesson-subject-input|lesson-note-input|lesson-editor-tool=eval|attendance|seating|drawStudent|lesson-save|close|lessons-settings]` - 반 도구 `[data-class-tools|class-tool-btn]`는 hover, P10-2) ·
  `LessonPanel`(쓰는 칸 `lesson` `{ sid, date, n }` `[data-lesson-panel|lesson-panel-subject|lesson-panel-note|lesson-panel-*]`)·`open.ts` · `WeekLessonRows`(`[data-week-lessons|week-lesson|week-lesson-note|week-lesson-changed]`) · `CalendarLessons`(월간·년간 수업 칩 - `LessonStrip` PC·`LessonWraps` 휴대폰 그날 목록·`LessonGrid` 휴대폰 월간 칸(P12-1) `[data-month-lessons|month-lesson|year-lessons|year-lesson|sheet-lessons|sheet-lesson]`, P9-3)·`lessonSubjects`(순수 - 'X' = 수업 없음) · `TeachingBanner`(`[data-teacher-mode-banner|banner-preset|banner-later]`) · `SlotCombobox`(▼ `[data-combobox-list|combobox-option]`)·`SlotPairInput`(`[data-slot-pair|slot-class-input|slot-subject-input]`)·`slotPair`) ·
  시간표 창 `features/timetable/`(`TimetableWindow` 창 `timetable` `{ tab }` `[data-timetable-window|timetable-tab|timetable-save|timetable-dirty]` · `GridTab`(`[data-timetable-pick|add|name|from|to|quick|delete]`·`input[data-cell="행-열"]`) · `PeriodsTab`(`[data-period-name|start|end|period-fill-run]`) · `TermsTab`(`[data-terms="summer-from"…]`) · `TeachingTab`(`[data-teacher-preset|teaching-*|class-color|homeroom-*]`) · `timetableDraft`(순수) · `shortcuts`(`teachingMode`)).
  새 학년도 준비(P9-2): 순수 `domain/newYear.ts`(2/15~3/31 `newYearTarget`·할 것 `newYearState`·`parseRosterPaste`·`copiedTimetable`) · `features/newYear/`(`useNewYear`·`NewYearBanner`(Shell `[data-new-year-banner|new-year-open|new-year-dismiss]`) ·
  `NewYearWindow` 창 `newYear` `{ year }` `[data-new-year-window|new-year-step=classes|timetable|terms|teaching(data-done)|new-year-grade|num|names|create-class|copy-timetable|open-terms|set-homeroom|done]`) · 계정 `common.newYearDone` ·
  시간표 창 `{ tab, pick, termsYear }`·머리줄 `[data-timetable-new-year]`. 점검 `tools/inspect-new-year.mjs`(32 - 시계 2027-02-20). seed는 `newYearDone: 9999`(띠가 다른 점검을 밀지 않게).
  `ui/useClock.ts`(분 단위 '지금') · `ui/listKeys.ts`(▼ 목록 키). 점검 `tools/inspect-lessons.mjs`(98 - teacher·teacher3). seed는 계정마다 교사 유형을 심는다(띠가 다른 점검을 밀지 않게).
  수업 셈 나눠 쓰기: `useLessons`는 같은 재료면 같은 `LessonSource`(공간마다) - 그 위의 `cachedSubjects(src, from, to)`·`offDayOf(src)`를 진도·지난 시간이 함께 쓴다.
- **진도**(P6-2 - 개인 공간 `progress/{planId}`): 순수 `domain/progress.ts`(V4 lib째 - `computeProgress`·`progressMarks`(slotId '날짜#교시' → 진도)·`progressUntil`·`courseStatus`·`toggleBump`·`sanitizePlan`·표/CSV 읽기)·`csv.ts`·`progressSample.ts` ·
  `features/progress/`(`useProgress`(`useProgressPlans`·`useProgressMarks(보는 날)` - 개인 공간을 볼 때만) · `actions`(`saveProgressPlan` 바뀐 칸만·bumps는 빼고 · `setProgressBump` · `deleteProgressPlan` 휴지통) · `progressDraft`(순수) · `open.ts`(`openProgress` - 창 `progress` `{ planId?, cls?, preset?, course?, at }`) · `shortcuts`(`newCourse`) ·
  `ProgressWindow`(`[data-progress-window|plan|new|key|key-option|subject|start|start-quick|sample|csv-open|csv-input|paste|table|row|row-delete|add-row|preview|summary|rows|save|delete]`·`[data-course-form|subject|class-toggle|hint|status|status-row|behind|bump|preview]`·`[data-slot|slot-bump]`) ·
  `ProgressMarkLine`(`[data-progress-mark=k|bumped|progress-mark-open|progress-page|progress-supplies|progress-bump=bump|undo]`, `ProgressCreateButton` `[data-progress-create]`)) · 주간 배지 `[data-week-progress]` · 시간표 창 `[data-timetable-progress]` · `ui/download.ts`(`downloadCsv`). 점검 `tools/inspect-progress.mjs`(66).
- **수업 종·주간학습안내·인쇄**(P6-3): 순수 `domain/classBell.ts`·`weeklyGuide.ts`(`guideDaysOf` = 계산한 수업 칸) · 설정 `common.classBell` · `features/bell/`(`bell.ts` `useClassBell`·`saveClassBell`·`useBellMutedHere`(이 기기 `sp5-class-bell-muted`)·`useClassBellRunner`(Shell) · `BellSettings`) ·
  하루 머리줄 `[data-day-bell|day-bell-panel|day-bell-close]`·`[data-class-bell|bell-enabled|bell-on|bell-amount|bell-unit|bell-when|bell-weekdays|bell-here|bell-preview]` · 창 `weeklyGuide` `{ date? }`(`features/weeklyGuide/WeeklyGuideWindow` `[data-weekly-guide-window|guide-range|guide-prev|next|this|coming|guide-copy|guide-print|guide-title|guide-opt|guide-note-input|weekly-guide|guide-heading|guide-note|guide-row|guide-cell]`, 주간 `[data-week-guide]`(담임)) ·
  인쇄 `ui/print.ts`(`printNode`·`preparePrint`·`#sp5-print-root` + index.css @media print, `data-print-hide`는 빼고 찍는다) · `app/printScreen.ts`(`usePrintTarget`(주간 이번 주·년간 학사력)·`printScreen`·`usePrintShortcut` = ⋮ 'print'·Ctrl+P). 점검 `tools/inspect-bell-guide.mjs`(48).
- **우리 학교(나이스)**(P6-3): `data/neis.ts`(학교 찾기·달마다 급식·학사일정 - 키 없이 5건씩 나눠 받기·6시간 담아 두기, `setNeisKeySource`) · `data/neisKey.ts`(`installNeisKey` - sharedConfig/neis 읽기만) · 순수 `domain/schoolSetting.ts` · 설정 `common.school` ·
  `features/school/`(`school.ts` `useSchool`·`saveSchool`·`saveSchoolGrade`·`useSchoolSchedule(달들)`·`useDayMeals` · `SchoolPicker`(환경설정 '학교' 탭 `[data-school-setting|school-name|school-change|school-clear|school-grade|school-query|school-search|school-results|school-result]`) ·
  `DayMeals`(`[data-day-meals|day-meal|day-school-events|day-school-event-open]`) · `SchoolEventName`(`[data-school-event=날짜]` - 주간 카드·월간 칸·월간 휴대폰 목록·년간 자세히, 학사력은 `monthSheetItems.schoolOf`) · 창 `schoolEvent` `{ date, items }`(`SchoolEventWindow` `[data-school-event-window|school-event-item|school-event-dday|school-event-to-event]`)) ·
  시간표 창 학기·방학 `[data-terms-fill|terms-fill-note]`. 점검 `tools/inspect-neis.mjs`(36 - 나이스는 page.route 흉내).
- **학급·명렬표**(P7-1 - 개인 공간 `classes/{학년도-학년-반}`, 학생 sid): 순수 `domain/roster.ts`(`classIdOf`·고르기 세 칸·`nextClassNum`·`addStudents`·CSV 학급 하나/전체·`withSids`·`cleanStudent`) · 사본 `MIRRORED` += classes(휴지통 '기타'의 학급) ·
  `features/class/`(`classes.ts` `useClasses`·`saveRoster`(바뀐 학급만·학년도/학년/반을 고치면 새 id)·고른 학급 `useHubClass`(`sp5-class-hub`) · `rosterDraft.ts`(저장 전까지 이 탭에) · `view.ts`(학급 도구 | 명렬표·탭, 단축키 '명렬표') · `tools.ts`(도구 카드 `CLASS_TOOLS`) ·
  `ClassScreen.tsx`(`[data-class-mode|class-empty|class-students|class-student|class-view=name|photo|class-photo-grid|class-photo-card|class-photo-count]`) ·
  `RosterView.tsx`(`[data-roster|roster-pick|roster-edit|roster-tab|roster-row|student-field|roster-remove|roster-save|roster-dirty|roster-discard|roster-photos|roster-view=list|tile|roster-tiles|roster-tile|roster-drop|roster-photo-count|roster-photo-folder|roster-csv-*|roster-all-csv-*|search-*]`)) ·
  가르치는 반에 명렬표의 반(`lessons/teaching.useTeachingClasses`). 점검 `tools/inspect-class.mjs`(34).
- **학생 사진**(P7-1 ■3 - 드라이브 School_Planner/Students_Poto/2026-5-2, V4 그대로): 순수 `domain/studentPhotoNames`(`photoClassKey`·`classFolderName`·짝짓기)·`photoBulkUpload`·`photoDiagnosis` · `ui/imageShrink` ·
  `data/google/studentPhotos.ts`(훑기·내려받기 blob·담아 두기 IndexedDB `sp5-student-photos`·올리기(같은 학생은 갈아끼우기)·`wipePhotoCache` - 로그아웃)·`picker.ts`(드라이브 선택창) · 설정 `common.photoFolders`(학급마다 고른 폴더) ·
  `features/photos/`(`useStudentPhotos`(켤 때만 드라이브, 토큰이 없으면 'needs-auth') · `usePhotoTools`(누르는 일 한 곳·크게 보기 아래 바꾸기 `PhotoReplaceButtons`) · `PhotoParts`(`[data-photo-bulk-group|photo-bulk-input|photo-bulk-device|photo-drive-many|photo-bulk-progress|photo-bulk-report|photo-needs-auth|photo-auth|photo-error|photo-loading]`) ·
  `StudentPhoto`(`[data-photo=이름|photo-empty|photo-file-input|photo-drive-pick]`) · `PhotoStatusBar`(`[data-photo-status]`) · `drivePhotoPick`) · 켬/끔은 이 기기 `sp5-roster-photos`·`sp5-class-photos`. 점검 `tools/inspect-photos.mjs`(56 - 드라이브 흉내, 암기 포함).
- **이름 암기**(P7-5 - 개인 공간 `quiz/{classId}` `records.{sid}`): 순수 `domain/photoQuiz.ts`(열쇠 '{classId}/{sid}' `buildRound`·`extendDeck`·`applyAnswer`·`undoAnswer`·`sanitizeQuizSettings`) · 사본 `MIRRORED` += quiz ·
  `features/quiz/`(`quizData`(`useQuizRecords`·`saveQuizRecords` - 학급마다 merge) · `usePhotoQuiz`(판·O/X 모았다 1.5초 뒤 한 번에, `quizStudentsOf`)) · 명렬표 '암기' 탭 `features/class/MemorizeTab.tsx`(설정 이 기기 `sp5-photo-quiz`, 키 `ui/listKeys.quizKeyOf`,
  `[data-roster-memorize|memorize-photos-off|memorize-photos-on|quiz-*]`).
- **학생 태그**(P7-1 - 기록·메모 `studentIds` `'{classId}/{sid}'`): 순수 `domain/studentTag.ts`(V4 '#26040305' 읽기 `findStudentTags`·`studentIdsToSave`(새로 적은 태그만)·'@이름' `findMention`·`matchMentionStudents`·`applyMention`) ·
  `notes/StudentTags.tsx`(`StudentMentionList` `[data-student-mention|mention-option]` · `StudentTagRow` `[data-note-students|note-student|note-student-remove|note-student-pick-open|note-student-picker|note-student-class|note-student-option]` · 카드 `EntryStudents` `[data-entry-students]`) · 쓰는 칸 키는 `ui/listKeys`.
- **출석부·알림장·교과 출결**(P7-2 - 학생 sid): 순수 `domain/attendance.ts`(`marksChanges` 바뀐 학생 칸만·`dayLines`·`summaryRangeOf`)·`notices.ts`(다음 수업일·초안·급식 줄)·`subjectAttendance.ts`(`subjectCellChanges` 학생 한 칸)·`dayCards.ts`(기록 칸 카드 계산) · `ui/shareText.ts`(공유·복사) ·
  사본 `MIRRORED` += attendance·notices·subjectAttendance · `features/attendance/`(`AttendancePanel` 쓰는 칸 `attendance` `{ date, classId?, tab? }` - 2.5초 뒤 저절로·고친 것은 학급·날짜와 함께(다른 날로 가면 그 날에) `[data-attendance-panel|tab|class|row|kind|reason|period|note|count|all-present|prev|next|save|dirty|range|summary-row|history|print]`·`attendanceClass`(고를 학급)·`actions`·`open`(단축키)) ·
  `features/notices/`(`NoticePanel` 쓰는 칸 `notices` `{ sid?, date, tab? }` 공간마다 `[data-notice-panel|tab|text|draft|meal|preview|copy|share|save|dirty|range|day|open|count]`) ·
  `features/subjectAttendance/`(`SubjectAttendancePanel` 쓰는 칸 `subjectAttendanceCell` `{ classId, date, n }` `[data-subject-att-panel|row|kind|reason|note|open-summary]` · `SubjectAttendanceWindow` 누계 창 `subjectAttendance` `[data-subject-summary|summary-class|summary-range|summary-row|summary-history|summary-csv]`) ·
  하루 수업 머리줄 📋·📢(담임) · 교과 모드 교시 카드 🙋 `[data-subject-attendance=n]` · 기록 칸 맨 위 카드 `features/day/useDayCards.ts`·`DayCards.tsx`(`[data-day-card|day-card-key]` - 그날 기록 창·검색 '기록'에도) · 학급 화면 📋 오늘 출결 줄 `[data-class-today]` · 주간학습안내 '알림장' 줄. 점검 `tools/inspect-attendance.mjs`(81).
- **자리표·뽑기·모둠**(P7-3 - 개인 공간 `seating/{id}`·`classHub/{classId}`, 학생 sid): 순수 `domain/seating.ts`(섞기 `shuffleSeats`·`numberOrderSeats`·`pairKey` 'a|b'·`nearApartSeats`·`displayOrder`)·`draw.ts`(`pickNext`·`afterPick`·`drawStatusLine`)·`groups.ts`(`randomGroups`·`seatGroups`·`moveMember`·`swapMembers`·`evalGroupsFrom`)·`observationPhrases.ts` ·
  사본 `MIRRORED` += seating·classHub(휴지통 '자리표' - `trash/useTrashDocs`) · 설정 `common.phrases` · `features/seating/`(`seatingData`(읽기·쓰기 한 곳) · `SeatingWindow` 창 `seating` `{ classId?, draw?, at? }`(`[data-seating-window|seating-class|seating-tab|seating-new|seating-create|seating-empty|seating-tool=shuffle|edit|shape|apart|groups|draw|seating-grid|seat|seat-sid|seat-locked|seat-warn|seat-att|seat-drawn|seat-drawn-now|seat-group|seat-action|unseated|unseated-sid|shuffle-opt]`) ·
  `SeatShapeBox`(`[data-seating-box=shape|seating-name|seating-size|seating-size-up|down|seating-group-cols|seating-front|seating-number-order|seating-delete]`) · `SeatApartBox`(`[data-apart|apart-a|apart-b|apart-add|apart-remove]`) ·
  `SeatStudentCard`(`[data-seat-student|seat-att-kind|reason|period|note|seat-observe-input|seat-observe-save|seat-student-lines|seat-student-close]`)·`observation.ts`·`ObservationPhrases`(`[data-observation-phrase|phrase-remove|phrase-input|phrase-add|phrases-edit]`) ·
  `useStudentDraw`·`SeatDrawBox`(`[data-seating-box=draw|draw-pick|draw-result|draw-undo|draw-new-round|draw-big-open|draw-picked]`)·`DrawBigView`(`[data-draw-big|draw-big-name|draw-big-pick|draw-big-close]`) · `SeatGroupsBox`(`[data-seating-box=groups|group-*]`) · `open.ts`(`openSeating`·단축키 '자리표'·'발표자 뽑기 (자리표)')) ·
  하루 수업 머리줄 `[data-lessons-tool=drawStudent]`(담임) · 교과 교시 카드 `[data-class-tools|class-tool-btn]`. 점검 `tools/inspect-seating.mjs`(69).
- **조사표**(P7-4 - 공간마다 `evaluations/{id}`, 한 장 = 문서 하나, 학생 sid): 순수 `domain/evaluation.ts`(`syncEvalStudents`·`evalValuesChanges` 학생 칸만·`studentEvalCell`·`filterEvals`·`semesterOf`·`overviewCsvRows`·`stepCounts`·과정별 `groupCourseEvals`) · 사본 `MIRRORED` += evaluations(휴지통 '조사표') ·
  `features/evaluations/`(`evalData`(`useEvaluations`·`useEvalsOn`·`useEvalCountsByDate`·`useSpacesEvals`·`createEvaluations`·`saveEvalValues`·`saveEvalStudentValue`·`saveEvalMeta`·`syncEvalRoster`·`deleteEvaluation`) ·
  `EvaluationWindow` 창 `evaluation` `{ sid, date, place?, slot?, evalId? }`(`[data-eval-window="날짜|자리"|eval-mode|eval-new|eval-list-open|eval-item|eval-view|eval-heading|eval-info|eval-print|eval-save|eval-dirty|eval-delete]`) ·
  `EvalCreateForm`(`[data-eval-create|eval-class|eval-title|eval-type|eval-subject|eval-date|eval-place|eval-indiv|eval-group|eval-step-count|eval-step|eval-group-set|eval-group-preview|eval-group-count|course-evals|eval-create-submit]`)·`useCourseTargets` ·
  `EvalMetaBox`(`[data-eval-meta|eval-meta-*]`) · `EvalTable`(`[data-eval-table|eval-row|eval-all|eval-all-indiv|eval-all-group|eval-all-check|eval-indiv-score|eval-group-score|eval-group-name|eval-check|eval-text]`) · `EvalCountBadge`(`[data-week-evals|month-evals|year-evals]`) ·
  `EvalOverviewWindow` 창 `evalOverview`(`[data-eval-overview-window|eval-overview-class|subject|semester|type|count|copy|csv|print|eval-col|eval-cell|eval-steps|eval-overview-tab]`)·`CourseEvalOverview`(`[data-course-overview|course-cell]`) · `open.ts`) ·
  하루 수업 칸 `[data-lesson-evals=n][data-eval-count]`·'N교시 수정' `[data-lesson-panel-evals]`·기록 칸 `[data-journal-evals]`·교과 반 도구 `[data-class-tool-btn=eval]`·자리표 학생 칸 `[data-seat-eval|seat-eval-indiv|group|check|text]`·검색 '조사표'. 점검 `tools/inspect-evaluations.mjs`(38).
- **학생 기록(누가기록)**(P7-4): 순수 `domain/studentRecord.ts`(`noteTimeline`·`attendanceTimeline`·`sortTimeline`·`recordCopyText`) · `features/studentRecord/`(`StudentRecordWindow` 창 `studentRecord` `{ classId?, sid?, at? }`
  `[data-student-record|student-record-class|tag|tag-find|pick|student-card|student-counts|student-record-copy|student-observe|student-observe-input|student-record-tab|student-timeline|student-timeline-item|timeline-kind|student-evals|student-eval|student-eval-value]` · `open.ts` `openStudentRecord`) ·
  학급 화면 학생 이름·도구 카드·자리표 학생 칸 '🧑‍🎓 누가기록'. 점검 `tools/inspect-student-record.mjs`(29).
- **구글 캘린더**(P8-1 - V4와 같은 캘린더 SP(work)·표시 app=SchoolPlannerV3·sp_id, V5는 `sp_item`·`sp_auto`를 더 단다): 순수 `domain/gcal.ts`(글·짝 V4 그대로 + `gcalOn`·`itemPayloads`(보이는 날마다·기간 (k/n)·이월 = 오늘)·`planItemSync`·손으로 `manualPayloads`·`planManualSync`) ·
  저장 도우미 `observeWrites`(쓰기 전·뒤 - 그 항목이 '구글 캘린더'였나) · `data/gcalQueue.ts`(큐 `gcalQueue/{itemId}` 바로 구독·쓰기 - 사본에 넣지 않는다) · `data/google/calendar.ts`(캘린더 찾기·만들기·목록·넣기·고치기·지우기) ·
  `features/gcal/`(`auto.ts` `useGcalAuto`(Shell - 쓰기 → 1.2초 → 큐 → 보내기, 이월은 이 기기 하루 한 번 `sp5-gcal-carried`, 라벨 끄면 보낸 것 맞춤)·`ensureGcalLogin`(일정 칸 저장 뒤)·`sendGcalNow` · 머리줄 `GcalPendingButton` `[data-gcal-pending=N]` ·
  `CalendarSyncSection`(백업 창 '보내기' 탭 - 단축키 '구글 캘린더로 보내기'가 그 탭을 연다 `[data-calendar-sync-window|cal-*]`)·`manual.ts`(창 밖에서 `useCalendarSync`·`rangeForScope`)). 점검 `tools/inspect-gcal.mjs`(35 - 캘린더 API 흉내). `select.docsNow`(훅 아닌 곳의 사본 읽기).
- **서버 푸시 알림**(P8-2): 함수 `functions/`(codebase `v5`, Node 22, 서울 - `index.js` `v5AlarmIndex`(items 쓰기 → `v5alarms/{itemId}`)·`v5SendDueAlarms`(매분)·`v5CleanupAlarms`, 순수 `alarmPlan.js` + `node --test` = `npm run test:functions`, `firebase.json` functions) ·
  `data/push.ts`(이 기기 FCM 토큰 `spaces/u_{uid}/pushTokens/{해시}` - `enablePush`·`disablePush`·`refreshPushToken`·`forgetPushOnLogout`, 이 기기 `sp5-push` · 알림 소리 길이를 서비스 워커에 `shareAlarmSound` = 캐시 `sp5-prefs` - P12-1) · 환경설정 '알림' 탭 `settings/NotifyTab.tsx`(알림 소리 `[data-choice=alarmSound:…]` · `[data-push-alarm|push-state|push-on|push-off]`) ·
  `public/sw.js` push(보는 창이면 'sp5-event-alarm' 메시지, 아니면 OS 알림 - 알림 소리 길이만큼 3초마다 다시·최대 2분 `alarmRepeatTimes`, P12-1)·notificationclick · `EventAlarms`가 그 메시지로 울린다. 점검 `tools/inspect-push.mjs`(13 - CDP `ServiceWorker.deliverPushMessage`).
- **메모로 Claude 요청**(P13 - `docs/CLAUDE-REQUEST.md`): 함수 `v5ClaudeRequest`(items 쓰기 → 🤖 요청(`claudeAskAt`이 바뀐 - `askedNow`) 'Claude요청' 라벨 개인 공간 메모 → 정한 메일만 → 줄 `queued`)·`dispatchNext`(트랜잭션 - 도는 것이 없을 때 하나만 GitHub 이슈, 비밀값 `CLAUDE_GITHUB_TOKEN`)·
  `checkClaudeRequests`(`v5SendDueAlarms` 안 - 이슈 라벨·배포 실행을 읽어 상태 → `ensureClaudeLabels` 한 시간에 한 번(`v5claudeMeta/labels`, 라벨 `system: 'claudeRequest'` - 라벨 관리 `[data-label-locked]`) → 다음 보내기), 순수 `functions/claudePlan.js`, 함수 칸 `v5claude/{itemId}` · 앱 `spaces/{sid}/claudeRequests/{itemId}`(`data/claudeRequests` Shell·store `claudeRequestStore`·`domain/claudeRequest`·카드 `notes/ClaudeRequestBadge` `[data-entry-claude=상태]`·결과 글 `notes/ClaudeRequestNote` `[data-entry-claude-note=상태]`(카드 세 줄·수정 칸·목록 펼친 줄, `claudeNoteText` - 10-19)·단추 `notes/ClaudeAskButton` `[data-note-claude-ask|note-claude-asked]`(메모 수정 칸 아래 - 잠긴 라벨이 저장된 메모만, 진행 표시는 카드·목록 줄에도) → `notes/actions.askClaude`) ·
  워크플로 `.github/workflows/claude-request.yml`(라벨 claude-request → Claude(`CLAUDE_CODE_OAUTH_TOKEN`) → 확인 → PR·합침(`CLAUDE_REQUEST_GITHUB_TOKEN` - 그래야 main CI·배포가 돈다) → 라벨 claude-merged|nochange|failed). 점검 `tools/inspect-claude-request.mjs`(31 - 카드 표시·결과 글·🔒 라벨·수정 칸 🤖 요청).
  **함수를 손으로 돌려 보기**: `FIRESTORE_EMULATOR_HOST`·`FIREBASE_AUTH_EMULATOR_HOST`·`CLAUDE_OWNER_EMAILS`·`CLAUDE_GITHUB_TOKEN`을 env로, `globalThis.fetch`를 가짜 GitHub로 두고 `functions/index.js`를 import → `v5ClaudeRequest.run(event)`·`v5SendDueAlarms.run({})`(P13 ■3 - 함수 에뮬레이터 없이).
- **백업 · 가져오기 · 보내기**(P8-3 - 창 `backup` `{ tab: backup|import|send|tidy }` = ⋮ 자료, `features/backup/`): `BackupWindow`(`[data-backup-window=탭|backup-tab-btn|backup-panel]`) · `open.ts`(`openBackup`)·`shortcuts.ts`(calendar → '보내기') ·
  '백업' `BackupTab`(JSON = 순수 `domain/backup.ts` + `data/backup.ts` 서버 읽기·되살리기 없거나 지운 것만, CSV = V4 모양 `[data-backup-*|restore-*]`) · `AutoBackupSection`·`auto.ts`(드라이브 자동 백업 `useAutoBackupRunner` - PC·토큰 있을 때만, `common.autoBackup`·`settings/backupLog` `data/backupLog.ts`, `data/google/driveBackup.ts`, 순수 `domain/autoBackup.ts`)·`AutoBackupBanner`(Shell) ·
  '가져오기' `V4ImportSection` + `KeepImportSection`·`keep.ts`(순수 `domain/keepImport.ts`, 백업 탭에 넣은 Keep 파일은 `useKeepInbox`로) · '보내기' `gcal/CalendarSyncSection` + `SheetsSection`·`sheets.ts`(V5 시트 파일 `settings/sheets`, 순수 `domain/sheets.ts`, `data/google/sheets.ts`, 명렬표 '📊 시트' `class/rosterSheet.ts`) ·
  '정리' `CollectSection`·`collect.ts`(첨부 모으기 - 순수 `domain/attachCollect.ts`, Storage 원본은 지우지 않는다). 점검 `inspect-backup`(42)·`inspect-keep`(29 - 첨부 모으기 포함)·`inspect-sheets`(31).
- **공유 그룹**(P8-4 ■1 - `spaces/g_…` members 맵·초대 코드 `spaceInvites/{code}`·구성원 이름 `people/{uid}`): `data/spaceChoice.ts`(store `useMySpaces`·이 기기에서 고른 공간 `useSpaceChoice` `sp5-space`·`chooseSpace`·`rememberGroups`·초대 코드 셈) ·
  `data/spaces.ts`(`watchMySpaces`·`useMySpacesWatch`(App)·`createGroup`·`joinGroup`·`leaveGroup`·`deleteGroup`·`readPeople`) · `session.currentSpaceId`가 고른 공간 · 기기 사본 `Engine.setSpaces`·`GROUP_MIRRORED` ·
  머리줄 📂 `SpaceSelect`(`[data-space-select=sid|space-list|space-option|space-manage]`) · 계정 칸 `[data-account-groups]` · 창 `group`(`features/groups/GroupsWindow` `[data-groups-window|group-row|group-*]`). 점검 `tools/inspect-share-groups.mjs`(27 - 두 계정).
  **V4 그룹 가져오기**(■2): 공간 `g_{V4 그룹 id}` - `spaces.ensureImportedGroup`(V4 주인·구성원 그대로 만들기 → 안 되면 V4 구성원으로 참여·빈 `people`은 V4 이름)·`openInvite`(그룹장 '🔑 초대 코드 만들기' `[data-group-make-code]`) ·
  창 칸 `features/groups/V4GroupsSection.tsx`(`[data-v4-groups|v4-group=V4 id|v4-group-state=new|imported|v4-group-import|v4-group-progress|v4-group-result|v4-groups-empty]`) · 결과 표 `features/import/ImportResult.tsx`(백업 탭과 함께) · 규칙 `isV4GroupMember`. 점검 `tools/inspect-import-groups.mjs`(33 - 세 계정, V4 그룹을 심고 끝에 지운다).
- **링크** `src/features/links/`(P4-3 - 양쪽 `linkIds` 한 묶음): `linkOps.ts`(순수 잇기·끊기·수업 링크 id · `LinkKind` event·note(P10-4) · 진도 차시 `progress:{planId}:{행}` `progressEndOf`·`progressLinkOps`·`progressLinksByNote` - 진도 쪽에만) · `linkerList.ts`(범위·목록 - 메모는 범위 안 가장 늦은 날짜 링크) · `actions.ts`(`saveLinks`·`removeLink`·`saveProgressLinks`·`removeProgressLink`) · `useProgressLinks.ts`(메모 → 이은 차시, 카드 🔗 n에 더함) · `open.ts`(`openLinker`·`openLinkViewer`·'+ 새로 만들어 연결' 쪽지 `pickFor`) ·
  `LinkerWindow.tsx`(창 `linker` - 수업에서도 열린다·🏫 수업 탭 `lessonCandidatesOf`·메모에서 열면 📘 진도표 탭 `progressCandidatesOf`(그 차시를 하는 날 = `useProgressMarks` 뒤집기)·진도 칩 `[data-linker-plan|linker-plans]`, 저장 `saveLinks(…, progress)` → `linkOps.noteToProgressOps` - P11-1) · `LinkViewerWindow.tsx`(창 `links` - 수업 줄 = 그 교시 과목·메모). 수업 쪽 = `LessonEnd`(lessonDays `periods.n.linkIds`, P6-1). 학기 셈 `domain/semester.ts`. 점검 `tools/inspect-links.mjs`(32).
- **주간 화면** `src/features/week/`(P5-1): `WeekScreen.tsx`(이번 주·넓으면 다음 주 줄·🕰️ 작년 이맘때 단추 줄) · `WeekDayCard.tsx`(요일 카드·일정 칩 - 오늘 카드에 이월 ↪) · `LastYearDay.tsx` ·
  `lastYear.ts`(순수 가져오기 셈)·`actions.ts`(`importLastYear`)·`prefs.ts`(`sp5-last-year`·단축키 'lastYear') · 셈 `domain/lastYearWeek.ts`·`domain/dayTone.ts`. 📝 n = 창 `dayNotes`(`notes/DayNotesWindow.tsx`, `notes/open.openDayNotes`). 점검 `tools/inspect-week.mjs`(44).
- **메모 화면** `src/features/memo/MemoScreen.tsx`(P4-1 - ⭐/라벨/전체·진행/완료·전체 비우기·'메모' 라벨 붙이기, 카드 쌓기 `ui/Masonry.tsx`·`domain/masonry.ts`, P10-3 - 모든 메모 `select.allNotes`·차례 `noteOps.memoScreenOrder`·카드 📅 칩 `[data-entry-date-chip]`·60장씩 `[data-memo-more]`,
  P10-5 - 왼쪽 제목 '🏷️ 라벨 관리' `[data-memo-labels-settings]`·카드/목록 `memoView.ts`(`sp5-memo-view` - 머리줄 `[data-memo-view-toggle=card|list]`, 메모 화면에서만)·목록 한 줄 `MemoListRow.tsx`(`[data-memo-list|memo-row|memo-row-text|memo-row-complete|memo-row-favorite]`,
  P11-1 - ▶/▼ `[data-memo-row-expand|memo-row-expanded|memo-row-body]`, 본문 = `notes/EntryBody`) · 칩 안내 `[data-filter-help]` = `LabelFilterChips.FILTER_HINT`(P11-1) · 새 메모 차례 `eventOps.orderBefore`(P11-1)) ·
  라벨로 보기 칩 `notes/LabelFilterChips.tsx`(메모 화면 세로·하루 메모 칸 한 줄)·기억 `notes/labelFilter.ts`(`sp5-label-filters` - 하루 칸 칩 줄 폄 `journalOpen`). 점검 `tools/inspect-memo.mjs`(33).
- **메모** `src/features/notes/`(하루 메모 칸·메모 화면(P4-1)이 함께 쓴다 - kind 'note' 하나, 날짜 링크 `domain/noteDates`(`noteDates`·`datesFields`·`datesChanges` - P10-3), 고르기 `itemsOn`은 날짜 링크마다·`noteDaysBetween`·`allNotes`): `open.ts`(쓰는 칸 `note` = `{ sid, date|null(연 날), id? }`·`openNotePanel`·`useEditingNoteIds`·`closeNotePanelsFor`) ·
  `NotePanel.tsx`(`[data-note-panel=new|edit|note-id|note-dates(쉼표로)|note-flag=done|favorite|note-date-chip|note-date-remove|note-date-add|note-dates-empty|note-text-input|checklist-toggle|hash-preview|hash-label|note-save|note-delete|note-close]` - + 날짜 = `ui/MiniCalendarPicker` trigger·marked, 빈 글 저장 = 지우기(P10-5)) ·
  `CheckLinesOverlay.tsx`(쓰는 칸 체크리스트 - 같은 글을 글 칸 아래에 그려 ☑ 줄긋기·▲▼ `[data-check-backdrop|check-row|check-state|check-up|check-down]`, 글 칸 `[data-check-mode]`, 셈 `domain/checkLines` `toggleCheckMoving`·`moveCheckLine` - P10-5) ·
  `noteForm.ts`(순수 - 칸 ↔ 문서, 날짜 칩 `dates`, '#라벨'·새 라벨 `savePlanOf`) · `noteOps.ts`(순수 - 즐겨찾기 먼저·▲▼ 무리 안·체크 줄·메모 화면 차례) ·
  `actions.ts`(`createNote`·`saveNote`(새 라벨과 한 묶음)·`setNoteDone`·`setNoteFavorite`·`moveNoteInList`·`toggleNoteCheckLine`·`deleteNote`) ·
  `EntryCard.tsx`(메모 카드 `[data-entry-card|entry-kind(journal = 날짜 있음)|entry-date-chip|entry-done|entry-favorite|entry-collapsed|entry-collapse|entry-up|entry-down|entry-complete|entry-favorite-toggle|entry-chip|entry-checks|entry-edit|entry-delete|entry-image|entry-images|check-line|check-done]`) ·
  `EntryBody.tsx`(카드 본문 - 그림·파일·글·체크 줄·주소 미리보기·표, 카드와 메모 화면 목록의 펼친 줄이 함께 - P11-1) ·
  `EntryTableView.tsx`(표 - 쓰는 칸은 칸 글자·행/열 `[data-note-table|cell|table-op]`, 카드는 compact `[data-entry-table]`) · `attach.ts`(📎·캡처 = 드라이브, 표 먼저 `pastedTable`) · `shortcuts.ts`(`newNote`·`newMemo`).
  순수 셈 `domain/checkLines`·`entryCollapse`·`hashLabels`(V4 테스트째). 주소 → 링크 `ui/FormattedText.tsx`. **쓰던 글 보관** `data/drafts.ts`(`useDraft` - DB `sp5-drafts-{uid}`, 메모·기록·일정 칸, 로그아웃하면 지움) + `ui/DraftOffer.tsx`(`[data-draft-offer|draft-restore|draft-discard]`).
- **설치(PWA)** `public/`: `manifest.json`(SP5 · share_target `/share-target`) · `sw.js`(문서는 네트워크 먼저·`/assets/`는 담아 둔 것 먼저·'sp5-precache' = 빌드의 `asset-manifest.json`대로 이 판을 담고 옛 판은 지움(`ignoreVary`)·공유받기 캐시 `sp5share-inbox`·푸시) · 아이콘 PNG = `node tools/gen-icons.mjs`(favicon.svg에서).
  공유받기 `features/share/receive.ts`(`useShareReceiver` - Shell, 새 메모 칸 `draftText`·`draftFiles`) · 순수 `domain/share.ts` · 새 판 띠 `app/newBuild.ts`·`NewBuildBanner`(`[data-new-build]`). 점검 `tools/inspect-offline.mjs`(빌드 + preview 4175).
- **사용 설명서**(P9-1 - 창 `help` `{ topic? }` = ⋮ 설정·머리줄 ?·단축키 'help'): `features/help/`(`types.ts` 모양 · `topics.ts` 장 차례·자리표 풀기 `plainText`·`topicText`·`findHelpTopic` · `chapters/*.ts` 11장(start·views·events·lessons·notes·attachments·classroom·find·share·settings·trouble) ·
  `HelpWindow.tsx`(V4 HelpModal - 분류 → 기능 → 설명·사용 예·왼쪽 목차(접기 이 기기 `sp5-help-tree-hidden`)·찾기·단축키 표, `[data-help-window|help-home|help-search|help-results|help-category|help-topic|help-detail|help-example|help-link|help-key|help-lookback|help-related|help-prev|help-next|help-crumb-home|help-back|help-tree|help-tree-topic|help-tree-category|help-tree-fold|help-tree-all|help-tree-toggle|help-shortcuts|help-shortcut|help-shortcuts-open]`)) ·
  시험 `topics.test`(링크·자리표·창의 `help` 주제가 있나)·`HelpWindow.test`(모든 항목을 그려 기호가 남지 않나). 점검 `tools/inspect-manual.mjs`(282 - 68주제마다 설명서가 말하는 자리).
- **점검용 창** `src/features/dev/`(`TestWindow`·`TestPanel` - 개발·에뮬레이터 빌드에만, `window.sp5.openWindow('devPanel', { n })`).
- **점검** `tools/lib/probe.mjs`(크롬 1400px·`browserOptions`(PC 크롬 / 컨테이너 Chromium)·`sel()`·`waitFor`·`serverUntil`·`emulator()`·`restorer()`·`noUserActivation`(P9-3)·`newPage(…, { isMobile… })`) · `tools/inspect-mobile.mjs`(P9-3 휴대폰 390·다크 대비) · `tools/inspect-scroll.mjs`(P10-5 - 긴 메모 끝 커서 줄·쓰는 칸 표 세로 스크롤 없음·옆 칸 휠·'스크롤로 페이지 이동' 날짜 그대로, 끝에 설정을 끈다) · `tools/inspect-perf.mjs`(P9-3 성능 - 빌드 + preview, teacher4 `?as=4` 1만 항목, 앱이 센 서버 읽기 `window.__sp5Reads`(`mirror/server` - 에뮬레이터 빌드만), 결과 = DESIGN 11장) · `tools/inspect-shell.mjs`(P1-3 끝 조건) · `tools/inspect-login.mjs` ·
  `tools/inspect-settings.mjs`(P1-4: 설정이 다른 창으로·단축키·시작 화면·계정 칸·로그아웃 전 올리기) · `tools/inspect-pwa.mjs`(임시 프로필 - 설치 오류 0·설치 창) ·
  `tools/inspect-data.mjs`(P2-1: 앱 모듈로 저장 도우미·안내 되돌리기·Ctrl+Z) · `tools/inspect-mirror.mjs`(P2-2: 서버를 막고 사본으로 먼저·다른 탭/기기 2초·IndexedDB 지움/막힘에도 서버 자료·다시 받기·로그아웃 지움) ·
  `tools/inspect-labels.mjs`(P2-3: 라벨 관리 창 - 이름 바꾸기 = 서버 문서 하나·다른 기기 고침이 들어옴·ESC 묻기·붙은 수·빈 라벨 정리·추가·되돌리기) ·
  `tools/inspect-import-labels.mjs`(P2-4: 띠 → 가져오기 → V5 라벨·설정 = V4·두 번째는 바뀐 것 0·띠 닫기, V4 문서를 고쳐 심고 되돌린다). seed는 계정마다 띠 닫음을 심는다.
  `tools/inspect-events.mjs`(P3-1: 일정 카드·완료·순서·추가·고치기·날짜 옮기기·빠른 입력·⏰·지우기·되돌리기·Ctrl+Z·앱 안 알림·단축키 새 일정(PC ＋ 새로 없음) - 저장마다 서버 문서 하나, 63항목) ·
  `tools/inspect-notes.mjs`(P3-2: 기록 카드·완료·즐겨찾기·체크 줄·순서·지우기·새 기록 칸·#라벨·고치기·날짜 빼기 = 같은 문서의 date·되돌리기·체크리스트·단축키 새 기록·메모·쓰던 글 보관 - 61항목) ·
  `tools/inspect-attach.mjs`(P4-2: 구글 API는 page.route 흉내 - 만료 토큰 묻는 창·캡처/파일 = 드라이브·표 먼저·칸 고치기·카드·크게 보기·클립보드 칸 - 47항목, 컨테이너는 로그인 창 열림을 건너뛴다) ·
  `tools/inspect-forward.mjs`(P3-3: 오늘 칸 ↪·carrying 한 번·다시 열면 쓰지 않음·끝내기 = 오늘로·→ 오늘로·학교 탭·지난 일정 줄·단축키 - 48항목, 날짜는 이 기기의 오늘) ·
  `tools/inspect-groups.mjs`(P3-3: 기간 한 문서·(k/n)·그날만 완료·이 날만/이 날부터·통째로 옮기기, 반복 만들기·이 날부터 고치기·지우기 - 41항목, 2027-03) · `tools/inspect-multi.mjs`(P3-3: Ctrl·Shift·완료·라벨·옮기기(기간은 고른 날만)·지우기·ESC·⋮ - 26항목, 2027-04).
  점검용 `window.sp5` = `openWindow`·`closeAllWindows`·`runShortcut`(키가 없는 단축키 일).
  자료 층 테스트 `npm run test:data`(에뮬레이터, `*.emu.test.ts` - `vitest.data.config.ts`, CI는 단위만 - `repo.emu`·`mirror.emu`·`import.emu`).
  규칙 테스트: `app/windowConventions.test.ts`(창 틀·'취소' 금지·그림 단추 설명·⋮ 표) · `app/keys.test.tsx`(키 글자를 박지 않는다).
- **V4 가져오기** `src/import/v4/`(V4 자리를 읽는 곳은 여기뿐 - `boundary.test`가 지킨다, 쓰기는 V5에만): `hash.ts`(SHA-1·base32·`stableStringify`) · `ids.ts`(`v4id`·id 없는 것 `idlessKey`) ·
  `classes.ts`(P7-5 `planClasses` - 명렬표(학생 sid = 셈한 값 `studentSid`, V5에서 고친 학급은 그 명렬표의 번호로)·출결·교과 출결·알림장·조사표(`v4Eval`)·자리표·허브(`v4Hub`)·암기(이름 열쇠),
  지운 표시 없는 문서는 칸 비우기 `planEmptiable`, 기록·메모 태그 → `studentKeysOf`(planItems opts)) · 점검 `tools/inspect-import-class.mjs`(36) ·
  `lessons.ts`(P6-4 `planLessons` - 표 → 기간 `timetableRanges`(학기마다 절반 넘게 맞는 표), schedules → lessonDays 다른 칸만, v4_progress → progress, 수업 없는 날은 `run.ts` `lessonOffDay`, 링크는 `items.ts` `linkOf`) · `settings.ts` `periodsFromV4`·`termsFromV4` · 점검 `tools/inspect-import-lessons.mjs`(30) ·
  `plan.ts`(다시 가져오기 규칙 `planDocs` - 지문 `src.h`로 새로·바뀜·그대로·둠·지움, V4에서 없어진 것은 `deletedBy: 'v4-import'`, 결과 수 `ImportCounts`) ·
  `record.ts`(기록 `settings/import` - 때·결과·라벨 짝 표·설정 칸마다 적은 값·띠 닫음, 결과 표 줄 `IMPORT_KINDS`) · `legacy/`(V4 옛 모양 읽기 - 본체는 import 금지) ·
  `labels.ts`(`planLabels` - V4 기본 라벨·이름 같은 V5 라벨에 잇기·짝 표) · `settings.ts`(`planSettings` - 칸마다, `COMMON_FROM_V4`) · `read.ts`(서버 읽기) ·
  `items.ts`(P3-4 `planItems` - 일정·기간 한 항목·반복 series·이월 사슬·기록·메모·링크) · `legacy/entries.ts`(기록·공휴일·기한·기간 조각 읽기) ·
  `run.ts`(`runImport`·`checkImportOffer`·`dismissImportOffer`·진행 store `useImportRun` · 공유 그룹 `runGroupImport`·`useGroupImportRun` - `read.readV4Groups`·`readV4GroupDocs`·`readV4LabelDocs`,
  라벨은 `items.usedLabelNames` + `planLabels` `{ only, shared }`, 항목·조사표의 만든 사람은 `Planned.author` → `writeOp.create(…, authorId)`, 알림장·조사표 `classes.planNotices`·`planEvaluations`), 결과 표 아래 안내 `record.IMPORT_NOTES`. 점검 `tools/inspect-import-items.mjs`(P3-4 - seed 수·두 번째 0·V5 고친 것 둠, 끝에 되돌림). 화면: 백업 창 '가져오기' 탭 `features/backup/V4ImportSection.tsx` ·
  처음 로그인 띠 `features/import/ImportBanner.tsx`(Shell 본문 맨 위). 문서는 `docs/`, 소개는 `README.md`(에뮬레이터 순서).
