# School Planner V5 — 설계

2026-10-08 정함(사용자: "정해야 하는 것은 네가 권장하는 방식을 따를께"). V5를 만드는 동안 **자료 모양과 뼈대의 정본**이다.
만들면서 바뀌면 같은 커밋에서 이 파일을 고친다. 메뉴·화면 자리는 `MENU.md`, 작업 순서는 `PLAN.md`, V4 기능 대조는 `PARITY.md`.

---

## 1. 목표

- **화면·기능·사용자가 정한 규칙은 V4 그대로** (V4 `CLAUDE.md` 5장, V4 설명서 `src/lib/helpTopics.ts`). 자리를 옮긴 것은 `MENU.md`.
- **속은 V4의 기능에 맞춰 새로**. V3·V4와 자료를 함께 쓰지 않는다. V4 자료는 한 방향 **가져오기**(8장)로만 읽는다.
- V4의 순수 함수와 그 테스트, 화면 부품은 옮겨 와서 쓴다(처음부터 다시 짜지 않는다).

## 2. 원칙 일곱

V4에서 사고가 났거나 코드가 불어난 자리마다 원칙 하나씩 세운다.

| # | 원칙 | V4에서 무엇을 없애나 |
|---|---|---|
| 1 | **항목 하나 = 문서 하나** | 하루치 배열(`events/{date}`·`journals/{date}`)을 통째로 다시 쓰기, 하루가 지워진 사고(09-22), 저장마다 트랜잭션·서버 확인 읽기 |
| 2 | **id는 바뀌지 않는다** | 이월·메모↔기록 옮기기 때 새 id → 역링크 갈아끼우기, 휴지통 사본, 구글 캘린더 짝 맞추기 |
| 3 | **이름이 아니라 id로 가리킨다** (라벨·학급·학생·항목) | 라벨 이름 바꾸기가 모든 문서를 돎(`labelRename`), `jm_` id, 학생 번호가 바뀌면 기록이 떨어짐 |
| 4 | **계산할 수 있는 것은 저장하지 않는다** | 이월 러너(앱 열 때 옮겨 쓰기), 시간표 적용(수업일마다 덮어쓰기), 기간 일정 날마다 사본·'(1/5)', 알림장·출결 자동 기록 사본과 맞추기(`autoJournalSync`) |
| 5 | **지우기 = 지운 표시** (`deletedAt`) | 휴지통 사본·종류별 되살리기(`trashRestore`), '휴지통에 못 넣으면 안 지움' |
| 6 | **기기 사본 + 바뀐 것만 받기** | 열 때마다 다시 받기, 기간 전체를 내려받는 검색, 오프라인 보기 없음 |
| 7 | **화면은 자료 층만 부르고, 창은 창 목록 한 곳에** | Layout이 창 열림 상태·단축키를 모두 쥠, 화면이 Firestore를 직접 부름, 첫 화면 JS 약 1.4MB |

**V4에서 그대로 지키는 규칙**: 저장 실패는 던진다(칸은 닫지 않는다) · 본문을 읽기·저장 길에서 바꾸지 않는다 ·
칸을 연 순간의 공간·날짜에 저장한다 · 새 창은 `ModalShell`/`PopupFrame` · 설명서·툴팁에 키 조합을 글로 박지 않는다 ·
사용자가 시키지 않은 일에서 구글 로그인 창을 띄우지 않는다.

## 3. 서버와 주소

- **Firebase 프로젝트는 `schoolplannerv3` 그대로.** 로그인 uid, FCM, 함수(서울 `asia-northeast3`), 나이스 키 `sharedConfig/neis`,
  공휴일 `holidays/{year}`를 그대로 쓴다. 무엇보다 **드라이브 `drive.file` 권한이 구글 클라우드 프로젝트(번호)에 묶여 있어**,
  같은 프로젝트에 있어야 V4가 올린 첨부·학생 사진·백업 파일을 V5가 그대로 연다.
- **Firestore는 `(default)` 데이터베이스.** 이름 붙인 데이터베이스는 따로 떼기는 좋지만 무료 사용량이 없다.
  V5 컬렉션은 V3·V4가 쓰지 않는 이름: `spaces`, `spaceInvites`, `v5alarms`.
- **규칙 파일은 하나다.** 기본 데이터베이스의 규칙은 한 벌이라 V5가 규칙을 배포하면 V3·V4 규칙도 그것으로 바뀐다.
  그래서 **V5 저장소 `firestore.rules` = V4 규칙 전부 + V5 블록**이고, P1-2부터 이것이 정본이다.
  V4 `firestore.rules`는 같은 내용의 복사본으로 두고 맨 위에 '정본은 V5 저장소'라고 적는다.
  규칙 검사 `tools/check-rules.mjs`는 V4의 35개 + V5 것을 함께 돌린다. 운영 배포는 사용자에게 묻고 한다.
- **함수는 codebase로 가른다.** V4 = `default`(V4 `functions/`), V5 = `v5`(V5 `functions/`, `firebase.json`에 `"codebase": "v5"`).
  배포는 반드시 `npx firebase deploy --only functions:v5` — codebase를 빼면 V4 함수를 지우려 한다.
- **주소는 Firebase Hosting 새 사이트**(이름은 P1-4, 권장 `schoolplanner-v5` → `https://schoolplanner-v5.web.app`).
  github.io 하위 경로는 V3·V4와 출처가 같아 localStorage를 함께 쓴다. `authDomain`도 그 주소로 두면 로그인 처리(`/__/auth/handler`)가
  같은 출처라 휴대폰 리디렉트 로그인이 안정적이다. 새 주소는 Auth 승인 도메인과 구글 OAuth 클라이언트의 승인된 JavaScript 원본에 더한다(👤).
- **에뮬레이터는 V4와 한 벌을 같이 쓴다**(같은 project id, 같은 포트 Firestore 8080·Auth 9099). 운영과 같게 V3·V4·V5 자료가 한 데이터베이스에
  있으므로 V4 seed 자료로 가져오기를 시험할 수 있다. P1-2부터는 V5 저장소에서 켠다(합친 규칙을 읽게).
- 기기에 두는 열쇠(localStorage·IndexedDB 이름)는 `sp5-`로 시작한다.

## 4. 자료 모양

### 4-1. 공간

`spaces/{sid}` = `{ kind: 'personal'|'group', name, ownerId, members: { [uid]: 'owner'|'member' }, inviteCode?, createdAt, updatedAt, v: 1 }`

- 개인 공간 id = `u_{uid}`(찾지 않고 바로 안다), 그룹 공간 = `g_{id}`.
- **공간마다**(개인·그룹 같다): `items`, `labels`, `series`, `lessonDays`, `timetables`, `evaluations`, `notices`.
- **개인 공간에만**(V4처럼 늘 개인): `classes`, `attendance`, `subjectAttendance`, `seating`, `classHub`, `quiz`, `progress`,
  `settings`, `pushTokens`, `gcalQueue`.
