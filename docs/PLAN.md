# V5 작업 계획 — 작업 순서 · 이어 하기

2026-10-08 사용자와 정함. V5 = **화면·기능은 V4 그대로, 자료 모양과 뼈대는 새로**(V3·V4와 자료를 함께 쓰지 않는다. V4 자료는 한 방향으로 가져온다).
사용자 말(10-08): "정해야 하는 것은 네가 권장하는 방식을 따를께. 작업 순서를 최대한 자세하게 정리해서 중간에 작업이 중지되거나
기기·장소를 바꿔 작업을 이어갈 때 문제가 생기지 않게 중간중간 작업 정리가 될 수 있게 해줘."

함께 보는 문서(이 `docs/` 폴더 - `CLAUDE.md`만 저장소 맨 위)
- `DESIGN.md` 설계 정본 - 원칙·서버·자료 모양·계산 규칙·자료 층·뼈대·가져오기 짝 표·점검·고치기 전 체크리스트
- `MENU.md` 메뉴·화면 자리 - V4 자리 → V5 자리(합친 것·나눈 것·화면으로 꺼낸 것·메뉴로 넣은 것)
- `PARITY.md` V4 기능 대조표 - V4 설명서 68주제 + 주제 밖 기능이 어느 세션에서 되는지, 다 됐는지
- `CLAUDE.md`(저장소 맨 위) V5 공유 기억 - 모든 대화가 처음 읽는다

> 이 문서들은 P0(10-08)에 V4 저장소 `docs/V5/`에 썼고 P1-1 ■3(10-08)에 이 저장소로 옮겼다. **이 저장소 것이 정본**이다(V4 `docs/V5/README.md`는 옮긴 곳 안내뿐).

---

## 0. 이어서 하는 법 (대화를 열면 이것만 읽고 시작)

1. `git pull` — V4 저장소, V5 저장소(있으면) 둘 다. 그리고 `git status` - 커밋하지 않은 변경이 있으면 이 기기에서 끊긴 조각이다(1-6).
2. 아래 **지금 하는 일**과 `CLAUDE.md` **지금 상태**를 본다. `wip/…` 브랜치가 적혀 있으면 `git checkout <브랜치>`로 받는다.
3. **그 세션 절만** 읽는다: `grep -n "^### P" PLAN.md`로 줄을 찾아 그 절만. 다른 세션 절은 읽지 않는다.
   그 절의 **먼저 읽을 것**만 읽는다(큰 파일은 grep으로 그 부분만).
4. 체크되지 않은 첫 조각(■)부터 한다. 조각마다 1-2 '조각 끝'.
5. 조각을 다 하면 1-3 '세션 끝 정리' → 사용자에게 "P○-○ 끝. 새 대화에서 '이어서'". 다음 세션을 같은 대화에서 시작하지 않는다(긴 대화는 사용량을 많이 쓴다).
6. **정해야 할 것이 나오면 권장안을 고르고** 5장 '결정 메모'에 까닭과 함께 적은 뒤 계속한다(2026-10-08 사용자: 권장대로).
   다만 다음은 **사용자에게 묻는다**: 운영 규칙·함수 배포 / 실제 자료를 지우거나 바꾸는 일 / V4 동작을 바꾸는 일 / 돈이 드는 설정 / V4에서 사용자가 정한 것을 바꾸는 일.
7. **👤 = 사용자가 해야 하는 일**(GitHub·콘솔·휴대폰 확인). 안 되어 있으면 그것에 기대지 않는 조각을 먼저 하고, `CLAUDE.md` 지금 상태에 부탁을 적는다.

## 지금 하는 일

**P3-1 일정** ■4 앱 안 알림·＋ 새로 (■3 끝 - 클라우드 `claude/peaceful-lamport-icu4gf`).

---

## 1. 끊겨도 잃지 않게 — 중간 정리 규칙

### 1-1. 크기: 세션 = 대화 하나, 조각 = 커밋 하나
- 세션(P○-○) 하나는 새 대화 하나다. 세션은 **조각(■)** 3~5개로 나뉜다. 조각 하나는 30~60분 일, 커밋 하나.
- 조각은 **빌드·테스트가 통과하는 상태로만** 끝낸다. 덜 된 기능은 창 목록에 등록하지 않거나 화면에서 숨겨 둔다.
- 그래서 끊기면 잃는 것은 하던 조각 하나뿐이고, 그것도 그 기기 작업 트리에 남는다.

### 1-2. 조각 끝 (조각마다, 5분)
1. 빠른 확인: 바꾼 곳 `npx vitest run <파일>` → `npx tsc -b` → `npm run lint`(오류 0) → `npm run build`.
2. 화면을 바꿨으면 그 조각의 크롬 점검(있으면).
3. 이 파일의 그 조각 `[ ]` → `[x]`, **지금 하는 일**을 다음 조각으로 (같은 커밋에).
4. 커밋 `V5 P1-1 ■2 <한 일>` + 빈 줄 + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` → `git push`(main).
   - V5는 넘어가기(P9-4) 전까지 사용자 혼자 쓰므로 조각마다 main에 올린다(배포돼도 괜찮다). 빌드·테스트가 깨지면 올리지 않는다(1-5처럼 wip 브랜치).

### 1-3. 세션 끝 정리 (세션마다 - 이 목록을 그대로 따른다)
- [ ] 전체 `npx vitest run` · `npx tsc -b` · `npm run lint` · `npm run build`
- [ ] 그 세션 절의 **끝 조건**을 크롬 점검으로 확인(PC 1400px 크롬 하나)
- [ ] `PARITY.md`에서 이 세션이 끝낸 줄 체크
- [ ] 자료 모양·뼈대가 바뀌었으면 `DESIGN.md`, 자리가 바뀌었으면 `MENU.md`
- [ ] `CLAUDE.md` 7장 시스템 지도에 새 파일·자리 한 줄씩
- [ ] `CLAUDE.md` 지금 상태: 이 세션 2줄 이하(끝난 것·사용자 부탁만). 지난 세션 줄은 지운다(대화마다 읽는 파일이라 짧게)
- [ ] 이 파일: 3장 상태 `끝 (날짜)`, **지금 하는 일** = 다음 세션, 4장 세션 기록 한 줄
- [ ] 커밋·푸시 → (클라우드면 PR → CI 통과 → 합치기, 1-7) → 사용자에게 "P○-○ 끝. 새 대화에서 '이어서'" (+ 👤 부탁이 있으면 함께)

### 1-4. 단계(P○) 끝 정리 (단계의 마지막 세션에 더한다)
- 그 단계의 점검 스크립트를 모두 한 번(MATCH 없이).
- `CLAUDE.md` 7장 지도를 그 단계 기준으로 다듬고, `DESIGN.md`와 코드가 맞는지 본다.
- 가져오기가 있는 단계면 👤 실제 계정으로 한 번 가져와 보기를 부탁한다(V4는 그대로 - V5에만 쓴다).
- 3장 '단계 메모'에 V4와 달라진 점 한 줄.

### 1-5. 사용자가 '저장'·'90%'라고 하면 (곧바로)
1. 하던 조각: 빌드·테스트가 되면 main에 커밋·푸시. 안 되면 `git checkout -b wip/P1-1-3`(세션-조각) → 커밋 → `git push -u origin wip/P1-1-3`.
2. main으로 돌아와 `CLAUDE.md` 지금 상태에 세 줄: 브랜치 이름 / 그 조각에서 한 것 / 남은 것과 다음 한 걸음.
   이 파일의 그 조각 줄 끝에 `(하던 중 - wip/P1-1-3)`. 커밋·푸시.
3. 멈추고 무엇을 어디에 저장했는지 짧게 알린다.
- **이어 받을 때**: `git checkout wip/…` → 남은 것 → `git checkout main && git merge wip/…` → 확인 → 푸시 → `git push origin --delete wip/…` → 지금 상태에서 그 줄을 지운다.

### 1-6. 기기·장소를 바꿀 때
- **떠나는 기기**: 1-5와 같이 한다. 말없이 떠나도 조각마다 푸시했으므로 잃는 것은 하던 조각 하나.
- **받는 기기**: 0장 1~2. `git status`에 남은 변경이 있으면 지난번 **이 기기**에서 끊긴 것이다 -
  그 조각을 다른 기기에서 이미 끝냈으면 `git stash`로 비켜 두고(지우지 않는다) 받은 것을 따르고, 아니면 이어서 한다.
- **새 기기 준비(한 번)**: Git · Node 24 · 크롬 · JDK 21(에뮬레이터 - 기기별 경로는 V4 `CLAUDE.md` 2장) →
  한 폴더(예 `D:\gody5\Git`)에 V4·V5 저장소를 나란히 `git clone` → 각각 `npm ci`. 배포하는 기기만 `npx firebase login`.
  Claude Code는 **두 저장소의 위 폴더**나 V5 폴더로 연다. 위 폴더로 열면 그 폴더에 `CLAUDE.md`(이 기기에만)를 두어
  "School_Planner_V5/CLAUDE.md를 먼저 읽는다"라고 적는다.
- **에뮬레이터·화면**: 켜져 있는지 먼저 본다(Firestore 8080·Auth 9099). P1-2부터는 **V5 저장소에서** `npm run emu`(합친 규칙을 읽게).
  자료는 V4 `npm run seed`(계정·V4 자료) → V5 `npm run seed`(V5 자료). 개발 화면은 V5 `npm run dev`(5175). 끄지 않고 계속 쓴다.
  긴 점검 전에 `df -h /c`(C: 디스크가 차면 에뮬레이터가 죽는다 - 로그 두 개를 비운다, V4 `CLAUDE.md` 2장).

### 1-7. 클라우드 세션 (claude.ai/code)
- 👤 한 번: Claude GitHub 앱에 이 저장소 권한(claude.ai/code에서 저장소를 고를 때 `School_Planner_V5`가 없으면 GitHub › Settings › Applications › Claude › Configure).
- 새 대화는 main에서 시작한다. 클라우드는 main이 아니라 **세션 브랜치(`claude/…`)에 푸시**한다 - 1-2 '조각 끝'의 main 푸시 = 세션 브랜치 푸시(CI가 그 브랜치에서도 돈다).
  세션을 끝내면(또는 '저장') **PR을 만들고, PR의 CI(check)가 통과하면 Claude가 곧바로 합친다**(merge 커밋 `V5 P○-○ 합침 - …`) - 사용자 결정 10-08 "앞으로는 자동으로 합치고 배포해".
  합치면 main CI가 통과한 뒤 실제 주소에 저절로 배포된다(PR에는 미리 보기 주소 - 로그인은 안 된다). CI가 실패하면 고쳐 푸시하고 다시 기다린다(실패한 채 합치지 않는다).
  자동으로 하는 것은 **합치기와 화면 배포(Hosting)뿐** - 운영 규칙·함수 배포는 여전히 PC에서 묻고 한다.
  이 파일·CLAUDE.md 같은 이어 하기 문서가 main에 있어야 다음 대화가 본다(V4 10-07 - 세션 브랜치에만 두어 '이어서'를 못 했다).
- 대화 처음 준비: `npm ci`(package-lock이 바뀌면 되돌린다) → `npm run emu`를 뒤에서(Java 21 - V4 10-02 컨테이너에는 있었다) → `npm run seed`
  (V4 저장소가 없으면 seed가 점검 계정 셋을 만든다) → `npm run dev:emu`를 뒤에서. Java가 없으면 단위 테스트·빌드까지 하고 크롬 점검은 PC에 부탁한다.
- 크롬: 컨테이너에는 크롬이 없어 점검 도구가 Playwright Chromium을 찾아 쓴다(`tools/lib/probe.mjs` `browserOptions`, `CHROME=<경로>`로 정할 수도 있다).
- 기기 기억 폴더가 없다 - `CLAUDE.md` 0장의 2~4(기억 합치기)는 건너뛴다. 새로 기억할 것은 `CLAUDE.md`에만 적는다(PC에서 합칠 때 기억으로 옮긴다).
- 배포·운영 규칙·`firebase` 명령은 클라우드에서 하지 않는다(로그인이 없다) - 화면 배포는 main에 합치면 저절로, 운영 규칙·함수 배포는 PC에서(묻고).
- 컨테이너에는 저장소가 하나다. **가져오기 세션(P2-4·P3-4·P6-4·P7-5·P8-4)은 V4 저장소도 옆에 받는다**(Public이라 권한 없이, V4에는 푸시하지 않는다):
  `git clone https://github.com/hyundonglim80-gif/School_Planner_V4 ../School_Planner_V4 && cd ../School_Planner_V4 && npm ci && npm run seed`. 안 되면 PC에서.
- 규칙(`firestore.rules`)을 고치면 에뮬레이터를 처음부터 다시 켠다(켜 둔 채 고치면 죽는다 - 5장 '컨테이너 에뮬레이터'). 자료 층 테스트 `npm run test:data`는 컨테이너에서도 돈다.
- 컨테이너 크롬은 내려받은 파일 이름을 모두 `download`로 준다 - 파일 이름 점검 실패는 앱 버그가 아니다. apis.google.com이 막혀 구글 창은 안 뜬다(흉내로 본다).

### 1-8. 막혔을 때
- 계획과 코드·설계가 다르면 5장 '막힌 것'에 적는다. 권장안이 분명하면 고르고 계속, 0장 6의 '묻는 것'이면 묻는다.
- 같은 버그를 두 번 고쳐도 되살아나면 멈추고 원인부터 적는다(V4 09-22 교훈 - 증상이 아니라 구조로 확인, 짐작으로 고치지 않는다).

### 1-9. 토큰 아끼기
- 대화를 열면 `CLAUDE.md` + 이 파일 0장·지금 하는 일·그 세션 절만. `DESIGN`·`MENU`는 그 절이 가리키는 장만.
- V4 코드는 '먼저 읽을 것'에 적힌 파일만, 큰 파일은 grep으로 그 부분만. 확인은 바뀐 부분만(전체 점검은 단계 끝에만).

---

## 2. 결정 표 (2026-10-08, 사용자: 권장대로)

| 주제 | 결정 | 까닭 |
|---|---|---|
| 기존 자료 | V4 자료를 **한 방향으로 가져온다**(여러 번 해도 겹치지 않는다) | 쓰던 자료 그대로. V4를 계속 쓰면서 V5를 진짜 자료로 시험 |
| 만드는 방식 | **새 뼈대 + V4 화면 부품·순수 함수를 옮겨 오기** | 디자인은 그대로 두고 Layout 같은 짐은 버린다 |
| 서버 | Firebase `schoolplannerv3` 그대로, `(default)` DB에 새 컬렉션(`spaces` …) | uid·푸시·함수·드라이브 권한(클라우드 프로젝트에 묶임) 그대로. 이름 붙인 DB는 무료 사용량이 없다 |
| 주소 | Firebase Hosting 새 사이트 | github.io 하위 경로는 V3·V4와 출처가 같아 localStorage를 함께 쓴다. 배포 전 미리 보기 주소 |
| 기기 사본 | P2-2부터(IndexedDB, 앱이 따로 둔다) | 화면이 처음부터 사본 위에 서야 나중에 갈아 끼우지 않는다 |
| 계산으로 | 이월 · 시간표(기간별) · 기간 일정 · 기록 칸의 알림장/출결 카드 | 저장하지 않으면 덮어쓰기·사본 맞추기가 없다 |
| 메뉴 | `MENU.md`대로(⋮ 4구역 8항목, 학급 일은 학급 화면, 설정은 기능 창 안으로) | 사용자 요청(10-08) |
| 규칙 파일 | V5 저장소 `firestore.rules`가 정본(V4 규칙 전부 + V5) | 기본 DB의 규칙은 한 벌이다 |
| 함수 | codebase `v5`, 배포는 `--only functions:v5` | V4 함수(default)를 지우지 않게 |
| 에뮬레이터 | V4와 한 벌을 같이 쓴다(같은 포트) | V4 seed로 가져오기를 시험 |
| 새 기능 | 치는 대로 찾기 · 오프라인 보기 · Ctrl+Z · 쓰던 글 보관 · 주소에 화면/날짜 · ＋ 새로 · 새 학년도 넘기기 | 10-08 제안 |

