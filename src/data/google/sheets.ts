// 구글 시트 부르기 (V4 lib/sheetsSync.ts의 시트 파일 부분, P8-3). 칸 모양은 domain/sheets, 묶기는 features/backup/sheets.
import { googleFetch, GoogleApiError } from './token';
import { SHEET_MEMO, SHEET_SCHEDULE } from '../../domain/sheets';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

/** 그 시트 파일이 아직 있나 (지웠거나 권한이 없으면 false - 로그인 문제는 던진다) */
export async function spreadsheetExists(token: string, id: string): Promise<boolean> {
  try {
    await googleFetch(`${SHEETS_API}/${id}?fields=spreadsheetId`, 'GET', token);
    return true;
  } catch (e) {
    if (e instanceof GoogleApiError && e.needsLogin) throw e;
    return false;
  }
}

/** V5 시트 파일을 새로 만든다 (탭 '일정기록'·'메모') */
export async function createSpreadsheet(token: string, title: string): Promise<string> {
  const created = await googleFetch<{ spreadsheetId: string }>(SHEETS_API, 'POST', token, {
    properties: { title },
    sheets: [{ properties: { title: SHEET_SCHEDULE } }, { properties: { title: SHEET_MEMO } }],
  });
  if (!created?.spreadsheetId) throw new Error('구글 시트 파일을 만들지 못했습니다.');
  return created.spreadsheetId;
}

/** 시트 파일 안의 탭 이름들 */
export async function listSheetTitles(token: string, id: string): Promise<string[]> {
  const meta = await googleFetch<{ sheets?: Array<{ properties?: { title?: string } }> }>(`${SHEETS_API}/${id}?fields=sheets.properties.title`, 'GET', token);
  return (meta?.sheets ?? []).map((s) => String(s?.properties?.title ?? '')).filter(Boolean);
}

/** 탭이 없으면 더한다 */
export async function ensureSheet(token: string, id: string, title: string, known: string[]): Promise<void> {
  if (known.includes(title)) return;
  await googleFetch(`${SHEETS_API}/${id}:batchUpdate`, 'POST', token, { requests: [{ addSheet: { properties: { title } } }] });
  known.push(title);
}

/** 탭을 비우고 처음부터 쓴다 */
export async function writeSheet(token: string, id: string, title: string, values: string[][]): Promise<void> {
  await googleFetch(`${SHEETS_API}/${id}/values/${encodeURIComponent(`${title}!A:ZZ`)}:clear`, 'POST', token, {});
  await googleFetch(`${SHEETS_API}/${id}/values/${encodeURIComponent(`${title}!A1`)}?valueInputOption=RAW`, 'PUT', token, { values });
}

/** 탭 읽기 (없는 탭이면 []) */
export async function readSheet(token: string, id: string, title: string): Promise<string[][]> {
  try {
    const res = await googleFetch<{ values?: string[][] }>(`${SHEETS_API}/${id}/values/${encodeURIComponent(`${title}!A:ZZ`)}`, 'GET', token);
    return res?.values ?? [];
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 400) return [];
    throw e;
  }
}
