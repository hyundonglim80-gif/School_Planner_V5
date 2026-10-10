// 백업 창 '가져오기' 탭의 구글 Keep 칸 (V4 KeepImportModal - P8-3에서 창 대신 탭의 칸으로).
// Takeout의 Keep 폴더 파일(.json + 사진·파일)을 골라(나눠 골라도 쌓인다) 미리보기 수를 보고 지금 공간의 메모로 넣는다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { showErrorToast, showToast } from '../../app/toast';
import { assetKey, isKeepAsset, parseKeepFile, planKeepNote, selectNotesToImport, type ExistingMemo, type KeepImportOptions, type KeepNote } from '../../domain/keepImport';
import { labelsOf, memos, useDocs } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { Section } from '../settings/parts';
import { keepResultText, runKeepImport, useKeepInbox } from './keep';

export default function KeepImportSection() {
  const sid = useCurrentSpaceId();
  const items = useDocs('items', sid);
  const labelDocs = useDocs('labels', sid);
  const fileRef = useRef<HTMLInputElement>(null);
  // 고른 파일 묶음 - 같은 파일(이름·크기·고친 때)을 또 골라도 한 번만
  const [batches, setBatches] = useState<Array<{ key: string; notes: KeepNote[] }>>([]);
  // 메모에 딸린 사진·파일 (Takeout은 메모 .json과 같은 폴더에 따로 둔다 - 이름으로 짝을 찾는다)
  const [assets, setAssets] = useState<Map<string, File>>(new Map());
  const [options, setOptions] = useState<KeepImportOptions>({ includeArchived: false, keepLabels: true });
  const [withFiles, setWithFiles] = useState(true);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState('');

  const memoList = useMemo(() => memos(items), [items]);
  const existing = useMemo<ExistingMemo[]>(
    () =>
      memoList.map((m) => ({
        id: m.id,
        text: m.text ?? '',
        ...(m.keepId ? { keepId: m.keepId } : {}),
        labels: (m.labelIds ?? []).map((id) => labelDocs[id]?.name ?? '').filter(Boolean),
        attachmentNames: (m.attachments ?? []).map((a) => a.name),
      })),
    [memoList, labelDocs],
  );
  const notes = batches.flatMap((b) => b.notes);
  const picked = selectNotesToImport(notes, options);
  const assetKeys = new Set(assets.keys());
  const plans = picked.map((n) => planKeepNote(n, options, withFiles, assetKeys, existing));
  const willAdd = plans.filter((p) => p.action === 'add').length;
  const willUpdate = plans.filter((p) => p.action === 'update').length;
  const willSkip = plans.length - willAdd - willUpdate;
  const matched = new Set(picked.flatMap((n) => n.attachmentNames.map(assetKey)).filter((k) => assets.has(k)));

  const ingest = async (chosen: File[]) => {
    if (chosen.length === 0) return;
    setResult('');
    const fresh: Array<{ key: string; notes: KeepNote[] }> = [];
    const freshAssets = new Map<string, File>();
    let other = 0;
    for (const file of chosen) {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.json')) {
        if (isKeepAsset(lower)) freshAssets.set(assetKey(file.name), file);
        else other += 1; // .html처럼 같은 내용을 한 번 더 담은 것
        continue;
      }
      try {
        fresh.push({ key: `${file.name}|${file.size}|${file.lastModified}`, notes: parseKeepFile(await file.text(), file.name) });
      } catch (e) {
        showErrorToast(`${file.name}을 읽지 못했습니다.`, e);
      }
    }
    if (freshAssets.size > 0) setAssets((prev) => new Map([...prev, ...freshAssets]));
    const seen = new Set(batches.map((b) => b.key));
    const added = fresh.filter((b) => !seen.has(b.key));
    if (added.length > 0) setBatches((prev) => [...prev, ...added]);
    const assetTail = freshAssets.size > 0 ? ` · 사진·파일 ${freshAssets.size}개` : '';
    const again = fresh.length - added.length;
    if (added.length > 0) {
      const found = added.reduce((n, b) => n + b.notes.length, 0);
      showToast(`📂 파일 ${added.length}개에서 메모 ${found}건을 더했습니다.${assetTail}${again > 0 ? ` (이미 고른 ${again}개는 건너뜀)` : ''}`);
    } else if (fresh.length > 0) showToast(`이미 고른 파일입니다 (${again}개).${assetTail}`);
    else if (freshAssets.size > 0) showToast(`🖼️ 사진·파일 ${freshAssets.size}개를 받아 두었습니다.`);
    else showErrorToast(`메모 파일을 찾지 못했습니다${other > 0 ? ` (.json이 아닌 파일 ${other}개)` : ''}. Takeout의 Keep 폴더에 있는 .json 파일을 골라 주세요.`);
  };

  // 백업 탭에서 넘겨받은 Keep 파일
  const inbox = useKeepInbox((s) => s.files);
  useEffect(() => {
    if (inbox.length === 0) return;
    useKeepInbox.setState({ files: [] });
    void ingest(inbox);
    // ingest는 그릴 때마다 새로 만들어진다 - 넘겨받은 파일이 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox]);

  const run = async () => {
    if (!sid || busy || willAdd + willUpdate === 0) return;
    setBusy('가져오는 중…');
    try {
      const r = await runKeepImport({
        sid,
        plans,
        assets,
        options,
        labels: labelsOf(labelDocs, 'note'),
        memoList,
        items,
        onStep: (msg) => setBusy(msg || '가져오는 중…'),
      });
      const text = keepResultText(r);
      setResult(text);
      showToast(`✅ ${text}`);
      setBatches([]);
      setAssets(new Map());
    } catch (e) {
      // 묶음 쓰기가 실패하면 failWithToast가 이미 알렸다
      console.error('Keep 가져오기 실패:', e);
    } finally {
      setBusy('');
    }
  };

  const check = (label: string, on: boolean, set: (v: boolean) => void, id: string, hint?: string) => (
    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
      <input type="checkbox" data-keep-opt={id} checked={on} onChange={(e) => set(e.target.checked)} className="w-3.5 h-3.5 accent-primary cursor-pointer" />
      {label}
      {hint && <span className="font-normal text-slate-400">{hint}</span>}
    </label>
  );

  return (
    <Section
      id="keep-import"
      title="📝 구글 Keep 메모 가져오기"
      desc="Keep은 구글이 바깥 앱에 열어 주지 않아 실시간 연동이 안 됩니다(회사·학교 계정 관리자용 통로만 있습니다). 대신 구글이 주는 내보내기 파일을 읽어 지금 공간의 메모로 넣습니다."
    >
      <div data-keep-import className="space-y-3">
        <ol className="text-xs text-slate-600 leading-relaxed list-decimal pl-4 space-y-0.5">
          <li>
            <a href="https://takeout.google.com/settings/takeout/custom/keep" target="_blank" rel="noreferrer" className="text-primary font-bold underline">
              구글 내보내기(Takeout)
            </a>
            에서 <b>Keep</b>만 골라 내보내고, 받은 압축 파일을 풉니다.
          </li>
          <li>
            <b>Takeout / Keep</b> 폴더의 <b>파일을 모두</b>(.json과 사진까지) 고릅니다. 사진까지 골라야 메모에 다시 붙습니다. 여러 번 나눠 골라도 쌓입니다.
          </li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-keep-pick
            onClick={() => fileRef.current?.click()}
            disabled={!!busy}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            📂 {batches.length > 0 ? 'Keep 파일 더 고르기' : 'Keep 파일 고르기'}
          </button>
          <input
            ref={fileRef}
            type="file"
            data-keep-file
            accept=".json,application/json,image/*,audio/*,.pdf,.3gp"
            multiple
            onChange={(e) => {
              const chosen = Array.from(e.target.files ?? []);
              e.target.value = '';
              void ingest(chosen);
            }}
            className="hidden"
            aria-label="Keep 파일"
          />
          {(batches.length > 0 || assets.size > 0) && (
            <>
              <span data-keep-count={notes.length} className="text-xs text-slate-500">
                지금까지 메모 {notes.length}건{assets.size > 0 && ` · 사진·파일 ${assets.size}개`}
              </span>
              <button
                type="button"
                data-keep-clear
                onClick={() => {
                  setBatches([]);
                  setAssets(new Map());
                }}
                disabled={!!busy}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                고른 파일 비우기
              </button>
            </>
          )}
        </div>

        {notes.length > 0 && (
          <>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
              {check('Keep의 라벨도 함께 가져오기', options.keepLabels, (v) => setOptions((p) => ({ ...p, keepLabels: v })), 'labels')}
              {check('보관(Archive)한 메모도 가져오기', options.includeArchived, (v) => setOptions((p) => ({ ...p, includeArchived: v })), 'archived')}
              {check(
                '사진·파일도 함께 붙이기',
                withFiles,
                setWithFiles,
                'files',
                matched.size > 0 ? `(짝을 찾은 파일 ${matched.size}개를 드라이브에 올립니다)` : '(같이 고른 사진·파일이 없습니다)',
              )}
              <p className="text-xs text-slate-500 pt-0.5">
                휴지통에 있던 메모는 가져오지 않습니다.{notes.length > picked.length && ` (지금 ${notes.length - picked.length}건이 빠집니다)`}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1.5 flex flex-wrap gap-x-2">
                <span data-keep-plan="add" className="text-primary font-bold">
                  새로 {willAdd}건
                </span>
                {willUpdate > 0 && (
                  <span data-keep-plan="update" className="text-amber-600 font-bold">
                    바뀌어서 고쳐 쓸 것 {willUpdate}건
                  </span>
                )}
                {willSkip > 0 && (
                  <span data-keep-plan="skip" className="text-slate-500 font-bold">
                    이미 있고 그대로라 건너뛸 것 {willSkip}건
                  </span>
                )}
              </p>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                {picked.slice(0, 20).map((n, i) => (
                  <div key={i} data-keep-preview-item className="px-3 py-2">
                    <p className="text-xs text-slate-800 whitespace-pre-wrap line-clamp-2">{n.content}</p>
                    {n.labels.length > 0 && options.keepLabels && <p className="text-xs text-slate-400 mt-0.5">🏷️ {n.labels.join(', ')}</p>}
                  </div>
                ))}
                {picked.length > 20 && <p className="px-3 py-2 text-xs text-slate-400">… 그리고 {picked.length - 20}건 더</p>}
              </div>
            </div>
            <button
              type="button"
              data-keep-run
              onClick={() => void run()}
              disabled={!!busy || willAdd + willUpdate === 0}
              className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
            >
              {busy || (willUpdate > 0 ? `메모 ${willAdd}건 가져오고 ${willUpdate}건 고치기` : `메모 ${willAdd}건 가져오기`)}
            </button>
          </>
        )}
        {result && (
          <p data-keep-result className="text-xs font-bold text-emerald-700">
            ✅ {result}
          </p>
        )}
      </div>
    </Section>
  );
}