- V4와 다른 점: **라벨이 공간 것**이다. 항목이 라벨을 id로 가리키므로 그룹 구성원이 같은 라벨 목록을 봐야 한다(개인 공간은 V4처럼 내 라벨).
- 규칙(`firestore.rules` V5 블록, P1-2): 개인 공간 아래는 id `u_{uid}`만 본다(공간 문서가 없어도 된다 - 로그인하면 `ensurePersonalSpace`가 만든다).
  그룹은 `members`. **`inviteCode`가 있으면 초대가 열린 것** - 참여는 그때 나만 'member'로, 나가기는 나만, 주인은 나가지 못하고 그룹을 지운다.
  `spaceInvites/{code}`는 그 그룹 주인만 만든다. 개인 공간 문서는 지우지 못한다.

### 4-2. `items/{id}` — 일정·메모·기록

| 칸 | 모양 | 뜻 |
|---|---|---|
| `kind` | `'event'`·`'note'` | 일정 / 메모·기록 |
| `date` | `'YYYY-MM-DD'`·`null` | 일정은 늘 있다. 메모·기록은 날짜가 있으면 그날 **기록**, `null`이면 **메모**(V4 U7 '날짜 칸 = 자리') |
| `endDate` | `'YYYY-MM-DD'`? | 기간 일정의 끝 날(일정만) |
| `workdays` | boolean? | 기간 일정: 주말·공휴일은 빼고 센다(V4 '주말과 공휴일 제외하고 계산하기' - 새 기간은 기본 켬, P3-3) |
| `skipDates` | string[]? | 기간 일정: '이 날만 지우기'로 뺀 날(한 문서를 그대로 두고 그날만 뺀다 - P3-3) |
| `text` | string | 본문. 읽기·저장 길에서 바꾸지 않는다 |
| `labelIds` | string[] | 라벨 id |
| `done` / `doneAt` | boolean / number? | 완료 / 완료한 때(ms) |
| `doneDates` | string[]? | 기간 일정의 날마다 완료 |
| `favorite` | boolean? | ★ (메모·기록) |
| `order` | string | 같은 날·같은 목록 안 차례. 분수 인덱스 글자라 하나만 고쳐 끼운다(▲▼ = 다시 세운 줄에서 옮긴 것만 - `rekeyOrders`). 새 항목은 그날 맨 뒤, 날짜를 옮겨도 그대로 |
| `time` / `alarmDone` | `'HH:mm'`? / boolean? | 알림 시각(그 항목의 `date` 기준 - 날짜를 옮기면 알림도 따라간다, 알림 창에 날짜 칸이 없다) / 울림 - 앱 안 알림이 울린 기기가 적고 다른 기기는 건너뛴다. 시각을 바꾸거나 날짜를 옮기면 지운다(다시 울린다) |
| `due` | `'YYYY-MM-DD'`? | 기한 |
| `props` | `{ forward?, calendar?, skip?, gcal? }`? | 이 항목만의 속성 값 - **라벨이 정한 값과 다른 것만** 적는다(P3-1 `features/events/eventForm`). 없으면 라벨 속성을 따른다(붙은 라벨 하나라도 켰으면 켬, 라벨이 없으면 달력만 - V4와 같다) |
| `carrying` / `carriedFrom` | boolean? / `'YYYY-MM-DD'`? | 이월로 따라오는 중(처음 따라올 때 한 번 쓴다) / 끝낼 때 그날로 옮겨 적으며 남기는 처음 날 |
| `seriesId` / `seriesIndex` | string? / number? | 반복 묶음 |
| `fromDate` | `'YYYY-MM-DD'`? | 기록에서 메모로 뺄 때 그 날('📅 10/6에서'). 메모를 다시 기록으로 옮기면 걷는다(P3-2 `features/notes/noteForm` `placeChanges` - 옮기기 = 같은 문서의 `date`만) |
| `keepId` | string? | 구글 Keep에서 가져온 메모의 열쇠(V4 tasks 그대로 - P3-4) |
| `tables` | EntryTable[]? | 붙인 표(V4 `lib/entryTable` 모양 그대로 - `rows[].cells[]`) |
| `studentIds` | string[]? | 학생 태그 `'{classId}/{sid}'` |
| `attachments` | Attachment[]? | 드라이브 파일(V4 모양: name·url·type·size·driveId) |
| `linkIds` | string[]? | 이은 항목 id. 수업은 `'lesson:{date}:{교시}'` |
| `authorId` | string | 만든 사람(그룹에서 보존) |
| `createdAt` | number | 만든 때(ms) |
| `updatedAt` | Timestamp | **서버 시각.** 기기 사본이 이것으로 바뀐 것만 받는다 |
| `deletedAt` / `deletedBy` | Timestamp·`null` / string? | 지운 표시. **만들 때 `null`을 꼭 넣는다**(없는 칸은 쿼리로 거를 수 없다) |
| `src` | `{ from: 'v4', path, id, h }`? | 가져온 항목의 V4 자리 - 다시 가져오기(`h` = 가져올 때 적은 칸의 지문, 8-1), V4가 보낸 구글 캘린더 일정과 짝 |
| `v` | 1 | 자료 판(나중에 모양을 바꿀 때 판으로 가린다) |

### 4-3. `labels/{id}`

`{ kind: 'event'|'note', name, color, parentId: string|null, order, props?, src?, updatedAt, deletedAt, v }` (`src` = V4에서 가져온 라벨, 8-1)

- `parentId`는 메모·기록 라벨만(2단계). 이름은 같은 종류 안에서 겹치지 않게 저장 때 본다.
- `props`는 일정 라벨만: `{ calendar?, forward?, skip?, gcal?, period?, recur? }` — 화면 이름은 V4 그대로 **달력·이월·수업X·구글 캘린더**
  (UX-AUDIT T2·T6 사용자 결정). `period`·`recur`는 V5에서 '새 일정 칸을 열 때 끝 날·반복 줄을 펴 둔다'는 기본값으로만 쓴다(4-4·5-3).
- 맨 위(order가 가장 앞) 라벨이 새 항목의 기본 라벨이다(V4와 같다). 메모·기록은 트리 차례의 맨 위(`data/select` `labelTreeOf().defaultId`).
- 상위는 문서의 `parentId`를 믿지 않고 다듬어 쓴다(`domain/labelTree` `parentMapOf`): 상위가 살아 있는 같은 종류 라벨이 아니거나 자기 자신이거나 3단계면 그 하위는 맨 위 단계로 보인다.
  **지운 상위의 하위 문서는 고쳐 쓰지 않는다** - 상위를 되살리면 트리가 돌아온다. 이름을 바꿔도 트리·항목은 그대로다(모두 id).
