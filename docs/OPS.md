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
  연습 DB(`restore-drill`)는 보호를 켜지 않으니 그대로 지울 수 있다.

```
npx firebase firestore:backups:schedules:list --project schoolplannerv3   # 일정 둘
npx firebase firestore:backups:list --project schoolplannerv3             # 백업 - 만든 다음 날부터 READY
npx firebase firestore:databases:get "(default)" --project schoolplannerv3
```

일정을 바꾸거나 지우는 것은 돈·자료에 닿으니 사용자에게 묻는다(`firestore:backups:schedules:update` / `:delete`).

## 되찾기 (복원은 새 데이터베이스로만)

**`(default)`를 통째로 덮지 않는다** - V3·V4·V5 모든 사람의 그 뒤 자료가 사라진다. 백업을 새 데이터베이스로 풀고, 필요한 문서만 옮긴다.

1. 백업 이름 찾기: `firestore:backups:list` → `projects/schoolplannerv3/locations/asia-northeast3/backups/<id>`(그 날짜의 READY).
2. 새 데이터베이스로 풀기(몇 분~):
   `npx firebase firestore:databases:restore -d restore-drill -b projects/schoolplannerv3/locations/asia-northeast3/backups/<id> --project schoolplannerv3`
3. Firebase 콘솔 → Firestore → 위 데이터베이스 고르기에서 `restore-drill` → 잃은 문서를 같은 경로로 찾는다
   (V5 `spaces/{공간}/…`, V4 `users/{uid}/…` - 경로는 `firestore.rules`·`docs/DESIGN.md`).
4. `(default)`의 같은 경로에 옮긴다 - 문서 몇 개면 콘솔에서 필드를 보고 손으로, 많으면 그때 Claude에게 옮기기 스크립트(읽기 = restore-drill, 쓰기 = 그 경로만).
5. 다 쓰면 바로 지운다(있는 동안 저장 값이 든다): `npx firebase firestore:databases:delete restore-drill --project schoolplannerv3`

### 복원 연습 기록

| 날짜 | 백업 | 한 것 | 결과 |
|---|---|---|---|
| (첫 READY 백업 뒤 한 번 - P14-3 끝 조건) | | | |