## 3. 전체 차례

| 세션 | 내용 | 크기 | 권장 노력 | 상태 |
|---|---|---|---|---|
| P0 | 방향·계획 문서 | 중간 | 높음 | 끝 (2026-10-08) |
| **P1 뼈대** | | | | |
| P1-1 | 저장소·도구·문서 옮기기·CI | 중간 | 중간 | 끝 (2026-10-08) |
| P1-2 | Firebase·로그인·규칙 합치기·에뮬레이터·seed | 중간 | 높음 | 끝 (2026-10-08) |
| P1-3 | 앱 껍데기: 화면 탭·주소·창 목록·오른쪽 칸·단축키·머리줄 | 큼 | 높음 | 끝 (2026-10-08) |
| P1-4 | 설정 동기화·환경설정 탭·계정 칸·배포·PWA 틀 | 중간 | 중간 | 끝 (2026-10-08) |
| **P2 자료 층** | | | | |
| P2-1 | 타입·저장 도우미·지운 표시·되돌리기·규칙 | 중간 | 높음 | 끝 (2026-10-08) |
| P2-2 | 기기 사본(IndexedDB)·바뀐 것만 받기 | 큼 | 높음 | 끝 (2026-10-08) |
| P2-3 | 라벨(트리·속성·라벨 관리 창) | 중간 | 중간 | 끝 (2026-10-08) |
| P2-4 | 가져오기 틀 + 라벨·설정 가져오기 | 중간 | 높음 | 끝 (2026-10-08) |
| **P3 하루 화면** | | | | |
| P3-1 | 일정: 목록·카드·일정 칸·완료·순서·지우기·Ctrl+Z·앱 안 알림 | 큼 | 높음 | **다음** |
| P3-2 | 기록·메모: 카드·쓰는 칸·날짜 칸·#라벨·체크리스트·쓰던 글 보관 | 큼 | 높음 | |
| P3-3 | 이월(계산)·지난 일정 줄·기간·반복·여러 개 고르기 | 큼 | 높음 | |
| P3-4 | 가져오기: 일정·기록·메모·링크 | 중간 | 높음 | |
| **P4 메모·첨부·링크** | | | | |
| P4-1 | 메모 화면·라벨로 보기 | 중간 | 중간 | |
| P4-2 | 구글 토큰·첨부·캡처·표·클립보드·사진 보기·링크 미리보기 | 큼 | 중간 | |
| P4-3 | 링크 연결·보기 | 중간 | 중간 | |
| **P5 달력·찾기·정리** | | | | |
| P5-1 | 주간·작년 이맘때 | 중간 | 중간 | |
| P5-2 | 월간·년간·오늘로 | 큼 | 중간 | |
| P5-3 | 끌어 옮기기·D-Day·공휴일 | 중간 | 중간 | |
| P5-4 | 검색(치는 대로)·휴지통 | 중간 | 중간 | |
| **P6 수업** | | | | |
| P6-1 | 시간표(기간별)·수업 칸 계산·하루/주간 수업 칸 | 큼 | 높음 | |
| P6-2 | 진도 | 큼 | 높음 | |
| P6-3 | 수업 종·주간학습안내·나이스·인쇄 | 중간 | 중간 | |
| P6-4 | 가져오기: 수업 | 중간 | 높음 | |
| **P7 학급** | | | | |
| P7-1 | 학급·명렬표·사진 | 큼 | 중간 | |
| P7-2 | 출석부·알림장·기록 칸 카드·교과 출결 | 큼 | 높음 | |
| P7-3 | 자리표·뽑기·모둠 | 중간 | 중간 | |
| P7-4 | 조사표·모아 보기·학생 기록 | 큼 | 높음 | |
| P7-5 | 암기 + 가져오기: 학급 | 중간 | 높음 | |
| **P8 연동** | | | | |
| P8-1 | 구글 캘린더 | 중간 | 높음 | |
| P8-2 | 서버 푸시 알림(함수 v5) | 중간 | 높음 | |
| P8-3 | 백업 · 가져오기 · 보내기 창·공유받기·오프라인 앱 | 큼 | 중간 | |
| P8-4 | 공유 그룹 + 그룹 가져오기 | 중간 | 높음 | |
| **P9 마무리·넘어가기** | | | | |
| P9-1 | 설명서 옮기기·설명서 점검 | 큼 | 중간 | |
| P9-2 | 새 학년도 넘기기 | 중간 | 중간 | |
| P9-3 | 전체 점검·성능 | 중간 | 중간 | |
| P9-4 | 넘어가기(마지막 가져오기·V4 안내) | 중간 | 높음 | |

**차례의 까닭**: 뼈대(P1)와 자료 층(P2)이 모든 화면의 바탕이다. 하루 화면(P3)이 가장 많이 쓰는 곳이라 먼저 하고, 가져오기를 단계마다 붙여
P3 끝부터 사용자가 **내 자료로** 써 볼 수 있게 한다. 수업(P6)이 달력(P5) 뒤인 까닭: 수업 칸은 주간에도 그려지므로 화면 틀이 먼저 있어야 한다.
학급(P7)은 수업 칸(반 도구·출결)에 기대므로 P6 뒤.

**단계 메모** (단계가 끝날 때 V4와 달라진 점 한 줄)
- P2 자료 층(10-08): 항목·라벨이 문서 하나씩·id로 가리킨다(라벨 이름 바꾸기 = 문서 하나) · 지우기 = 지운 표시 + Ctrl+Z · 기기 사본(IndexedDB)으로 열자마자 보이고 바뀐 것만 받는다 ·
  V4 자료는 한 방향으로 가져온다(라벨·설정부터 - 여러 번 해도 겹치지 않고 V5에서 고친 것은 덮지 않는다). V3와 함께 쓰던 옛 모양 읽기는 가져오기 안에만.

## 4. 세션 기록 (한 세션 한 줄 - 어느 기기에서 어디까지 했나)

| 날짜 | 기기 | 세션 | 마지막 커밋 | 메모 |
|---|---|---|---|---|
| 2026-10-08 | 영-전-3-현동림 PC | P0 | V4 `100c0e4` | 계획 문서 다섯(V4 `docs/V5/` - P1-1에서 이 저장소로) |
| 2026-10-08 | 영-전-3-현동림 PC | P1-1 | P1-1 세션 끝 정리 | 웹에서 만든 Public 저장소를 clone · 도구·뼈대·문서·CI(42초 통과) · V4 `8d4c7b6` |
| 2026-10-08 | 영-전-3-현동림 PC | P1-2 | P1-2 세션 끝 정리 | 규칙 V4 35 + V5 45 통과 · 에뮬레이터를 V5에서 · inspect-login 통과 · V4 화면도 그 에뮬레이터에서 · V4 `1f847e1` · 운영 규칙 배포(사용자 허락, 배포 전 운영 = V4 파일 확인) |
| 2026-10-08 | 영-전-3-현동림 PC | P1-3 | P1-3 세션 끝 정리 | 단위 133 · inspect-shell 33항목 · inspect-login 통과 · 운영 빌드에 점검용 창·에뮬레이터 주소 없음 확인 |
| 2026-10-08 | 영-전-3-현동림 PC | P1-4 | P1-4 세션 끝 정리 | 단위 173 · inspect-settings 20 · inspect-pwa 5 · shell·login 통과 · https://schoolplanner-v5.web.app 자동 배포 · 👤 휴대폰 로그인 확인 · 클라우드 세션 준비(Chromium 찾기·seed 계정 만들기·CI claude/**) |
| 2026-10-08 | 클라우드(claude.ai/code) | P2-1 | P2-1 세션 끝 정리 | 단위 263 · 자료 층(에뮬레이터) 11 · check-rules V4 35 + V5 59 · inspect-data 11 · settings 20 · shell 통과 · 브랜치 `claude/happy-rubin-wcxw0e` → PR · 👤 규칙 V4 복사·운영 배포는 PC에서 |
| 2026-10-08 | 클라우드(claude.ai/code) | P2-2 | P2-2 세션 끝 정리 | 단위 309 · 자료 층(에뮬레이터) 19 · inspect-mirror 27 · data·settings·shell·login 통과 · 브랜치 `ccr-85a3b20a-nxq1q4` → PR #2 → Claude가 합침(사용자 결정: 앞으로 자동 합치기·배포) · V4는 읽기용으로 옆에 받음(`--depth 1`) |
| 2026-10-08 | 클라우드(claude.ai/code) | P2-3 | P2-3 세션 끝 정리 | 단위 363 · inspect-labels 20 · shell·settings·data 통과 · 브랜치 `claude/dreamy-ritchie-ub4ru5` → PR → Claude가 합침 · V4는 읽기용으로 옆에 받음(`--depth 1`) · 작업 중 사용량 한도로 한 번 멈췄다가 이어 함 |
| 2026-10-08 | 클라우드(claude.ai/code) | P2-4 | P2-4 세션 끝 정리 | 단위 610 · 자료 층(에뮬레이터) 24(import.emu 5) · inspect-import-labels 32 · P2 단계 점검 모두(data·mirror·labels·import-labels + shell·settings·login·pwa) 통과 · 브랜치 `claude/eager-hypatia-mlpldd` → PR → Claude가 합침 · V4는 읽기용으로 옆에 받음(`--depth 1`) · 👤 실제 계정으로 한 번 가져와 보기 |

## 5. 막힌 것 · 결정 메모

(세션이 계획과 다른 것을 만나면 여기에 적는다. 권장안으로 고른 것도 까닭과 함께 한 줄.)

- **P1-1 저장소**(10-08): 사용자가 웹에서 먼저 만들어 두었다 - **Public**, 커밋 둘(README를 만들었다 지움). 그래서 `git init` 대신 `git clone`해 그 위에 쌓았다.
  Public은 그대로 둔다(V4도 Public, Actions 시간이 무료, 저장소에 학생 자료는 없다). 비공개로 바꾸려면
  `gh repo edit hyundonglim80-gif/School_Planner_V5 --visibility private --accept-visibility-change-consequences`.
- **P1-1 tsconfig**: `strict` + `noUnusedLocals`·`noUnusedParameters`를 켰다(V4는 쓰지 않는 변수 검사를 꺼 두어 쌓였다). V4 코드를 옮길 때 그 파일만 정리한다.
- **P1-1 npm 11 설치 스크립트**: npm 11은 패키지의 설치 스크립트를 허락 없이 돌리지 않는다 → `package.json` `allowScripts`에 `@firebase/util`·`protobufjs` 허락,
  `re2` 막음(firebase-tools가 쓰는 선택 모듈, node-gyp 빌드가 필요 - 없어도 `firebase` 명령이 돈다). 새 패키지가 경고를 내면 같은 자리에서 고른다.
- **P1-2 규칙**(10-08): V4 groups보다 조였다 - 참여는 그룹에 `inviteCode`가 있을 때만(주인이 지우면 초대 닫힘), 참여자는 나만·'member'로만,
  `spaceInvites` 만들기는 그 그룹 주인만(`getAfter` - 그룹과 한 묶음으로 만들 수 있게), 개인 공간 문서는 지우지 못한다. 개인 공간 아래는 id만 보고(문서 읽기 없음).
- **P1-2 운영 규칙 배포**(10-08 사용자 허락): 배포 전에 운영 규칙(10-01 배포)이 V4 파일과 한 글자도 다르지 않음을 확인했다 → 바뀐 것은 V5 블록뿐.
  `npx firebase deploy --only firestore:rules --project schoolplannerv3` 뒤 `node tools/live-rules.cjs`로 운영 = 파일. 다음 배포도 먼저 `live-rules`로 본다.
- **P1-2 에뮬레이터**: V5 `npm run emu`는 auth·firestore만(V4 함수는 V4 것). V4 서버 푸시를 에뮬레이터로 볼 때는 V4에서
  `firebase emulators:start --only auth,firestore,functions` - 규칙 파일이 같아 결과도 같다. 이 PC는 PowerShell `Start-Process`(숨김)로 띄워 대화가 끝나도 남긴다.
- **P1-2 에뮬레이터 빌드**: 빌드 상수 `__USE_EMULATOR__`(`--mode emu` 또는 V4처럼 `VITE_USE_EMULATOR=1`) → `npm run dev:emu`(5175)·`build:emu`.
  운영 빌드에는 에뮬레이터 주소·자동 로그인이 없다(빌드 결과에서 확인). `?as=2|3`은 남은 로그인이 다른 계정이면 바꿔 들어간다.
- **P1-2 로그인 상태**: `src/data/session.ts`(zustand, 구독은 main에서 하나 - V4는 useAuth를 부르는 곳마다 구독). 들어오면 `ensurePersonalSpace`
  (없을 때만 만든다, 실패해도 앱은 막지 않고 안내 - 연결 없음은 조용히 다음에). 구글 토큰은 sessionStorage `sp5-google-token`(P4-2가 이어받는다).
  안내(toast)는 로그인 오류에 필요해 P1-3 ■4보다 먼저 `src/app/toast.ts`로 옮겼다.