- `props`는 바뀌면 여섯 칸을 모두 채워 적고, 읽기는 `domain/labels` `labelProps`(적지 않은 `calendar` = 켜짐 - V4 `normalizeEventLabel`과 같다).
- `color`는 색 이름(`blue`·`green`…, `domain/labels` `LABEL_COLORS` - V4 표 그대로, 모르는 색은 회색).
- 쓰기는 `data/labels`: 라벨 관리 창의 저장 = **바뀐 라벨 문서의 바뀐 칸만**(`labelSaveOps` - 차례는 옮긴 것만 `rekeyOrders`), 새 라벨은 그 종류의 맨 뒤,
  쓰는 칸의 새 라벨·'#라벨'은 `ensureLabelOps`로 항목과 한 묶음. 라벨이 없는 공간에 기본 라벨을 저절로 넣지 않는다(라벨 관리의 '기본 라벨 넣기', id `dflt_…`).

### 4-4. `series/{id}` — 반복

`{ rule: { freq: 'daily'|'weekly'|'monthly', interval, weekdays?: number[], monthWeek?, monthDays?: number[] }, start, until?, count?,
template: { text, labelIds, time?, props? }, imported?: true, updatedAt, deletedAt, v }`

- 항목은 날마다 만들어 둔다(완료·이월·알림·구글 캘린더가 날마다 따로 돌게). 규칙은 '어떤 반복인가'(일정 칸 '🔁 매주 화')를 보이는 데 쓰고,
  묶음은 `seriesId`로 고른다 - 고치기·지우기 = 이 일정만·이 날부터·전부(바꾼 칸만 그 항목들에, 이 날부터 지우기는 `until`을 앞 항목 날로). 한 번에 499개까지(반복 문서와 한 묶음, P3-3).
- V4에서 가져온 반복은 규칙을 모르므로 `imported: true`, `rule` 없음(묶음 지우기만 된다).

### 4-5. 수업

| 자리 | 모양 | 뜻 |
|---|---|---|
| `timetables/{id}` | `{ name, from, to, grid: { '1'~'5'(요일): { '<교시>': '국어' \| '5-2 과학' } }, updatedAt, deletedAt, v }` | **기간별 시간표**(1학기·2학기·'10/14부터 바뀐 시간표'). 기간이 겹치면 늦게 시작한 것이 이긴다 |
| `lessonDays/{date}` | `{ periods: { '<교시>': { subject?, memo?, supplies?, attachments?, linkIds? } }, updatedAt, v }` | **그날 바꾼 칸만.** `subject`가 있으면 그 과목(`''`이면 그 교시 수업 없음), 칸이 없으면 시간표를 따른다. 과목이 그날 시간표와 같으면 적지 않는다(P6-1 `features/lessons/lessonOps`). 고칠 때는 `periods.3.memo`처럼 그 칸만 - 날짜 문서라 저장 도우미 `merge`(없으면 만든다). 지운 표시는 없다 |
| `settings/common.periods` | `[{ n, name, start, end }]` | 교시 이름·시각(V4 '수업 시간 명칭' + `v4_periodTimes`를 하나로). 교시 수 = 길이(1~12), 기본 1~6교시·시각 없음 |
| `settings/common.terms` | `{ '2026': { summer?: {from,to}, winter?: {from,to} } }` | 학년도마다 **방학만**(학년도 = 3월~이듬해 2월). 학기는 셈한다 - 1학기 = 3/1 ~ 여름 방학 전날, 2학기 = 여름 방학 다음 날 ~ 겨울 방학 전날(V4 `lib/semester` - `domain/semester` `termSemesters`·`semesterConfigOf`) |
| `settings/common.teaching` | `{ unit, hasHomeroom, homeroomClass, subjects, classes, classColors }` 또는 없음 | 교사 유형(V4 `v4_teaching`). 없으면 (초등) 담임으로 보고 하루 화면에 '교사 유형을 골라 주세요' 띠 |

### 4-6. 학급 (개인 공간)

| 자리 | 모양 |
|---|---|
| `classes/{classId}` | classId = `'{학년도}-{학년}-{반}'`(예 `'2026-5-2'`). `{ year, grade, num, name?, students: [{ sid, num, name, gender?, status: 'active'\|'out', outDate? }], updatedAt, v }` — **학생은 sid로 가리킨다**(번호가 바뀌어도 기록이 따라간다) |
| `attendance/{classId}_{date}` | `{ classId, date, records: { [sid]: { kind, reason, periods?, note? } }, updatedAt }` — 바뀐 학생 칸만 쓴다 |
| `subjectAttendance/{classId}_{date}` | `{ classId, date, periods: { '<교시>': { [sid]: { kind, reason, note? } } }, updatedAt }` |
| `seating/{id}` | V4 `v4_seating` 모양, 학생은 sid |
| `classHub/{classId}` | `{ apart: ['sidA\|sidB'], draw: { picked: [sid], round }, groupSets: {…} }` |
| `quiz/{key}` | 암기 성적(V4 `settings/photoQuiz`) |

### 4-7. 조사표·알림장·진도 (조사표·알림장은 공간마다, 진도는 개인)

- `evaluations/{evalId}`: **조사표 한 장 = 문서 하나** `{ date, period?, classId?, title, type, columns?, values: { [sid]: … }, groups?, subject?, courseId?, updatedAt, deletedAt, v }`
  (V4는 하루 문서의 배열 `list`/`evalList` - 두 이름을 함께 쓰던 것을 없앤다).
- `notices/{date}`: `{ date, lines: string[], updatedAt }`.
- `progress/{planId}`: V4 `v4_progress` 모양 그대로(`key, subject?, classes?, startDate, lessons[], bumps[]`) + `updatedAt, deletedAt`.

### 4-8. 설정 (개인 공간 `settings/`)

- `common`(계정에 하나): 교사 유형 `teaching` · 이월 기간 `forwardDays`(기본 14) · 휴지통 자동 비우기 `trashDays` · 자동 백업 `autoBackup` ·
  우리 학교 `school` · 수업 종 `classBell` · 교시 `periods` · 학기 `terms` · D-Day `ddays` · 관찰 문구 `phrases` · 학급마다 고른 사진 폴더 `photoFolders`(V4 backup_config).
- `import`: V4 가져오기 기록(8-1) - 설정이 아니라 따로 둔다(설정 맞추기가 건드리지 않는다).
- `pc` / `mobile`: 글자 크기·창 위치·시작 화면·단축키·화면 보기(V4 `v4_preferences_pc/_mobile`). 1초 뒤 올린다(V4 `preferenceSync`).
- V4는 V3가 모르는 칸을 지울까 봐 설정을 문서 10여 개로 나눴다. V5는 세 문서다.
- 문서에는 **기본값과 다른 칸만** 적는다(없는 칸·틀린 칸 = 기본값). 칸마다 기본값과 읽기 규칙은 표 하나(`domain/settings.ts`의 `SettingsSpec`) -
  `app/prefs.ts`의 `DEVICE_PREFS`(pc/mobile)·`COMMON_SETTINGS`(common). 기능을 옮기는 세션이 그 표에 칸을 더한다. 맞추기는 `data/settingsSync.ts`.
