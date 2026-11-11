# 운영 - 서버 백업과 되찾기

프로젝트 `schoolplannerv3` · 데이터베이스 `(default)` · 위치 `asia-northeast3`(서울). **V3·V4·V5가 한 데이터베이스**를 쓴다 - 여기 일은 셋 모두에 닿는다.
명령은 이 PC의 Firebase CLI로 된다(gcloud 없어도 - 10-29 P14-3). VS Code 터미널(PowerShell)에서는 `npx.cmd firebase …`.

## 서버 예약 백업 (2026-10-29 사용자 결정 - ① 매일 7일 + 매주 8주)

| 일정 | 보관 | id |
|---|---|---|
| 매일 | 7일 | `47244ac6-c0b6-41cd-bcfb-7eda1a8b7b14` |
| 매주 일요일 | 56일(8주) | `112399b6-e5aa-473e-bdac-6ef55ab9e4b4` |

- 드라이브 자동 백업(앱)은 PC + 구글 권한 + **개인 공간만**이다. 이 백업은 서버 자료 전체(그룹 공간·휴대폰만 쓰는 사람·V3·V4)를 담는다. 예약 내보내기 함수는 두지 않는다(같은 일).
- 값: 백업 저장 용량만큼(무료 할당 없음). Google Cloud 콘솔 → 결제 → 보고서 → 서비스 'Cloud Firestore'의 Backup 줄. 예산 알림은 결제 → 예산 및 알림.
- PITR(7일 안 아무 시점)은 켜지 않았다(10-29 - ③을 고르지 않음).
- **`(default)` 삭제 보호 켬**(10-29 사용자 - 무료): 데이터베이스를 통째로 지우는 명령이 막힌다. 끄는 것도 묻는다(`firestore:databases:update "(default)" --delete-protection DISABLED`).
  **복원한 데이터베이스는 이 보호를 물려받는다**(11-06 복원 연습 - 옛 글은 '그대로 지울 수 있다'였다): 지우기 전에 그 임시 데이터베이스만 보호를 끈다(아래 되찾기 5).

```
npx firebase firestore:backups:schedules:list --project schoolplannerv3   # 일정 둘
npx firebase firestore:backups:list --project schoolplannerv3             # 백업 - 만든 다음 날부터 READY
npx firebase firestore:databases:get "(default)" --project schoolplannerv3
```

일정을 바꾸거나 지우는 것은 돈·자료에 닿으니 사용자에게 묻는다(`firestore:backups:schedules:update` / `:delete`).

## 저장소 지키기 (2026-11-06 사용자 - P22-6)

- GitHub 룰셋 'main 지키기'(id `26676723`): 기본 브랜치의 **강제 푸시·지우기만** 막는다. 검사 필수는 걸지 않는다 - 메모 자동 요청의 바로 합치기가 막힌다. 끄려면 저장소 Settings → Rules → Rulesets.
- Dependabot 보안 알림·자동 고침을 켰다 - 고침 PR이 저절로 열려도 합치기 전에는 앱에 닿지 않는다. 합칠 때는 CI를 본다.
- App Check는 쓰지 않는다(PLAN 5장 'P22-6 App Check').
- Dependabot 알림이 남아도 `firebase-tools`(명령 도구) 밑이면 **강제 고침(`npm audit fix --force`)·도구 밑 판 바꿔 끼우기를 그냥 받지 않는다** - force는 도구를 옛 판으로 내리고, minimatch 바꿔 끼우기는 배포 파일을 0개로 만들었다(PLAN 5장 'P26-2 의존성 경고'). 바꾸면 `listFiles('dist')` 수부터 본다.

## 보안 헤더·CSP (2026-11-11 막기 - P26-2)

- 값은 `firebase.json` hosting `source: **` 한 곳. **CSP는 막기**(`Content-Security-Policy`) - 빠진 출처는 그 기능을 깨뜨린다(그림이 안 뜨거나 연결이 막힌다).
- 위반은 앱이 오류 보고 '[CSP] <칸> <출처>'로 올린다(개발자 탭 오류 기록) - 사용자가 '사진 고르기·드라이브·캘린더가 안 된다'를 알리면 여기부터 본다. 고치기 = 그 출처를 그 칸에 더하고 main 푸시(저절로 배포).
- 급하면 되돌리기: 키를 `Content-Security-Policy-Report-Only`로 한 줄(막지 않고 보고만) - `app/securityHeaders.test.ts`·`tools/inspect-headers.mjs`도 함께 바꾼다.
- 확인: 운영 `SITE=https://schoolplanner-v5.web.app/ node tools/inspect-headers.mjs`(헤더 + 로그인 단추 → 구글 로그인 창까지 위반 0). 개발 서버는 CSP를 내지 않는다 - 화면 점검은 미리 보기(에뮬레이터 주소만 더한 값)로.

## 되찾기 (복원은 새 데이터베이스로만)

**`(default)`를 통째로 덮지 않는다** - V3·V4·V5 모든 사람의 그 뒤 자료가 사라진다. 백업을 새 데이터베이스로 풀고, 필요한 문서만 옮긴다.

1. 백업 이름 찾기: `firestore:backups:list` → `projects/schoolplannerv3/locations/asia-northeast3/backups/<id>`(그 날짜의 READY).
2. 새 데이터베이스로 풀기(몇 분~):
   `npx firebase firestore:databases:restore -d restore-drill -b projects/schoolplannerv3/locations/asia-northeast3/backups/<id> --project schoolplannerv3`
3. Firebase 콘솔 → Firestore → 위 데이터베이스 고르기에서 `restore-drill` → 잃은 문서를 같은 경로로 찾는다
   (V5 `spaces/{공간}/…`, V4 `users/{uid}/…` - 경로는 `firestore.rules`·`docs/DESIGN.md`).
4. `(default)`의 같은 경로에 옮긴다 - 문서 몇 개면 콘솔에서 필드를 보고 손으로, 많으면 그때 Claude에게 옮기기 스크립트(읽기 = restore-drill, 쓰기 = 그 경로만).
5. 다 쓰면 바로 지운다(있는 동안 저장 값이 든다). 복원본은 삭제 보호를 물려받아 먼저 끈다 - **이름이 `restore-drill`인지 꼭 본다**(`(default)`에 하면 실제 자료의 보호가 꺼진다):
   `npx firebase firestore:databases:update restore-drill --delete-protection DISABLED --project schoolplannerv3`
   `npx firebase firestore:databases:delete restore-drill --project schoolplannerv3`

복원이 되었는지 수만 볼 때는 `node tools/restore-count.cjs`(글 내용은 받지 않는다, `(default)`는 세지 않는다). 작업 목록이 끝났다고 해도 서버는 한동안 'undergoing a restore'로 거절한다 - 이 도구가 대답할 때까지 기다린다.

### 복원 연습 기록

| 날짜 | 백업 | 한 것 | 결과 |
|---|---|---|---|
| 2026-11-06 | `04b15d0d-…`(11-05 09:10 UTC) | `restore-drill`에 풀어 문서 수만 셌다(`tools/restore-count.cjs` - 글 내용은 받지 않았다) | **되살아났다**: 맨 위 컬렉션 16 · `spaces` 4 · 공간 `items` 1206 · `events` 2460(맨 위 365 + 그 아래) · `journals` 494 · `evaluations` 65 · 쪽지 3. `users`·`v5Mail`은 부모 문서 없이 하위만 있어 맨 위 수 0이 맞다. `(default)`와 수를 견주지는 않아 '모두 같다'까지는 모른다. 복원본이 삭제 보호를 물려받는 것을 찾았다 |
