// 인쇄 창 설정 - 용지 방향(화면마다)·한 장에 맞추기·여백·정렬. 이 기기에만 남긴다(프린터·종이가 기기마다 다르다), 읽기는 domain/printPages.
import { useState } from 'react';
import { readPrintPrefs, type PrintPrefs } from '../../domain/printPages';

const KEY = 'sp5-print';

function load(): PrintPrefs {
  try {
    return readPrintPrefs(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return readPrintPrefs(null);
  }
}

/** 인쇄 설정 - 바꾸면 곧바로 이 기기에 */
export function usePrintPrefs(): [PrintPrefs, (change: Partial<PrintPrefs>) => void] {
  const [prefs, setPrefs] = useState(load);
  const update = (change: Partial<PrintPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...change };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* 남기지 못해도 이번에는 바뀐다 */
      }
      return next;
    });
  return [prefs, update];
}