- 이 기기에만(문서에 넣지 않는다): 지금 보는 화면·날짜, 화면 밝기 `sp5_theme`, 오른쪽 칸 폭.

### 4-9. 그 밖

- `pushTokens/{id}`: V4 `v4_pushTokens` 모양. `gcalQueue/{itemId}`: `{ at, fails }`(V4는 날짜 큐 - V5는 항목 큐).
- `spaceInvites/{code}`: `{ sid, ownerId }` — 코드를 아는 사람만 하나 읽기(목록 막음).
- `v5alarms/{itemId}`: 함수만 읽고 쓴다(규칙에 없어 앱은 막힘). V4 `v4_alarms`를 항목 하나 단위로.
- 공유 자료 `holidays/{year}`, `sharedConfig/neis`는 V4와 같이 읽기만.

### 4-10. 서버에 묻는 쿼리

화면은 기기 사본에서 고르므로 서버 쿼리는 칸 하나짜리뿐이다(복합 색인이 필요 없다): 구독 `updatedAt > 커서 - 1분` · 처음 받기 `orderBy('updatedAt')` 쪽 나눠 ·
처음 받기에서 먼저 `date >= 학년도 첫날` · 하루 한 번 견주기 `deletedAt != null`(P2-2 `data/mirror/server.ts`). 함수의 `v5alarms`도 칸 하나(`pendingAt`).
⚠️ 에뮬레이터는 색인을 보지 않는다 - 새 쿼리는 칸 하나로 짓고, 둘 이상이면 운영에서 색인이 필요한지 먼저 본다.

## 5. 계산 규칙 (저장하지 않는 것)

### 5-1. 이월
- **대상**: 일정, 끝내지 않음, 지우지 않음, 하루짜리(기간 일정은 빼다), 글이 있음, 이월 판단이 참(V4와 같다: 항목 `props.forward` → 없으면 아는 라벨의 `forward` →
  아는 라벨이 없으면 흔적 `carrying`), `date < 오늘`, 그리고 (`date >= 오늘 - forwardDays` 또는 `carrying`). 코드는 `domain/forward`(P3-3).
- **오늘 화면**: 오늘 것 아래에 이월 대상을 '↪ 10/5부터'와 함께(처음 날 = `carriedFrom ?? date`). **지난 날 화면**: 흐리게 '→ 오늘로'(누르면 오늘).
- **쓰기는 두 번뿐**: 처음 따라올 때 `carrying: true` 한 번(기간이 지나도 계속 따라오게 - V4 '사슬'과 같은 뜻, 어느 기기가 써도 같은 값 - 일정·라벨을 서버에서 받은 뒤에만 판단),
  오늘 칸에서 끝낼 때 `date = 오늘`, `carriedFrom = 처음 날`, `carrying` 지움, `order` = 오늘 줄 맨 뒤(지난 날 칸에서 끝내면 그날에 끝낸 것). 앱을 열 때마다 옮겨 쓰는 일은 없다.
- 이월 중인 일정의 구글 캘린더 날짜는 '보이는 날(오늘)'로 보낸다(P8-1). **알림은 처음 날에만**(`time`은 `date` 기준 - 따라오는 동안 다시 울리지 않는다, V4도 이월하면 알림이 따라오지 않았다).

### 5-2. 수업 칸
`그날 n교시 = lessonDays[date].periods[n].subject` (있으면) → 없으면 `수업 없는 날`(V4 `lib/classDays.classOffReason`: 방학·공휴일·수업X 일정·'휴업')이면 없음 →
아니면 그 날짜가 든 시간표의 `grid[요일][n]`. 준비물·메모·첨부·링크는 `lessonDays`에만 있다. 진도(V4 `lib/progress`)는 이 결과를 입력으로 센다.
**'시간표 적용' 단추는 없다** — 시간표를 고치면 그 기간의 날이 저절로 따라간다(그날 바꾼 칸은 그대로).

### 5-3. 기간 일정
항목 하나(`date`~`endDate`). 보이는 날 = 범위 안 · `skipDates` 아님 · `workdays`면 주말·공휴일 아님(`domain/period` - 공휴일은 P5-3이 넣는다, 그 전에는 주말만).
날마다의 '(2/5)'는 보이는 날로 센다. 월간·년간 막대는 이 범위를 그대로 그린다.
'이 날만 지우기' = 그날을 `skipDates`에(P3-3 - 처음 설계의 '두 항목으로 나누기' 대신: 한 문서로 남아 '(k/n)'이 이어지고, V4에서 가져온 기간의 빈 날도 그대로 옮긴다),
'이 날부터' = 끝 날을 그 앞의 마지막 날로 당기기(하루만 남으면 하루짜리), '전부' = 항목 지우기. 날마다 완료는 `doneDates`(모든 날을 끝내면 `done`).
일정 칸에서 시작 날을 옮기면 기간을 통째로 옮긴다(끝 날·뺀 날·끝낸 날이 함께). 하루만 옮기기는 여러 개 고르기의 옮기기(그날을 빼고 하루짜리 일정으로).

### 5-4. 기록 칸의 알림장·출결
그날 `notices/{date}`가 있으면 '📢 알림장' 카드, 그날 출석부 문서가 있으면 '📋 출결' 카드를 기록 칸에 **계산해서** 보인다.
누르면 원본 칸(알림장·출석부)이 열린다. 검색에도 나온다. V4의 자동 기록 사본(`notice_{date}`·`attendance_…`)과 거꾸로 맞추기는 없앤다.

### 5-5. 그 밖에 사본에서 바로 세는 것
빈 라벨 정리의 쓰임 수(`data/select` `labelUsageOf` - 메모·기록·일정·휴지통, 상위는 하위가 붙은 것도. 항목을 다 받기(구독 중) 전에는 세지 않는다), 학생 기록(누가기록 - `studentIds`·`classId`로 모으기), 검색(치는 대로), 반별 진도 현황, 📝·📊 표식.

## 6. 자료 층 (`src/data`)

### 6-1. 쓰기
- 도우미(`src/data/repo`)만 쓴다: `create` · `patch` · `merge`(칸 바꾸기 - 문서가 없으면 만든다, 날짜 문서 lessonDays) · `remove`(지운 표시) · `restore` · `purge`(영구 - 휴지통에서만) · `put`(문서 통째 - 설정) · `batch`.
  화면·기능 코드는 `setDoc`을 직접 부르지 않는다. 자리는 `DocPath { sid, coll, id }`, 새 id는 `newPath(sid, coll)`(기기에서 - 저장 전에 그 항목의 칸을 열 수 있게).
