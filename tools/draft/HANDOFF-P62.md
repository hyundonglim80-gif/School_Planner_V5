# HANDOFF - V5 개선 (11-28 클라우드 대화에서 넘김)

## 전체 목표
사용자 11-28: "v5를 개선하기 위해 네가 할 수 있는 것을 생각해서 해봐." - 고르는 것은 Claude에게 맡겼다.
CLAUDE.md 1장 추천 기준 ①안정성 ②심플한 화면 ③자원 ④UI 정돈 안에서만(새 기능은 먼저 권하지 않는다).
여러 파일을 바꾸므로 **새 세션은 아래 후보로 3~5줄 계획을 쉬운 말로 보여 승인받고 시작**(작업 규칙 5번) → 승인 뒤 확인·저장 기록·올리기·합치기까지 한 번에.

## 완료한 작업 (이 대화)
- 11-27 전반 점검(고장 없음) → P61(어두운 화면 강조 글자·기간 막대·흰 글씨 단추 · 카드 열 칸 폭 상한 · '⏳ 기한 추가' · 휴대폰 ▲▼ 기본 '⇅ 누를 때만' · 한글 낱말 줄바꿈 · 겹침 측정 도구 고침)
- 합치기 요청 #209 합침(본 줄기 `1fd7720`) → 본 줄기 자동 검사·실제 사이트 내보내기 성공. 자세한 것은 `docs/PLAN.md` 6장 'P61'.

## 현재 상태
- 작업 갈래 `ccr-8f1994b6-813h5f`는 #209로 합쳐졌다 → **새 세션은 `git fetch origin main && git checkout -B ccr-8f1994b6-813h5f origin/main`** 으로 다시 시작(합쳐진 것만 든 갈래라 나중에 force-with-lease 올리기 괜찮음).
- 저장소 파일 변경 없음(깨끗). node_modules는 깔려 있다(`npx -y npm@11 ci` 끝). 연습용 서버·개발 서버는 꺼 두었다 → 필요하면 다시 켠다(아래 '검증 방법').
- 이 컨테이너에만 있는 도구(저장소에 올리지 않는 `tools/report/` - .gitignore):
  - `tools/report/a11y-scan.mjs` - 접근성 측정(크롬 접근성 트리로 읽어 주는 이름 없는 누를 것 · 글씨 대비 WCAG · 11px 아래 글씨 · 콘솔 오류 · 키보드 초점). `SETS=pc1400,ph390,pc1400-dark,ph390-dark` 고르기, `SHOTS=1` 그림, `NOWIN=1` 창 빼기. 결과 `tools/report/a11y/result.json`.
  - `tools/report/run-outside.sh` - 자동 검사 밖 점검 35개를 하나씩(`LIST="a b"`로 고르기, 결과 `tools/report/outside/summary.txt`).

## 다음 할 일 (우선순위 - 후보, 계획 승인 뒤)
1. **[① 점검 빈틈] 자동 검사 겹침 묶음 넓히기** - `tools/inspect-ui-overlap.mjs` `CI_SETS`가 PC 1400·휴대폰 360 글자 100%뿐이라, P61에서 글자 150%·130%·가로 휴대폰에서만 생긴 회귀 셋(년간 날짜 '1/0' 꺾임 · 가로 휴대폰 수업 칸 머리 ⚙ 9px · 휴대폰 360 글자 130% 메모 정렬 줄 25px)이 자동 검사를 통과했다(손으로 돌린 전체 측정이 잡음).
   → CI_SETS에 작은 묶음 더하기(예: `pc1400-font150` 년간·하루·한눈에 · `phLand` 하루·한눈에 · `ph360-font130` 메모·하루 - 창은 빼고) · 자동 검사 시간 +1~2분 안 · **PROBES.md 규칙: 자동 검사에 더할 것은 세 번 돌려 흔들림 없을 때만**(손 실행 `mcp__github__actions_run_trigger` CI `repeat=3` - 이 환경엔 gh 명령이 없다) · SUITE=ci는 오늘을 2026-11-20에 묶는다(날짜 걱정 없음). 크기 작음.
