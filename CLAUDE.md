# School Planner V5 — Claude 작업 규칙과 기억

이 파일은 V5를 여러 기기에서 같은 규칙으로 만들기 위한 **공유 기억**이다. 저장소에 들어 있어 `git pull`로 기기끼리 맞춰진다.
기기마다 따로 쌓이는 Claude 기억(그 기기의 `~/.claude/projects/<작업 폴더>/memory/`)과는 아래 0장 절차로 하나로 맞춘다.

> 저장소 `hyundonglim80-gif/School_Planner_V5`. 계획·설계 문서는 `docs/`(PLAN·DESIGN·MENU·PARITY). P1-1(10-08)에 V4 저장소 `docs/V5/`에서 옮겨 왔다 - 이것이 정본.

마지막 합침: 2026-10-08 (영-전-3-현동림 PC) - 처음 씀(V4 CLAUDE.md 1·2·5장과 이 기기 기억에서)

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

- **2026-10-08 P4-1 끝**(클라우드 - 메모 화면·라벨로 보기(메모·기록 칸)). 사용자 요청(10-08)으로 **P9-4까지 쉬지 않고 이어 간다** - 다음 P4-2. 👤 V5 주소 환경설정 '가져오기'로 실제 계정을 가져와 하루·메모 화면을 V4와 견주기, 이월·기간·반복·여러 개 고르기·메모 라벨로 보기 써 보기.
- 👤 PC에 갈 때(급하지 않다 - 그동안 클라우드로 이어 간다, 묻고): 바뀐 `firestore.rules`를 V4 저장소에 복사 → `node tools/live-rules.cjs` → 운영 규칙 배포(`docs/PLAN.md` 5장 'P2-1 규칙').

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
  - **계정에 올라가는 설정은 기기 저장소만 바꿔서 시험하지 않는다** - 다시 열면 계정 값이 이긴다. 계정 문서로 바꾸고 끝에 걷는다(P4-1 - inspect-shell이 '가운데 창'을 계정에 남겨 다른 점검이 깨졌다).
- **오늘에 따라 고르는 것(이월·지난 일정)의 단위 테스트는 날짜를 고정**한다: `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(…)`, 끝에 `vi.useRealTimers()`(P3-3 - 고정하지 않으면 다음 날 시험이 깨진다).
- **단위 테스트가 `data/select`·`session`·`space`를 부르면 `vi.mock('…/data/firebase')`** - 진짜 Firebase 앱이 뜨면 시험이 끝난 뒤 IndexedDB를 열다
  '처리하지 않은 오류'가 가끔 남는다(P3-1 - 셋에 한 번). vitest가 'originated in <파일>'로 그 파일을 알려 준다. 끝에 `Errors`가 0인지도 본다.
- **IndexedDB(idb)는 트랜잭션을 열어 일과 `tx.done`을 함께 기다린다**(P3-2) - `db.get`·`db.put` 줄임은 읽기 트랜잭션의 done을 아무도 받지 않아, 트랜잭션이 끊기면 '처리하지 않은 오류'(AbortError)가 된다.
- **확인과 커밋을 한 줄에 잇지 않는다**(P3-2): `npx tsc -b && … ; git commit`은 앞이 실패해도 커밋한다, `grep -c`는 0이면 실패로 끝나 `&&` 사슬을 멈춘다. 확인 결과를 본 뒤 커밋한다.
- **C: 디스크가 차면 에뮬레이터가 죽는다**: `firebase-debug.log`·`firestore-debug.log`(git 무시)가 커진다. 긴 점검 전에 `df -h /c`, 차면 두 로그를 비우고 `npm run emu` → seed.
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
- **날짜 셈**: 한 달 더하기는 말일로 맞춘다(1/31 + 1달 = 2/28), 학년도는 3월~이듬해 2월(윤년 2월 29일), 학기 셈은 한 곳(`semester`)에서.

## 5. 화면 규칙 (사용자가 정한 것 - V4 그대로. 자리를 옮긴 것은 `docs/MENU.md`)

### 오른쪽 칸 (V4 2026-09-29 → 10-07)
- 창은 기본으로 **화면 오른쪽 칸**에 뜬다. 넓은 화면은 화면을 나눠 붙고, 휴대폰은 오른쪽에서 덮는다. 환경설정 '창 위치'에서 '가운데 창'으로 바꿀 수 있다(PC·휴대폰 따로).
- 오른쪽 칸은 **한 줄에 한 폭**. 경계선을 끌어 폭을 바꾸고, 두 번 누르면 기본 폭.
- 여러 개면 **위에 탭**. 새 칸은 탭 하나로 더해지고 보인다, 숨은 탭도 적던 글째 살아 있다, 탭 ×는 그 칸 닫기. 높이를 나누는 방식(62/38)은 사용자가 거절했다.
- **쓰는 칸(메모·기록·일정·알림장·출석부)도 탭**이다. 이미 열린 항목을 다시 열면 그 탭을 보인다. 닫기·뒤로가기·Ctrl+S는 그 칸 하나만.
- **ESC는 오른쪽 줄 전체**를 닫는다(저장 안 한 글이 있으면 먼저 묻는다). **Ctrl+S**는 커서가 든 칸·창만, 커서가 없으면 보이는 탭.
  Ctrl+S는 저장 단추가 있는 모든 곳에서 저장한다. 좁은 화면에서 배경을 누르면 고친 것을 저장하고 닫는다(닫기·✕·ESC는 저장하지 않는다).