- 도우미가 늘 넣는 것: `updatedAt: serverTimestamp()`·`v: 1`, 만들 때 `deletedAt: null`·`createdAt`·`authorId`, 지울 때 `deletedBy`. 기능 코드는 이 칸을 쓰지 않는다(`Editable<C>`·쓰면 던진다).
- `patch(자리, 바꿀 칸, 고치기 전 문서)`: 고치기 전 값은 서버에서 읽지 않고 화면이 든 문서에서. `undefined` = 그 칸 지우기, `'periods.3.memo'`처럼 점 = 깊은 칸. 없는 문서면 실패(updateDoc).
- 실패는 `failWithToast`로 **던진다**(V4 규칙). 부르는 칸은 실패하면 닫지 않는다. 뒤에서 맞추는 설정 동기화만 `writeOps`(안내 없이 원래 오류).
- 쓰기마다 **되돌리는 쓰기**(`Undo` = WriteOp 목록, 고치기 전 칸 값으로)를 돌려준다 → `recordUndo(공간, 안내, undo, { what })`(`src/data/undo.ts`)로
  안내의 '되돌리기'와 Ctrl+Z(글 칸 밖, 공간마다 20개)가 한 길이다. 만들기의 되돌리기는 지운 표시, 영구 지우기의 되돌리기는 그 문서를 그대로 다시 적기.
  작은 일(일정 완료·순서·카드 ⏰)은 `{ quiet: true }` - 안내 없이 Ctrl+Z 더미에만(V4도 안내가 없었다). 되돌리는 쓰기를 기능이 지을 수도 있다(일정 옮기기 = 날짜만 되돌린다).
- 적는 것은 늘 `writeBatch` 하나(500개를 넘으면 나눈다). 여럿을 함께 바꾸는 것(링크 양쪽, 반복 묶음, 공간 옮기기)은 `batch([writeOp.…])`. 서버에서 읽어 고쳐 쓰는 트랜잭션은 거의 없다.
- 규칙(`firestore.rules`)이 items·labels의 `kind`·`deletedAt`·`v`·**`updatedAt == 서버 시각`**을 본다 - 서버 시각을 빠뜨린 쓰기는 사본에 가지 않으므로 저장 실패로 드러낸다.

### 6-2. 기기 사본 (IndexedDB, `idb`) — `src/data/mirror/`
- DB `sp5-mirror-{uid}`(계정마다), 저장소 둘: `docs`(열쇠 [공간, 컬렉션, id]) · `meta`(공간·컬렉션마다 커서 `cursor`·이어 받을 자리 `after`·다 받음 `complete`·견준 때 `prunedAt`).
  공간·컬렉션은 **열쇠 범위로** 나눈다 - 저장소를 더하려면 DB 판을 올려야 하고, 판 올리기는 다른 탭이 열어 둔 동안 막힌다. 커서 = 받은 `updatedAt`의 가장 큰 값.
  Timestamp는 `codec.ts`가 표시해 넣고 되살려 꺼낸다(구조 복제로 모양을 잃으면 되돌리기·영구 지우기 때 규칙 `deletedAt is timestamp`에 걸린다).
- 받는 컬렉션 `MIRRORED`(`sync.ts`) = items·labels·series - 기능을 옮기는 세션이 더한다. 지금은 개인 공간 하나(그룹은 P8-4 - `startMirror`의 `spaces`).
- **처음**: 이번 학년도 항목(`date >= 3/1`)부터, 그다음 `orderBy('updatedAt')`으로 500개씩 모두. 끊기면 `after`부터 잇는다(같은 시각은 겹쳐 받는다 - id로 덮는다).
  받는 동안 다른 기기가 고친 것은 `updatedAt`이 늦어 뒤 쪽에서 온다. **그 뒤**: 컬렉션마다 `where('updatedAt', '>', 커서 - 1분)` 구독 하나.
  구독은 `includeMetadataChanges` - 첫 소식이 캐시에서 오면(빈 컬렉션 등) 서버 확인은 문서 변화 없는 메타데이터 소식으로만 온다(P2-2 에뮬레이터로 찾음).
  커서는 서버가 확인한 소식의 결과 전체에서 가장 늦은 판 - 캐시에서 온 소식으로는 옮기지 않는다(문서는 넣는다).
- 받은 것은 **먼저 화면 store**(`store.ts`), 사본에는 뒤따라 적는다(기다리지 않는다). store·사본 모두 판마다 **늦은 판이 이긴다** - 두 탭이 같은 사본에 함께 써도 같은 값.
  문서와 커서는 한 트랜잭션(커서가 가리키는 데까지의 문서가 늘 사본에 함께 있다). 지운 표시도 그대로 받는다(그래서 지우기가 다른 기기에 퍼진다).
- **내 쓰기는 화면에 먼저**: 저장 도우미(`repo` `writeOps`)가 적기 직전에 그 결과를 store에 덧칠한다(`beginLocalWrite` - 무엇을 적나는 `toWrite` 한 곳). 실패하면 곧바로 걷고,
  끝나면 서버 판이 한 번 더 올 때 걷는다(8초 안에 오지 않으면 그냥). 덧칠은 메모리에만 - 사본에는 서버가 준 판만 들어간다.
  Firestore 구독은 내가 쓰는 동안 그 문서를 결과에서 **'빠짐'**으로 준다(서버 시각이 아직 없어 `updatedAt >` 조건에 맞지 않는다 - 에뮬레이터로 확인).
  그래서 덧칠이 있는 문서의 '빠짐'은 무시하고, 없으면 서버에 물어(`getDocFromServer`) 정말 없을 때만 사본에서 뺀다.
- **영구 지우기**: 내 것은 끝나면 사본에서 뺀다(그 판까지만 - 그 사이 되돌려 다시 적었으면 둔다). 다른 기기의 것은 결과 밖의 문서면 구독에 보이지 않으므로,
  하루 한 번 사본의 지운 항목을 `where('deletedAt', '!=', null)`과 견줘 서버에 없는 것을 뺀다(묻기 전의 판만 - 그 사이 되살린 것은 두고).
- 화면은 **`data/select.ts`만** 쓴다: 날짜로 `itemsOn` · 기간으로 `itemsBetween` · 라벨로 `itemsWithLabels` · 종류로 `itemsOfKind` · 메모만 `memos` · 휴지통 `trashOf` · 라벨 `labelsOf`,
  같은 이름의 `use…` 훅(지금 공간 - `session.useCurrentSpaceId`), 받기 상태 `useMirrorStatus`(copy 사본으로 그림 · loading · live · offline · error).
  구독을 화면에서 직접 걸지 않는다. 문서에 자리 `id`가 붙는다(`Stored<C>`) - 저장 도우미는 맨 위 `id`를 적지 않으니 화면이 든 문서를 그대로 넘겨도 된다.
