// 백업 창 '백업' 탭 (V4 BackupModal의 JSON·CSV, P8-3): 지금 공간 - 기간 · 담을 것 → 🗄️ JSON 백업 받기 / 📄 CSV 받기, 그리고 백업 파일로 되살리기.
// 되살리기는 없는 것(지운 것 포함)만 넣는다 - 지금 있는 것은 덮지 않는다(domain/backup planRestore). 여러 파일을 한 번에 고를 수 있다(V4 그대로).
import { useState } from 'react';
import { useNav } from '../../app/nav';
import { showErrorToast, showToast, ShownError } from '../../app/toast';
import { BACKUP_KINDS, countBackup, csvRowsOf, describeCounts, isV4Backup, planRestore, readBackupFile, type BackupFile, type BackupKind, type DateRange } from '../../domain/backup';
import { academicYearOf, addDays, todayStr } from '../../domain/dateUtils';
import { lessonsOn } from '../../domain/lessons';
import { classIdOf, describeClass, genderToText } from '../../domain/roster';
import { schoolYearSpan } from '../../domain/semester';
import { buildBackup, readCurrentFor, writeRestore } from '../../data/backup';
import { itemLabels, itemsBetween, labelTreeOf, memos, useDocs } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { downloadCsv, downloadJson } from '../../ui/download';
import { rangeForScope } from '../gcal/manual';
import { useLessonSource } from '../lessons/useLessons';
import { Section } from '../settings/parts';

type Period = 'all' | 'year' | 'view' | 'custom';

const PERIODS: ReadonlyArray<{ key: Period; name: string }> = [
  { key: 'all', name: '전체 기간' },
  { key: 'year', name: '이번 학년도' },
  { key: 'view', name: '지금 화면 기간' },
  { key: 'custom', name: '직접 정하기' },
];

const ALL_KINDS = BACKUP_KINDS.map((k) => k.key);