- **P1-2 V5 seed**: 계정은 만들지 않고 V4 seed 계정으로 들어가 개인 공간만 심는다. 설정 기본값은 문서로 심지 않는다(앱이 셈한다 - 원칙 '계산할 수 있는 것은
  저장하지 않는다'). 점검 계정이 기본값과 달라야 하는 설정(teacher3 교과 전담 등)은 그 설정을 만드는 세션(P1-4·P6-1)에서 seed에 더한다.
- **P1-3 주소와 뒤로가기**(10-08): 화면(탭)을 바꾸면 기록 한 칸, 같은 화면에서 날짜만 바꾸면(◀▶·📅) 주소만 고친다 - ◀▶를 여러 번 누른 뒤
  뒤로가기가 하루씩 되돌아가면 '앞 화면'이 아니다. 기록과 창 층(뒤로가기로 창 닫기)은 `src/app/history.ts` 한 곳이 다룬다(기록마다 차례 번호 `sp5Idx`,
  창이 열린 동안 표지판 하나 - V4 그대로). 창을 연 채 화면을 바꾸면 [앞 화면][새 화면][표지판] → 뒤로가기는 창부터, 그다음 앞 화면.
- **P1-3 날짜**: store의 보는 날은 'YYYY-MM-DD' 글자(이 기기 시각). V4는 toISOString(UTC)이라 한국 새벽에 하루 앞날이 됐다.
  주간 둘째 줄 '○월 ○주'는 그 주(월~일) 목요일로 센다 - V4는 일요일이면 다음 주 목요일로 셌다(그 주와 어긋남).
- **P1-3 손짓**: V4처럼 환경설정 '스크롤 페이지 이동'(기본 끔)을 켰을 때만. V4가 휴대폰 첫 화면에 띄우던 손짓 안내는 기본이 꺼져 있어 맞지 않아
  P1-4(그 설정을 옮길 때)에서 안내를 설정과 함께 정한다.
- **P1-3 창 목록**: 열린 창(store)과 오른쪽 줄의 탭(틀이 줄에 선다)을 나눴다 - 창 안에서 띄우는 작은 창(등록하지 않은 PopupFrame)도
  같은 줄·탭을 쓰게(V4 그대로). ESC는 껍데기 키 처리 한 곳(`keys.ts`)이 `closeAllWindows`로 - 저장 안 한 글을 먼저 묻고, 아니라면 아무것도 닫지 않는다
  (V4는 팝업을 먼저 닫고 쓰는 칸만 물었다). 점검용 창 둘(`features/dev`, 개발·에뮬레이터 빌드에만)을 `window.sp5.openWindow`로 연다.
- **P1-3 단축키**: 정의는 `src/domain/shortcuts.ts`(V4 id 그대로 + 새 id 다섯), 하는 일은 `src/app/keys.ts` 한 곳(`runShortcut`) - 창을 여는 id는
  창 목록의 같은 id 창을 연다(창을 등록하면 단축키도 선다). **없는 기능은 브라우저 기본 동작을 막지 않는다**(검색이 들어오기 전 Ctrl+F = 브라우저 찾기).
  Ctrl+P는 화면별 인쇄(P6-3) 전까지 브라우저 인쇄. 되돌리기 Ctrl+Z는 글 칸 안에서는 듣지 않는다. 바꾼 키는 이 기기(`sp5-shortcuts`) - P1-4에서 계정과 맞춘다.
- **P1-3 머리줄**: 단추·⋮ 항목은 단축키 id로 일을 부탁한다(`keys.runFromButton`). 아직 옮기지 않은 기능은 흐린 글자로 두고 누르면
  '🚧 아직 V5로 옮기지 않은 기능입니다' - 자리를 먼저 보이게(사용자가 V5를 쓰기 전까지만 보인다). ⋮ 표는 `src/app/moreMenu.ts` 한 곳(창 목록 테스트가 지킨다),
  '이 화면 인쇄'는 주간·년간에서만. 화면 밝기 키 `sp5_theme`(이 기기), 글자 크기는 `layoutPrefs.fontScale`(P1-4에서 계정과 맞춘다).
- **P1-1 lucide-react**: V4는 한 파일에서만 써서 넣지 않았다 - 그 파일을 옮길 때 이모지로 바꿀지 그때 정한다. `App.tsx`는 `src/app/`(껍데기 자리).
- **P1-4 설정 문서**(10-08): `spaces/u_{uid}/settings/{common|pc|mobile}`에 **기본값과 다른 칸만** 적는다(통째로 setDoc - 기본값으로 되돌리면 칸이 빠진다).
  없는 칸·모양이 틀린 칸은 기본값으로 읽는다(V4는 틀린 칸에 이 기기 값을 두어 기기마다 다른 값이 남을 수 있었다). 칸 표는 `domain/settings.ts`(기본값·읽기 한 곳).
  값이 사는 store는 그대로(토글·시작 화면 = nav, 글자 크기·창 위치 = layoutPrefs, 바꾼 키 = keys) - `app/prefs.ts`가 어느 값을 어느 문서에 두는지만 정한다.
  맞추기(`data/settingsSync.ts`): V4의 getDocFromServer + 구독 대신 **구독 하나**(memoryLocalCache라 첫 소식이 서버에서 온다 - 연결 없이 캐시에서 온 '문서 없음'만 믿지 않는다).
  문서가 없으면 이 기기 값이 기본값과 다를 때만 올린다. 적기를 기다리는 1초 동안 온 서버 값은 입히지 않는다(이 기기에서 방금 바꾼 것이 더 새것 - V4는 덮였다).
  이 기기 사본의 주인 `sp5-settings-owner` - 다른 계정으로 들어오면 앞 사람 설정을 기본값으로 비운다(새 계정 문서에 올리지 않게, `?as=` 점검도).
  `common`은 지금 이월 기간 `forwardDays`(1~60, 기본 14)만 - 그 기능을 옮기는 세션이 칸을 더한다. `updatedAt`·`v`는 저장 도우미 `put`이 붙인다(P2-1 - 그 전에는 `settingsPort`가).
  **시작 화면**은 주소에 화면이 없을 때만(설치한 앱·첫 주소) - 새로고침·주소로 연 것은 그 화면 그대로.
- **P1-4 환경설정 창**: '보기' 탭은 모두 **누르는 즉시** 바뀐다(V4는 글자 크기·창 위치·화면 밝기만 즉시, 토글·시작 화면은 '저장'을 기다려 섞여 있었다).
  '저장'은 단축키 탭에만 - 키를 하나씩 바꾸는 동안 잠깐 겹치므로(겹치면 저장을 막는다). Ctrl+S = 고치던 단축키 저장(다른 탭에 있어도), 고치던 것은 탭을 바꿔도 남고 ESC 때 묻는다.
  아직 옮기지 않은 기능의 탭(알림 P8-2·학교 P3-3/P6-1/P6-3·개발자)은 `SettingsWindow.tsx` 탭 표의 `ready: false`로 숨긴다 - 기능을 옮기는 세션이 켠다.
  단축키 목록에는 아직 없는 기능도 흐리게 두어 키를 미리 정할 수 있다. P1-3에서 미룬 손짓 안내는 '스크롤로 페이지 이동' 줄의 설명으로(첫 화면에 띄우지 않는다).
- **P1-4 계정 칸**: 머리줄 사진 → 드롭다운(⋮와 같은 모양) 이름·메일·🚪 로그아웃. V4의 PC 머리줄 로그아웃 단추·휴대폰 ⋮ 로그아웃은 이 칸 하나로.
  로그아웃은 먼저 1초 뒤 올리려던 설정을 올리고(`stopPrefsSync`, 3초까지) 나간다 - 뒤에 가면 권한이 없어 버려진다.
- **P1-4 PWA 틀**: ■4(배포)가 사용자 일을 기다려 ■5를 먼저 했다. 아이콘 글자를 V5로(P1-1이 V4 favicon을 그대로 옮겨 'V4'였다) → `tools/gen-icons.mjs`로 PNG.
  `sw.js`는 설치·활성만(fetch를 가로채지 않는다 - 화면 파일은 늘 서버에서). 지금 크롬은 설치에 fetch 처리기를 요구하지 않는다(CDP 설치 오류 0으로 확인).
  등록·설치 이벤트는 `src/app/install.ts`(main에서 일찍 - 이벤트가 화면보다 먼저 온다), 단추는 환경설정 '앱' 탭. 점검 `tools/inspect-pwa.mjs`(임시 프로필 - 시크릿 창은 크롬이 설치를 막는다).
- **P1-4 배포**(10-08 사용자 허락 '만들고 배포'): Hosting 사이트 `schoolplanner-v5` → https://schoolplanner-v5.web.app (프로젝트의 기본 사이트 `schoolplannerv3`는 그대로).
  첫 배포는 이 PC에서 `npx firebase deploy --only hosting --project schoolplannerv3`(규칙·함수는 건드리지 않는다). `firebase.json` hosting: site·`dist`,
  첫 주소·index.html·sw.js·manifest.json은 `no-cache`(정규식 하나 - 첫 주소 '/'는 source '/index.html'에 걸리지 않는다), `/assets/**`는 1년(파일 이름에 해시).
  `authDomain`은 콘솔 두 곳(👤 승인된 도메인 · OAuth 클라이언트 원본·**리디렉션 URI** `https://schoolplanner-v5.web.app/__/auth/handler`)이 된 뒤에 바꾼다 -
  리디렉션 URI가 없으면 바꾸는 순간 로그인이 redirect_uri_mismatch로 막힌다(계획에는 JS 원본만 적혀 있었다).
  승인된 도메인은 `getProjectConfig?key=…`(공개)로 확인했고, 리디렉션 URI는 실제 로그인으로만 확인된다(Google이 로그인 뒤에야 견준다) → 10-08 바꿔 다시 배포.
- **P1-4 자동 배포**: 👤 `init hosting:github`가 비밀값 `FIREBASE_SERVICE_ACCOUNT_SCHOOLPLANNERV3`와 작업 파일 둘을 만들었다. 다듬은 것:
  merge = CI가 main에서 **통과한 뒤**(`workflow_run`) 그 커밋을 배포(깨진 빌드가 실제 주소에 가지 않게, 잇달아 올리면 마지막 것만), Node 24 맞춤.
  PR = 미리 보기 주소(7일) - 승인된 도메인이 아니라 구글 로그인은 안 된다(화면만). 사용자가 따로 GCP 프로젝트 'SchoolPlannerV5'를 만들었지만
  V5는 `schoolplannerv3`를 그대로 쓴다(uid·드라이브 drive.file·푸시가 묶여 있다) - 새 프로젝트는 쓰지 않는다(지워도 된다).
  init이 함께 깐 Firebase AI 스킬(`.agents/`·`.claude/skills/`·`skills-lock.json`)은 앱과 상관없어 `.gitignore`.
- **P2-1 저장 도우미**(10-08): 규칙 부분(`data/repo/ops.ts` - 무엇을 적나 `toWrite`, 되돌리는 쓰기 `undoOf`)과 적는 부분(`repo/index.ts`)을 나눴다.
  쓰기 하나 = `WriteOp` 하나, 되돌리기 = WriteOp 목록(`Undo`)이라 되돌리기도 `batch(undo)` 한 길이다. 늘 `writeBatch`로 적고 500개를 넘으면 나눈다(그때는 묶음마다만 한꺼번에).
  **만들기의 되돌리기는 지운 표시**(영구로 지우면 다른 기기 사본이 모른다), 영구 지우기의 되돌리기는 그 문서를 그대로 다시 적기(put).
  `patch`는 `updateDoc`(없는 문서면 실패 - 지운 항목을 빈 껍데기로 되살리지 않는다). 날짜 문서(lessonDays 등)를 처음 만드는 길은 그 세션(P6-1·P7-2)이 더한다.
  `patch(자리, 바꿀 칸, 고치기 전 문서)` - 고치기 전 값은 서버에서 읽지 않고 화면이 든 문서에서. undefined = 칸 지우기, 점 = 깊은 칸.
  설정 동기화는 `writeOps`(안내 없이 원래 오류 - 뒤에서 맞추는 것이라 V4처럼 콘솔에만). **P2-2에 넘길 것**: 사본에서 꺼낸 문서를 `purge`·되돌리기에 넘길 때 Timestamp를 되살려야 한다
  (IndexedDB에서 꺼내면 `{seconds, nanoseconds}` 맵이 되어 규칙의 `deletedAt is timestamp`에 걸린다).
  또 **영구 지우기는 '바뀐 것만 받기'에 보이지 않는다**(문서가 없어져 `updatedAt`이 없다) - 다른 기기 사본에는 지운 표시가 붙은 채 남아 그 기기 휴지통에 계속 보인다.
  P2-2(또는 휴지통 P5-4)에서 사본의 지운 항목을 서버의 지운 항목 목록과 가끔 견줘 없는 것을 사본에서 뺀다.
- **P2-1 되돌리기**(10-08): `recordUndo(공간, 안내, 되돌리는 쓰기, { what })` 하나로 안내의 '되돌리기' 단추와 Ctrl+Z 더미가 함께 선다 - 어느 쪽으로 되돌려도 그 하나가 빠진다.
  더미는 공간마다 20개, 로그인한 사람이 바뀌면 비운다. 실패하면 더미 맨 위로 돌려놓는다(다시 Ctrl+Z). 다시 하기(되돌리기의 되돌리기)는 없다.
  Ctrl+Z는 `main.tsx`에서 `setShortcutAction('undo', undoLast)` - 지금 공간은 개인 공간 하나(P8-4가 보는 공간으로). 비었으면 '되돌릴 것이 없습니다'.
  Ctrl+Z로 되돌리면 안내에 `what`('메모 지우기')을 붙인다 - 단추로 되돌릴 때는 방금 본 안내라 붙이지 않는다. **기능 세션이 쓰기마다 `what`을 준다.**
- **P2-1 규칙**(10-08): items·labels는 `kind`('event'|'note')·`deletedAt`(칸이 있고 null 또는 시각)·`v`(정수)·**`updatedAt == request.time`**만 본다.
  서버 시각은 계획에 없던 것을 더했다 - 기기 시각이거나 칸만 고치고 빠뜨리면 기기 사본(P2-2)이 '바뀐 것만 받기'로 그 쓰기를 영영 놓치므로, 규칙에서 막아 저장 실패로 드러낸다.
  같은 문서에 맞는 match가 여럿이면 하나만 허락해도 되므로 컬렉션마다 match를 두지 않고 `spaces/{sid}/{sub}/{document=**}` 하나에서 `sub`로 가른다(읽기·지우기는 모양을 보지 않는다).
  check-rules V5 45 → 59. 👤 **PC에서**: V4 저장소 `firestore.rules`에 그대로 복사(V4 check:rules) → `node tools/live-rules.cjs`로 운영 = 앞 파일인지 보고 → 운영 배포(묻고).
  지금 운영에 V5 항목 쓰기가 없어 배포가 늦어도 깨지는 것은 없다(배포 전 규칙이 더 느슨하다).
- **P2-2 사본 DB**(10-08): 계획의 '공간·컬렉션마다 저장소' 대신 저장소 둘(`docs` 열쇠 [공간, 컬렉션, id] · `meta`)을 열쇠 범위로 나눴다 -
  저장소를 더하려면 DB 판을 올려야 하는데 판 올리기는 다른 탭이 열어 둔 동안 막힌다(그룹 공간에 들어갈 때마다 판을 올릴 수 없다).
  P2-1에서 넘겨받은 것 둘 다 했다: Timestamp는 `mirror/codec.ts`로 지키고(에뮬레이터에서 사본 문서로 영구 지우기·되돌리기가 규칙을 지남), 다른 기기의 영구 지우기는 하루 한 번 견주기.
- **P2-2 내 쓰기 먼저(덧칠)**: Firestore 구독은 내가 쓰는 동안 그 문서를 결과에서 '빠짐'으로 준다(에뮬레이터 실험 - snap·문서 모두 hasPendingWrites=false라 가려낼 수 없다).
  그래서 화면에 먼저 보이기는 Firestore에 맡기지 않고 저장 도우미가 적기 직전에 store에 덧칠한다. '빠짐'은 덧칠이 없을 때만 서버에 물어 정말 없으면 뺀다.
  덧칠을 걷는 때: 쓰기가 끝나고 서버 판이 한 번 더 올 때(그 전에 왔으면 끝날 때) - 쓰는 동안은 구독이 그 문서를 주지 않으므로 그 뒤 처음 오는 판에는 내 쓰기가 들어 있다.
- **P2-2 구독 메타데이터**: 빈 컬렉션은 구독의 첫 소식이 캐시에서 오고, 서버가 같은 결과를 확인해도 문서 변화가 없어 기본으로는 소식이 오지 않는다
  → '구독 중'이 되지 않았다(자료 층 테스트로 찾음). `includeMetadataChanges: true`로 받고, 커서는 그 소식의 결과 전체에서 가장 늦은 판으로.
- **P2-2 로그아웃**(권장안으로 고름): 로그아웃하면 그 계정의 기기 사본을 지운다 - V4에는 기기 사본이 없었고, 교실 PC를 함께 쓰면 학생 자료가 남는다. 다시 들어오면 서버에서 다시 받는다(읽기만 든다).
  로그인이 저절로 풀린 것(토큰 만료)은 지우지 않는다 - 사용자가 누른 로그아웃만.
- **P2-2 화면 문서의 id**: 고르기가 주는 문서에 자리 `id`를 붙였다(`Stored<C>` - 차례 `compareOrder`도 id를 쓴다). 저장 도우미는 맨 위 `id`를 적지 않는다(만들기·통째로·되돌리기에서 뺀다, patch로 바꾸면 던진다).
- **P2-2 처음 받기 쿼리**: 쪽 나누기는 `orderBy('updatedAt')` + `startAfter(마지막 문서)`(같은 시각을 id로 가른다 - 한 묶음 쓰기는 모두 같은 서버 시각이라 시각만으로는 쪽 경계에서 빠진다).
  이어 받기는 `startAt(after 시각)`(겹쳐 받기). 처음 받기·견주기·확인은 `…FromServer`(연결 없이 캐시의 일부를 '다 받음'으로 믿지 않게).
- **컨테이너 에뮬레이터**(10-08): 켜 둔 채 `firestore.rules`를 고치면 규칙 다시 읽기에서 Auth 쪽이 죽고 Firestore(java)만 남아 포트를 쥔다 →
  `ps aux | grep cloud-firestore-emulator`로 그 java를 끄고 `npm run emu`를 다시. 규칙을 고친 뒤에는 처음부터 다시 켠다.
- **P2-3 라벨 트리**(10-08): 상위는 라벨 문서마다 `parentId`(DESIGN 4-3). 문서 값은 믿지 않고 다듬어 쓴다(`domain/labelTree` `parentMapOf` - 상위가 목록에 없거나
  자기 자신이거나 3단계면 그 하위는 맨 위 단계로). **지운 상위의 하위 문서는 고쳐 쓰지 않는다**(권장안) - 맨 위 단계로 보이다가 상위를 휴지통에서 되살리면 트리가 돌아온다,
  '이름을 바꾸면 문서 하나'처럼 지우기도 문서 하나. V4 빈 라벨 정리는 상위/하위 연결을 함께 뗐다 - V5는 떼지 않아도 같게 보인다.
- **P2-3 기본 라벨**(권장안으로 고름): 라벨이 하나도 없는 공간에 저절로 넣지 않는다 - 라벨 관리 창의 그 탭이 비었을 때(서버 확인 뒤) '기본 라벨 넣기' 단추.
  V4 사용자는 P2-4 가져오기로 라벨이 들어오는데, 먼저 기본 라벨을 만들어 두면 이름이 같은 라벨이 겹친다. id를 정해 두어(`dflt_e1`…) 두 기기에서 함께 눌러도 하나.
  일정 = V4 기본 다섯(달력·수업X·이월·기간·반복), 메모·기록 = V4 기록 기본 넷과 라벨 관리 창의 메모 기본에서 겹치지 않게 일곱(긴급·중요·학급활동·학생상담·업무전달·수업기록·개인).
- **P2-4 다시 가져오기 = 지문**(권장안으로 고름): 계획의 'V5에서 고친 것 = `updatedAt` > 지난 가져오기 때' 대신 문서마다 `src.h`(가져올 때 적은 칸의 지문)와
  지금 칸을 견준다 - 가져오기가 중간에 끊겨 기록을 못 남겨도, 여러 기기가 가져와도 문서마다 맞다. V4에서 없어진 것의 지운 표시는 `deletedBy: 'v4-import'` -
  사용자가 지운 것(되살리지 않는다)과 가져오기가 지운 것(V4에 다시 생기면 새로)을 가른다.
- **P2-4 기록**(권장안으로 고름): 가져오기 기록은 `settings/common.import`가 아니라 **`settings/import`** 문서 - 설정 맞추기(`data/settingsSync`)가 `common`을
  아는 칸만으로 통째로 다시 쓰므로 모르는 칸(기록)이 지워진다. 띠 닫음(`dismissed`)도 여기(계정에 하나).
- **P2-4 라벨 이름이 같을 때**(권장안으로 고름): V5에 이름이 같은 라벨(V5에서 만든 것·'기본 라벨 넣기')이 있으면 새로 만들지 않고 그 라벨에 잇는다
  (같은 종류 안에서 이름이 겹치면 라벨 관리 창이 저장을 막는다). 이은 것은 짝 표(`settings/import.labelMap` - V4 이름 → V5 id)에 - P3-4 항목 가져오기가 이것으로 라벨을 찾는다.
  V4에 라벨 문서가 없으면 V4가 보이던 기본 라벨(일정 다섯·기록 넷·메모 다섯)을 가져온다 - 그 사람 항목이 그 id·이름을 들고 있다.
- **P2-4 설정 가져오기는 칸마다**: 설정 문서에는 기본값과 다른 칸만 있어 문서 지문으로는 'V5에서 바꿨나'를 알 수 없다 → 기록에 칸마다 가져오기가 적은 값을 두고 견준다.
  V4 이월 기간(기기마다 `forwardLookbackDays`)은 V5 `common.forwardDays` 하나로(PC 값 먼저). 교사 유형·수업 종 같은 common 칸은 그 칸이 생기는 세션이
  `import/v4/settings.ts` `COMMON_FROM_V4`에 한 줄 더한다(칸이 없으면 설정 맞추기가 지운다).
- **P2-4 되돌리기 없음**: 가져오기는 Ctrl+Z 더미에 넣지 않는다 - 수백 개를 한꺼번에 지운 표시로 되돌리면 더 위험하고, 다시 가져오기가 바뀐 것만 고친다.
- **P3-1 완료·순서의 되돌리기**(권장안으로 고름): ☐ 완료·라벨 칩·▲▼는 V4처럼 안내를 띄우지 않고 Ctrl+Z 더미에만 넣는다(`recordUndo(…, { quiet: true })`) -
  누를 때마다 '되돌리기' 안내가 뜨면 시끄럽고, 잘못 누른 것은 한 번 더 누르거나 Ctrl+Z로 되돌린다. 지우기·옮기기는 안내 + 되돌리기(■3).
- **P3-1 순서**: ▲▼는 보이는 줄을 다시 세워 `rekeyOrders`로 **옮긴 것만** 새 차례 값 - 한 칸 옮기기는 문서 하나(어느 쪽이 바뀔지는 가장 긴 오름차순이 정한다).
  두 기기가 같은 차례 값을 만든 줄도 그 자리에서 풀린다. 기간 일정(P3-3)은 차례 값이 하나라 한 날에서 옮기면 다른 날에서도 그 차례다.
- **P3-1 쓰는 칸 자리**: 창 목록의 쓰는 칸 `event` - 새 일정 = `{ sid, date }`(같은 날의 새 일정 칸이 열려 있으면 그 탭), 수정 = `{ sid, date, id }`(같은 일정이면 그 탭 - 항목은 id로 찾으므로 날짜는 보지 않는다).
  저장한 새 일정 칸은 창의 `setParams`로 id를 더해 그 일정의 수정 칸이 된다(V4 `setEntryPanelId` - 다시 그리지 않아 적은 것이 남는다).
- **P3-1 하루 화면**: V4의 '불러오는 중' 막기와 `EmptyDayReport`(왜 비었나 서버에 묻기)는 옮기지 않는다 - 기기 사본에서 곧바로 그리고, 사본도 서버 소식도 없을 때만 '일정을 받는 중…'.
  V4 진단은 Firestore 캐시가 고장 났던 때(09-22)의 것이고 V5 사본 상태는 환경설정 '앱' 탭이 보인다.
- **P3-1 알림 = 일정 날의 시각**(DESIGN 4-2대로): 알림 창에 날짜 칸이 없다 - 일정 날짜를 옮기면 알림도 따라간다(V4는 알림 날짜를 따로 골랐고, 옮길 때 같은 날 수만큼 옮겼다).
  앞날 알림은 드물고, 따로 두면 옮기기·이월·서버 푸시(P8-2)가 날짜 둘을 맞춰야 한다. 시각을 바꾸거나 다른 날로 옮기면 `alarmDone`을 지워 다시 울린다.
  P3-4 가져오기: V4 알림 날짜가 일정 날과 다르면 그 시각을 일정 날에 두고 결과 표에 수를 적는다.
- **P3-1 속성 적기**: 일정 칸의 속성(달력·이월·수업X·구글 캘린더)은 **라벨이 정한 값과 다른 것만** `props`에 적는다(V4는 모두 적었고 구글 캘린더만 같으면 비웠다) -
  나중에 라벨 속성을 바꾸면 손대지 않은 일정이 따라간다. 라벨이 정한 값 = 붙은 라벨 가운데 하나라도 켰으면 켬, 라벨이 없으면 달력만 켬(V4 그대로).
  라벨을 바꾸면 따로 정한 것은 걷는다(V4 '라벨을 고르면 그 라벨 속성이 따라 켜진다'). 기간·반복은 속성이 아니라 일정 칸의 줄(P3-3).
- **P3-1 테스트와 Firebase**: `data/select`·`session`을 부르는 단위 테스트는 `vi.mock('…/data/firebase')`를 둔다 - 진짜 앱을 띄우면 시험이 끝난 뒤 Firebase가
  IndexedDB를 열다 jsdom이 걷혀 '처리하지 않은 오류'가 가끔(3번에 1번) 남는다. vitest가 'originated in …'으로 그 파일을 알려 준다.
- **P2-3 차례**: 라벨 관리 창의 ▲▼는 창 안에서만 줄을 바꾸고, 저장할 때 **옮긴 라벨만** 새 차례 값(`domain/order` `rekeyOrders` - 가장 긴 오름차순을 남긴다).
  일정 라벨 속성은 바뀌면 여섯 칸을 모두 채워 적는다(읽기는 `labelProps` - 적지 않은 달력 = 켜짐, V4와 같다).

---

## 6. 세션별 내용

> 형식: **시작 조건** → **먼저 읽을 것** → 조각 ■ → **끝 조건**. 끝나면 1-3 세션 끝 정리. V4 파일 경로는 `../School_Planner_V4/` 기준.

### P0. 방향·계획 (끝)
- [x] ■1 V4 분석과 V5 방향 (2026-10-08 대화)
- [x] ■2 계획 문서 다섯 `docs/V5/`(PLAN·DESIGN·MENU·PARITY·CLAUDE 초안)
- [x] ■3 V4 `CLAUDE.md` 지금 상태·`docs/ROADMAP.md` 지금 하는 일에 V5 안내, 커밋·푸시

### P1-1. 저장소·도구·문서 옮기기·CI
**시작 조건**: GitHub에 빈 저장소 `hyundonglim80-gif/School_Planner_V5` — **Private**, README·.gitignore·라이선스 없이.
- **gh가 로그인되어 있으면**(`gh auth status`에 hyundonglim80-gif) Claude가 `gh repo create hyundonglim80-gif/School_Planner_V5 --private`로 만든다
  (10-08 계획에서 사용자가 저장소 만들기를 맡김 - 이미 있으면 만들지 않는다). gh가 없거나 로그인 전이면 👤 웹에서 만들어 달라고 한다.
  gh 설치: `winget install --id GitHub.cli -e` → VS Code를 완전히 껐다 켜기(PATH) → `gh auth login`(GitHub.com · HTTPS · Yes · 웹 브라우저).
- 확인: `git ls-remote https://github.com/hyundonglim80-gif/School_Planner_V5.git`가 오류 없이 끝난다(빈 저장소면 아무것도 나오지 않는다).
- 저장소가 없으면 ■1~■3을 로컬에서 하고 ■4에서 멈춘다 - 지금 상태에 '로컬에만(기기 이름)'을 적고, 그동안은 V4 `docs/V5/`가 정본이다.
- gh가 있으면 Claude가 Actions 결과도 직접 본다(`gh run list`·`gh run watch`).
👤 클라우드 세션도 쓰려면 Claude GitHub 앱에 이 저장소 권한을 더한다.
**먼저 읽을 것**: `DESIGN.md` 7-1, V4 `package.json`·`tsconfig*.json`·`vite.config.ts`·`vitest.config.ts`·`.github/workflows/deploy.yml`·`.gitignore`, V4 `CLAUDE.md` 0~2장.
- [x] ■1 폴더와 도구: V4 옆 `School_Planner_V5`. `package.json`은 V4와 같은 판(React 19·Vite 8·TS 6·Tailwind 4·zustand 5·firebase 12·
  vitest 5·oxlint·playwright·jsdom·testing-library) + `idb`, `fake-indexeddb`(테스트). react-router-dom은 넣지 않는다(V4도 쓰지 않았다).
  스크립트: `dev`(5175)·`build`·`preview`(4175)·`test`·`lint`·`emu`·`seed`·`check:rules`. `tsconfig`·`vite.config`(base `/`, `__BUILD_ID__`)·`vitest.config`·
  `.gitignore`(node_modules·dist·*.log·firebase-debug.log·firestore-debug.log·.env*). `npm install` → package-lock.
- [x] ■2 뼈대 폴더(`DESIGN.md` 7-1: app·data·domain·features·import/v4·ui) + `main.tsx`·`App.tsx`에 'SP5'와 빌드 번호, Tailwind, 테스트 하나. `npm run build`·`npx vitest run` 통과.
- [x] ■3 문서: V4 `docs/V5/{PLAN,DESIGN,MENU,PARITY}.md` → V5 `docs/`, V4 `docs/V5/CLAUDE.md` → V5 `CLAUDE.md`(맨 위).
  문서 안의 'V4 저장소 docs/V5에 있다' 안내 문구와 경로를 V5 기준으로 고친다. `README.md` 한 문단.
- [x] ■4 GitHub: `git init -b main` → `git remote add origin …` → 첫 커밋·푸시(10-08: 저장소가 이미 있어 clone으로 대신, ■1부터 조각마다 푸시). 그다음 **V4 저장소**: `docs/V5/`의 다섯 파일을 지우고
  `docs/V5/README.md`(옮긴 곳 한 줄), V4 `CLAUDE.md` 지금 상태의 V5 줄을 'V5 저장소 CLAUDE.md를 본다'로 고쳐 커밋·푸시.
  이 PC의 `D:\gody5\Git\CLAUDE.md`(이 기기에만)를 'School_Planner_V5/CLAUDE.md를 먼저 읽는다'로.
- [x] ■5 CI: `.github/workflows/ci.yml` - push·PR마다 lint → test → build(배포는 P1-4). 푸시해 통과를 본다(👤 gh가 없으면 Actions 탭을 보고 알려 달라고 한다).
**끝 조건**: 다른 폴더에 `git clone` → `npm ci` → `npm run build`·`npx vitest run` 통과. V4 `CLAUDE.md`와 이 PC 위 폴더 `CLAUDE.md`가 V5 저장소를 가리킨다.

### P1-2. Firebase·로그인·규칙 합치기·에뮬레이터·seed
**시작 조건**: P1-1 끝.
**먼저 읽을 것**: `DESIGN.md` 3장·4-1·4-8, V4 `src/lib/firebase.ts`·`lib/emulator.ts`·`lib/accountProbe.ts`·`features/auth/*`·`firestore.rules`·`firebase.json`·
`tools/check-rules.mjs`·`tools/seed.mjs`(계정 만드는 앞부분), V4 `CLAUDE.md` 2장(JDK·에뮬레이터).
- [x] ■1 `firebase.json`: firestore rules `firestore.rules`, emulators(auth 9099·firestore 8080·ui 4000·singleProjectMode - **V4와 같은 포트·project id**),
  hosting 자리(P1-4), functions는 P8-2(codebase `v5`). `npm run emu` = `firebase emulators:start --only auth,firestore --project schoolplannerv3`.
- [x] ■2 규칙 합치기: V4 `firestore.rules` 통째로 + V5 블록(`spaces/{sid}` - 개인 `u_{uid}`는 본인만, 그룹은 `members`에 있는 사람, 아래 문서도 같은 규칙 /
  `spaceInvites/{code}` get만·list 막음 / `v5alarms` 막음). `tools/check-rules.mjs`: V4 35개 그대로 + V5 검사(남의 개인 공간·구성원 아님·초대 코드 목록 막힘 …).
  에뮬레이터를 V5에서 켜고 통과.
- [x] ■3 V4 쪽: V4 `firestore.rules`를 합친 것과 같게 + 맨 위 "정본은 V5 저장소 firestore.rules - 여기서 고치지 않는다", V4 `npm run check:rules` 통과 → V4 커밋·푸시.
  👤 **운영 규칙 배포는 묻고 한다**(`npx firebase deploy --only firestore:rules --project schoolplannerv3` - V4 규칙은 그대로라 V3·V4에는 바뀌는 것이 없다).
  묻기 전·답을 받기 전에는 배포하지 않는다(에뮬레이터로만 계속 - 운영 V5 쓰기는 P1-4 배포 뒤에야 필요하다).
- [x] ■4 `src/data/firebase.ts`: V4와 같은 웹 앱 설정, 앱 이름 `SchoolPlannerV5`, Firestore `memoryLocalCache`(기기 사본은 P2-2에서 앱이 따로),
  `VITE_USE_EMULATOR=1`이면 에뮬레이터. 로그인(구글, V4 `LoginScreen` 옮기기), 로그인하면 `spaces/u_{uid}`가 없으면 만든다.
  에뮬레이터 자동 로그인 `?as=2|3`(V4 `autoSignIn`).
- [x] ■5 `tools/seed.mjs`(V5): V4 seed가 만든 계정(teacher·teacher2·teacher3)으로 로그인해 V5 공간·설정 기본값만. 순서(V4 seed → V5 seed)를 README에.
**끝 조건**: 에뮬레이터에서 teacher로 로그인 → `spaces/u_{uid}` 생김. V5·V4 check-rules 모두 통과. V4 화면(serve-both)도 그 에뮬레이터에서 그대로 돈다.

### P1-3. 앱 껍데기: 화면 탭·주소·창 목록·오른쪽 칸·단축키·머리줄
**시작 조건**: P1-2 끝.
**먼저 읽을 것**: `MENU.md` 1·3장, `DESIGN.md` 7장, V4 `components/Layout.tsx`(머리줄 680~1030줄·`runShortcut` 450줄~·오른쪽 줄 1040줄~ - grep으로),
`PopupFrame.tsx`·`ModalShell.tsx`·`SidePanelFrame.tsx`·`ColumnResizer.tsx`·`panelRaise.ts`·`MobileTabBar.tsx`·`MiniCalendarPicker.tsx`,
`hooks/useModalLayer.ts`·`useBodyScrollLock.ts`·`useBackdropClose.ts`·`useMainWidth.ts`·`useIsMobile.ts`·`useGlobalGestures.ts`·`useVisualViewport.ts`,
`lib/shortcuts.ts`·`theme.ts`·`fontScale.ts`·`typeScale.ts`·`dateUtils.ts`·`todayScroll.ts`·`lazyWithReload.ts`, `utils/toast.ts`, `src/dark.css`·`tools/gen-dark-css.mjs`,
테스트 `modalConventions.test.ts`.
- [x] ■1 store(zustand)의 화면·날짜 + 주소(`DESIGN.md` 7-3)가 서로 맞물리게, 뒤로가기 = 앞 화면. 화면 탭(PC)·탭바(휴대폰), 날짜 이동(`addMonthsClamped`·주말을 감추면 건너뛰기),
  둘째 줄(토글·◀ 날짜 ▶·📅 고르기·D-Day 자리·년간 학기 칩). 빈 화면 여섯.
- [x] ■2 창 목록 + 오른쪽 칸: `registerWindow`·`openWindow`(`DESIGN.md` 7-2), ModalShell·PopupFrame·SidePanelFrame 옮기기, 탭(숨은 탭 display:none - 글이 남는다),
  폭 끌기·두 번 누르기, ESC = 줄 전체(저장 안 한 글은 묻기), Ctrl+S = 커서 든 칸 → 없으면 보이는 탭, 휴대폰 뒤로가기 = 맨 위 하나, 가운데 창 모드.
  시험 창 둘(쓰는 칸 하나·창 하나). `modalConventions` 테스트 옮기기 + 창 목록 테스트(`MENU.md` 5장).
- [x] ■3 단축키: `SHORTCUT_ACTIONS` 옮기기(id 그대로 + 새 id `newEvent`·`newNote`·`newMemo`·`print`·`undo` - `MENU.md` 3-8), 키 처리 한 곳(창 목록 id로 연다),
  글을 칠 때는 Ctrl·Alt 없는 키를 듣지 않는다. 설명서·툴팁에 키 글자를 박지 않는 테스트.
- [x] ■4 머리줄(`MENU.md` 3-1): ⏳ D-Day 자리·🗑️·＋ 새로(PC)/둥근 ＋(휴대폰)·🔍·화면 탭·📂 자리·?·⋮(창 목록에서 4구역)·계정 칸 자리.
  다크 모드(`gen-dark-css` 옮기기)·글자 크기·안내(toast)·빌드 번호.
- [x] ■5 점검 틀: `tools/lib/probe.mjs`(크롬·1400px·`data-*`로 찾기·`waitFor`·`serverUntil`·자료 되돌리기 도우미) + `tools/inspect-shell.mjs`(화면 탭·주소·뒤로가기·창 둘 탭·ESC·Ctrl+S·단축키).
**끝 조건**: 빈 화면 여섯을 탭·단축키·주소로 오가고, 시험 창 둘이 V4처럼 탭·ESC·Ctrl+S·뒤로가기로 움직인다(`inspect-shell` 통과).

### P1-4. 설정 동기화·환경설정 탭·계정 칸·배포·PWA 틀
**시작 조건**: P1-3 끝.
**먼저 읽을 것**: `MENU.md` 3-5·3-6, `DESIGN.md` 3장(주소)·4-8, V4 `lib/preferenceSync.ts`·`hooks/usePreferenceSync.ts`·`components/SettingsModal.tsx`(구역만 - `grep -n 'title="'`)·
`ShortcutModal.tsx`, V4 `public/manifest.json`·`public/sw.js`(앞부분)·`tools/gen-icons.mjs`.
- [x] ■1 설정 문서 `settings/common`·`pc`·`mobile` + 동기화(V4 preferenceSync - 1초 뒤 올림, PC/휴대폰 가르기) + store.
- [x] ■2 환경설정 창(창 목록 `settings`, 탭 다섯 + 개발자 - `MENU.md` 3-6). 지금 있는 것만 채우고 아직 없는 기능의 칸은 숨긴다. 단축키 바꾸기(ShortcutModal 옮기기).
- [x] ■3 계정 칸(사진 누르기): 이름·메일·로그아웃(공유 그룹은 P8-4 전까지 숨김).
- [x] ■4 배포: 👤 사이트 이름 고르기(권장 `schoolplanner-v5`, 쓰고 있으면 `sp5-` 붙인 이름) → `npx firebase hosting:sites:create <이름> --project schoolplannerv3`(묻고).
  `firebase.json` hosting(site·`dist`). 👤 콘솔 두 곳: Firebase › Authentication › 설정 › 승인된 도메인에 `<이름>.web.app` /
  Google Cloud › API 및 서비스 › 사용자 인증 정보 › V4가 쓰는 OAuth 웹 클라이언트 › 승인된 JavaScript 원본에 `https://<이름>.web.app`(드라이브·캘린더 토큰).
  `authDomain`을 `<이름>.web.app`로. 👤 `npx firebase init hosting:github`(브라우저로 GitHub 허락 → 서비스 계정·Secret이 저절로) → main 푸시 = 배포, PR = 미리 보기 주소.
  (운영 규칙은 P1-2에서 배포했다 - 10-08. 규칙을 또 고쳤으면 `node tools/live-rules.cjs`로 보고 배포를 묻는다.)
- [x] ■5 PWA 틀: manifest(이름 SP5, 아이콘은 V4 gen-icons로 PNG), `sw.js` 최소(설치만 - 앱 파일 캐시는 P8-3), 화면 끝에 빌드 번호.
**끝 조건**: 실제 주소에서 구글 로그인 → 빈 V5. PC에서 글자 크기를 바꾸면 다른 탭·다른 기기(같은 종류)에 따라온다. 👤 휴대폰에서 주소가 열리는지 한 번.

### P2-1. 타입·저장 도우미·지운 표시·되돌리기·규칙
**시작 조건**: P1-4 끝(배포가 늦어지면 P1-3 끝이어도 된다 - 에뮬레이터로).
**먼저 읽을 것**: `DESIGN.md` 2·4·6-1장, V4 `utils/toast.ts`(failWithToast·ShownError·showErrorToastOnce)·`lib/undoToast.ts`.
- [x] ■1 `src/data/types.ts`(`DESIGN.md` 4장 그대로), `newId()`(20자 - `data/id.ts`), 차례 값 `domain/order.ts`(분수 인덱스 - 두 값 사이 값, 테스트).
- [x] ■2 저장 도우미 `src/data/repo/`: `create`·`patch`·`remove`(지운 표시)·`restore`·`purge`·`batch` - `updatedAt` 서버 시각, 만들 때 `deletedAt: null`·`v`·`createdAt`·`authorId`.
  실패는 `failWithToast`로 던진다. 모두 **되돌릴 값**을 돌려준다.
- [x] ■3 되돌리기 `src/data/undo.ts`: 안내의 '되돌리기'(V4 undoToast 모양) + Ctrl+Z 쌓기(글 칸 밖에서만, 공간마다 20개).
- [x] ■4 규칙: items·labels 모양 검사(`kind`·`deletedAt`·`v` 정도 - 지나치게 막지 않는다), check-rules V5 검사 더하기.
- [x] ■5 자료 층 테스트(에뮬레이터, 따로 된 설정 `vitest.data.config.ts` · `npm run test:data` - PC에서. CI는 단위만): 만들기·고치기·지우기·되살리기·되돌리기·Ctrl+Z.
**끝 조건**: 위 테스트 통과. 저장이 실패하면 던지는 것을 테스트로 본다.

### P2-2. 기기 사본(IndexedDB)·바뀐 것만 받기
**시작 조건**: P2-1 끝.
**먼저 읽을 것**: `DESIGN.md` 6-2·6-3, 이 파일 5장 'P2-1 저장 도우미'(사본 Timestamp 되살리기·영구 지우기는 받기에 보이지 않음), V4 `CLAUDE.md` 4장(09-22 'primary lease' - 무엇이 달라야 하나), V4 `lib/clipboardHistory.ts`(V4의 IndexedDB 쓰는 법).
- [x] ■1 `src/data/mirror/db.ts`(idb): DB `sp5-mirror-{uid}`, 공간·컬렉션마다 저장소, 커서.
  → 저장소는 둘(`docs` 열쇠 [공간, 컬렉션, id] · `meta`) - 공간·컬렉션은 열쇠 범위로 나눈다(5장 'P2-2 사본 DB'). Timestamp는 `codec.ts`로 지킨다.
- [x] ■2 동기화 `src/data/mirror/sync.ts`: 처음 = 이번 학년도부터 쪽 나눠 받고 나머지는 뒤에서 / 그 뒤 = 컬렉션마다 `updatedAt > 커서 - 1분` 구독 하나 →
  사본·store에 넣기(지운 표시도 그대로) / 내 쓰기는 화면에 먼저.
  → `mirror/store.ts`(서버 판 + 내 쓰기 덧칠 - 저장 도우미가 적기 직전에 얹고 서버 판이 오면 걷는다), `mirror/server.ts`(Firestore 받는 길 - 시험은 흉내 서버),
  구독의 '빠짐'은 서버에 물어 확인(내 쓰기 중에도 빠진다), 하루 한 번 지운 항목 견주기(다른 기기의 영구 지우기). 받는 컬렉션 `MIRRORED` = items·labels·series.
- [x] ■3 store 고르기 `src/data/select.ts`: 날짜로·기간으로·라벨로·종류로·메모만. 화면은 이것만 쓴다.
  → 순수 함수(`itemsOn`·`itemsBetween`·`itemsWithLabels`·`itemsOfKind`·`memos`·`trashOf`·`labelsOf`) + 같은 이름의 `use…` 훅(지금 공간 `useCurrentSpaceId` - data/session).
  문서에 자리 `id`가 붙는다(`Stored<C>`) - 저장 도우미는 id를 적지 않는다.
- [x] ■4 고장 대비: IndexedDB가 없거나·지워지거나·막히면 메모리로만(서버 구독은 그대로), 다음에 다시. 환경설정 '앱' 탭 '이 기기 사본 다시 받기'. 두 탭이 같이 써도 같은 값.
  → 받은 것은 먼저 메모리, 사본에는 뒤따라(기다리지 않는다). 열기 실패·시간 넘음·도중에 잃음·적기 실패 = 메모리로만, 이 탭에서는 다시 열지 않는다(빈 DB에 커서만 앞서는 것을 막는다).
  꺼내지 못하는 사본은 지워 다음에 새로 받는다. 두 탭은 줄마다 늦은 판이 이기고 커서는 합친다. 로그아웃하면 그 계정의 사본을 지운다(5장 'P2-2 로그아웃').
- [x] ■5 테스트(fake-indexeddb + 에뮬레이터): 다른 탭에서 고친 것 받기·지운 표시·커서 겹침·사본 지우고 다시 받기·IndexedDB 없음.
  크롬 점검 `inspect-mirror.mjs`: 새로고침 때 사본으로 먼저 그린다(네트워크를 막고도), 다른 탭 변경이 2초 안에, **IndexedDB를 지운 채로도 서버 자료가 들어온다**.
  → 단위(흉내 서버 + fake-indexeddb) `mirror/*.test.ts` 34 + `select.test.ts` 10 · 자료 층 `mirror.emu.test.ts` 8(다른 기기 쓰기·지운 표시·영구 지우기·내 쓰기 먼저·사본 문서로 영구 지우기 되돌리기·겹쳐 받기·다시 받기·IndexedDB 없음) ·
  `inspect-mirror.mjs` 27항목(서버를 막고 사본으로 먼저·다른 탭 3ms·다른 기기 7ms·도는 중 IndexedDB 지움/처음부터 막힘에도 서버 자료·다시 받기·로그아웃 지움).
  에뮬레이터로 찾은 것: 빈 컬렉션은 구독의 첫 소식이 캐시에서 오고 서버 확인은 메타데이터 소식으로만 온다 → `includeMetadataChanges`.
**끝 조건**: 위 점검 통과. IndexedDB가 고장 나도 서버 구독이 멈추지 않는 것을 **구조로** 확인했다(증상만 보지 않는다).

### P2-3. 라벨
**시작 조건**: P2-2 끝. 라벨 목록은 기기 사본에서 `data/select`의 `labelsOf`·`useLabels`로 고르고(이미 있다), 쓰기는 저장 도우미로 - 화면에 먼저 보인다.
**먼저 읽을 것**: `DESIGN.md` 4-3, V4 설명서 `labels`·`event-attrs` 주제, V4 `components/LabelModal.tsx`·`hooks/useLabels.ts`·`lib/labelTree.ts`·`lib/labelUsage.ts`·`lib/eventLabels.ts`(풀이 규칙만).
- [x] ■1 labels 저장·고르기(일정 / 메모·기록, parentId, props, 차례), `domain/labelTree.ts`(V4 labelTree를 id로 - 테스트째), 맨 위 라벨 = 기본값.
  → `domain/labels.ts`(색 표·속성 읽기 `labelProps`·기본 라벨) · `data/labels.ts`(쓰기 묶음 `labelSaveOps` - 바뀐 칸만·옮긴 것만·지운 표시, `createLabelOp`·`defaultLabelOps`·이름 검사) ·
  `select.ts` `labelTreeOf`·`useLabelTree`(트리 차례·기본 라벨 `defaultId`)·`itemsMatching`(라벨로 보기)·`labelUsageOf`(붙은 수 - 사본에서 바로) · `order.ts` `rekeyOrders`.
- [x] ■2 라벨 관리 창(LabelModal 옮기기: 탭 둘·색·차례·속성(달력·이월·수업X·구글 캘린더)·상위/하위·더할 때 상위 고르기·빈 라벨 정리 = 사본에서 바로 세기·지우기 = 지운 표시).
  각 칸 ⚙️에서 그 탭으로.
  → `features/labels/LabelsWindow.tsx`(창 목록 `labels` - ⋮ 일정, `openWindow('labels', { tab: 'note' })`) · `ColorPicker.tsx`. 창은 고친 것만 들고(덧칠) 나머지는 사본 그대로 -
  열어 둔 동안 다른 기기에서 고친 것도 들어온다. 붙은 수는 늘 보인다(V4 '🔢 항목 수 세기' 단추는 없앴다 - 사본에서 바로), 항목을 다 받기 전에는 세지 않는다.
  '삭제된 라벨 복구' = 지웠지만 살아 있는 항목에 붙은 라벨 되살리기. 빈 탭에는 '기본 라벨 넣기'. 크롬 `inspect-labels.mjs` 20항목.
- [x] ■3 라벨 칩·고르기 부품(쓰는 칸·카드가 쓸 것) + 크롬 점검 `inspect-labels.mjs`(이름 바꾸기 = 서버 문서 하나).
  → `features/labels/LabelChip.tsx`(`LabelChip`·`LabelChips` - 끝낸 항목은 회색) · `LabelPicker.tsx`(일정 = 라벨 색, 메모·기록 = 트리 차례 └, '+ 새 라벨'은 저장 때 만들 이름 -
  `data/labels` `ensureLabelOps`로 항목과 한 묶음, ⚙️ = 라벨 관리 그 탭) · `select` `itemLabels`(붙인 차례, 지운 라벨은 뺀다).
  라벨로 보기 칩 줄(접기·'기타'·수)은 그 화면을 옮기는 P3-2·P4-1이 `domain/labelTree`의 고르기 규칙 위에 짓는다.
**끝 조건**: 라벨 이름을 바꾸면 서버에서 그 라벨 문서 하나만 바뀐다. 설명서 `labels` 주제가 된다.

### P2-4. 가져오기 틀 + 라벨·설정 가져오기
**시작 조건**: P2-3 끝. V4 저장소가 옆에 있고 에뮬레이터에 V4 seed 자료가 있다.
**먼저 읽을 것**: `DESIGN.md` 8장, V4 `lib/eventText.ts`·`lib/evalList.ts`·`lib/entryLabels.ts`·`lib/legacyLabels.ts`·`lib/eventLabels.ts`·`hooks/useLabels.ts`(normalizeEventLabel)·
`lib/labelTree.ts`(readLabelTree)·`lib/preferenceSync.ts`·`lib/backupJson.ts`(V4가 무엇을 어디서 읽나 - 목록으로 좋다).
- [x] ■1 `src/import/v4/` 틀: 결정적 id(`DESIGN.md` 8-2), 진행 칸·결과 표(종류·학년도별 수), 다시 가져오기 규칙(V5에서 고친 것은 덮지 않음·V4에서 지운 것은 지운 표시),
  가져오기 기록 `settings/common.import`(때·수·짝 표).
  → `hash.ts`(SHA-1·base32·`stableStringify`) · `ids.ts`(`v4id`·id 없는 것 `idlessKey`/`nthKey`) · `plan.ts`(`planDocs` - 지문 `src.h`로 새로·바뀜·그대로·둠·지움,
  결과 수 `ImportCounts`(학년도별 `years`)) · `record.ts`(기록은 **`settings/import`** - `common`이 아니다, 5장) · 저장 도우미 `remove(자리, 누가)`(`deletedBy: 'v4-import'`).
  진행 칸·결과 표 화면은 ■4.
- [x] ■2 옛 모양 읽기를 `import/v4/legacy/`로 테스트째 옮긴다: readEventList·parseV3EventText·normalizeEventLabel·readEvalList·mergeEntryLabels·resolveEventLabelNames·readLabelTree.
  V5 본체가 이것을 import하지 않는지 테스트로 지킨다.
  → `legacy/eventText.ts`·`evalList.ts`·`eventLabels.ts`(+ V4 기본 일정 라벨)·`entryLabels.ts`(+ V4 기본 메모·기록 라벨, `mergeEntryTrees`)·`labelTree.ts` + `legacy.test.ts`(V4 테스트째, 쓰는 쪽은 뺐다 -
  V5는 V4에 쓰지 않는다. `resolveEventLabelNames`의 keepUnknown도 뺐다 - 가져오기는 V4 라벨을 늘 먼저 읽는다).
  `import/v4/boundary.test.ts`: `src/import/` 밖은 legacy를 import하지 않고 V4 자리(`'users'`·`'groups'`)를 부르지 않는다.
- [x] ■3 라벨·설정: `settings/labels` → labels(일정 = V3 이름 먼저, 메모·기록 = 이름으로 합침 + `v4_labelTree` 상위, `v4_gcal` → `props.gcal`, 짝 표),
  V4 설정 문서들 → settings(`DESIGN.md` 8-3 표).
  → `labels.ts`(`planLabels` - V4에 문서가 없으면 V4 기본 라벨, V5에 이름이 같은 라벨이 있으면 그 라벨에 잇기, 짝 표 = V4 이름 → V5 id) ·
  `settings.ts`(`planSettings` - **칸마다** 지난번에 적은 값과 견준다: V5에서 바꾼 칸은 둠, V4에 그 문서가 없으면 건너뜀. 지금은 pc·mobile 칸 전부 + common `forwardDays`) ·
  `read.ts`(V4 자리를 읽는 유일한 곳·V5 문서는 서버에서) · `run.ts`(`runImport`·`checkImportOffer`·`dismissImportOffer`, 진행 store `useImportRun` - 500개씩, 기록은 맨 끝, 되돌리기에 넣지 않음) ·
  자료 층 `import.emu.test.ts` 5(규칙을 지남·두 번째는 라벨 문서를 다시 쓰지 않음·V4에서 지운 라벨·띠).
- [x] ■4 화면: 환경설정에 '가져오기' 자리(P8-3에서 백업 · 가져오기 · 보내기 창으로 옮긴다) + 처음 로그인 때 'V4 자료 가져오기' 띠.
  점검 `inspect-import-labels.mjs`: V4 seed → 가져오기 → 라벨 이름·색·속성·상위가 같다, 두 번째 가져오기는 '바뀐 것 0'.
  → `features/settings/ImportTab.tsx`(탭 '가져오기' - 단추·진행 칸·결과 표 `[data-import-run|progress|result|row|count|years|last|failed]`) ·
  `features/import/ImportBanner.tsx`(`Shell` 본문 맨 위, `[data-import-banner|banner-run|banner-close]`) · 열린 환경설정 창을 다른 탭으로 다시 열면 그 탭으로 ·
  seed가 계정마다 띠 닫음(`settings/import.dismissed`)을 심는다 · 크롬 `inspect-import-labels.mjs` 32항목.
**끝 조건**: 위 점검 통과. **P2 단계 끝 정리**(1-4).

### P3-1. 일정: 목록·카드·일정 칸·완료·순서·지우기·Ctrl+Z·앱 안 알림
**시작 조건**: P2-4 끝.
**먼저 읽을 것**: V4 설명서 `event-add`·`event-edit`·`event-complete`·`event-labels`·`event-attrs`·`alarm`, V4 `features/day/DayScreen.tsx`·`DayEvents.tsx`·`EmptyDayReport.tsx`,
`components/EventDrawer.tsx`·`EventItemActions.tsx`·`EventAlarmModal.tsx`·`EventAlarmPopup.tsx`·`QuickInputChips.tsx`·`DueBadge.tsx`·`EntryPanelHost.tsx`,
`lib/quickInput.ts`·`eventDue.ts`·`sound.ts`, `hooks/useEventAlarms.ts`.
- [x] ■1 하루 화면 틀(수업 자리·일정·기록 자리·급식 자리) + 일정 목록(PC 1열·휴대폰 2열 카드, ☐ 완료, 라벨 칩 누르기 = 완료, ⏰, 🔗 수, `data-event-*`), 순서 바꾸기(`order` 하나만).
  → `features/day/DayScreen.tsx`(수업·기록 자리는 `[data-day-slot]`) · `DayEvents.tsx`(`[data-day-events|event-card|event-done|event-complete|event-chip|event-alarm|event-links|event-up|event-down|event-edit|event-add|event-count|event-collapse|event-empty|event-waiting]`) ·
  `features/events/`(`eventOps.ts` 순수 - `reorderOps`(rekeyOrders로 옮긴 것만)·`doneChanges`·`orderAfter` / `actions.ts` `setEventDone`·`moveEventInList` / `open.ts` 쓰는 칸 'event' 열기·고치는 일정 짚기 / `DueBadge.tsx`) ·
  `domain/eventDue.ts`(V4 테스트째 - 사슬 기한은 없다) · `recordUndo(…, { quiet })` · 창 `setParams`(windows `setWindowParams`) · 크롬 `inspect-events.mjs` 16항목(■5에서 늘린다).
- [x] ■2 일정 칸(EventDrawer 옮기기 - 쓰는 칸 kind `event`): 내용 칸 맨 위·날짜·알림 시각·라벨·속성 줄(달력·이월·수업X·구글 캘린더 - 값이 있으면 라벨을 이긴다)·기한·빠른 입력 칩.
  저장하면 그 항목의 수정 칸이 된다. 날짜를 바꾸면 `date`만.
  → `features/events/EventPanel.tsx`(창 목록 `event` - `[data-event-panel=new|edit|event-id|event-text-input|event-date|event-date-prev|next|event-move-note|event-move-keep|event-due-input|event-due-clear|event-alarm-open|event-link-add|event-attr|event-save|event-close|event-missing]`) ·
  `eventForm.ts`(순수 - 속성 = 라벨 먼저·다른 것만 `propsToStore`, 라벨을 바꾸면 따로 정한 것을 걷음, 저장 = 바뀐 칸만 `editChanges`) · `actions.ts` `createEvent`·`saveEvent`(옮기기의 되돌리기는 날짜만)·`setEventAlarm` ·
  `EventAlarmWindow.tsx`(⏰ 시각만 - `[data-alarm-window|alarm-time|alarm-save|alarm-off]`, 하루 카드 ⏰는 누르는 즉시 저장) · `QuickInputChips.tsx`(`[data-quick-chip]`) ·
  `domain/quickInput.ts`(V4 테스트째) · `domain/eventAlarm.ts` `normalizeTimeInput` · `ui/AutoTextarea.tsx`(V4 테스트째) · `dateUtils.shortDateLabel` · 크롬 `inspect-events` 40항목.
  미룬 것: 반복 칩·'🔁 반복'·'끝 날'·이월 일정을 지난 날로 옮길 때 안내 → P3-3, 🔗 링크 추가 → P4-3(지금은 🚧), 구글 캘린더 로그인 묻기 → P8-1.
- [x] ■3 지우기 = 지운 표시 + 안내 '되돌리기' + Ctrl+Z. 저장 실패면 칸을 닫지 않는다.
  → `actions.deleteEvent`(확인 창 없이 - V4 그대로, 그 일정을 고치던 칸은 `open.closeEventPanelsFor`로 닫는다) · 카드 🗑️ `[data-event-delete]`(✏️ 옆, 마우스를 올리면) · 칸의 '삭제'.
  크롬 `inspect-events` 51항목(🗑️·안내 되돌리기·칸 삭제·Ctrl+Z·완료 Ctrl+Z). 묶음 지우기(이 날만·이 날부터·전부)는 P3-3.
- [ ] ■4 앱 안 알림(useEventAlarms·EventAlarmPopup·소리 3초마다 3번·🔇 옮기기 - 사본에서 오늘 알림을 본다. 서버 푸시는 P8-2) + 머리줄 ＋ 새로 → 새 일정 칸.
- [ ] ■5 크롬 점검 `inspect-events.mjs`: 추가·완료·순서·고치기·날짜 바꾸기·지우기·되돌리기·Ctrl+Z, **저장마다 서버 문서 하나만** 바뀌는지.
**끝 조건**: 위 설명서 주제가 V5에서 된다(PARITY 체크).

### P3-2. 기록·메모: 카드·쓰는 칸·날짜 칸·#라벨·체크리스트·쓰던 글 보관
**시작 조건**: P3-1 끝.
**먼저 읽을 것**: V4 설명서 `journal`·`memo-write`·`move-entry`, V4 `components/EntryDrawer.tsx`·`EntryCard.tsx`·`AutoTextarea.tsx`·`StudentTagPicker.tsx`·`StudentMentionList.tsx`·
`EntryTableView.tsx`(보기만 - 붙여넣기는 P4-2), `features/day/DayJournal.tsx`, `lib/hashLabels.ts`·`checkLines.ts`·`mention.ts`·`studentTag.ts`·`entryCollapse.ts`·`journalEntries.ts`.
- [ ] ■1 기록 목록(DayJournal: PC 2~4열·휴대폰 2열, 머리줄 `▼ 기록 N [+ 추가] [+ 메모] … ⚙️`) + EntryCard 옮기기(머리줄 한 줄·칩 위·접기·☑ n/m·체크 줄 누르기·체크한 줄 아래·완료·★·'📅 m/d에서').
- [ ] ■2 쓰는 칸(EntryDrawer 옮기기): 📅 날짜 = 자리(바꾸면 `date`만 - 휴지통 사본 없음), 첫·마지막 줄 #라벨, ☑ 체크리스트(Enter 이어 쓰기·단축키), '+ 새 라벨',
  @이름 학생 태그(학급은 P7 전까지 이름 칩만 - `studentIds` 자리만), 완료·★(저장된 항목은 그 칸만 곧바로).
- [ ] ■3 쓰던 글 보관: IndexedDB `drafts`(칸마다, 2초 뒤), 칸을 다시 열면 '저장하지 않은 글이 있습니다 - 되살리기', 저장하면 지움.
- [ ] ■4 ＋ 새로 → 새 기록·새 메모 + 크롬 점검 `inspect-notes.mjs`(쓰기·#라벨·체크·날짜 넣고 빼기 = 문서 하나의 `date`만·쓰던 글 되살리기).
**끝 조건**: 설명서 `journal`·`memo-write`·`move-entry`가 된다.

### P3-3. 이월(계산)·지난 일정 줄·기간·반복·여러 개 고르기
**시작 조건**: P3-2 끝.
**먼저 읽을 것**: `DESIGN.md` 4-4·5-1·5-3, V4 설명서 `forwarding`·`period`·`recurring`·`group-delete`·`multi-select`, V4 `lib/forwarding.ts`,
`hooks/useDayData.ts`의 `runAutoForwarding`(159~460줄 - 판단 규칙만), `components/ForwardingModal.tsx`·`PeriodModal.tsx`·`RecurringModal.tsx`·`GroupDeleteModal.tsx`·
`GroupMoveModal.tsx`·`MultiEventActionBar.tsx`, `lib/eventGroups.ts`, `store/useAppStore.ts`의 `bulk*`.
- [ ] ■1 이월 계산 `domain/forward.ts`(`DESIGN.md` 5-1 - 판단은 V4와 같게, 처음 따라올 때 `carrying` 한 번, 끝내면 `date` = 그날·`carriedFrom`) + 테스트.
  오늘 칸 '↪ m/d부터', 지난 날 흐리게 '→ 오늘로'. 이월 중 알림을 어떻게 할지 정해 5장에 적는다.
- [ ] ■2 '📥 지난 일정 N개 ▸'(오늘일 때 일정 칸 아래 - 이월 대상이 아닌 끝내지 않은 지난 N일 일정, 골라 오늘로 = `date` 바꾸기, 되돌리기). ⋮에는 두지 않는다(`MENU.md` 2-1).
- [ ] ■3 기간 일정 = 한 항목(일정 칸 '끝 날', 날마다 '(k/n)'은 계산, 날마다 완료 `doneDates`), 묶음 지우기·옮기기 '이 날만(나누기)·이 날부터(끝 날 당기기)·전부'.
- [ ] ■4 반복: 일정 칸 '🔁 반복' 줄(안 함·매일·매주 요일·매월 n째 주 요일·끝나는 날) → `series` + 항목들(한 batch), '이 날부터 바꾸기·지우기'.
- [ ] ■5 여러 개 고르기: ⋮ + 일정 카드 Ctrl+누르기·Shift 범위(휴대폰 길게 누르기) → 아래 동작 줄(완료·라벨·날짜·지우기·끝), 되돌리기.
  크롬 점검 `inspect-forward.mjs`·`inspect-multi.mjs`.
**끝 조건**: 위 설명서 주제가 된다. **앱을 열 때 이월이 서버에 아무것도 쓰지 않는다**(처음 따라올 때 한 번만 - 점검으로 확인).

### P3-4. 가져오기: 일정·기록·메모·링크
**시작 조건**: P3-3 끝. V4 seed 자료.
**먼저 읽을 것**: `DESIGN.md` 8-2·8-3, V4 `lib/eventText.ts`·`eventLabels.ts`·`eventDue.ts`·`eventDueStore.ts`·`periodBars.ts`(조각 알아보기 - groupId + '(i/n)')·
`holidays.ts`(isHolidayEvent)·`journalEntries.ts`·`entryTable.ts`(TABLE_ONLY_CONTENT)·`utils/linkUtils.ts`.
**P2-4가 둔 틀**(V5 `src/import/v4/`): `planDocs`(지문으로 새로·바뀜·그대로·둠·지움 - `ImportColl`에 'items'가 있다, `Planned.year`로 학년도별 수) · `ids`(`v4id`·`idlessKey`) ·
`legacy/`(readEventList·resolveEventLabelNames …) · 라벨은 `planLabels(…).labelMap`(V4 이름 → V5 id - 같은 실행에서) · `run.ts`에 라벨 뒤 차례로 더하고 `record.IMPORT_KINDS`에 줄을 더한다.
- [ ] ■1 `events/{date}` → items(event): readEventList(id 없는 항목 - `DESIGN.md` 8-2), 라벨 셋 자리 → `labelIds`, 속성(V3 이름 먼저), time·alarmTriggered,
  기한(사슬로), 공휴일 일정 빼기, 이월 사슬 → `carriedFrom`, authorId·createdAt·`src`.
- [ ] ■2 기간 조각 → 한 항목(글 끝 '(i/n)' 떼기, 날마다 완료 → `doneDates`, 조각마다 글이 다르면 따로 두고 결과 표에), 반복 묶음 → `series`(imported) + 항목들.
- [ ] ■3 `journals` → items(note, date), `tasks` → items(note, null): 라벨 짝, tables, attachments, completed·favorite·fromDate·keepId, '[표]' → 빈 글,
  `notice_`·`attendance_` 자동 기록은 가져오지 않는다. `linkedItems` → `linkIds`(결정적 id로 바로 셈, 수업 → `'lesson:{date}:{n}'`).
- [ ] ■4 결과 표 + 점검 `inspect-import-items.mjs`(V4 seed 수와 맞다·두 번째는 바뀐 것 0·V5에서 고친 것은 그대로). 👤 실제 계정으로 가져와 하루·메모 화면을 V4와 견주기 부탁.
**끝 조건**: 점검 통과(사용자 확인은 받았거나 지금 상태에 부탁으로). **P3 단계 끝 정리**(1-4).

### P4-1. 메모 화면·라벨로 보기
**시작 조건**: P3-4 끝.
**먼저 읽을 것**: V4 설명서 `memo-screen`·`memo-manage`·`journal-view`, V4 `features/memo/*`, `lib/labelTree.ts`(matchEntry·clickFilterLabel·filterChipOrder·readLabelFilter)·`lib/masonry.ts`.
- [ ] ■1 메모 화면(MemoScreen·MemoMasonry·MemoCard·QuickLinks 옮기기 - 즐겨찾기가 있으면 즐겨찾기 먼저·없으면 전체, 접기, '완료된 메모 모두 삭제' = 지운 표시 여럿 + 되돌리기).
- [ ] ■2 라벨로 보기(MemoFilter 옮기기 - 탐색기식 누르기·상위 → 하위·'기타'·처음 접힘·ESC·'?'), 기록 칸도 같은 부품, 고른 라벨 기억.
- [ ] ■3 크롬 점검 `inspect-memo.mjs`.
**끝 조건**: 설명서 `memo-screen`·`memo-manage`·`journal-view`가 된다.

### P4-2. 구글 토큰·첨부·캡처·표·클립보드·사진 보기·링크 미리보기
**시작 조건**: P4-1 끝. 👤 P1-4의 OAuth 승인된 JavaScript 원본에 새 주소가 들어가 있다(없으면 에뮬레이터·흉내로만 하고 실제 확인은 부탁으로).
**먼저 읽을 것**: V4 설명서 `attach`·`paste-table`·`paste-image`·`clipboard`·`image-viewer`, V4 `lib/googleApi.ts`·`googleLoginPrompt.ts`·`components/GoogleLoginPrompt.tsx`·
`lib/driveApi.ts`·`attachments.ts`·`imageShrink.ts`·`shrinkWorker.ts`·`hooks/usePasteImageUpload.ts`·`utils/uploadHelper.ts`·`lib/entryTable.ts`·`components/EntryTableView.tsx`·
`ClipboardPanel.tsx`·`lib/clipboardHistory.ts`·`ImageViewerModal.tsx`·`lib/linkPreview.ts`·`LinkPreviewCards.tsx`.
- [ ] ■1 구글 토큰(조용한 토큰·누른 직후 로그인 창·'구글 로그인이 필요합니다' 창 - V4 규칙 그대로).
- [ ] ■2 첨부(드라이브 `School_Planner` 폴더 - V4가 올린 파일이 그대로 열린다), 캡처 Ctrl+V(줄이기 워커), 엑셀 표 붙여넣기(표 먼저 - 그림 올리기로 넘기지 않는다), 링크 미리보기.
- [ ] ■3 클립보드 칸(왼쪽 📋, IndexedDB 이 기기만, 지우면 이 기기 휴지통), 이미지 크게 보기(넘겨 보기·3:4 틀).
- [ ] ■4 크롬 점검(구글 API는 page.route로 흉내) + 👤 실제 계정: V4에서 가져온 기록의 첨부 하나가 V5에서 열리는지.
**끝 조건**: 위 설명서 주제가 된다.

### P4-3. 링크 연결·보기
**시작 조건**: P4-2 끝.
**먼저 읽을 것**: V4 설명서 `links`·`link-viewer`, V4 `components/LinkerModal.tsx`·`LinkViewerModal.tsx`·`utils/linkUtils.ts`·`lib/semester.ts`(schoolYearSpan).
- [ ] ■1 링크 연결 창(LinkerModal 옮기기 - 사본에서 목록, 기간 고르기), 저장 = 양쪽 `linkIds`를 한 batch로, 저장 뒤 닫기.
- [ ] ■2 링크 보기(LinkViewerModal - 탭, 같은 항목은 그 탭), 고치기 = 같은 쓰는 칸. 수업 링크는 P6-1 뒤 수업 칸으로(그 전에는 그날로만).
- [ ] ■3 '+ 새 00 만들어 연결'(처음 저장하면 연결) + 크롬 점검 `inspect-links.mjs`(가져온 V4 링크가 양쪽에 보인다).
**끝 조건**: 설명서 `links`·`link-viewer`가 된다. **P4 단계 끝 정리**(1-4).

### P5-1. 주간·작년 이맘때
**시작 조건**: P4-3 끝.
**먼저 읽을 것**: V4 설명서 `week`·`badges`·`toggles`, V4 `features/week/*`, `hooks/useLastYearWeek.ts`, `lib/lastYearWeek.ts`·`lastYearImport.ts`.
- [ ] ■1 주간 표(WeekGrid·WeekHeader 옮기기 - 본문 1200px가 넘으면 다음 주도(읽는 범위는 늘 두 주), 요일 카드, 일정 칩 완료, 📝 표식, 수업 칸 자리(P6-1), 주말 감추기, `data-today`·`data-today-area`).
- [ ] ■2 작년 이맘때(학년도 몇째 주, 이번 주 줄에만 흐리게, 골라서 올해로 = 새 항목 - 첨부·링크·알림·묶음은 빼고, 같은 글은 건너뜀, 되돌리기).
- [ ] ■3 크롬 점검 `inspect-week.mjs`.

### P5-2. 월간·년간·오늘로
**시작 조건**: P5-1 끝.
**먼저 읽을 것**: V4 설명서 `month`·`year`, V4 `features/month/*`·`features/year/*`, `lib/periodBars.ts`(그리기 부분)·`yearSheet.ts`·`todayScroll.ts`.
- [ ] ■1 월간(MonthGrid subgrid - 한 주 한 줄, 기간 막대 = 항목의 `date`~`endDate` 그대로, 휴대폰 MonthDaySheet·칩 완료).
- [ ] ■2 년간(📅 학사력 / 📋 자세히 - 고른 것은 이 기기, 학기 칩, 달 나눠 그리기) + 오늘로(V4 todayScroll - 2.5초 찾고 0.7초 지켜보기).
- [ ] ■3 크롬 점검 `inspect-month-year.mjs`.

### P5-3. 끌어 옮기기·D-Day·공휴일
**시작 조건**: P5-2 끝.
**먼저 읽을 것**: V4 설명서 `event-edit`(옮기기)·`dday`·`holidays`, V4 `hooks/useEventDrag.tsx`·`useEventMove.tsx`·`components/GroupMoveModal.tsx`·`DDayModal.tsx`·`hooks/useDDay.ts`·
`lib/holiday.ts`·`holidays.ts`·`hooks/useGovHolidays.ts`·`components/HolidayName.tsx`.
- [ ] ■1 끌어 옮기기(주간·월간·년간 자세히 - `date`만, 기간·반복이면 범위 묻기, 되돌리기).
- [ ] ■2 D-Day(`settings/common.ddays` - 머리줄·둘째 줄·관리 창), 공휴일(`holidays/{year}` + 개인 공휴일)·주말 색.
- [ ] ■3 크롬 점검.

### P5-4. 검색(치는 대로)·휴지통
**시작 조건**: P5-3 끝.
**먼저 읽을 것**: V4 설명서 `search`·`trash`, V4 `components/SearchModal.tsx`·`lib/searchFocus.ts`·`components/TrashModal.tsx`·`lib/trashRetention.ts`.
- [ ] ■1 검색(사본에서 치는 대로 - 모든 학년도·종류·라벨·기간·첨부만, 결과를 누르면 그 자리로 가서 찾은 글을 짚는다).
- [ ] ■2 휴지통(지운 표시 걸러 보기·되살리기·영구 삭제 = 문서 지우기 + 드라이브 첨부 정리(누른 때 토큰), ⚙️ 자동 비우기 - `settings/common.trashDays`, 앱을 열 때 지난 것만).
- [ ] ■3 크롬 점검.
**끝 조건**: 설명서 `search`·`trash`가 된다. **P5 단계 끝 정리**(1-4).

### P6-1. 시간표(기간별)·수업 칸 계산·하루/주간 수업 칸
**시작 조건**: P5-4 끝.
**먼저 읽을 것**: `DESIGN.md` 4-5·5-2, V4 설명서 `teaching-mode`·`class-cell`·`detail-popup`·`timetable`, V4 `components/TimetableTemplateModal.tsx`·`TeachingModePanel.tsx`·
`TeachingModeBanner.tsx`·`PeriodTimesEditor.tsx`·`SlotCombobox.tsx`·`SlotPairInput.tsx`·`DetailEditModal.tsx`(수업 갈래), `hooks/useTimetableTemplate.ts`·`useTeachingMode.ts`·
`useTeachingClasses.ts`·`useClassColor.ts`·`usePeriodTimes.ts`·`useClock.ts`, `lib/semester.ts`·`classDays.ts`·`teachingSlot.ts`·`teachingMode.ts`·`periodTimes.ts`·`gridNav.ts`, `features/day/DaySchedule.tsx`.
- [ ] ■1 시간표 창(탭: 교사 유형 / 시간표 - 기간별 여러 장 / 교시 - 이름·시각 / 학기·방학). **'적용' 단추 없음**(`MENU.md` 2-3).
- [ ] ■2 수업 칸 계산 `domain/lessons.ts`(`DESIGN.md` 5-2 - classDays 옮기기, `lessonDays`가 이긴다) + 테스트(기간 경계·방학·공휴일·수업X 일정·'휴업'·바꾼 칸).
- [ ] ■3 하루 수업 칸(DaySchedule 옮기기 - 과목 크게·교시 색 막대·지금 몇 교시·진도 줄 자리·준비물·메모·✏️·🔗·교과 모드 반 중심·SlotPairInput·처음 안내 띠),
  고치면 `lessonDays`의 그 칸만(field path). 수업 수정 창(DetailEditModal 수업 갈래), 주간 수업 칸 채우기.
- [ ] ■4 크롬 점검 `inspect-lessons.mjs`(teacher·teacher3).
**끝 조건**: 위 설명서 주제가 된다(시간표는 '적용' 대신 기간별).

### P6-2. 진도
**시작 조건**: P6-1 끝.
**먼저 읽을 것**: V4 설명서 `progress`, V4 `lib/progress.ts`·`progressDraft.ts`·`progressSample.ts`·`csv.ts`, `components/ProgressModal.tsx`·`ProgressMarkLine.tsx`·`ProgressCreateButton.tsx`, `hooks/useProgress.ts`.
- [ ] ■1 progress 저장(V4 모양 + `updatedAt`·`deletedAt`) + 셈(`lib/progress` 옮기기 - 입력을 수업 칸 계산 결과로, 수업 문서 범위 쿼리 대신 사본).
- [ ] ■2 진도 창(붙여넣기·CSV·예시 CSV·행 추가·Ctrl+Enter·과정(여러 반)·반 탭·현황표·차시 수 늘리기) + 진도 줄·밀기·되돌리기·'📘 진도 만들기'·지난 시간 줄.
- [ ] ■3 크롬 점검 `inspect-progress.mjs`(V4 inspect-progress·course·course-status·refine-u2·u3 항목 가운데 V5에 맞는 것).
**끝 조건**: 설명서 `progress`가 된다.

### P6-3. 수업 종·주간학습안내·나이스·인쇄
**시작 조건**: P6-2 끝.
**먼저 읽을 것**: V4 설명서 `weekly-guide`·`neis`, V4 `lib/classBell.ts`·`hooks/useClassBell.ts`·`components/ClassBellPanel.tsx`, `lib/weeklyGuide.ts`·`weeklyGuideStore.ts`·
`components/WeeklyGuideModal.tsx`, `lib/neis.ts`·`schoolSetting.ts`·`govApi.ts`·`hooks/useNeis.ts`·`useSchool.ts`·`components/SchoolSettingPanel.tsx`·`SchoolEventModal.tsx`·`SchoolEventName.tsx`·
`features/day/DayMeals.tsx`, `lib/print.ts`.
- [ ] ■1 수업 종(하루 '수업' 옆 🔔, 이 기기에서 울리기).
- [ ] ■2 주간학습안내(주간 화면 단추, 담임만).
- [ ] ■3 나이스(우리 학교·급식·학사일정 표시·D-Day로·일정으로·방학 채우기) + 인쇄(⋮ '🖨️ 이 화면 인쇄'·Ctrl+P - 주간 A4·학사력, `data-print-hide`).
- [ ] ■4 크롬 점검.
**끝 조건**: 설명서 `weekly-guide`·`neis`와 인쇄가 된다.

### P6-4. 가져오기: 수업
**시작 조건**: P6-3 끝. V4 seed 자료.
**먼저 읽을 것**: `DESIGN.md` 8-3 수업 줄, V4 `hooks/useTimetableTemplate.ts`(timetable_v5 모양)·`lib/periodTimes.ts`·`teachingMode.ts`·`classBell.ts`·`progress.ts`(저장 모양).
- [ ] ■1 `timetable_v5` → timetables(기간)·terms, 교시(이름·시각), `v4_teaching`·`v4_classBell`·`v4_school` → settings.
- [ ] ■2 `schedules/{date}` → lessonDays: **그 기간 시간표와 같은 칸은 빼고** 다른 것만(과목이 다르거나 메모·준비물·첨부·링크가 있는 칸), 옛 문자열 값.
- [ ] ■3 `v4_progress` → progress + 점검(V4 seed: 하루·주간 수업 칸·진도 줄이 V4와 같다). 👤 실제 계정 확인 부탁.
**끝 조건**: 점검 통과. **P6 단계 끝 정리**(1-4).

### P7-1. 학급·명렬표·사진
**시작 조건**: P6-4 끝.
**먼저 읽을 것**: `DESIGN.md` 4-6, V4 설명서 `class-screen`·`roster`·`student-photos`·`roster-search`, V4 `features/class/ClassScreen.tsx`, `components/RosterModal.tsx`·`roster/*`,
`hooks/useRoster.ts`·`useStudentPhotos.ts`, `lib/studentPhotos.ts`·`studentPhotoNames.ts`·`photoBulkUpload.ts`·`photoDiagnosis.ts`·`rosterCsv.ts`·`classPicker.ts`·`classMemory.ts`·`googlePicker.ts`·`hangul.ts`.
- [ ] ■1 classes(학생 sid·번호·이름·성별·전출) + 명렬표(관리 - 붙여넣기·파일·전출 / 검색).
- [ ] ■2 학급 화면(🏫 학급 도구 | 🧑‍🤝‍🧑 명렬표, 학급 고르기, 도구 카드 = 창 목록 `classTool`, 학생 명단 이름/사진, 이름 → 학생 기록 자리).
- [ ] ■3 학생 사진(드라이브 `Students_Poto` 그대로·드라이브에서 고르기) + 쓰는 칸 @이름 → `studentIds`.
- [ ] ■4 크롬 점검.

### P7-2. 출석부·알림장·기록 칸 카드·교과 출결
**시작 조건**: P7-1 끝.
**먼저 읽을 것**: `DESIGN.md` 5-4, V4 설명서 `notice`·`attendance`·`subject-attendance`, V4 `components/AttendanceDrawer.tsx`·`NoticeDrawer.tsx`·`SubjectAttendancePanel.tsx`·
`SubjectAttendanceSummaryModal.tsx`, `lib/attendance.ts`·`attendanceStore.ts`·`notices.ts`·`shareText.ts`·`subjectAttendance.ts`·`subjectAttendanceStore.ts`·`autoJournal.ts`(무엇을 보였나만).
- [ ] ■1 출석부(sid, 2.5초 뒤 저절로 저장, 누계·인쇄), 하루 '📋'·학급 화면.
- [ ] ■2 알림장(쓰기·모아 보기·📤 공유·다음 수업일 불러오기 + 진도 준비물).
- [ ] ■3 기록 칸 카드(그날 알림장·출결을 계산해 보인다 - 누르면 원본 칸, 검색에도). V4 autoJournal·autoJournalSync는 옮기지 않는다.
- [ ] ■4 교과 출결(교시 카드 🙋 → 칸, 누계·학급 탭) + 크롬 점검.
**끝 조건**: 설명서 `notice`·`attendance`·`subject-attendance`가 된다.

### P7-3. 자리표·뽑기·모둠
**시작 조건**: P7-2 끝.
**먼저 읽을 것**: V4 설명서 `seating`, V4 `components/SeatingModal.tsx`·`SeatStudentCard.tsx`·`SeatDrawPanel.tsx`·`DrawBigView.tsx`·`SeatGroupsPanel.tsx`·`ObservationPhrases.tsx`,
`lib/seating.ts`·`seatingStore.ts`·`draw.ts`·`groups.ts`·`classHub.ts`·`classHubStore.ts`·`observationPhrases.ts`, `hooks/useStudentDraw.ts`.
- [ ] ■1 자리표(sid, 섞기·고정·떨어뜨릴 학생·모양·되돌리기) + 학생 칸(출결·조사표·관찰 한 줄).
- [ ] ■2 발표자 뽑기(하루 수업 머리 🎯 - 담임 / 교시 카드 반 도구 - 교과 / 학급 화면) + 모둠.
- [ ] ■3 크롬 점검.

### P7-4. 조사표·모아 보기·학생 기록
**시작 조건**: P7-3 끝.
**먼저 읽을 것**: V4 설명서 `evaluation`·`student-record`, V4 `components/EvaluationModal.tsx`·`EvalOverviewModal.tsx`·`CourseEvalOverview.tsx`·`EvalCountBadge.tsx`·`StudentRecordModal.tsx`,
`hooks/useEvaluation.ts`·`useDayEvalCounts.ts`, `lib/evalArchive.ts`·`evalSummary.ts`·`courseEvals.ts`.
- [ ] ■1 조사표 한 장 = 문서 하나(평가·체크·메모·조별·여러 반에 같은 조사표·교시에 붙이기) + 📊 표식.
- [ ] ■2 조사표 모아 보기(학급별·과정별·CSV·표 복사·인쇄) + 학생 기록(`studentIds`·`classId`로 사본에서 모으기 - 기록·메모·출결·교과 출결·조사표, 학생 카드).
- [ ] ■3 크롬 점검.
**끝 조건**: 설명서 `evaluation`·`student-record`가 된다.

### P7-5. 암기 + 가져오기: 학급
**시작 조건**: P7-4 끝. V4 seed 자료.
**먼저 읽을 것**: `DESIGN.md` 8-3 학급 줄, V4 `components/roster/RosterMemorizeTab.tsx`·`hooks/usePhotoQuiz.ts`·`lib/photoQuiz.ts`, V4 저장 모양(attendance·evaluations·v4_seating·v4_classHub·
v4_subjectAttendance·photoQuiz·v4_observationPhrases - ARCHITECTURE 3장 표).
- [ ] ■1 암기(사진 틀 고정·정답은 이름만·자동 넘김·출제 수·함께 외울 학급).
- [ ] ■2 가져오기: rosters → classes(번호 → sid 짝 표를 가져오기 기록에 - 다시 해도 같은 sid), attendance·subjectAttendance·notices·evaluations(evalList 먼저)·seating·classHub·quiz·관찰 문구,
  기록·메모의 `#26040305` 태그 → `studentIds`(글은 그대로).
- [ ] ■3 점검 `inspect-import-class.mjs` + 👤 실제 계정 확인(학급 화면·출석 누계·조사표 모아 보기가 V4와 같은지) 부탁.
**끝 조건**: 점검 통과. **P7 단계 끝 정리**(1-4).

### P8-1. 구글 캘린더
**시작 조건**: P7-5 끝.
**먼저 읽을 것**: V4 설명서 `calendar-sync`, V4 `lib/gcalAuto.ts`·`gcalPlan.ts`·`gcalNote.ts`·`calendarSync.ts`·`calendarSyncTask.ts`·`components/CalendarSyncModal.tsx`, V4 ARCHITECTURE 5장 'U11' 단락.
- [ ] ■1 자동 보내기(항목 큐 `gcalQueue/{itemId}`, 보내는 날 = 이월·기간·반복을 계산한 날, 끈 것·지운 것은 구글에서 지움, **가져온 항목은 `src.id`로 V4가 보낸 구글 일정과 짝** - 두 벌이 되지 않게),
  '📅 못 보낸 일정 N', 저장 때 로그인 묻기.
- [ ] ■2 손으로 보내기(나중에 백업 · 가져오기 · 보내기 창의 '보내기' 탭 - 지금은 단독 창으로 등록).
- [ ] ■3 크롬 점검(구글 API 흉내) + 👤 실제 구글 캘린더 확인.

### P8-2. 서버 푸시 알림 (함수 v5)
**시작 조건**: P8-1 끝.
**먼저 읽을 것**: V4 ARCHITECTURE 8장 '일정 알림 서버 푸시', V4 `functions/index.js`·`alarmPlan.js`·`alarmPlan.test.js`, `lib/push.ts`·`components/PushAlarmPanel.tsx`·`public/sw.js`(push 부분).
- [ ] ■1 함수(V5 `functions/`, `firebase.json` codebase `v5`, Node 22, 서울): `spaces/{sid}/items/{id}` 쓰기 → `v5alarms/{itemId}` 하나 맞춤(받는 사람: 개인 = 그 사람, 그룹 = authorId),
  매분 보내기(두 번 안 보내게), 30일 지난 것 지우기. alarmPlan을 항목 하나 단위로 + 테스트(`npm run test:functions`).
- [ ] ■2 기기 토큰(`spaces/u_{uid}/pushTokens`) + 환경설정 '알림' 탭 + `sw.js` push(보는 창이 있으면 앱으로, 없으면 알림).
- [ ] ■3 👤 배포를 묻고 `npx firebase deploy --only functions:v5 --project schoolplannerv3` → `npx firebase functions:list`로 V4 함수(default)가 그대로인지 본다. 👤 휴대폰 확인.

### P8-3. 백업 · 가져오기 · 보내기 창·공유받기·오프라인 앱
**시작 조건**: P8-2 끝.
**먼저 읽을 것**: `MENU.md` 2-3·3-7, V4 `components/BackupModal.tsx`·`lib/backupJson.ts`·`autoBackup.ts`·`hooks/useAutoBackup.ts`·`components/AutoBackupBanner.tsx`·`KeepImportModal.tsx`·
`lib/keepImport.ts`·`sheetsSync.ts`·`driveMigration.ts`, `lib/shareTarget.ts`·`hooks/useShareReceiver.ts`·`public/sw.js`·`public/manifest.json`.
- [ ] ■1 '💾 백업 · 가져오기 · 보내기' 창(탭: 백업 - 받기·되살리기·드라이브 자동 백업 / 가져오기 - V4·Keep / 보내기 - 구글 캘린더·시트 / 정리 - 첨부 모으기). 백업 JSON은 V5 모양.
- [ ] ■2 공유받기(Web Share Target - 안드로이드 설치본, 새 메모 칸) + 앱으로 설치(환경설정 '앱' 탭). 매니페스트를 바꾸면 '지우고 다시 설치' 안내(V4 교훈).
- [ ] ■3 오프라인 앱: `sw.js`가 앱 파일을 캐시(index.html은 네트워크 먼저, 해시 붙은 파일은 캐시 먼저, 새 빌드면 '새 판이 있습니다 - 새로고침' 띠) → 기기 사본과 함께 오프라인 보기.
- [ ] ■4 크롬 점검(오프라인으로 열기 포함).
**끝 조건**: 설명서 `backup`·`keep`·`install`이 되고, 네트워크 없이 열어도 화면과 자료가 보인다.

### P8-4. 공유 그룹 + 그룹 가져오기
**시작 조건**: P8-3 끝.
**먼저 읽을 것**: V4 설명서 `groups`, V4 `components/GroupModal.tsx`·`hooks/useGroups.ts`·`lib/groups.ts`, V4 `firestore.rules`의 groups·inviteCodes 블록.
- [ ] ■1 그룹 공간(`spaces/g_…`, members 맵, 초대 코드 `spaceInvites`) + 공간 선택(목록 끝 '👥 그룹 관리…') + 계정 칸 공유 그룹 + 그룹 라벨(공간 것) + 기기 사본에 그룹 공간도.
- [ ] ■2 그룹 자료 가져오기(`groups/{gid}` → `spaces/g_{gid}`, 구성원 누구나 - 결정적 id라 겹치지 않음, members 배열 → 맵).
- [ ] ■3 크롬 점검(두 계정).
**끝 조건**: 설명서 `groups`가 된다. **P8 단계 끝 정리**(1-4).

### P9-1. 설명서 옮기기·설명서 점검
**시작 조건**: P8-4 끝.
**먼저 읽을 것**: `MENU.md`, `PARITY.md`, V4 `src/lib/helpTopics.ts`(장마다 나눠 옮기며 읽는다), `components/HelpModal.tsx`, V4 `tools/inspect-manual.mjs`.
- [ ] ■1 helpTopics 옮기기(장마다 파일 `features/help/chapters/*.ts`) + HelpModal(왼쪽 목차 트리) + 링크·단축키 자리 테스트 옮기기.
- [ ] ■2 내용 고치기: `MENU.md`대로(화면 구성·⋮ 목록·단축키·휴대폰·환경설정), 계산으로 바뀐 것(이월·시간표·기간·기록 칸 카드), 'V3와 함께 쓰기' → 'V4에서 옮겨 오기', 문제 해결을 V5 내용으로.
- [ ] ■3 설명서 점검 `inspect-manual.mjs`(V5 - 항목마다 `data-*`로).

### P9-2. 새 학년도 넘기기
**시작 조건**: P9-1 끝.
**먼저 읽을 것**: `DESIGN.md` 4-5·4-6, V4 `lib/semester.ts`.
- [ ] ■1 3월 안내 띠 + 창: 라벨·설정은 그대로, 새 학급(명렬표 붙여넣기), 새 시간표(지난 것 복사해 고치기), 학기·방학(나이스로 채우기), 지난 학년도는 보기만.
- [ ] ■2 크롬 점검 + 설명서 장 더하기.

### P9-3. 전체 점검·성능
**시작 조건**: P9-2 끝.
- [ ] ■1 `PARITY.md` 모두 체크(남은 것 처리), 점검 스크립트 전부, 담임 teacher·교과 teacher3, 설명서 점검.
- [ ] ■2 휴대폰 390px 한 번(이때만 - V4 09-28 사용자 결정), 다크 모드.
- [ ] ■3 성능: 첫 화면 JS 크기(V4 압축 약 400KB와 견준다), 열 때 서버 읽기 수(사본이 있을 때·없을 때), 큰 자료(1만 항목) 검색 속도 → 결과를 `DESIGN.md` 끝에 기록.

### P9-4. 넘어가기
**시작 조건**: P9-3 끝.
- [ ] ■1 👤 마지막 가져오기(개인·그룹) - 결과 표를 사용자와 함께 확인.
- [ ] ■2 👤 V4에 'V5로 옮겼습니다' 띠(새 주소, V4는 보기만 권함 - V4 커밋·배포는 묻고), V4 서버 푸시 끄기(👤 묻고 - V4 알림 함수 넷 내리기, 같은 일정이 두 번 울리지 않게).
- [ ] ■3 문서: V5 `CLAUDE.md`가 정본, V4 `CLAUDE.md`에 '보관 - V4는 고칠 때만' 표시, 이 파일 끝(지금 하는 일 = 없음).