- **09-22 사고와 다른 점**: 그때는 Firestore SDK 안의 IndexedDB가 고장 나 서버 자료가 멈췄다. V5 사본은 앱이 따로 두는 '먼저 보여 줄 복사본'이고
  Firestore는 V4처럼 `memoryLocalCache`다. 받은 것을 메모리에 먼저 넣으므로 사본이 고장 나도 서버 구독은 그대로 돈다:
  열기 실패(없음·막힘·3초 넘음)·도중에 잃음(브라우저가 지움·다른 탭이 지움)·적기 실패 = **그 탭은 메모리로만, 다시 열지 않는다**
  (새로 열면 빈 DB에 커서만 앞서 적혀 다음에 앞부분을 영영 못 받는다). 꺼내지 못하는 사본은 지워 다음에 새로 받는다. 다음에 앱을 열 때 다시 연다.
  사본은 "있다/없다"를 판단해 쓰는 데 쓰지 않는다(쓰기는 문서 하나라 읽고 고칠 일이 없다). 점검은 증상이 아니라 구조로 한다(V4 교훈 - `inspect-mirror`).
- 환경설정 '앱' 탭 **'이 기기 사본 다시 받기'**(`resetMirror` - 지우고 처음부터). **로그아웃하면 그 계정의 사본을 지운다**(`wipeMirror` - 공용 PC에 학생 자료를 남기지 않게).

### 6-3. 쓰던 글
쓰는 칸의 글은 2초 뒤 IndexedDB `drafts`(이 기기만)에 남긴다. 칸을 다시 열면 '저장하지 않은 글이 있습니다 - 되살리기'. 저장하면 지운다.
- P3-2 `data/drafts.ts`: DB `sp5-drafts-{uid}`(계정마다) 저장소 `drafts`, 열쇠 = 칸 열쇠(`note:{sid}:{id}` · 새 칸은 `note:{sid}:new:{날짜|memo}`, 일정은 `event:…`).
  `useDraft(열쇠, 칸 값, 손댔나)` - 손댄 동안 2초 뒤, 칸이 닫힐 때·`pagehide`에는 곧바로 적는다. 닫기·ESC로 버리고 닫아도 남는다(다시 열어 '버리기').
  남은 글이 지금 칸과 같으면 묻지 않고 지운다. 새 칸의 날짜를 바꾸면 열쇠를 옮긴다. 로그아웃하면 `wipeDrafts`(기기 사본과 같은 까닭).
- 트랜잭션은 끝(`tx.done`)까지 함께 기다린다 - 따로 두면 끊긴 트랜잭션의 done이 받는 이 없이 거절되어 '처리하지 않은 오류'가 된다. 고장 나면 조용히(콘솔에 한 번) - 칸은 그대로 쓴다.

## 7. 화면 뼈대 (`src/app`)

### 7-1. 폴더
```
src/
  app/        껍데기: 머리줄·둘째 줄·탭바, 주소, 창 목록, 오른쪽 칸, 단축키, 안내(toast), 다크 모드
  data/       firebase, 저장 도우미(repo), 기기 사본(mirror), store 고르기(select), 되돌리기(undo), id·차례
  domain/     순수 함수 - V4 lib에서 옮긴 것(테스트째): forward·lessons·classDays·semester·progress·seating·draw·groups·
              entryTable·checkLines·hashLabels·quickInput·labelTree·linkPreview·neis·csv·print·dateUtils …
  features/   기능마다 폴더 - 화면·창·훅·테스트. 설명서 장은 features/help/chapters/
  import/v4/  V4 가져오기. 옛 모양 읽기(readEventList 등)는 여기에만 둔다
  ui/         공통 부품: ModalShell·PopupFrame·SidePanelFrame·칩·카드·SlotCombobox·MiniCalendarPicker …
```

### 7-2. 창 목록
모든 창(오른쪽 칸 창·쓰는 칸·가운데 창)을 한 곳에 등록하고, ⋮ 메뉴·학급 화면 도구 카드·하루 수업 머리줄·단축키·설명서 링크가 여기서 읽는다.
```ts
registerWindow({
  id: 'seating',               // = 단축키 id (V4 SHORTCUT_ACTIONS의 id를 그대로)
  title: '자리표', icon: '🪑',
  menu?: '일정' | '수업' | '자료' | '설정',   // ⋮ 구역 (없으면 ⋮에 없다) - MENU.md 3-4
  classTool?: true,            // 학급 화면 도구 카드
  lessonHeader?: true,         // 하루 수업 머리줄 단추
  show?: (mode) => boolean,    // 담임/교과 전담 숨기기 (V4 homeroom·classUnit)
  kind: 'side' | 'panel',      // 오른쪽 칸 창 / 쓰는 칸
  load: () => import('./SeatingWindow'),   // 열 때 싣는다
  help: 'seating',             // 설명서 주제 id
})
openWindow('seating', { classId })        // Layout이 열림 상태를 들지 않는다
```
store(`src/app/windows.ts`)의 `windows: [{ key, id, params, openedAt, raisedAt }]`는 **무엇이 열려 있나**다. 같은 항목을 다시 열면
새로 만들지 않고 `raisedAt`만 바꿔 그 탭을 보인다(창 `side`는 id마다 하나, 쓰는 칸 `panel`은 params마다 - `sameAs`로 바꾼다).
창 컴포넌트는 기능 폴더의 `*Window.tsx`(ModalShell)·`*Panel.tsx`(SidePanelFrame)이고 `{ params, close, raise, setParams }`를 받아 스스로 틀을 그린다.
`setParams`는 열린 창이 가리키는 것을 바꾼다(다시 그리지 않는다) - 새 일정 칸이 저장한 뒤 그 일정의 수정 칸이 될 때(P3-1 쓰는 칸 `event` = `{ sid, date, id? }`,
P3-2 메모·기록 쓰는 칸 `note` = `{ sid, date: 날짜|null, id?, labelIds?, draftText? }` - 날짜 null = 메모, 메모와 기록은 같은 칸).
오른쪽 줄의 탭 차례·숨은 탭·폭은 그 틀이 줄에 설 때 정한다(`src/ui/sideColumn.ts` - V4 PopupFrame 그대로, 다시 연 탭은 끝으로 간다).
창 안에서 띄운 작은 창(등록하지 않은 PopupFrame)도 같은 줄에 선다. 닫기 단추에는 `data-close`(탭 ×가 누른다).
저장 안 한 글이 있는 창은 `registerUnsavedCheck`로 알린다 - ESC·▶(줄 전체 닫기)가 먼저 묻는다.

