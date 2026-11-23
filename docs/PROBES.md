# 화면 점검·연습용 서버·자동 검사 점검 교훈

> 11-23 P60-2에 `CLAUDE.md` 2장에서 옮겼다(차례 그대로, 지우지 않음 - 10-29 `docs/MAP.md`와 같은 까닭: CLAUDE.md는 대화마다·메모 요청마다 통째로 읽힌다).
> **점검(`tools/inspect-*.mjs`)을 쓰거나 고치거나 돌리기 전에 · 연습용 서버·개발 서버가 이상할 때 · 자동 검사의 크롬 점검이 틀릴 때** 읽는다(통째로 - 35KB).
> 11-23 전 글·코드 주석의 'CLAUDE.md 2장'이 점검·연습용 서버·자동 검사 이야기면 이 문서다. 새 점검 교훈은 이 문서 끝에 더한다(작업 방식·코드 교훈은 CLAUDE.md 2장).

- 점검 줄 이름: 화면 점검 = `tools/inspect-*.mjs`(probe = `tools/lib/probe.mjs`) · 연습용 서버 = Firebase 에뮬레이터(Firestore 8080·Auth 9099) · 개발 서버 = `npm run dev:emu`(5175) · 미리 보기 = 빌드 + preview(4175) · 자동 검사 크롬 일 = `tools/ci-chrome.mjs`.
- 점검 스크립트(`tools/inspect-*.mjs`):
  - 화면 글자가 아니라 **`data-*`로 찾는다**(V4는 title을 바꿔 4항목이 며칠 깨진 채 남았다). 새 단추에는 `data-…`.
  - 심은 자료는 끝에 되돌린다. 점검이 이상하게 깨지면 앱보다 먼저 자료(라벨·설정 문서)를 본다.
  - 계정에 저장되는 설정을 바꾸면 2~3초 기다린 뒤 닫는다(1초 뒤 올라간다).
  - 정한 시간만 기다리지 않고 보려는 것이 뜰 때까지 기다린다(`waitFor`). 서버 확인은 기다려 읽는다(`serverUntil`).
  - 늘 움직이는 것(깜빡이는 ⏰ 알림 창)은 Playwright가 '멈춘 단추'를 끝없이 기다린다 → 그 단추만 `click({ force: true })`(P3-1).
  - 보던 화면이 기억되므로 묶음 시작에서 화면을 정한다(주소 `#/day/…`로 열면 된다). **월간 주소는 `#/month/2027-10`, 년간은 `#/year/2027`(학년도)** - 날짜를 다 주면 하루 화면이 뜬다(P17-2 - 월간 점검이 빈 화면을 찾았다). 같은 주소(# 뒤만 같은 것)를 `goto`하면 새로 읽지 않는다 - 앱을 처음부터 보려면 `page.reload()`(P2-4).
  - 창을 닫은 바로 뒤 주소를 바꾸면 창 층의 뒤로가기가 주소를 되돌릴 수 있다 → 그 화면이 뜰 때까지 다시 간다(`inspect-groups` `go()` - P3-3).
    **ESC로 닫은 바로 뒤 새 칸을 열면 늦게 온 뒤로가기(표지판 걷기 `history.back()`)가 새 칸을 닫을 수 있다** → 칸 수 0 + `history.state.sp5Sign` 없음까지 기다린 뒤 연다(P54-3 inspect-links `escClose` - 칸 수 0만 기다려도 30초 멈춤이 남았다).
    오른쪽 칸을 닫은 바로 뒤 칸 폭을 재면 닫히는 움직임 중이라 틀린다 - 창을 여는 묶음은 새 창(`newPage`)으로 나눈다(P24-3 inspect-board - 본문 1255로 재 비율 셋이 틀렸다). 서버를 읽어 셀 때 지운 표시(`deletedAt`)를 빼는지 본다.
  - 같은 `data-*` 이름을 두 곳(카드 표시·칸 안내)에 쓰지 않는다 - Playwright가 둘을 찾아 멈춘다(P3-3 `event-series`/`event-series-info`).
  - `ModalShell`의 `headerExtra`·`footer` 단추(저장·삭제·+ 새로)는 창 본문의 `data-*` 상자 밖에 그려진다 - 본문 상자로 좁혀 찾지 말고 page에서(그 창 하나만 연 채로 - P7-4).
  - **파일 끌기는 `fileDrag`(probe - CDP `Input.dispatchDragEvent`)로 본다**(P21-1): 놓는 자리·폴더까지 진짜다(`DragEvent` 흉내는 `webkitGetAsEntry`가 null). 다만 칸 밖에 놓아도 CDP는 브라우저가 파일을 여는 데까지 가지 않는다 - 지킴은 주소가 아니라 dragover의 `defaultPrevented`·`dropEffect`로 본다. 크롬은 새 요소로 넘어가는 박자에 enter·leave만 내고 dragover를 내지 않는다.
  - 정한 날(`DAY`)에 심는 점검은 **날이 지나면 깨질 수 있다**: 이월 라벨 일정은 그날이 지나면 오늘로 따라와 ForwardMarks가 `carrying`을 한 번 쓴다 - '바뀐 문서 하나'를 세는 점검이면 `carrying: true`로 심는다(P8-2 inspect-events).
  - Playwright `route.fulfill` 흉내 응답은 **CORS를 보지 않는다** - 막힌 내려받기(버킷 CORS)는 `route.abort('failed')`로 흉내 낸다(P8-3 첨부 모으기). 컨테이너 Chromium은 한글 내려받기 이름을 'download'로 바꾼다(이름은 PC에서).
  - 서비스 워커·오프라인은 개발 서버가 아니라 **빌드 + preview(4175)**로 본다(`SITE=http://localhost:4175/` - inspect-offline). 응답이 `Vary: Origin`이라 캐시 짝 찾기는 `ignoreVary`(P8-3).
  - **그룹 구성원은 스스로만 들어온다**(P15-1 규칙 - 주인이 남을 넣지 못한다): 동료가 든 그룹은 그 계정이 스스로 참여해 심거나, 옛 자료 흉내는 에뮬레이터 관리자 쓰기(REST `Bearer owner` - `group.emu.test` `plantAsAdmin`).
  - 지운(없는) 공간 문서는 규칙이 읽기를 막는다(`resource`가 없어 members를 못 본다) - 점검에서 '없어졌나'는 읽기 거부도 없음으로 센다(P8-4 inspect-share-groups).
  - **계정에 올라가는 설정은 기기 저장소만 바꿔서 시험하지 않는다** - 다시 열면 계정 값이 이긴다. 계정 문서로 바꾸고 끝에 걷는다(P4-1 - inspect-shell이 '가운데 창'을 계정에 남겨 다른 점검이 깨졌다).
- **클라우드 컨테이너는 apis.google.com·*.web.app에 닿지 못한다** - Firebase 팝업 로그인(다시 받기 포함)이 창을 열기 전에 `auth/internal-error`. 그 확인은 PC에서(P4-2 inspect-attach가 건너뛴다).
  거꾸로 **PC 크롬은 방금 누른(Playwright 클릭·타자) 때 로그인 창을 바로 연다** - '구글 로그인이 필요합니다' 창 갈래는 `noUserActivation(page)`로 '방금 누르지 않음'을 만들어 본다.
  진짜 로그인 창을 닫으면 Firebase가 8초쯤 기다린 뒤 닫힘을 알린다(P9-3 - 컨테이너에서만 통과하던 attach·gcal).
- **클라우드에서만 돌던 점검을 PC에서 돌리면**(P9-3): Windows 클립보드는 `\r\n`으로 돌려준다 · '오늘부터' 세는 것(진도 다음 수업 밀기)은 `page.clock.setFixedTime` ·
- **점검이 화면 안에서 앱 모듈을 부를 때는 `import(window.__appModule('/src/…'))`** - 개발 서버는 고친 파일(과 그것을 부르는 것) 뒤에 `?t=…`를 붙여 내려,
  `/src/…`를 그냥 부르면 다른 모듈(되돌리기 더미·사본 store가 따로)이 된다(P9-3 - 자료 층을 고친 뒤 inspect-data Ctrl+Z가 깨졌다. `newPage`가 심는다).
- **한꺼번에 심은 문서가 구독 겹침(1분, `OVERLAP_MS`) 안에 들면 구독이 그것을 다시 보내** 에뮬레이터 통로가 막힌다(`too many pending messagings (10001)` -
  `firestore-debug.log`가 300MB, 모든 점검이 느려졌다). 큰 자료를 심은 점검(`inspect-perf`)은 1분 넘게 기다린 뒤 표시 하나를 쓰고 연다. 점검이 갑자기 다 느리면 로그를 보고 에뮬레이터를 다시 켠다(→ seed).
- **휴대폰 흉내(`isMobile`)는 글이 넘치면 화면 폭(innerWidth)째 넓힌다** - 넘침은 정한 폭(390)과 견준다(P9-3 inspect-mobile). 전체 화면 그림(`fullPage`)의 fixed(탭바·＋)는 엉뚱한 자리에 찍힌다 - 자리는 보이는 화면 그림으로.
- **PC 점검 창(1400)의 글자는 한눈에만 90%, 다른 화면은 100%다**(11-09 - 처음 모두 80% → 90% → 같은 날 한눈에만, P29-1) - px 크기를 재는 점검은 한눈에 14.4px·다른 화면 16px로 견준다. 한눈에의 좁은 폭 갈래를 보려면 창을 더 좁힌다(쌓기는 760이 아니라 700 - 본문 폭을 0.9로 나눠 780과 견준다). 글자 크기 단계는 `style.fontSize`가 아니라 html의 `--font-scale`, 한눈에 표시는 html `data-dense`.
- **`pkill -f <글자>`는 그 글자가 든 자기 명령 줄(셸)도 죽인다**(P7-3 - `pkill -f vite`로 Bash가 144로 끝났다). 에뮬레이터·개발 서버는 뒤에서(`run_in_background`) 켠다.
- **클라우드 백그라운드 명령은 기본 30분에 꺼진다** - 에뮬레이터·개발 서버는 `run_in_background` + `timeout: 7200000`(최대 2시간, 그 뒤에도 꺼진다 - 다시 켜고 seed, P9-1). 점검이 갑자기 다 깨지면 먼저 8080·5175가 살아 있나.
- 점검에서 칸을 닫는 `sp5.closeAllWindows()`는 저장 안 한 칸이 있으면 confirm으로 묻고 probe는 '아니오'라 **칸이 남는다** → 그때만 `dialogs.answer = true`(inspect-manual `closeAll`, P9-1).
- **헤드리스 크롬은 스크롤바를 숨긴다**(`--hide-scrollbars`) - 스크롤바 폭(15px)이 관계된 것(칸 높이·줄바꿈)은 `chromium.launch({ ...browserOptions(), ignoreDefaultArgs: ['--hide-scrollbars'] })`로 본다
  (10-21 - 글 칸이 높이를 재는 동안 오른쪽 줄 스크롤바가 사라져 넓은 폭으로 재, 끝까지 찬 마지막 줄이 가려졌다. 점검은 스크롤바가 없어 통과했다).
- **크기·자리만 재는 점검은 빈 글자도 통과한다** - 칩·배지를 새로 그리면 글자(`textContent`)가 있는지도 본다(P12-1 - 휴대폰 월간 칩이 빈 채 '칩 폭 22px·넘침 없음'을 통과, 그림으로 찾았다.
  `parseSlot`은 반이 없으면 `cls: ''`라 `??`로는 과목으로 넘어가지 않는다 - `||`).
- **CI가 크롬 점검 스물넷을 돌린다**(P36-1 11-16 여덟 + P40-1 11-16 달력 화면 다섯 + P44-1 11-17 넷 + P48-5 11-20 table + P49-1 11-20 넷 + P51-1 11-21 manual(설명서 = 기능 명세, 1분) + P57-3 11-23 ui-overlap(단추 겹침 짧은 묶음 `SUITE=ci` - `PROBE_ENV`, 90초) - 새 일 `chrome`, 목록은 `tools/ci-chrome.mjs` 한 곳: shell·memo·notes·progress·lessons·settings·events·week + month-year·board·gcal·forward·print + popout·search-trash·claude-request·chat + table + clipboard-popup·attach·evaluations·side-left + manual + ui-overlap, 한 바퀴 15분쯤 - mobile은 길어 뺐다): 틀리면 CI 실패 = 배포 멈춤. **메모 요청은 PR의 CI를 기다렸다 합치고, 틀리면 PR을 열어 둔 채 'PC 일'**(`docs/CLAUDE-REQUEST.md` 'CI가 틀리면').
  CI 점검은 에뮬레이터 안 seed → 개발 서버 → 첫 화면 한 번(묶기) → 하나씩, `TZ=Asia/Seoul`·러너의 구글 크롬. 틀리면 그 실행의 결과 묶음 `chrome-probes`(점검 출력·틀린 순간 그림 - probe `SHOTS_DIR`·에뮬레이터 로그 끝). 점검을 더하려면 CI에서 세 번 돌려 흔들림이 없을 때만 + **날마다 도는 CI라 그날 날짜로 깨지지 않는지**(오늘을 기준으로 셈하거나 시계를 고정 - PLAN 5장 'P36-1'·'P40-1').
  **그날인 척 돌리기 = `FAKE_TODAY=2027-02-28 node tools/inspect-….mjs`**(P49-1 probe - 노드와 newPage 창의 시계를 그날 10시로 옮겨 흐르게): 학년도가 바뀌는 2월 말·3월 1일·월말로 한 번씩. 에뮬레이터 시각은 진짜라 **미래 날이면 서버 시각과 '오늘'을 견주는 것이 빗나간다**(휴지통 자동 비우기 90일이 방금 지운 것을 지워 inspect-evaluations '휴지통에'가 틀렸다 - 그 계정 `settings/common` `trashDays: 0`으로 두고 보면 통과).
  12월 중순(보는 달이 오늘을 품음)·1월 1일(달력 해가 바뀜)로도 CI 스물둘이 통과한다(P56-1 11-22 - chat 뺌).
  **보는 날을 정해 둔 점검이 자료를 '오늘의 학년도'로 심으면 3월 1일에 깨진다**(P51-1 inspect-manual - 보는 날 2026-10-08은 그대로인데 시간표·학급이 새 학년도로 옮겨 수업 칸이 비었다, FAKE_TODAY=2027-03-01로 찾음): 심는 자료의 기간은 보는 날을 덮게(그 날의 학년도부터) · CI에 더할 점검은 2월 말·3월 1일·두 해 뒤로 한 바퀴씩.
  **자료가 통째로 한 학년도에 묶인 점검은 `pinToday('YYYY-MM-DD')`로 점검의 오늘을 그 학년도에 묶는다**(P52-1 inspect-lessons - 2026학년도 시간표·방학을 심는데 시간표 창 학기 탭·적용된 시간표 줄은 '오늘의 학년도'를 봐 2027-03-01부터 열일곱 줄이 틀렸을 것, 앱은 의도대로): 점검 맨 위(날짜를 세거나 newPage 전), FAKE_TODAY보다 앞선다.
  **대화(inspect-chat)는 미래 날로 볼 수 없다** - 서버 시각이 진짜라 글의 expireAt(지금 + 1년)이 규칙 한도를 넘어 앱 글도 점검 글도 막힌다(진짜 그날에는 상관없다).
  **CI가 틀렸는데 PC에서 늘 통과하면 경쟁부터 본다**(11-16 첫날 셋: 펼 때 탭 visibility 0.15초 늦음(점검) · 📅 올리기+누르기 한 동작이 열었다 닫음(앱) · 진도 창 행 추가 뒤 커서를 한 프레임 뒤에 옮겨 친 글자가 이전 칸으로(앱) · 11-17 넷째: 긴 메모 수정 칸을 열면 Claude 답이 2006px 아래 - 자라는 글 칸이 잰 뒤 둘레 스크롤을 '재기 전 자리'로 되돌려 브라우저 스크롤 고정이 내려 준 것까지 끌어올림(앱) → `ui/restoreSpots` 위로 당겨진 것만)
  **스크롤이 엉뚱한 자리로 가면 짐작으로 고치지 말고 `Element.prototype.scrollTop` setter를 가로채 줄인 쓰기를 스택과 함께 기록한다**(P44-1 - 첫 짐작 '스크롤 알림 경쟁'은 PR CI에서 그대로 틀렸고, 기록 한 번에 범인 줄이 나왔다) - 그 실행의 `chrome-probes`를 받아(`gh run download <실행> -n chrome-probes`) 출력·그림부터.
  **클라우드 대화는 `chrome-probes`를 받지 못한다**(결과 묶음 주소 blob이 막힘 - 11-20 P49-1) → 일 기록 끝(`get_job_logs` tail 80줄쯤)에 ci-chrome이 다시 찍는 **틀린 점검의 끝 60줄**부터 · 점검의 멈춤은 첫 줄만 찍지 말고 `e.stack`(무엇을 기다렸나 - Playwright Call log).
  **CI에서만 틀리고 PC·컨테이너에서 재현되지 않는 화면 경쟁(스크롤 자리 등)은 원인 하나를 맞히다 끝나지 않는다**(P44-1 - 짐작 둘을 고친 뒤에도 같은 2006px) - 그 순간 그림(`chrome-probes` shots)부터 보고, 알림 한 번에 기대지 않게(열고 잠깐은 프레임마다 지키기·사용자가 손대면 그만) 고친다.
  **11-18 P45-1: 위 claude-request 2006px의 진짜 원인은 점검이었다** - 점검이 심은 라벨 차례 `'zz'`로 손대지 않은 라벨 관리가 '저장 안 됨' → ESC가 묻고 점검 기본 답 '아니오' → 칸이 하나도 안 닫혀 '다시 열기'가 열린 칸을 봤다(앱은 손댄 것만 '저장 안 됨'으로 고침). **점검의 ESC·닫기 뒤에는 정말 닫혔나를 확인**하고, 기록 장치의 첫 줄(그때 이미 무엇이 있었나)부터 본다 · 심는 자료는 앱·서버가 만드는 꼴로(위 '흉내 응답은 진짜 모양 그대로'와 같은 교훈).
  흔들림은 **손 실행 '몇 바퀴'**로 찾는다(`gh workflow run CI --ref <브랜치> -f repeat=3`). **커서를 옮기는 고침은 `requestAnimationFrame`이 아니라 그린 바로 그때(`useLayoutEffect`)** - 한 프레임 사이 친 글자가 이전 칸에 든다.
- **점검 묶음만 따로 돌리는 갈래(`ONLY=…`)는 그 묶음이 심은 자료를 스스로 지운다**(P36-4 - inspect-gcal `ONLY=draw`가 심은 앱 기간 일정을 전체 갈래의 되돌리기에만 맡겨 남았고, 다음 전체 점검의 하루 칸에 카드가 하나 더 서서 `[data-event-delete]`가 둘이 되어 멈췄다). 흉내 구글 일정 시각(+09:00)을 글로 견주는 점검은 `TZ=Asia/Seoul`(컨테이너는 UTC - CI는 서울).
- **흉내 응답은 진짜 응답 모양 그대로 둔다**(11-17 P36-4 PC 확인 - 구글은 기본 캘린더 이름을 메일 주소로 주는데 inspect-gcal 흉내는 `summaryOverride: '내 캘린더'`를 달아, 진짜에서만 보이는 긴 메일 주소 칩·한눈에 목록 꺾임을 흉내 점검이 놓쳤다).
  **진짜 구글 계정 확인(PC)**: 시험용 크롬(스크래치패드 새 프로필 + `--remote-debugging-port=9222`) → 사용자가 로그인 → `connectOverCDP`로 **그 탭**(구글 토큰은 탭 sessionStorage) · 가려진 창은 그림이 멈춰 `bringToFront()` · 계정 설정은 되돌리고 임시 캘린더는 허락받아 캘린더째 지움 · 끝에 프로필 지움(PLAN 5장 'P36-4 PC 확인 11-17' ④).
  **운영에 만든 임시 자료는 그 탭의 Ctrl+Z(글 칸 밖)로 되돌려 휴지통에 보낸 뒤 휴지통에서 영구 삭제**(11-20 P46-2 PC 확인 - 만들기의 되돌리기 = 지운 표시. 명렬표 '학급 삭제'는 마지막 학급이면 빈 '1학년 1반'을 새로 만들어 흔적이 남는다) · 되돌리기 더미는 메모리라 **새로고침 전에** 한다(새로고침해도 구글 토큰은 남는다) · 새 판 확인이 필요하면 휴지통 '복원'(그 되돌리기도 더미에 쌓인다)으로 되살려 보고 다시 Ctrl+Z.
- **메모 요청(자동) 실행은 스물넷 밖의 크롬 점검을 돌리지 않는다**(lint·단위·빌드 + PR CI) - 화면 자리를 바꾼 요청 뒤에 여덟 밖 점검이 깨진 채 남을 수 있다
  (10-22: #60 '바뀜'·#88 이은 곳 표시·#94 오른쪽 수정 칸 뒤 inspect-lessons·progress·seating·manual이 옛 `data-*`를 찾았다). PC에서 이어 할 때 그 요청이 건드린 화면의 점검부터 돌린다.
  10-29(P14-4)부터 자동 요청이 옛 글·`data-*`를 grep 해 **점검 줄도 고친다**(돌리지는 않는다) - 커밋 메시지 끝 **'점검 고침: …'**이 있으면 PC에서 그 점검부터 돌려 본다.
  **줄을 눌러 여는 점검은 줄 가운데가 아니라 그 글(`data-…-text`)을 누른다** - 10-29: #123이 라벨 칩에 ✓ 자리를 늘 잡아 월간 칩이 넓어지자 줄 가운데가 칩(= 완료)에 걸려 inspect-month-year 셋이 깨졌다.
- **앱이 꺼진 기기 흉내**(P22-3 inspect-two-devices): `page.close()`해도 그 컨텍스트의 IndexedDB는 남는다 → `ctx.newPage()` + `clock.setFixedTime(지금 + 25시간)`로 열면 하루 한 번 일(`maybePrune`)까지 돈다. **Firestore만 끊기**는 `page.route('**/google.firestore.v1.Firestore/**', abort)`(로그인은 그대로 - Firestore가 '끊김'으로 보는 데 10초, 풀고 `window.dispatchEvent(new Event('online'))`).
  **새 기기의 '받기 전' 모습**은 새 창(빈 사본) + `page.route(/127\.0\.0\.1:8080\/google\.firestore/, …)`에서 약속을 기다렸다 `route.continue()` - 붙잡는 동안 화면은 '받는 중', 풀면 받는다(P32-2 inspect-lessons. 같은 창에서 `#` 주소만 바꾸면 붙잡은 채 화면을 옮겨 본다).
- **점검이 `try { … } finally { done(); process.exit(); }`만 있으면 예외가 '✔ 모두 통과'로 끝난다**(P23-2 - 없는 `data-*`를 30초 기다리다 던졌는데 뒤 묶음이 말없이 빠졌다, 줄 수가 줄어 알았다). `} catch (e) { 틀림으로 센다 }`를 넣는다. 새 점검도 이 꼴로(P26-1에 남은 8개를 넣어 이제 모든 점검에 있다 - `grep -L "^} catch" tools/inspect-*.mjs`가 비어야 한다).
- **창 위치 '팝업창'을 켠 채 점검이 `sp5.openWindow`를 부르면 진짜 브라우저 팝업창이 뜰 수 있다**(P28-2 - 몇 초 전 Playwright 클릭의 '방금 누름'이 남아 단축키 탭이 새 창에 떠 30초를 기다렸다): 팝업창 모드는 창을 연 뒤에 켜거나, 값은 `import(window.__appModule('/src/app/layoutPrefs.ts'))`로 바꾼다.
  jsdom 단위 시험은 거꾸로 `navigator.userActivation.isActive`가 거짓이라 `window.open`까지 가지 않는다 - 팝업창 갈래를 보려면 `Object.defineProperty(navigator, 'userActivation', { value: { isActive: true } })`.
- **한 컨텍스트에서 `?as=`로 계정을 바꿔 여는 점검은 `data-user`가 새 계정이 된 뒤에 창을 연다**(P22-4 - 앞 계정이 잠깐 뜨고 `open`은 그때 돌아온다. 그새 연 창은 `watchAccountChange`가 비운다).
- **에뮬레이터는 끊겼다 이어질 때 쌓인 글을 묶어 내려 주지 않는 것으로 보인다**(P22-5 ■3 - 55개를 끊고 이어도 듣기가 한 쪽을 건너뛰지 않아 빈틈이 재현되지 않았다). 한 번에 내려 줄 때만 생기는 일은 단위 시험으로 만든다.
- **새 계정(처음 쓰는 사람)은 `?as=new-<글자>`로 본다**(P22-7): 점검이 Auth 에뮬레이터 `accounts:signUp`으로 그때 만든다(자료·설정이 하나도 없다). seed 계정은 '다음' 띠(`firstStepsDone`)를 닫아 둔다 - 에뮬레이터를 새로 켜면 seed부터.
  **실제 자료 사본 연습은 사용자 💾 백업 JSON을 `?as=new-…` 계정에 앱 되살리기로 넣는다**(P26-3 - 새 계정이라 설정 셋까지 빠짐없이, 되살리기 길도 함께 본다. 실제 자료는 스크래치패드에만, 끝에 지운다).
  1천여 문서면 화면이 다 받는 데 3초를 넘어 **'받기 전' 갈래가 드러난다**(새 학년도 창이 '베낄 표 없음'을 보였다 - 작은 seed로는 보이지 않는다). 에뮬레이터는 자료를 디스크에 남기지 않아 끄면 사본도 사라진다.
  **점검의 `page.reload()`가 30초 멈추면 서버가 받기 전 저장의 '떠나기 전에 묻기'(beforeunload)다** - probe의 기본 답이 '아니오'라 머문다. 저장 바로 뒤 새로고침하는 점검은 그때만 `dialogs.answer = true`(inspect-week). **서버 문서가 보여도(`serverUntil`) 앱은 쓰기 대답을 아직 못 받았을 수 있다** - 새로고침 앞에서 `hasPendingWrites()`(`data/pendingWrites`)가 빌 때까지 기다린다(11-17 inspect-memo 끌어 놓기 뒤 CI 한 번 30초 멈춤). **저장 바로 뒤 ESC로 닫는 앞에서도**(11-20 P48-5 - 이미 있는 메모를 Ctrl+S 하고 곧바로 ESC = 앱이 아직 '저장 안 함'이라 묻고 점검 답 '아니오'로 칸이 남았다, CI 세 바퀴 중 둘. 새 메모는 '수정 칸이 됨'을 기다려 괜찮다 - inspect-table `appSaved`).
- **메모 카드 누르기 = 보기 칸**(11-09): 글을 고치는 점검은 카드 ✏️(`entry-edit`)나 `openWindow('note', { …, edit: true })`로 연다. 보기 칸은 `data-note-mode=view`(`data-note-panel`은 있는 메모면 그대로 `edit`), 안내·알림으로 연 칸의 글은 `note-view-body`에서 읽는다.
  메모 칩도 이제 누르면 완료다(`[data-note-done-chip]`) - 카드 가운데를 누르지 말고 글(`entry-text`·`entry-preview`)을 누른다. 새로 연 칸의 커서는 글 맨 앞이다(친 글은 앞에 든다).
- **처음 화면 밝기가 어둡게(#113)라 '밝은 화면'을 보는 점검은 `localStorage sp5_theme = light`를 심고 시작한다**(10-28 - inspect-handwriting 셋이 #113 뒤로 깨져 있었다).
  **창을 닫게 하는 키(ESC)는 keydown 사이에 팝업이 닫혀 `keyboard.press`가 '닫혔다'로 실패한다** - `.catch(() => {})`로 누르고 닫힘은 `waitForEvent('close')`로 본다(inspect-popout).
- **점검이 개발 서버로 도는 동안 저장소 파일(.md 포함)을 고치지 않는다**(P10-5) - Tailwind가 다시 훑어 `index.css`·`Shell`이 HMR로 바뀌고 열린 칸이 사라져 점검이 틀린다. 문서는 점검 묶음 뒤에.
- **점검이 화면 안에서 계정 설정을 바꾸려면 `useCommonLoaded`를 기다린다**(P20-3 - 앱이 막 떴을 때 넣은 값을 서버 값이 덮어, 8초를 기다려도 그림이 뜨지 않았다. 앱 버그가 아니다).
- **색·대비를 재는 점검은 `transition`을 끄고, 잴 것을 심는다**(P20-2): `*{transition:none!important}` 없이는 같은 칸이 잴 때마다 달랐고, 달력이 비어 있어 칩을 재지 않고 통과하고 있었다. 칩을 심은 뒤 라벨 칩 색은 그 라벨 문서가 있어야 칠해진다.
- **진짜 엑셀과 클립보드 오가기는 보이는 크롬 + 엑셀 자동 조작으로 본다**(11-23 P48-5 PC): 숨긴 크롬(헤드리스)은 제 클립보드를 따로 써 윈도우 클립보드가 빈다 → `chromium.launch({ ...browserOptions(), headless: false })` · 엑셀은 PowerShell `New-Object -ComObject Excel.Application` → `Worksheet.Paste(Range)`(= Ctrl+V)·`Range.Copy()`(엑셀을 끄기 전까지 쥔다) → 칸 `Value2` 종류(Double/String)·`Text`·`NumberFormat`. 엑셀 쪽 HTML은 앱 화면 paste 이벤트에서 받는다. **엑셀은 HTML 맨 앞 이름표(`xmlns:x`)가 없으면 `x:num`·`x:str`을 버리고 보이는 글을 읽는다**('12,000원'은 글, '5-2'는 날짜) - 흉내 HTML 점검은 이것을 못 잡는다.
- **단추 겹침·잘린 글·작은 누를 곳은 `tools/inspect-ui-overlap.mjs`로 잰다**(P57-1 - 상황 표 `SET_RE=`·`ONLY=`, 일부러 겹친 것은 `lib/uiOverlap` `IGNORE`에 까닭과 함께): 칩·단추·머리줄 자리를 바꾸면 그 상황만 `ONLY=`로 돌린다.
  **자동 검사는 짧은 묶음 `SUITE=ci`(PC 1400·휴대폰 360 44상황 - P57-3)만** 지킨다 - 폭 1100·900·글자 150%·130%·왼쪽 칸·팝업창은 손으로: 화면 폭·글자 크기에 따라 바뀌는 것을 고치면 `SET_RE='^pc'`·`'^ph'` 한 바퀴(PC 30분쯤).
  그림은 `SHOTS=<폴더>`(걸린 상황만, `SHOTS_ALL=1` = 모든 상황) - **측정은 단추 밖 글이 세로로 꺾인 것은 보지 않는다**(11-23 P57-2 ■5 가로 휴대폰 한눈에 달 목록 제목을 그림으로 찾았다) → 고친 화면은 그림도 본다.
- **에뮬레이터에 `sharedConfig/initialSettings`(관리자 처음 설정 - P33-3)가 남으면 새 계정(`?as=new-…`)은 그 값으로 시작한다** - 처음 쓰는 사람 점검의 글자 크기·단축키·색 테마가 앱 기본이 아니면 그 문서부터 본다(inspect-initial-settings는 끝에 되돌린다). seed 계정도 설정 문서(`settings/pc|common`)가 없으면 한 번 받는다.
- **크롬 예약 키·윈도우 키는 점검으로 볼 수 없다**(P34 - Playwright 키(CDP)는 렌더러에 바로 가서 Ctrl + Tab·Alt + Tab도 앱까지 온다): '앱까지 오지 않는다'는 크롬 소스(`IsReservedCommandOrKey`)·윈도우 기본 키로 정하고, 점검은 띠가 막는지만 본다.
- **리눅스 크롬은 언어 설정(LANG)이 비면 한글 파일 경로를 버린다**(P44-1 11-17 - 클라우드 컨테이너는 LANG이 비어 inspect-chat·attach의 끌어 놓기 덮개가 늘 안 떴다, `'놓은파일.txt'` 끌기에 dataTransfer 'Files'가 없다. CI 러너·PC는 UTF-8): probe `browserOptions`가 `LANG=C.UTF-8`을 준다. 컨테이너 '한글 내려받기 이름 = download'도 같은 뿌리로 보인다(확인 전).
- **크롬 점검은 하나씩 차례로 돌린다**(P14-7 - 셋을 한꺼번에 돌리면 hover·기다림이 '요소가 멈추지 않음'으로 틀렸다, 하나씩은 통과).
- **C: 디스크가 차면 에뮬레이터가 죽는다**: `firebase-debug.log`·`firestore-debug.log`(git 무시)가 커진다. 긴 점검 전에 `df -h /c`, 차면 두 로그를 비우고 `npm run emu` → seed.
  클라우드 컨테이너는 두 로그를 `/dev/null` 링크로 둔다(`ln -s /dev/null firebase-debug.log` - P4-3에 30GB가 되어 Auth 에뮬레이터가 죽었다). 링크는 git 무시라 기기마다 한 번.
- 에뮬레이터에서 문서 하나 저장이 6~7초씩 걸리면 앱 버그가 아니라 남은 잠금이다(점검 브라우저를 저장 도중에 끈 탓) - 에뮬레이터를 다시 켜고 seed.
- **8080이 대답하고 Node 단독 읽기가 되어도 에뮬레이터 통로는 막혀 있을 수 있다**(P22-6 ■1 - 3시간 켠 에뮬레이터에서 login·popout·attach가 `client is offline`·저장 실패로 틀렸다, 끝난 뒤 단독 읽기는 241ms). `grep -c 'too many pending' firestore-debug.log`와 시각을 본다. 앱을 고친 뒤 틀리면 **코드는 그대로 두고 에뮬레이터만 다시 켜** 견준다 - 그래야 고친 것 때문이 아님을 안다.
- **CSP는 막기다(11-11 P26-2) - CSP를 보는 점검은 미리 보기(빌드 + preview)로**: 개발 서버는 CSP를 내지 않는다. 미리 보기는 `vite.config` `EMULATOR_CSP`(에뮬레이터 주소)를 더해 낸다.
  점검의 흉내 주소는 **허용된 진짜 출처 꼴**로(attach의 `upload.mock.test`가 막혔다 → `www.googleapis.com/upload/…&upload_id=mockN` - backup·chat·handwriting·keep·mail은 아직 옛 주소라 미리 보기로 돌리려면 바꾼다).
  **막힌 iframe은 크롬 오류 페이지(출처 없음)가 되어 점검 `addInitScript`의 sessionStorage·localStorage가 SecurityError**로 '화면 오류'에 잡힌다 - 그 오류가 미리 보기에서만 나면 frame-src부터 본다(에뮬레이터 로그인 iframe 9099).
- **`firebase serve`는 `firebase.json` 헤더를 내지 않는다**(P22-6 ■1 - Cache-Control도, firebase-tools 15.34). 개발 서버·미리 보기는 `vite.config`가 그 값을 읽어 낸다, 운영은 `SITE=https://schoolplanner-v5.web.app/ node tools/inspect-headers.mjs`.
- **`npx`로 뒤에 띄운 서버는 TaskStop이 바깥만 꺼서 포트가 남는다**(P22-6 ■1) - `exec node node_modules/…/bin/…`로 띄운다. 남았으면 포트의 PID 명령 줄을 보고 그 PID만 끈다.
- **오래 켠 에뮬레이터는 느려져 경쟁을 가린다 - '다시 돌리면 통과'로 넘기지 않는다**(P22-1 - 저장이 4초씩 걸려 Ctrl+S 점검이 틀렸고, 다시 켜 빨라지자 11-02에 '다시 돌리면 통과'로 넘긴 구성원 이름 'undefined'가 늘 틀렸다. 진짜 앱 버그였다).
- **점검을 도중에 끄면 심은 자료가 남는다**(P22-1 - check-rules를 끈 뒤 '대화 점검 …' 그룹 둘에 teacher가 남아 inspect-share-groups가 코드 칸 셋을 찾았다). 갑자기 strict 오류면 에뮬레이터 `spaces`부터 본다.
- **개발자·관리자 점검은 메일 확인 표시가 있어야 한다**(P22-1 규칙 `isDeveloper` · P33-1 더한 관리자도 `isAdmin` - inspect-admins는 그때 만든 `?as=new-…`에 `accounts:update` emailVerified): seed가 `?as=5` 계정에 표시하고, check-rules·errorReport.emu는 스스로 한다(Auth 에뮬레이터 `accounts:update` + `Bearer owner`). 에뮬레이터를 새로 켜면 seed부터.
- **가져오기 점검(import-*)은 에뮬레이터 듣기 통로를 넘치게 한다**(P26-1): 가져오기가 문서 1천4백여 개를 쓰는 동안 화면 구독 메시지가 한 통로에 10001개를 넘어 에뮬레이터가 통로를 끊는다(`firestore-debug.log` 'too many pending messagings'). 한 번은 버티지만, 전체 점검에서 import-class(09:53)부터 51분 이어지자 로그가 4.6GB, 가져오기 결과 표가 120초를 넘겼고 뒤 점검 셋이 가끔 틀렸다.
  **전체를 돌린 뒤 틀린 것은 에뮬레이터를 새로 켜고(로그 비움 → seed) 다시 돌린다** - 분마다 넘침 수: `LC_ALL=C awk '/BackChannel add$/ { split($0,a," "); t=a[4]; sub(/:[0-9][0-9]$/,"",t); print t }' firestore-debug.log | uniq -c`(1.4GB면 몇 분 걸린다 - 뒤에서). 점검은 되돌리기(문서 지우기) 전에 브라우저를 닫는다.
  **이 세션이 켜지 않은 에뮬레이터를 끄는 것은 Claude 자동 권한이 막는다** - 사용자에게 물어 허락을 받거나 사용자가 다시 켠다(11-10). 켤 때 Java는 `JAVA_HOME=…/Android Studio/jbr`.
  11-17 허락받아 끔: PowerShell `Get-CimInstance Win32_Process`로 `emulators:start` 명령 줄의 맨 위 cmd PID를 찾아 `taskkill /F /T /PID` → 로그를 옮기고 `JAVA_TOOL_OPTIONS=-Xmx4g` + `exec npx firebase emulators:start …` → seed(1분).
  **가져오기가 없어도 넘침은 쌓여서 온다**(P42-2 11-17 - import-* 점검은 P31에 없어졌는데: 아침부터 켠 에뮬레이터는 15번째 점검(14:16 gcal)부터, 새로 켠 에뮬레이터는 40번째쯤(15:03)부터 - 시작한 점검이 달라 한 점검 탓이 아니다. 점검이 끝나며 끊긴 브라우저 몫의 듣기 통로가 쌓인 것으로 본다).
  넘침 뒤 틀린 셋(initial-settings 새 계정 로그인 20초·mirror·month-year 서버 쓰기 10초)은 새 에뮬레이터에서 모두 통과 → **전체 한 바퀴는 새로 켠 에뮬레이터에서 시작하고, 전체 스크립트는 점검마다 넘침 수(`grep -c "too many pending" firestore-debug.log`)를 함께 적는다** - 넘침 뒤에 틀린 것만 새로 켜서 다시.
- **점검에서 사이트 IndexedDB를 통째로 지우면(CDP `Storage.clearDataForOrigin` 'indexeddb') 로그인 정보(`firebaseLocalStorageDb`)도 지워져 몇 초 뒤 로그아웃된다**(P42-2 inspect-mirror - 앞 점검에 따라 로그아웃이 자료보다 먼저 와 '2초 안에'가 2.05초로 틀렸다, 혼자는 통과). 사본 하나만 끊으려면 `IndexedDB.deleteDatabase`(같은 '브라우저가 연결을 끊었다' 길, 로그인 그대로).
- **크롬은 `tabular-nums` 같은 글꼴 낱값이 있으면 `getComputedStyle().font`(묶음 값)를 빈 글자로 준다**(P26-1 inspect-class - 본문 16px로 재 '번호 칸이 좁다'로 틀렸다): 글자 폭을 잴 때는 `fontFamily`·`fontSize`·`fontWeight`·`fontVariantNumeric`을 낱낱이 옮긴다. `<input>`의 `clientWidth`는 여백까지 뺀 값이다 - 안쪽 폭은 겉 폭 − 테두리 − 여백으로.
- **창 크기 바꾸기(`window.resizeTo`·`screen.availWidth`)는 보통 점검 창으로 볼 수 없다**(P43 - 새 창 넓히기가 520 → 520): Playwright 창 크기 흉내(viewport)는 팝업의 `innerWidth`·`screen`을 그 크기로 붙잡고, 흉내를 꺼도 헤드리스 화면은 800px이다 →
  `chromium.launch({ ...browserOptions(), args: ['--window-size=1400,900', '--screen-info={1920x1080}'] })` + `newPage(real, { viewport: null })`(inspect-popout 묶음 4). 헤드리스는 `window.open` 크기를 받지 않아(1416) 새 창은 `resizeTo`로 먼저 맞춘다.
- **에뮬레이터가 둘 떠 있을 수 있다 - 끄기 전에 8080을 쥔 PID를 `netstat -ano`로 본다**(P43 11-17 - `emulators:start` 명령 줄로 찾아 끈 것은 남아 있던 옛것이고, 8080은 다른 줄의 java가 쥐고 있었다. 새로 켜자 'multiple instances'·Firestore exit 1. PowerShell `Get-NetTCPConnection`은 빈 결과를 냈다).
  느려진 표시: REST 문서 하나 읽기가 2초를 넘고 점검의 메모 저장이 8초 안에 끝나지 않는다(↗ 새 창이 '옮기는 중…'에서 닫힘) - 새로 켜니 0.24초.
- **크롬 점검 전체(59개)를 돌리면 에뮬레이터 Java 메모리가 찰 수 있다**(11-04 - 아침부터 켠 에뮬레이터가 20번째 점검에서 `OutOfMemoryError: Java heap space`, 뒤 점검이 모두 시간 초과·`client is offline`으로 틀렸다. 앱 버그가 아니다).
  포트는 열려 있는데 `curl http://127.0.0.1:8080/`이 멈추면 이것 - `firestore-debug.log`에서 찾고 `JAVA_TOOL_OPTIONS=-Xmx4g`로 다시 켠다 → seed. 전체를 돌리는 스크립트는 점검 사이마다 8080이 대답하는지 본다.
  뒤에서 돌리는 스크립트는 `exec bash 스크립트`로 띄운다(`bash 스크립트; echo`면 TaskStop이 바깥 셸만 꺼서 점검이 계속 돈다). 4175에 남은 미리 보기는 `npm run build` 뒤 운영 빌드를 내어 점검이 로그인에서 멈춘다 - 다른 포트로.
