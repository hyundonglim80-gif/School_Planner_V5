# 메모로 Claude에게 고칠 것 보내기 (10-16 사용자 요청 - 완전 자동)

앱 메모에 **`Claude요청`** 라벨을 붙여 저장한 뒤 메모 수정 칸 아래의 **🤖 요청**을 누르면, Claude가 코드를 고치고 확인한 뒤 **사람 확인 없이 합치고 실제 화면에 배포**한다.
저장만으로는 보내지 않는다(10-16 사용자 요청 - 보낼 때를 사용자가 정한다).

```
🤖 요청(메모의 claudeAskAt) → 함수 v5ClaudeRequest → 줄 → GitHub 이슈(라벨 claude-request)
  → .github/workflows/claude-request.yml: Claude가 고침 → lint·테스트·빌드 → PR 만들고 바로 합침
  → main CI → firebase-hosting-merge.yml 배포 → 메모 카드 ✅ 배포됨
```

- 진행 표시(메모 카드): (🤖 차례 기다림) → 🤖 보냄 → 🤖 고치는 중 → 🤖 배포 중 → ✅ 배포됨 / ❌ 실패 / 🤖 바꾼 것 없음. 누르면 GitHub 이슈(결과 글). 보통 10~30분.
- **결과 글**(10-19 사용자 의견 - '바꾼 것 없음'만으로는 왜인지 몰랐다): 바꾼 것 또는 **바꾸지 않은 까닭**(이미 있다·규칙에 걸린다·요청이 모호하다 + 다시 요청할 때 더 적을 것)을
  메모 카드 아래에 글로(세 줄까지 - 마우스를 올리면 전부), 메모 수정 칸·메모 화면 목록의 펼친 줄에는 전부. Claude가 `.claude-request/summary.md`에 쓰고(첫 줄이 결론),
  워크플로가 이슈 결과 댓글로 → 함수가 1000자까지 옮긴다(주소·'합쳤습니다' 줄은 앱이 뺀다).
- **라벨은 저절로**(10-16): 정한 계정에는 메모 라벨 `Claude요청`이 저절로 생긴다(한 시간 안 - 매분 함수가 한 시간에 한 번 챙긴다). 라벨 관리에서 🔒 - 이름을 바꾸거나 지울 수 없고, 빈 라벨 정리에서도 빠진다. 다른 길로 지워져도 한 시간 안에 되살아난다.
- **한 번에 하나**(10-16): 요청이 도는 동안(보냄·고치는 중) 들어온 요청은 🤖 차례 기다림 - 앞 요청이 합쳐지거나(배포 중) 끝나면 먼저 기다린 것부터 차례대로 보낸다(1분 안).
  보낼 때의 메모 글로 보낸다(기다리는 사이 고친 글이 간다). 기다리는 사이 메모를 지우거나 라벨을 떼면 보내지 않는다(🤖 바꾼 것 없음).