- 기록·메모를 여는 길은 모두 **하루·메모 화면과 같은 쓰는 칸**이다. 새 일정·기록·메모는 **저장한 뒤에도 적은 것이 남고** 그 항목의 수정 칸이 된다.
- 새 창은 반드시 `ModalShell` 또는 `PopupFrame`(테스트가 지킨다).

### 왼쪽 클립보드 칸
- 왼쪽 가장자리 📋로 여닫는다. 최신 복사가 위, 누르면 글 쓰던 칸에 붙여넣기. **이 기기에만**(IndexedDB) - 계정에 올리지 않는다(비밀번호·캡처가 지나간다). 지우면 이 기기의 휴지통으로.

### 하루 화면
- 일정·기록 머리줄: `▼ 제목 숫자 [+ 추가] ……… ⚙️`(라벨 설정은 오른쪽 끝).
- 일정은 **휴대폰 2열 카드, PC 1열**. 기록은 휴대폰 2열, PC 2~4열.
- 수업 칸: 과목은 **굵고 크게**(PC 18px·휴대폰 16px, font-black), 과목이 있는 교시 카드는 왼쪽에 **교시 색 막대**.

### 메모 ↔ 기록 = 날짜 칸
- **메모와 기록만** 서로 옮긴다. **일정은 제외**(라벨 속성·기간/반복 묶음 때문).
- 쓰는 칸 머리의 '📅 날짜'가 자리다: 날짜가 있으면 그날 기록, 비우면 메모. 기록 → 메모는 글에 날짜 줄을 더하지 않고 카드에 '📅 10/6에서'.
  (V5에서는 날짜 칸 하나만 바뀐다 - 휴지통 사본이 없다.)

### 라벨 상위/하위와 라벨로 보기
- 메모·기록 라벨만 2단계 트리(일정 라벨은 뺀다). 메모·기록 라벨은 한 목록.
- 라벨로 보기는 **여러 개** 고른다(하나라도 붙은 항목). **상위를 고르면 하위도 함께**, 하위 끝 가상 칩 **'기타'** = 하위 없이 상위만 붙은 항목. 하위는 화면을 열면 접혀 있다.
- 칩 고르기는 **윈도우 탐색기처럼**: 그냥 누르기 = 하나만, Ctrl = 더하기·빼기, Shift = 범위, ESC = 모두 떼기(오른쪽 칸도 닫힘). 라벨을 더할 때 상위 라벨도 고른다.
- 빈 라벨은 **저절로 지우지 않는다**(라벨 관리 '빈 라벨 정리 (N개)').

### 메모·기록의 표
- 엑셀·한셀·구글 시트에서 복사해 본문에 붙여넣으면 서식째 표. 붙인 뒤에는 **칸 글자와 행·열만** 고친다(서식 편집 없음). 표는 글 아래 첨부처럼.

### 기타
- 휴지통 자동 비우기: 끄기/7/14/30/60/90일(계정에 하나, **기본 끄기**). 휴대폰에서도 맨 위에 🗑️ 휴지통.
- 구글 로그인이 만료되면(첨부·사진·백업·캘린더) 오류 대신 '구글 로그인이 필요합니다' 창을 띄우고 그 단추에서 로그인 창을 연다.
- 진도표 차시 칸 = 그 내용의 차시 수('2'면 같은 내용을 2행으로). 1, 2, 3 … 차례 번호로 적은 옛 표는 늘리지 않는다.
- 체크리스트는 글 안의 `☐ `/`☑ `, 카드 '☑ n/m', 체크한 줄은 보이기만 아래로. 첫·마지막 줄 '#라벨'은 라벨로 떼고 그 줄을 지운다(숫자 8자리 학생 태그는 남긴다).
- 일정 라벨 속성 '구글 캘린더' - 켠 라벨의 일정은 저장·완료·옮기기·지우기를 구글 캘린더에도. 저장할 때 로그인이 없으면 로그인 창을 묻는다.
- 교사 유형은 시간표 창에서 고른다((초등) 담임 / 전담 / (중등) 전담 + 담임). 전담은 담임 도구(출석부·알림장)를 숨긴다. 수업 칸 글자는 '5-2 과학'.
- 명렬표는 학급 화면 안(⋮에 없다). 수업 종은 하루 '수업' 옆. 링크 연결 창은 저장하면 닫힌다.
- 화면 이름(UX-AUDIT 10-07 사용자 결정): 일정 속성 **'달력'·'수업X'은 그대로**, '조사표'로 통일(모아 보기도 '조사표 모아 보기'), 표는 '행/열', 메모 거르개는 '라벨로 보기',
  '창 위치'(오른쪽 칸 / 가운데 창), '⏰ 시간표', '💾 저장', '지난 일정 오늘로 가져오기', '여러 개 고르기', '라벨 관리', '검색', '학생 기록(누가기록)', '앱으로 설치'.