export default function BackupTab() {
  const sid = useCurrentSpaceId();
  const personal = !!sid?.startsWith('u_');
  const spaceName = personal ? '개인' : (sid ?? '');
  const scope = useNav((s) => s.scope);
  const date = useNav((s) => s.date);
  const items = useDocs('items', sid);
  const labels = useDocs('labels', sid);
  const classes = useDocs('classes', sid);
  const lessonSrc = useLessonSource(sid);
  const [period, setPeriod] = useState<Period>('all');
  const [custom, setCustom] = useState(() => rangeForScope(scope, date));
  const [include, setInclude] = useState<Set<BackupKind>>(() => new Set(ALL_KINDS));
  const [busy, setBusy] = useState('');
  const [files, setFiles] = useState<Array<{ name: string; file: BackupFile }>>([]);
  const [result, setResult] = useState('');

  const kinds = BACKUP_KINDS.filter((k) => personal || !k.personalOnly);
  const chosen = kinds.map((k) => k.key).filter((k) => include.has(k));

  const range = (): DateRange | null => {
    if (period === 'all') return null;
    if (period === 'year') return schoolYearSpan(academicYearOf(todayStr()));
    if (period === 'view') return rangeForScope(scope, date);
    return custom;
  };
  const stamp = todayStr();

  const exportJson = async () => {
    if (!sid) return;
    if (chosen.length === 0) return showToast('담을 것을 하나 이상 골라 주세요.');
    const r = range();
    if (r && r.start > r.end) return showToast('시작일이 종료일보다 늦습니다.');
    setBusy('백업을 만드는 중…');
    try {
      const file = await buildBackup(sid, spaceName, chosen, r, (msg) => setBusy(msg));
      downloadJson(file, `School_Planner_V5_백업_${spaceName}_${stamp}.json`);
      showToast(`✅ 백업 파일을 받았습니다 (${describeCounts(countBackup(file.colls)) || '담긴 것 없음'}).`);
    } catch (e) {
      showErrorToast('백업을 만들지 못했습니다. 네트워크를 확인해 주세요.', e);
    } finally {
      setBusy('');
    }
  };

  /** CSV (V4 그대로 한 장 - 기기 사본으로. 수업은 기간이 있을 때만 날마다 셈한다) */
  const exportCsv = () => {
    if (chosen.length === 0) return showToast('담을 것을 하나 이상 골라 주세요.');
    const r = range() ?? { start: '0000-01-01', end: '9999-12-31' };
    const evTree = labelTreeOf(labels, 'event');
    const noteTree = labelTreeOf(labels, 'note');
    const names = (tree: typeof evTree, ids: string[] | undefined) => itemLabels(tree, ids).map((l) => l.name).join(', ');
    const lessonRange = range();
    const lessons: Parameters<typeof csvRowsOf>[0]['lessons'] = [];
    if (include.has('lessons') && lessonRange) {
      for (let d = lessonRange.start, i = 0; d <= lessonRange.end && i < 800; d = addDays(d, 1), i++) {
        for (const c of lessonsOn(d, lessonSrc).cells) if (c.subject || c.memo) lessons.push({ date: d, n: c.n, subject: c.subject, memo: c.memo });
      }
    }
    const rows = csvRowsOf({
      events: include.has('events')
        ? itemsBetween(items, r.start, r.end, 'event').map((e) => ({ date: e.date ?? '', labels: names(evTree, e.labelIds), text: e.text ?? '', done: !!e.done, time: e.time }))
        : [],
      lessons,
      records: include.has('records') ? itemsBetween(items, r.start, r.end, 'note').map((n) => ({ date: n.date ?? '', labels: names(noteTree, n.labelIds), text: n.text ?? '' })) : [],
      students:
        include.has('classes') && personal
          ? Object.values(classes)
              .filter((c) => !c.deletedAt)
              .sort((a, b) => classIdOf(a).localeCompare(classIdOf(b)))
              .flatMap((c) => c.students.map((st) => ({ cls: describeClass(c), num: st.num, gender: genderToText(st.gender), name: st.name, note: st.note ?? '' })))
          : [],
      memos: include.has('memos')
        ? memos(items).map((m) => ({ created: typeof m.createdAt === 'number' ? todayOf(m.createdAt) : '', labels: names(noteTree, m.labelIds), text: m.text ?? '', done: !!m.done }))
        : [],
    });
    if (rows.length <= 1) return showErrorToast('고른 조건에 맞는 내보낼 자료가 없습니다.');
    downloadCsv(rows, `School_Planner_V5_${spaceName}_${stamp}.csv`);
    showToast(`✅ ${rows.length - 1}건을 CSV 파일로 받았습니다.`);
  };

  const pickFiles = async (list: FileList | null) => {
    const next: Array<{ name: string; file: BackupFile }> = [];
    for (const f of Array.from(list ?? [])) {
      try {
        const raw = JSON.parse(await f.text()) as unknown;
        if (isV4Backup(raw)) {
          showToast(`${f.name}: V4 백업 파일입니다. V4 자료는 '가져오기' 탭에서 V4 계정 그대로 가져옵니다.`);
          continue;
        }
        const file = readBackupFile(raw);
        if (!file) {
          showToast(`${f.name}: V5 백업 파일이 아닙니다.`);
          continue;
        }
        next.push({ name: f.name, file });
      } catch {
        showToast(`${f.name}: 읽지 못했습니다 (JSON 파일이 아닙니다).`);
      }
    }
    setFiles(next);
    setResult('');
  };

  const restore = async () => {
    if (!sid || files.length === 0) return;
    if (chosen.length === 0) return showToast('되살릴 것을 하나 이상 골라 주세요.');
    setBusy('지금 자료와 맞춰 보는 중…');
    try {
      const added: Record<BackupKind, number> = { events: 0, lessons: 0, records: 0, memos: 0, classes: 0, evaluations: 0 };
      let kept = 0;
      for (const { name, file } of files) {
        setBusy(`${name} 맞춰 보는 중…`);
        const plan = planRestore(file, new Set(chosen), await readCurrentFor(sid, file));
        await writeRestore(sid, plan, (done, total) => setBusy(`${name} 되살리는 중… (${done}/${total})`));
        for (const k of ALL_KINDS) added[k] += plan.added[k];
        kept += plan.kept;
      }
      const text = `${describeCounts(added) || '넣은 것 없음'}${kept ? ` (지금 있는 ${kept}개는 그대로 두었습니다)` : ''}`;
      setResult(text);
      showToast(`♻️ 백업에서 되살렸습니다 - ${text}`);
    } catch (e) {
      if (!(e instanceof ShownError)) showErrorToast('백업을 되살리지 못했습니다.', e);
    } finally {
      setBusy('');
    }
  };

  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary'}`;

  return (
    <div data-backup-tab>
      <Section id="backup-what" title={`담을 것 · 기간 (${spaceName} 공간)`} desc="JSON 백업과 CSV, 되살리기가 함께 씁니다. 라벨·설정은 백업에 늘 함께 담깁니다.">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" data-backup-period={p.key} aria-pressed={period === p.key} onClick={() => setPeriod(p.key)} className={chip(period === p.key)}>
              {p.name}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2 mb-2 text-xs">
            <input type="date" aria-label="시작일" data-backup-start value={custom.start} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} className="px-2 py-1.5 border border-slate-200 rounded-lg" />
            <span className="text-slate-400">~</span>
            <input type="date" aria-label="종료일" data-backup-end value={custom.end} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} className="px-2 py-1.5 border border-slate-200 rounded-lg" />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {kinds.map((k) => (
            <label key={k.key} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl p-2 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                data-backup-include={k.key}
                checked={include.has(k.key)}
                onChange={(e) =>
                  setInclude((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(k.key);
                    else next.delete(k.key);
                    return next;
                  })
                }
                className="w-4 h-4 accent-primary cursor-pointer"
              />
              {k.name}
            </label>
          ))}
        </div>
      </Section>

      <Section id="backup-export" title="받기" desc="JSON = 앱의 자료를 통째로 담는 백업 파일(되살리기에 씁니다). CSV = 엑셀에서 여는 표(조사표는 담지 않습니다).">
        <div className="flex flex-wrap gap-2">
          <button type="button" data-backup-json disabled={!!busy || !sid} onClick={() => void exportJson()} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold disabled:opacity-50">
            🗄️ JSON 백업 받기
          </button>
          <button type="button" data-backup-csv disabled={!!busy || !sid} onClick={exportCsv} className="px-4 py-2 bg-white border border-slate-200 hover:border-primary hover:text-primary text-slate-600 rounded-xl text-xs font-bold disabled:opacity-50">
            📄 CSV 받기
          </button>
        </div>
      </Section>

      <Section
        id="backup-restore"
        title="백업 파일로 되살리기"
        desc="V5 백업 파일(.json)을 고르면 위에서 고른 것만 되살립니다. 지금 없는 것(지운 것 포함)만 넣고, 지금 있는 것은 덮지 않습니다. 여러 파일을 한 번에 고를 수 있습니다."
      >
        <input type="file" accept=".json,application/json" multiple data-restore-file onChange={(e) => void pickFiles(e.target.files)} className="text-xs" />
        {files.length > 0 && (
          <ul data-restore-preview={files.length} className="mt-2 space-y-1 text-xs text-slate-600">
            {files.map(({ name, file }) => (
              <li key={name}>
                <b>{name}</b> - {file.spaceName || '공간'} · {file.exportedAt.slice(0, 10)} · {describeCounts(countBackup(file.colls)) || '담긴 것 없음'}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          data-restore-run
          disabled={!!busy || files.length === 0}
          onClick={() => void restore()}
          className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
        >
          ♻️ 되살리기
        </button>
        {result && (
          <p data-restore-result className="mt-2 text-xs font-bold text-emerald-700">
            ♻️ {result}
          </p>
        )}
      </Section>
      {busy && (
        <p data-backup-busy className="px-5 pb-3 text-xs text-slate-500">
          {busy}
        </p>
      )}
    </div>
  );
}

/** ms → 그날 'YYYY-MM-DD' (이 기기 시각) */
function todayOf(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