- **🤖 요청 단추**: 메모 수정 칸 아래(삭제 옆) - 잠긴 `Claude요청` 라벨(정한 계정에만 생긴다)이 **저장된** 메모에만. 고친 것을 저장하지 않았으면 누를 수 없다(저장된 글이 간다).
  누르면 **묻지 않고 바로** 보낸다(10-20 #76 - 옛날엔 묻는 창). 도는 동안 수정 칸·카드·목록 줄에는 진행 표시만, 끝나면(바꾼 것 없음·실패·배포됨) 글을 더 적어 **'🤖 다시 요청'**(10-20 #69 - 옛날엔 한 번 보낸 메모는 다시 요청 없음).
- 메모 첫 줄에 `#Claude요청`이라고 써도 라벨이 붙는다.

## 지키는 것

- **보낼 수 있는 계정**: 배포 값 `CLAUDE_OWNER_EMAILS`의 메일만(사용자 결정 10-16 - 세 계정). 개인 공간 메모만(공유 그룹 메모는 보내지 않는다).
  메일 목록은 코드에 적지 않는다 - 저장소가 공개라서(배포가 `functions/.env.schoolplannerv3`에 적는다, git 무시).
- **공개**: 요청 글은 누구나 볼 수 있는 이슈가 된다 - 학생 이름 등은 적지 않는다. 첨부는 보내지 않는다.
- **자동으로 올리지 않는 파일**: `firestore.rules`·`functions/`·`.github/`·`firebase.json`·`.firebaserc` - PC에서 배포해야 해서. 고치면 실패로 끝나고 까닭을 남긴다.
- **확인**: CI와 같은 것(lint·단위 테스트·함수 시험·빌드). 크롬 점검·에뮬레이터는 돌리지 않는다 - 하나라도 실패하면 올리지 않는다.
  다만 화면 글·`data-*`·자리를 바꾸면 그것을 찾는 점검 줄(`tools/inspect-*.mjs`)도 grep으로 찾아 같은 커밋에서 고친다(돌리지는 않는다 - 커밋 메시지 끝 '점검 고침: …', P14-4 10-29).
  Actions에서 크롬 점검을 돌리지 않는 까닭: 에뮬레이터·V4 seed·개발 서버가 들어 한 번에 수십 분(공개 저장소라 분은 무료지만 요청마다 기다림이 길어진다).
- **돈**: 추가 요금 없음 - Claude는 Pro 구독 토큰(사용 한도를 함께 쓴다), Actions는 공개 저장소라 무료, 진행 확인은 이미 매분 도는 `v5SendDueAlarms` 안에서(예약 작업을 늘리지 않는다).
- **한 번에 하나**: 함수가 줄을 세워 앞 요청이 도는 동안 이슈를 만들지 않는다(워크플로 `concurrency`는 덧댄 것 - 이슈가 하나씩 오므로 밀려나는 일이 없다).

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
5. **써 보기** - 라벨 `Claude요청`은 함수가 한 시간 안에 만든다(🔒가 붙어야 🤖 요청 단추가 나온다). 그 라벨을 작은 요청(예: "설명서 '메모' 주제 첫 줄에 '메모는 날짜 없이도 쓸 수 있습니다'를 더해 줘") 메모에 붙여 저장한 뒤 수정 칸의 🤖 요청.

토큰이 끝나면(1년) 1~3을 다시 하고, 4는 `secrets:set`만 다시 한다(그 뒤 함수가 새 값을 읽게 같은 배포 명령을 한 번 더).

## 문제가 생기면

- 카드에 표시가 안 뜬다 → Firebase 콘솔 함수 로그 `v5ClaudeRequest`('정한 계정이 아님'이면 4의 메일 목록, '보내기 실패'면 GitHub 토큰).
- ❌ 실패 → 표시를 눌러 이슈의 결과 글·실행 기록(Actions)을 본다. Claude 토큰이 끝났거나 Pro 사용 한도가 찼으면 Claude 단계에서 멈춘다.
- 멈추고 싶다 → 저장소 Settings → Actions에서 'Claude 요청' 워크플로를 끈다(Disable workflow). 함수는 이슈만 만든다.

## 자리

`functions/claudePlan.js`(순수 - 라벨 이름·새로 붙은 라벨·이슈 글·계정·상태 셈·한 번에 하나 `nextToDispatch`·라벨 챙기기 `planClaudeLabel`, `claudePlan.test.js`) ·
`functions/index.js`(`v5ClaudeRequest` = 줄에 세우기 · `dispatchNext` = 트랜잭션으로 하나만 보내기 · `checkClaudeRequests` = 진행 → `ensureClaudeLabels`(한 시간에 한 번, 표시 `v5claudeMeta/labels`) → 다음 보내기, 함수 칸 `v5claude/{itemId}` - 규칙에 match 없음 = 앱은 못 읽음) ·
라벨 표시 `labels.system = 'claudeRequest'`(라벨 관리 `[data-label-locked]` - 이름 읽기만·✕ 없음·빈 라벨 정리에서 뺌) ·
🤖 요청 `notes/ClaudeAskButton`(`[data-note-claude-ask]`·보낸 뒤 `[data-note-claude-asked]` - `notes/NotePanel` 아래) → `notes/actions.askClaude`(메모 `claudeAskAt` 하나) → 함수 `askedNow` · 진행 표시는 카드·`memo/MemoListRow`·수정 칸 ·
앱이 보는 칸 `spaces/{sid}/claudeRequests/{itemId}`(`data/claudeRequests` Shell에 하나 · store `data/claudeRequestStore` · 순수 `domain/claudeRequest`(결과 글 `claudeNoteText`) · 카드 `notes/ClaudeRequestBadge` `[data-entry-claude=상태]` · 결과 글 `notes/ClaudeRequestNote` `[data-entry-claude-note=상태]`) ·
워크플로 `.github/workflows/claude-request.yml` · 점검 `tools/inspect-claude-request.mjs`(카드 표시 - 함수·GitHub는 흉내 내지 않는다).