### 7-3. 주소
`#/day/2026-10-08` · `#/week/2026-10-05` · `#/month/2026-10` · `#/year/2026` · `#/memo` · `#/class/2026-5-2`.
새로고침해도 그 자리, 휴대폰 뒤로가기는 앞 화면(창이 열려 있으면 V4처럼 맨 위 창 하나를 먼저 닫는다). 창은 주소에 넣지 않는다.

### 7-4. 오른쪽 칸·단축키
V4 규칙 그대로(V4 `CLAUDE.md` 5장): 탭, 폭 끌기·두 번 누르기, ESC = 줄 전체(저장 안 한 글은 먼저 묻기), Ctrl+S = 커서가 든 칸(없으면 보이는 탭),
휴대폰 뒤로가기 = 맨 위 하나, 환경설정 '창 위치'로 가운데 창(쓰는 칸은 그래도 오른쪽).
자리: 브라우저 기록·창 층 `src/app/history.ts`, 키 `src/app/keys.ts`(ESC·Ctrl+S 막기·단축키), Ctrl+S 받기 `src/ui/useSaveKey.ts`, 창 자리 설정 `src/app/layoutPrefs.ts`. 단축키는 V4 `lib/shortcuts.SHORTCUT_ACTIONS`를 id째 옮기고 새 id를 더한다(MENU.md 3-8).

## 8. V4 → V5 가져오기 (`src/import/v4`)

### 8-1. 원칙
- **한 방향**: V4를 읽기만 하고 V5에만 쓴다. V3·V4 자료와 코드는 손대지 않는다.
- **결정적 id**: V5 id = V4 자리에서 셈한다(8-2). 그래서 **여러 번 가져와도 겹치지 않고**, 링크도 상대를 찾지 않고 바로 셈한다.
- **다시 가져오기**(`import/v4/plan.ts` `planDocs`): 가져온 문서는 `src.h`에 **가져올 때 적은 칸의 지문**을 남긴다. 다시 가져올 때
  지금 V5 문서의 칸 지문 ≠ `src.h`면 V5에서 고친 것 → 덮지 않고(둠) 결과 표에 적는다. 새로 셈한 지문 == `src.h`면 그대로(쓰지 않는다), 그 밖은 바뀐 칸만.
  '지난 가져오기 때'(`updatedAt` > 때)를 믿지 않는다 - 가져오기가 끊겨 기록을 못 남겨도, 기기 시각이 틀려도 같다.
  V4에서 없어진 것은 V5에서 고치지 않았으면 지운 표시(`deletedBy: 'v4-import'` - 휴지통에 'V4에서 지움'), 고쳤으면 둔다.
  V5가 저절로 적는 표시(`carrying`·`alarmDone`)는 지문에 넣지 않는다 - 그것만으로 'V5에서 고침'이 되지 않게(P3-4).
  V5에서 사용자가 지운 것은 되살리지 않고, 가져오기가 지운 것이 V4에 다시 생기면 새로 적는다. 결과 = 새로·바뀜·그대로·둠·지움(+ 항목은 학년도별 수).
- **옛 모양 읽기는 여기에만**: V4 `readEventList`·`parseV3EventText`·`normalizeEventLabel`·`readEvalList`·`mergeEntryLabels`·`resolveEventLabelNames`·
  `readLabelTree`를 `import/v4/legacy/`로 테스트째 옮긴다. V5 본체는 이것을 import하지 않는다(테스트로 지킨다).
- 가져온 문서(항목·라벨 …)에는 `src: { from: 'v4', path, id, h }`. 가져오기 기록(때·종류별 수·라벨 짝 표·설정 칸마다 적은 값·띠 닫음)은
  그 공간의 **`settings/import`**(`import/v4/record.ts`) - 설정 문서(common)에 두면 설정 맞추기가 모르는 칸으로 지운다.
- 드라이브 파일은 옮기지 않고 그대로 가리킨다(같은 프로젝트라 권한이 그대로다).

### 8-2. 결정적 id
`v4id(종류, 공간, 자리, V4 id)` = sha1을 base32로 20자(`import/v4/ids.ts` - SHA-1은 `hash.ts`에 직접 두어 기기에서 바로 셈한다). **주의**: V3가 id 없이 쓴 일정은 V4 `readEventList`가 `ev_차례`를 붙이므로
그날 목록이 바뀌면 차례가 밀린다 - id 없는 항목은 `날짜|글|라벨` 해시로 셈하고, 같은 날 같은 글이 둘이면 몇째인지를 붙인다.

### 8-3. 짝 표