- **하지 않기로 한 것**(V4 ROADMAP): 학부모 소통(알림 발송·설문·상담 예약 - 복사·공유로 잇기만), AI API 직접 연결(학생 개인정보가 밖으로 나간다).

## 6. 사용 설명서 = 기능 명세

- **P9-1 전까지는 V4 설명서**(`../School_Planner_V4/src/lib/helpTopics.ts`, 11장 68주제)가 명세다. 기능을 옮기기 전에 그 주제 부분만 읽는다
  (`grep -n "id: '<주제 id>'" ../School_Planner_V4/src/lib/helpTopics.ts` - 주제 id는 `docs/PARITY.md`). 대화 시작에 전부 읽지 않는다.
- V5에서 동작이 바뀌는 것은 `docs/MENU.md`·`docs/DESIGN.md`·`docs/PARITY.md`에 적고, P9-1에서 설명서를 V5로 옮기며 반영한다. 그 뒤로는 동작을 바꾸면 설명서도 같은 커밋에서 고친다.

## 7. V5 시스템 지도 (세션마다 채운다)

기능을 고치기 전에 이 지도로 자리를 찾는다. 세션 끝 정리에서 새 파일·자리를 한 줄씩 더하고, 단계 끝에 다듬는다.

- **도구**: `package.json`(dev 5175·dev:emu·build:emu·preview 4175·test·test:data·lint·emu·seed·check:rules, `allowScripts`) · `vite.config.ts`(base `/`, `__BUILD_ID__` 한국 시각, `__USE_EMULATOR__`) ·
  `vitest.config.ts`(jsdom·vmThreads, `__BUILD_ID__`='test') · `src/test/setup.ts`(jest-dom·fake-indexeddb·cleanup) · `.github/workflows/ci.yml`(lint → test → build - main·`wip/**`·`claude/**`·PR) ·
  `firebase-hosting-merge.yml`(main CI가 통과하면 그 커밋을 schoolplanner-v5에 배포, 비밀값 `FIREBASE_SERVICE_ACCOUNT_SCHOOLPLANNERV3`) · `firebase-hosting-pull-request.yml`(PR 미리 보기 - 로그인 안 됨).
  npm 11은 설치 스크립트를 허락 없이 돌리지 않는다 - 'not yet covered by allowScripts'가 나오면 `npm install-scripts approve|deny <패키지>`(`docs/PLAN.md` 5장).
- **들어가는 곳**: `index.html`(manifest 링크) → `src/main.tsx`(watchSession·리디렉션 로그인 마무리·에뮬레이터 자동 로그인·앱 설치 이벤트) → `src/app/App.tsx`(불러오는 중 `[data-session=loading]` /
  로그인 화면 / 로그인하면 'SP5' `[data-session=signed-in]`, 빌드 번호 `[data-build-id]`). 글자·간격 단계(`@theme`)는 `src/index.css`(V4 앞부분).
