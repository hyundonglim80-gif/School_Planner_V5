# 메모로 Claude에게 고칠 것 보내기 (10-16 사용자 요청 - 완전 자동)

앱 메모에 **`Claude요청`** 라벨을 붙여 저장하면, Claude가 코드를 고치고 확인한 뒤 **사람 확인 없이 합치고 실제 화면에 배포**한다.

```
메모 저장(라벨 Claude요청) → 함수 v5ClaudeRequest → GitHub 이슈(라벨 claude-request)
  → .github/workflows/claude-request.yml: Claude가 고침 → lint·테스트·빌드 → PR 만들고 바로 합침
  → main CI → firebase-hosting-merge.yml 배포 → 메모 카드 ✅ 배포됨
```

- 진행 표시(메모 카드): 🤖 보냄 → 🤖 고치는 중 → 🤖 배포 중 → ✅ 배포됨 / ❌ 실패 / 🤖 바꾼 것 없음. 누르면 GitHub 이슈(결과 글). 보통 10~30분.
- 같은 메모를 다시 보내려면 라벨을 떼었다 다시 붙여 저장한다(같은 메모를 고쳐 저장할 때마다 보내지 않는다).
- 메모 첫 줄에 `#Claude요청`이라고 써도 라벨이 붙는다.

## 지키는 것

- **보낼 수 있는 계정**: 배포 값 `CLAUDE_OWNER_EMAILS`의 메일만(사용자 결정 10-16 - 세 계정). 개인 공간 메모만(공유 그룹 메모는 보내지 않는다).
  메일 목록은 코드에 적지 않는다 - 저장소가 공개라서(배포가 `functions/.env.schoolplannerv3`에 적는다, git 무시).
- **공개**: 요청 글은 누구나 볼 수 있는 이슈가 된다 - 학생 이름 등은 적지 않는다. 첨부는 보내지 않는다.
- **자동으로 올리지 않는 파일**: `firestore.rules`·`functions/`·`.github/`·`firebase.json`·`.firebaserc` - PC에서 배포해야 해서. 고치면 실패로 끝나고 까닭을 남긴다.
- **확인**: CI와 같은 것(lint·단위 테스트·함수 시험·빌드). 크롬 점검·에뮬레이터는 돌리지 않는다 - 하나라도 실패하면 올리지 않는다.
- **돈**: 추가 요금 없음 - Claude는 Pro 구독 토큰(사용 한도를 함께 쓴다), Actions는 공개 저장소라 무료, 진행 확인은 이미 매분 도는 `v5SendDueAlarms` 안에서(예약 작업을 늘리지 않는다).
- **한 번에 하나**: 워크플로 `concurrency`. 셋째 요청이 기다리던 둘째를 밀어내면 그 요청은 3시간 뒤 '실패(시간 초과)' - 라벨을 다시 붙인다.

## 처음 한 번 설정 (PC)

1. **Claude 토큰** - VS Code 터미널 `claude setup-token` → 브라우저에서 허락 → 나온 `sk-ant-oat…` 복사(1년).
2. **GitHub 토큰** - https://github.com/settings/personal-access-tokens/new
   - 이름 `sp5-claude`, 기간 1년, Repository access = Only select repositories → `School_Planner_V5`
   - Permissions: Contents **Read and write** · Issues **Read and write** · Pull requests **Read and write** · Actions **Read-only**
   - Generate → `github_pat_…` 복사
3. **GitHub 비밀값** - https://github.com/hyundonglim80-gif/School_Planner_V5/settings/secrets/actions → New repository secret 둘
   - `CLAUDE_CODE_OAUTH_TOKEN` = 1의 토큰
   - `CLAUDE_REQUEST_GITHUB_TOKEN` = 2의 토큰
4. **Firebase 비밀값 + 함수 배포** (V5 폴더에서, `git pull` 뒤)
   ```
   npx.cmd firebase functions:secrets:set CLAUDE_GITHUB_TOKEN --project schoolplannerv3
   ```
   값을 물으면 2의 토큰을 붙여넣는다.
   ```
   $env:FUNCTIONS_DISCOVERY_TIMEOUT=60; npx.cmd firebase deploy --only functions:v5 --project schoolplannerv3
   ```
   `CLAUDE_OWNER_EMAILS`를 물으면 보낼 수 있는 메일을 쉼표로 한 줄에 넣는다.
5. **써 보기** - 메모 화면에서 라벨 `Claude요청`을 만들고, 작은 요청(예: "설명서 '메모' 주제 첫 줄에 '메모는 날짜 없이도 쓸 수 있습니다'를 더해 줘") 메모에 붙여 저장.

토큰이 끝나면(1년) 1~3을 다시 하고, 4는 `secrets:set`만 다시 한다(그 뒤 함수가 새 값을 읽게 같은 배포 명령을 한 번 더).

## 문제가 생기면

- 카드에 표시가 안 뜬다 → Firebase 콘솔 함수 로그 `v5ClaudeRequest`('정한 계정이 아님'이면 4의 메일 목록, '보내기 실패'면 GitHub 토큰).
- ❌ 실패 → 표시를 눌러 이슈의 결과 글·실행 기록(Actions)을 본다. Claude 토큰이 끝났거나 Pro 사용 한도가 찼으면 Claude 단계에서 멈춘다.
- 멈추고 싶다 → 저장소 Settings → Actions에서 'Claude 요청' 워크플로를 끈다(Disable workflow). 함수는 이슈만 만든다.

## 자리

`functions/claudePlan.js`(순수 - 라벨 이름·새로 붙은 라벨·이슈 글·계정·상태 셈, `claudePlan.test.js`) · `functions/index.js`(`v5ClaudeRequest`·`checkClaudeRequests`, 함수 칸 `v5claude/{itemId}` - 규칙에 match 없음 = 앱은 못 읽음) ·
앱이 보는 칸 `spaces/{sid}/claudeRequests/{itemId}`(`data/claudeRequests` Shell에 하나 · store `data/claudeRequestStore` · 순수 `domain/claudeRequest` · 카드 `notes/ClaudeRequestBadge` `[data-entry-claude=상태]`) ·
워크플로 `.github/workflows/claude-request.yml` · 점검 `tools/inspect-claude-request.mjs`(카드 표시 - 함수·GitHub는 흉내 내지 않는다).
