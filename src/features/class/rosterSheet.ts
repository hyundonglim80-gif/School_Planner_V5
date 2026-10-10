// 명렬표 '📊 시트' - 구글 시트의 학급 탭에서 명단 불러오기 (V4 RosterModal '구글 시트에서 불러오기', P8-3).
// 시트는 백업 창 '보내기'와 같은 V5 시트 파일(공간 settings/sheets), 탭은 '조사표_2026-5-2'(조사표 보내기와 같은 탭 - 머리말 '번호 | 이름 | 성별').
// 탭이 없으면 묻고 머리말만 적은 탭을 만들어 연다 - 선생님이 시트에 명단을 적고 다시 누른다.
import { evalSheetNameOf, parseRosterSheet, ROSTER_SHEET_HEADER, sheetUrlOf } from '../../domain/sheets';
import type { CsvStudent } from '../../domain/roster';
import { ensureSheet, listSheetTitles, readSheet, writeSheet } from '../../data/google/sheets';
import { withGoogleToken } from '../../data/google/token';
import { ensureSpreadsheet } from '../backup/sheets';

export type RosterSheetRead =
  | { kind: 'students'; students: CsvStudent[]; tab: string; url: string }
  | { kind: 'created' | 'empty' | 'declined'; tab: string; url: string };

/** 학급 탭을 읽는다. 탭이 없으면 askCreate()가 true일 때 머리말 탭을 만든다 */
export function readRosterSheet(sid: string, classId: string, askCreate: (tab: string) => boolean): Promise<RosterSheetRead> {
  return withGoogleToken('구글 시트에서 명단을 불러오려면 구글 로그인이 필요합니다.', async (token) => {
    const id = await ensureSpreadsheet(token, sid);
    const tab = evalSheetNameOf(classId);
    const url = sheetUrlOf(id);
    const titles = await listSheetTitles(token, id);
    if (!titles.includes(tab)) {
      if (!askCreate(tab)) return { kind: 'declined', tab, url };
      await ensureSheet(token, id, tab, titles);
      await writeSheet(token, id, tab, [ROSTER_SHEET_HEADER]);
      return { kind: 'created', tab, url };
    }
    const students = parseRosterSheet(await readSheet(token, id, tab));
    return students.length > 0 ? { kind: 'students', students, tab, url } : { kind: 'empty', tab, url };
  });
}