- **서버·규칙**: `firebase.json`(에뮬레이터 auth 9099·firestore 8080·ui 4000 · hosting 사이트 `schoolplanner-v5` = https://schoolplanner-v5.web.app, `dist`, 첫 주소·sw·manifest no-cache) · `.firebaserc` · `firestore.rules`(**정본** - V4 규칙 전부 + V5 블록, V4 저장소 것은 복사본) ·
  `tools/check-rules.mjs`(V4 35 + V5 59 - items·labels 모양 포함) · `tools/live-rules.cjs`(운영 규칙 = 파일인지, 읽기만) · `tools/seed.mjs`(V4 seed 계정의 V5 개인 공간 - 계정이 없으면 만든다) · `tools/inspect-login.mjs`(크롬: 로그인·개인 공간·Firestore IndexedDB 없음).
- **자료 층** `src/data/`: `firebase.ts`(앱 이름 SchoolPlannerV5, memoryLocalCache, googleProvider 범위) · `emulator.ts`(`?as=2|3`) ·
  `session.ts`(로그인 store `useSession` - 구독 하나) · `space.ts`(`personalSpaceId`·`ensurePersonalSpace`) ·
  `settingsSync.ts`(설정 문서 하나 맞추기 `startSettingsSync` - 구독 하나·1초 뒤·받기 전엔 안 올림, `settingsPort` = `spaces/u_{uid}/settings/{common|pc|mobile}`, 적기는 `writeOps`) ·
  `types.ts`(자료 모양 = DESIGN 4장, 컬렉션 표 `SpaceCollections`·`Editable<C>`·`DocPath`) · `id.ts`(`newId` 20자) ·
  `repo/`(저장 도우미 - `ops.ts` 무엇을 적나·되돌리는 쓰기(순수 - 순수 모듈은 `repo/ops`에서 import, `repo/index`는 Firebase째 끌고 온다), `index.ts` `create`·`patch`·`remove`(누가 - 가져오기만)·`restore`·`put`·`purge`·`batch`·`newPath`·`writeOps`, 모두 `Undo`를 돌려준다) ·
  `undo.ts`(`recordUndo` = 안내의 되돌리기 단추 + Ctrl+Z 더미(공간마다 20) - `quiet`면 안내 없이 더미에만, `undoLast` - `main.tsx`가 단축키 'undo'에 잇는다).
  `mirror/`(기기 사본 - `db.ts` IndexedDB `sp5-mirror-{uid}` 저장소 docs·meta · `codec.ts` Timestamp 지키기 · `store.ts` 화면 store `useMirror`(서버 판 + 내 쓰기 덧칠 `beginLocalWrite`) ·
  `server.ts` Firestore 받는 길(흉내 서버로 시험) · `sync.ts` `startMirror`·`useMirrorSync`(App)·`resetMirror`·`wipeMirror`(로그아웃)·받는 컬렉션 `MIRRORED`) ·
  `select.ts`(화면이 고르는 곳 - `itemsOn`·`itemsBetween`·`itemsWithLabels`·`itemsOfKind`·`memos`·`trashOf`·`labelsOf` + `use…` 훅·`useDocs`·`useMirrorStatus`,
  라벨: `labelTreeOf`·`useLabelTree`(트리 차례·기본 라벨 `defaultId`)·`itemLabels`·라벨로 보기 `itemsMatching`·붙은 수 `labelUsageOf`·`emptyLabelsOf`·`missingLabelsOf`) ·
  `labels.ts`(라벨 쓰기 - 저장 = 바뀐 칸만 `labelSaveOps`·`createLabelOp`·이름으로 찾기·만들기 `ensureLabelOps`·`defaultLabelOps`·`labelNameProblem`, 적기 `addLabel`·`saveLabels`·`restoreLabels`·`addDefaultLabels`) ·
  `session.ts`의 `currentSpaceId`·`useCurrentSpaceId`(지금 공간 한 곳). 화면 문서 = `Stored<C>`(자리 id가 붙는다 - 저장 도우미는 id를 적지 않는다).
- **기능** `src/features/auth/`: `LoginScreen.tsx`(`[data-login-google]`) · `login.ts`(`useGoogleLogin`·`logout`·`finishRedirectLogin`, 구글 토큰 sessionStorage `sp5-google-token`).
  로그인한 화면은 `[data-session=signed-in][data-user=<메일>]`. `logout`은 기다리던 설정을 먼저 올리고, 나간 뒤 기기 사본·쓰던 글 보관을 지운다.
- **라벨** `src/features/labels/`: `LabelsWindow.tsx`(창 `labels` - ⋮ 일정, `{ tab: 'event'|'note' }`, 고친 것만 들고 사본 위에 얹는다, `[data-labels-window]`·
  `[data-label-tab|row|name|color|prop|parent|up|down|delete|save|add|new-name|new-parent|usage|prune|prune-item|prune-confirm|recover|defaults]`) · `ColorPicker.tsx`(`[data-color-option]`) ·
  `LabelChip.tsx`(`LabelChip`·`LabelChips` `[data-label-chip]`) · `LabelPicker.tsx`(쓰는 칸 - `[data-label-picker|pick|pick-new|pick-new-input|pick-pending|picker-settings]`).
- **환경설정** `src/features/settings/`: `SettingsWindow.tsx`(창 목록 `settings`, 탭 표 `ready` - 지금 보기·학교·단축키·앱·가져오기, `{ tab }`로 열기 - 열린 창도 그 탭으로) · `ViewTab`(누르는 즉시) · `SchoolTab`(이월 기간 `[data-forward-days]` - common.forwardDays) ·
  `ShortcutsTab`(V4 ShortcutModal - 저장·겹침 막기·ESC 때 묻기) · `AppTab`(📱 앱으로 설치·이 기기 사본 `[data-mirror-state|count|reset]`·빌드 번호) · `parts`(Section·ToggleRow·Choices).
  `[data-settings-tab|panel|toggle]`·`[data-choice="이름:값"]`·`[data-shortcut-row|key|save|reset]`·`[data-install-pwa=ready|guide]`.
- **껍데기** `src/app/`: `App.tsx`(로그인 상태 → `Shell`) · `Shell.tsx`(틀: 머리줄·본문·탭바·창·오른쪽 줄 ▶·폭 끌기) · `Header.tsx`(첫 줄 - ⏳·🗑️·＋ 새로·🔍·화면 탭·?·⋮·사진,
  `[data-header-*]`·`[data-scope-tab]`·`[data-more-menu]`·`[data-menu-item]`·`[data-new]`) · `SecondRow.tsx`(토글·◀ 날짜 ▶·📅·학기 칩, `[data-date-prev|next|label]`·`[data-view-toggle]`) ·
  계정 칸(사진 → `[data-account]`·`[data-account-panel]`·`[data-account-name|email]`·`[data-logout]`) · `MobileTabBar.tsx`(`[data-tabbar-tab]`) · `screens.ts`(화면 여섯 = 탭·단축키, 화면은 `features/<화면>/<Name>Screen.tsx` - 하루 말고는 아직 빈 자리 `ui/EmptyScreen` `[data-screen]`) ·
  `route.ts`(주소 ↔ 화면, 순수) · `nav.ts`(화면·날짜·토글 store `useNav` - 'YYYY-MM-DD', `stepDate`·`goToday`·`dateLabel`) ·
  `history.ts`(브라우저 기록 한 곳: 주소 맞물리기 `startRouting` + 창 층 `useModalLayer`·`useBackLayer`·`closeAllLayers`, 뒤로가기 표지판) ·
  `windows.ts`(창 목록 `registerWindow`·`openWindow`·`setWindowParams`(창의 `setParams`)·`closeAllWindows`·`registerUnsavedCheck`) · `windowList.ts`(창 등록 한 곳 - 창을 만드는 세션이 한 줄씩) · `WindowHost.tsx` ·
  `moreMenu.ts`(⋮ 4구역 8항목 표) · `keys.ts`(키 처리 한 곳 `runShortcut`·`setShortcutAction`·`runFromButton`·`useShortcutTitle`, 바꾼 키 `sp5-shortcuts`) ·
  `layoutPrefs.ts`(창 위치·글자 크기·줄 폭 `sp5-layout`) · `prefs.ts`(어느 설정을 어느 문서에 - `DEVICE_PREFS`·`COMMON_SETTINGS`·`useCommonSettings`·`usePrefsSync`·`stopPrefsSync`,
  값은 nav·layoutPrefs·keys store 그대로, 사본 주인 `sp5-settings-owner`) · `install.ts`(sw 등록·설치 이벤트 `installApp`·`useInstall`) · `theme.ts`(화면 밝기 `sp5_theme` - `index.html` 스크립트와 같은 규칙) · `todayScroll.ts` · `useGlobalGestures.ts` · `lazyWithReload.ts` ·
  `toast.ts`(`showToast`·`showErrorToast`·`failWithToast`·`ShownError`·`showToastAfterReload` - 안내 `[data-toast]`). 다크 색표 `src/dark.css` = `node tools/gen-dark-css.mjs`.
- **공통 부품** `src/ui/`: `ModalShell.tsx`(창 껍데기, ✕ `[data-close]`) · `PopupFrame.tsx`(오른쪽 칸/배너/가운데 `[data-popup-frame]`) · `SidePanelFrame.tsx`(쓰는 칸 `[data-panel-frame]`) ·
  `sideColumn.ts`(오른쪽 줄·탭 차례 `useSideSlot`·`useDocked`) · `SideTabs.tsx`(`[data-side-tab]`·`[data-side-tab-close]`) · `useSaveKey.ts`(Ctrl+S 받기) · `ColumnResizer.tsx` ·
  `MiniCalendarPicker.tsx`(`[data-date-picker]`·`[data-picker-day]`) · 훅 `useMinWidth`·`useIsMobile`·`useMainWidth`·`useVisualViewport`·`useBodyScrollLock`·`useBackdropClose`.
- **순수 함수** `src/domain/`: `dateUtils.ts` · `order.ts`(차례 값 - 분수 인덱스 `orderBetween`·`ordersBetween`·`compareOrder`(같으면 id로)·다시 세운 줄 `rekeyOrders`(옮긴 것만)) ·
  `labelTree.ts`(V4 트리를 id로 - `parentMapOf`·`orderByTree`·라벨로 보기 `matchLabels`·탐색기식 `clickFilterLabel`·`filterChipOrder`·`otherKey`) ·
  `labels.ts`(색 표 `LABEL_COLORS`·`labelColor`·속성 읽기 `labelProps`·속성 칸 `EVENT_LABEL_PROPS`·기본 라벨 `DEFAULT_LABELS`·`cleanLabelName`) · `shortcuts.ts`(V4 id + 새 id 다섯, `readShortcutOverrides`·`overridesFromBindings`) · `fontScale.ts` · `typeScale.ts` ·
  `settings.ts`(설정 칸 표 `SettingsSpec` - 기본값·읽기, `readSettings`·`sparseSettings`: 문서에는 기본값과 다른 칸만).
- **하루 화면** `src/features/day/`: `DayScreen.tsx`(수업·일정 7:5 - 본문 폭 720px, 수업 자리 `[data-day-slot]` - P6-1, 아래 기록 칸) · `DayJournal.tsx`(기록 칸 - `▼ 📔 기록 N [+ 추가] [+ 메모] … ⚙️`, 즐겨찾기 먼저·본문 폭 2~4열, `[data-day-journal|journal-count|journal-add|journal-add-memo|journal-collapse|journal-empty|journal-waiting]`) ·
  `DayEvents.tsx`(일정 칸 - `▼ 📅 일정 N [+ 추가] … ⚙️`, 카드 PC 1열·휴대폰 2열, `[data-day-events|event-card|event-done|event-complete|event-chip|event-alarm|event-links|event-up|event-down|event-edit|event-delete|event-add|event-count]`).
- **일정** `src/features/events/`(하루·주간·월간·년간이 함께 쓴다): `open.ts`(쓰는 칸 `event` = `{ sid, date, id? }`·`openEventPanel`·`useEditingEventIds`·`closeEventPanelsFor`) ·
  `EventPanel.tsx`(일정 칸 - `[data-event-panel=new|edit]`·`[data-event-text-input|event-date|event-date-prev|next|event-move-note|event-due-input|event-alarm-open|event-attr|event-save|event-delete]`) ·
  `eventForm.ts`(순수 - 칸 ↔ 문서, 속성은 라벨과 다른 것만 `propsToStore`, 저장 = 바뀐 칸만 `editChanges`) · `eventOps.ts`(순수 - `reorderOps`·`doneChanges`·`orderAfter`·`itemPath`) ·
  `actions.ts`(`setEventDone`·`moveEventInList`·`createEvent`·`saveEvent`·`setEventAlarm`·`deleteEvent` - 되돌리기까지) · `EventAlarmWindow.tsx`(⏰ 시각 `[data-alarm-window|alarm-time|alarm-save|alarm-off]`) ·
  `EventAlarms.tsx`(Shell에 하나 - 앱 안 알림, 20초마다 사본) · `EventAlarmPopup.tsx`(`[data-alarm-popup|alarm-item|alarm-mute|alarm-dismiss]`) · `QuickInputChips.tsx`(`[data-quick-chip]`) · `DueBadge.tsx`(`[data-due-badge]`) ·
  `shortcuts.ts`(`newEvent` = ＋ 새로 → 보는 날의 새 일정, `recurring` = 반복 줄을 편 새 일정 칸, `forwarding` = 오늘로 가서 지난 일정 줄). 순수 셈 `domain/eventDue.ts`·`eventAlarm.ts`(`normalizeTimeInput`·`dueAlarms`)·`quickInput.ts`(V4 테스트째). 소리 `app/sound.ts`. 자동 높이 글 칸 `ui/AutoTextarea.tsx`.
  - **이월(계산 - P3-3)**: `domain/forward.ts`(`forwardOn`·`isCarried`·`carriedOf`·`staleOf`·`carriedSince`) · `events/forward.ts`(`useCarried` = 오늘로 따라오는 일정·지난 일정, `usePastRow`·`staleCountNow`) · `ForwardMarks.tsx`(Shell - 처음 따라올 때 carrying 한 번, live에서만) ·
    `eventOps.carriedDoneChanges`(오늘 칸에서 끝내면 오늘로) · 하루 `DayEvents`(오늘 것 아래 `[data-event-carried|event-since]`, 지난 날 `[data-event-away|event-to-today]`) · `day/DayPastEvents.tsx`('📥 지난 일정 N개' `[data-past-*]`) · `ui/useToday.ts`(자정에 바뀌는 오늘).
  - **기간·반복·묶음(P3-3)**: `domain/period.ts`(보이는 날·'(k/n)'·doneDates·skipDates·끝 날 당기기 - 공휴일은 `HolidayCheck`로 P5-3) · `domain/recur.ts`(규칙·날짜·이름) · `events/seriesOps.ts`(순수 - 만들기·묶음 고치기·지우기)·`series.ts`(`useSeriesOf`) ·
    일정 칸 '📆 끝 날' `[data-event-period-*|event-end|event-workdays]`·`RecurRow.tsx`(`[data-event-recur-row|recur-*]`)·`[data-event-series-info]` · `EventScopeWindow.tsx`(세 갈래 창 `[data-scope-window|scope-choice]`)·`EventDeleteChooser.tsx` · 카드 '(k/n)' `[data-event-period]`·🔁 `[data-event-series]`.
  - **여러 개 고르기(P3-3)**: `events/multi.ts`(store `useMulti` - id + 그 날)·`multiOps.ts`(순수 - 한 일정 여러 날은 한 문서에 접는다)·`MultiSelectBar.tsx`(Shell - `[data-multi-*]`, ⋮ `multiSelect`·ESC) · 카드 `[data-event-picked]`·Ctrl·Shift·길게 누르기 · ESC에 함께 할 일 `app/keys.addEscapeAction`.
- **메모 화면** `src/features/memo/MemoScreen.tsx`(P4-1 - ⭐/라벨/전체·진행/완료·전체 비우기·'메모' 라벨 붙이기, 카드 쌓기 `ui/Masonry.tsx`·`domain/masonry.ts`) ·
  라벨로 보기 칩 `notes/LabelFilterChips.tsx`(메모 화면 세로·하루 기록 칸 한 줄)·기억 `notes/labelFilter.ts`(`sp5-label-filters`). 점검 `tools/inspect-memo.mjs`(30).
- **메모·기록** `src/features/notes/`(하루 기록 칸·메모 화면(P4-1)이 함께 쓴다 - 메모와 기록은 같은 kind 'note', 날짜가 있으면 기록): `open.ts`(쓰는 칸 `note` = `{ sid, date|null, id? }`·`openNotePanel`·`useEditingNoteIds`·`closeNotePanelsFor`) ·
  `NotePanel.tsx`(`[data-note-panel=new|edit|note-id|note-noun|note-flag=done|favorite|note-date|note-date-clear|note-place-hint|note-place-keep|note-text-input|checklist-toggle|hash-preview|hash-label|note-save|note-delete|note-close]`) ·
  `noteForm.ts`(순수 - 칸 ↔ 문서, 자리 `placeChanges`(기록 → 메모 = fromDate), '#라벨'·새 라벨 `savePlanOf`) · `noteOps.ts`(순수 - 즐겨찾기 먼저·▲▼ 무리 안·체크 줄) ·
  `actions.ts`(`createNote`·`saveNote`(새 라벨과 한 묶음·옮기기 되돌리기는 자리만)·`setNoteDone`·`setNoteFavorite`·`moveNoteInList`·`toggleNoteCheckLine`·`deleteNote`) ·
  `EntryCard.tsx`(메모·기록 같은 카드 `[data-entry-card|entry-kind|entry-done|entry-favorite|entry-collapsed|entry-collapse|entry-up|entry-down|entry-complete|entry-favorite-toggle|entry-chip|entry-checks|entry-edit|entry-delete|check-line|check-done]`) · `TablePreview.tsx`(표 보기만) · `shortcuts.ts`(`newNote`·`newMemo`).
  순수 셈 `domain/checkLines`·`entryCollapse`·`hashLabels`(V4 테스트째). 주소 → 링크 `ui/FormattedText.tsx`. **쓰던 글 보관** `data/drafts.ts`(`useDraft` - DB `sp5-drafts-{uid}`, 메모·기록·일정 칸, 로그아웃하면 지움) + `ui/DraftOffer.tsx`(`[data-draft-offer|draft-restore|draft-discard]`).
- **설치(PWA)** `public/`: `manifest.json`(SP5) · `sw.js`(설치·활성만 - 담아 두기·공유받기·푸시는 P8) · 아이콘 PNG = `node tools/gen-icons.mjs`(favicon.svg에서).
- **점검용 창** `src/features/dev/`(`TestWindow`·`TestPanel` - 개발·에뮬레이터 빌드에만, `window.sp5.openWindow('devPanel', { n })`).
- **점검** `tools/lib/probe.mjs`(크롬 1400px·`browserOptions`(PC 크롬 / 컨테이너 Chromium)·`sel()`·`waitFor`·`serverUntil`·`emulator()`·`restorer()`) · `tools/inspect-shell.mjs`(P1-3 끝 조건) · `tools/inspect-login.mjs` ·
  `tools/inspect-settings.mjs`(P1-4: 설정이 다른 창으로·단축키·시작 화면·계정 칸·로그아웃 전 올리기) · `tools/inspect-pwa.mjs`(임시 프로필 - 설치 오류 0·설치 창) ·
  `tools/inspect-data.mjs`(P2-1: 앱 모듈로 저장 도우미·안내 되돌리기·Ctrl+Z) · `tools/inspect-mirror.mjs`(P2-2: 서버를 막고 사본으로 먼저·다른 탭/기기 2초·IndexedDB 지움/막힘에도 서버 자료·다시 받기·로그아웃 지움) ·
  `tools/inspect-labels.mjs`(P2-3: 라벨 관리 창 - 이름 바꾸기 = 서버 문서 하나·다른 기기 고침이 들어옴·ESC 묻기·붙은 수·빈 라벨 정리·추가·되돌리기) ·
  `tools/inspect-import-labels.mjs`(P2-4: 띠 → 가져오기 → V5 라벨·설정 = V4·두 번째는 바뀐 것 0·띠 닫기, V4 문서를 고쳐 심고 되돌린다). seed는 계정마다 띠 닫음을 심는다.
  `tools/inspect-events.mjs`(P3-1: 일정 카드·완료·순서·추가·고치기·날짜 옮기기·빠른 입력·⏰·지우기·되돌리기·Ctrl+Z·앱 안 알림·＋ 새로 - 저장마다 서버 문서 하나, 58항목) ·
  `tools/inspect-notes.mjs`(P3-2: 기록 카드·완료·즐겨찾기·체크 줄·순서·지우기·새 기록 칸·#라벨·고치기·날짜 빼기 = 같은 문서의 date·되돌리기·체크리스트·＋ 새로·쓰던 글 보관 - 61항목) ·
  `tools/inspect-forward.mjs`(P3-3: 오늘 칸 ↪·carrying 한 번·다시 열면 쓰지 않음·끝내기 = 오늘로·→ 오늘로·학교 탭·지난 일정 줄·단축키 - 48항목, 날짜는 이 기기의 오늘) ·
  `tools/inspect-groups.mjs`(P3-3: 기간 한 문서·(k/n)·그날만 완료·이 날만/이 날부터·통째로 옮기기, 반복 만들기·이 날부터 고치기·지우기 - 41항목, 2027-03) · `tools/inspect-multi.mjs`(P3-3: Ctrl·Shift·완료·라벨·옮기기(기간은 고른 날만)·지우기·ESC·⋮ - 26항목, 2027-04).
  점검용 `window.sp5` = `openWindow`·`closeAllWindows`·`runShortcut`(키가 없는 단축키 일).
  자료 층 테스트 `npm run test:data`(에뮬레이터, `*.emu.test.ts` - `vitest.data.config.ts`, CI는 단위만 - `repo.emu`·`mirror.emu`·`import.emu`).
  규칙 테스트: `app/windowConventions.test.ts`(창 틀·'취소' 금지·그림 단추 설명·⋮ 표) · `app/keys.test.tsx`(키 글자를 박지 않는다).
- **V4 가져오기** `src/import/v4/`(V4 자리를 읽는 곳은 여기뿐 - `boundary.test`가 지킨다, 쓰기는 V5에만): `hash.ts`(SHA-1·base32·`stableStringify`) · `ids.ts`(`v4id`·id 없는 것 `idlessKey`) ·
  `plan.ts`(다시 가져오기 규칙 `planDocs` - 지문 `src.h`로 새로·바뀜·그대로·둠·지움, V4에서 없어진 것은 `deletedBy: 'v4-import'`, 결과 수 `ImportCounts`) ·
  `record.ts`(기록 `settings/import` - 때·결과·라벨 짝 표·설정 칸마다 적은 값·띠 닫음, 결과 표 줄 `IMPORT_KINDS`) · `legacy/`(V4 옛 모양 읽기 - 본체는 import 금지) ·
  `labels.ts`(`planLabels` - V4 기본 라벨·이름 같은 V5 라벨에 잇기·짝 표) · `settings.ts`(`planSettings` - 칸마다, `COMMON_FROM_V4`) · `read.ts`(서버 읽기) ·
  `items.ts`(P3-4 `planItems` - 일정·기간 한 항목·반복 series·이월 사슬·기록·메모·링크) · `legacy/entries.ts`(기록·공휴일·기한·기간 조각 읽기) ·
  `run.ts`(`runImport`·`checkImportOffer`·`dismissImportOffer`·진행 store `useImportRun`), 결과 표 아래 안내 `record.IMPORT_NOTES`. 점검 `tools/inspect-import-items.mjs`(P3-4 - seed 수·두 번째 0·V5 고친 것 둠, 끝에 되돌림). 화면: 환경설정 '가져오기' 탭 `features/settings/ImportTab.tsx`(P8-3에서 백업 창으로) ·
  처음 로그인 띠 `features/import/ImportBanner.tsx`(Shell 본문 맨 위). 문서는 `docs/`, 소개는 `README.md`(에뮬레이터 순서).