| V4 | V5 | 주의 |
|---|---|---|
| `settings/labels`의 `eventLabels` | `labels`(event, props) | 속성은 V3 이름 먼저(`normalizeEventLabel`), `v4_gcal` → `props.gcal`. 문서가 없으면 V4 기본 라벨. 열쇠 = V4 id(없으면 'name:이름') |
| `memoLabels`·`journalLabels` + `v4_labelTree` | `labels`(note, parentId) | 이름으로 합친다(`mergeEntryLabels` - 열쇠 = 기록 id·`jm_이름`), 상위 이름 → `parentId`. V5에 이름이 같은 라벨이 있으면 그것에 잇는다. 짝 표 `labelMap`: V4 이름 → V5 id (`import/v4/labels.ts`) |
| `{sp}/events/{date}`(`readEventList`) | `items`(event) | 라벨 셋 자리(`label`·`labelIds`·본문 앞 `[이름]` - 등록된 라벨만) → `labelIds`, 본문은 그대로. `time`('YYYY-MM-DDTHH:mm') → `time`, `alarmTriggered` → `alarmDone`, 공휴일 일정(`isHolidayEvent`) 빼기, 이월 사슬(`forwardChainId`·`originalDate`) → `carriedFrom`, 기한(`due` + `v4_eventDue` 사슬) → `due`, `gcal` → `props.gcal` |
| 기간 조각(`groupId` + 글 끝 `(i/n)`) | `items` 하나(`date`~`endDate`) | 글 끝 '(i/n)'를 뗀다, 날마다 완료 → `doneDates`, 조각이 평일에만 → `workdays`, 범위 안의 빈 날 → `skipDates`, 조각마다 글이 다르면 합치지 않고 따로(P3-4) |
| 반복 묶음(`groupId`, '(i/n)' 없음) | `series`(imported) + `items` | 규칙은 모른다 |
| `{sp}/journals/{date}.entries` | `items`(note, date) | 기록 라벨 id → V5 id, `tables`, `attachments`, `completed`·`favorite`, 글 `[표]` → 빈 글, **`notice_`·`attendance_` 자동 기록은 가져오지 않는다**(5-4) |
| `{sp}/tasks/{id}` | `items`(note, `null`) | 라벨 이름 → id, `fromDate`, `keepId`, `order` |
| 항목의 `linkedItems` | `linkIds` | 결정적 id로 바로 셈, 수업 → `'lesson:{date}:{n}'` |
| `{sp}/schedules/{date}` | `lessonDays` | **그 기간 시간표와 같은 칸은 뺀다**(과목이 같고 메모·준비물·첨부·링크가 없으면) - 그래야 시간표를 고치면 따라간다. 옛 문자열 값 읽기. V4에 칸이 없는데 시간표에 과목이 있으면 `subject: ''`, 수업 없는 날(방학·공휴일·수업X)은 과목 그대로, memo = memo(없으면 옛 content). 문서에 `src`(날짜 문서 하나 = 지문 하나), V4에서 없어진 날은 `periods: {}`(지우지 않는다) |
| `settings/timetable_v5` | `timetables`·`settings/common.terms` | 템플릿 → 기간: 학기마다 그 학기 V4 수업 칸과 과목이 절반 넘게 맞는 표 = 그 학기부터 학년도 끝까지, 맞은 학기가 없으면 이름의 '1학기'·'2학기'로 올해, 나머지는 기간 없음('' - 쓰이지 않음), 빈 표는 뺀다(P6-4 `import/v4/lessons.ts`). 방학 한 벌 → `terms[여름 방학이 든 학년도]` |
| `v4_periodTimes` + 설정의 수업 시간 명칭 | `settings/common.periods` | 이름 = `timetable_v5.currentNames`(없으면 첫 표의 names), 시각 = `v4_periodTimes.times` (P6-4) |
| `settings/rosters` | `classes` | 학생마다 새 sid. **번호 → sid 짝 표를 가져오기 기록에** 둔다(다시 해도 같은 sid) |
| `attendance`, `v4_subjectAttendance` | `attendance`, `subjectAttendance` | 번호 → sid |
| `{sp}/evaluations/{date}`(`readEvalList`) | `evaluations` 한 장씩 | `evalList`가 최신, 학생 칸 번호 → sid |
| `{sp}/notices/{date}` | `notices` | |
| `v4_seating`, `v4_classHub`, `settings/photoQuiz` | `seating`, `classHub`, `quiz` | 번호 → sid |
| `v4_progress` | `progress` | 모양 그대로 |
| 기록·메모 글의 학생 태그 `#26040305` | `studentIds` | 글의 태그는 그대로 둔다(본문을 바꾸지 않는다) |
| `settings/preferences.dDayList` | `settings/common.ddays` | |
| `v4_preferences_pc/_mobile`, `v4_teaching`·`v4_classBell`·`v4_school`·`v4_trash`·`v4_autoBackup`·`v4_observationPhrases` | `settings/pc`·`mobile`·`common` | 단축키 id는 그대로라 사용자가 바꾼 키가 이어진다. 기기별 문서가 없으면 옛 한 벌 `v4_preferences`. `forwardLookbackDays` → `common.forwardDays`(PC 먼저). **칸마다** 가져오기가 지난번에 적은 값과 견줘 V5에서 바꾼 칸은 둔다(`import/v4/settings.ts`). common의 나머지는 그 칸이 생기는 세션이 `COMMON_FROM_V4`에 |
| `groups/{gid}` + 그룹 자료 | `spaces/g_{gid}` + 그 아래 | `members` 배열 → 맵, 구성원 누구나 가져올 수 있다(결정적 id라 겹치지 않음) |
| `trash`, `v4_pushTokens`, `v4_gcalQueue`, `v4_alarms` | 가져오지 않는다 | 휴지통의 것은 V4에서 되살린 뒤 다시 가져오면 된다. 알림·보내기는 기기에서 다시 켠다 |

## 9. 점검

| 무엇 | 언제 |
|---|---|
| `npx vitest run` (단위) | 조각마다. domain 순수 함수는 V4 테스트째 옮긴다. CI도 돈다 |
| 자료 층 테스트(에뮬레이터) `npm run test:data` | 자료 층을 고칠 때. 저장 도우미·되돌리기·기기 사본·가져오기(`src/**/*.emu.test.ts`, `vitest.data.config.ts`). 에뮬레이터를 켠 곳에서(CI는 단위만) |
| `tools/check-rules.mjs` | 규칙을 고칠 때마다. V4 35개 + V5 |
| 크롬 점검 `tools/inspect-*.mjs` | 세션마다 바뀐 부분만. **`data-*`로만 찾는다**(화면 글자가 아니라). 심은 자료는 끝에 되돌린다. PC 1400px 크롬 하나. 화면이 없는 자료 층은 앱 모듈을 `import('/src/…')`로 불러 store를 읽는다(`inspect-data`·`inspect-mirror`). 서버에 쓰는 것은 '그 문서만 바뀌었나'를 다른 문서의 `updatedAt`으로 본다(`inspect-labels`) |
| 가져오기 점검 | 가져오기 세션마다: V4 seed → 가져오기 → 종류·수 대조 → 두 번째 가져오기는 '바뀐 것 0'. 순수 규칙은 단위(`import/v4/*.test`), 규칙을 지나는지는 자료 층(`import.emu.test`), 화면은 `tools/inspect-import-labels.mjs`(V4 문서를 고쳐 심고 끝에 V4·V5 모두 되돌린다). seed는 계정마다 `settings/import`에 띠 닫음을 심는다(띠가 다른 점검을 밀어내지 않게) |
| 설명서 점검 | P9-1부터. 여러 세션을 모아 마지막에 한 번 |
| `PARITY.md` | 세션 끝마다 그 세션이 끝낸 기능을 체크 |

## 10. 고치기 전에 확인할 것

1. **문서 하나만 쓰나?** 둘 이상이면 `writeBatch`. 서버에서 읽어 고쳐 쓰기는 피한다.
2. **저장 도우미를 거치나?** (`updatedAt` 서버 시각·`deletedAt: null`·`v` - `setDoc` 직접 금지)
3. **id로 가리키나?** 라벨·학생·학급·항목을 이름이나 번호로 저장하지 않는다.
4. **계산할 수 있는 것을 저장하고 있지 않나?** (5장)
5. **화면이 Firestore를 직접 부르지 않나?** 화면은 고르기(`data/select`)와 저장 도우미(`data/repo`)만. 새 컬렉션을 화면에 쓰면 `MIRRORED`(`data/mirror/sync`)에 더했나?
6. **새 창이면 창 목록에 등록했나?** (⋮ 구역·학급 도구·수업 머리줄·단축키 id·설명서 id - `MENU.md`대로)
7. **저장 실패를 던지나? 칸은 실패하면 닫지 않나?** 되돌릴 값을 돌려주나?
8. **본문을 바꾸나?** 읽기·저장 길에서는 바꾸지 않는다.
9. **같은 커밋에서** `DESIGN.md`·`MENU.md`·`PARITY.md`(그리고 P9-1부터는 설명서)를 고쳤나?
10. **점검 스크립트는 `data-*`로 찾나?** 새 단추에 `data-…`를 달았나?