2. **[① 점검 빈틈] 접근성 측정을 저장소 점검으로** - `tools/report/a11y-scan.mjs`를 `tools/inspect-a11y.mjs`로 다듬어 들이기: 지킬 것만 틀림으로(읽어 주는 이름 없는 누를 것 0 · 콘솔 오류 0 · 어두운 화면 강조 글자(text-primary) 4.5:1 · 흰 글씨 꽉 찬 단추 대비) - 일부러 옅은 '꺼진 것'(slate-300)·완료 ✓ 작은 글씨는 셈에서 뺀다. 그다음 자동 검사에 넣을지는 시간·흔들림 보고. 크기 중간.
3. **[④ 물어볼 것] 거의 안 보이는 누를 것**: ☆ 즐겨찾기 끄기 상태(`data-entry-favorite-toggle` 밝은 1.5:1·어두운 1.8:1 - 누르는 단추인데 비문자 기준 3:1 미달) · '일정이 없습니다.'(주간·한눈에 slate-300 1.4~1.8:1). CLAUDE.md 5장 '꺼진 것·옅은 나눔은 300'이 정한 것이라 **바꾸기 전에 사용자에게 묻는다**(AskUserQuestion 한 번 - 그림 견주기 권장).
4. **[③ 자원] 첫 화면 JS 371.9/380KB(남은 8.1KB)** - 지켜볼 것. 할 거면 CLAUDE.md 2장 '무엇이 첫 조각을 차지하나는 소스맵으로' 방법으로 나눌 후보를 숫자로 찾는다. 급하지 않음.
5. (낮음) 개발 도구 판 올리기(vite 8.4.0·vitest 5.1.2·firebase-tools 15.37·oxlint 1.95 - 기한 없음) · npm audit 개발 의존성 moderate 13(운영 의존성 0).
- 하지 않는 것: CLAUDE.md '지금 상태'의 '사용자가 말하면 할 것' 둘(일정·수업 보기 칸, #200 3번 나머지)은 사용자가 말할 때만.

## 내린 결정과 이유 (P61)
- 어두운 화면 강조 글자는 글자만 밝은 파랑(`themeCss` `darkAccentText`) - `--color-primary`는 꽉 찬 단추 바탕이라 그대로(흰 글씨 대비 지킴).
- 한글 줄바꿈 = html `word-break: keep-all`만. 전역 `overflow-wrap: break-word`는 정한 폭 상자(년간 날짜 18px)의 숫자를 꺾어 뺐다.
- 카드 열 상한 = 카드 96px·메모 140px, 자동 열 수보다 적게는 안 줄임(휴대폰 360 메모 목록이 227px라 세 열 = 65px였다).
- 휴대폰 ▲▼ 기본 '⇅ 누를 때만' = 사용자 '너의 추천으로 진행'(옛 사용자 규칙 '휴대폰은 늘'을 바꿈 - CLAUDE.md 5장 고침).

## 실패한 방법과 원인
- 전역 `overflow-wrap: break-word` → 년간 날짜 '10'이 글자 150%·130%에서 두 줄(겹침 측정 257건). 뺐다.
- ⇅ 단추가 서면서 넓은 둘레(@37.5rem)의 수업 칸 머리·메모 정렬 줄이 넘침 → 둘 다 줄 바꿈 허용으로 고침.
- 겹침 측정 '가림'이 가까운 스크롤 칸만 봐 가로 휴대폰 한눈에서 헛걸림 → `lib/uiOverlap` `revealable`이 바깥 칸·문서까지.
- 점검 스크립트에서 `sp5.openWindow('event', { date })`(sid 없이)는 창이 안 떴다 → `[data-event-add]`를 누르거나 sid를 준다.

## 검증 방법
- 준비: `npm run emu`(뒤에서, timeout 2시간 - 또는 `exec node node_modules/firebase-tools/lib/bin/firebase.js emulators:start --only auth,firestore --project schoolplannerv3`) → `node tools/seed.mjs` → `exec node node_modules/vite/bin/vite.js --mode emu`(뒤에서) · 살았나 `localhost:5175`·`127.0.0.1:8080`.
- 점검을 돌리기 전에 `docs/PROBES.md`를 읽는다(CLAUDE.md 2장). 점검이 도는 동안 저장소 파일을 고치지 않는다. 크롬 점검은 하나씩.
- 조각마다: `npx vitest run` · `npx tsc -b` · `npx oxlint` · `npx vite build` · `npm run check:size` · 바꾼 곳 화면 점검 · 겹침 측정(`SUITE=ci` + 바꾼 묶음 `SET_RE=`).
- 끝: 합치기 요청(초안) → 자동 검사(check·chrome·rules-data·build_and_preview) 통과 → 초안 풀고 합치기(CLAUDE.md - 사용자 규칙) → 세션 끝 정리(PLAN 1-3).

## 다음 작업에 추천하는 모델
opus (여러 파일·점검 판단이 필요) - 후보 1만 한다면 sonnet도 충분.
