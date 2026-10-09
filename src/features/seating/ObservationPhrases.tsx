// 관찰 문구 단추 (V4 components/ObservationPhrases.tsx). 누르면 그 문구로 곧바로 한 줄(부르는 쪽이 저장 - 오늘 기록에 학생을 붙여).
//   '✏️ 문구'로 고치기: 빼기(✕)·더하기. 목록은 계정에 하나(common.phrases) - 다른 기기·학생 기록(누가기록)과 같다.
import { useState } from 'react';
import { setCommonSetting, useCommonSettings } from '../../app/prefs';
import { showToast } from '../../app/toast';
import { MAX_PHRASE_LENGTH, addPhrase } from '../../domain/observationPhrases';

interface Props {
  onPick: (phrase: string) => void;
  disabled?: boolean;
}

export default function ObservationPhrases({ onPick, disabled }: Props) {
  const phrases = useCommonSettings((s) => s.phrases);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const add = () => {
    const r = addPhrase(phrases, draft);
    if (!r) return;
    if ('problem' in r) return showToast(r.problem);
    setDraft('');
    setCommonSetting('phrases', r.list);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5" data-observation-phrases>
      {phrases.map((p) => (
        <span key={p} className="inline-flex items-center">
          <button
            type="button"
            onClick={() => (editing ? undefined : onPick(p))}
            disabled={disabled && !editing}
            data-observation-phrase={p}
            title={editing ? undefined : `'${p}'을(를) 오늘 기록에 남깁니다`}
            className={`px-2 py-0.5 border text-2xs font-bold ${
              editing
                ? 'rounded-l-full bg-white border-slate-200 text-slate-500 cursor-default'
                : 'rounded-full bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 disabled:opacity-40 cursor-pointer'
            }`}
          >
            {p}
          </button>
          {editing && (
            <button
              type="button"
              data-observation-phrase-remove={p}
              onClick={() => setCommonSetting('phrases', phrases.filter((x) => x !== p))}
              aria-label={`'${p}' 빼기`}
              title={`'${p}' 빼기`}
              className="px-1.5 py-0.5 rounded-r-full border border-l-0 border-slate-200 bg-white text-2xs text-slate-400 hover:text-red-500 cursor-pointer"
            >
              ✕
            </button>
          )}
        </span>
      ))}
      {editing && (
        <span className="inline-flex items-center gap-1">
          <input
            value={draft}
            data-observation-phrase-input
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                add();
              }
            }}
            maxLength={MAX_PHRASE_LENGTH}
            placeholder="새 문구"
            aria-label="새 관찰 문구"
            className="w-28 px-2 py-0.5 border border-slate-200 rounded-full text-2xs"
          />
          <button type="button" data-observation-phrase-add onClick={add} title="문구 더하기" aria-label="문구 더하기" className="px-2 py-0.5 rounded-full bg-slate-800 text-white text-2xs font-bold cursor-pointer">
            ＋
          </button>
        </span>
      )}
      <button
        type="button"
        data-observation-phrases-edit
        onClick={() => setEditing(!editing)}
        aria-pressed={editing}
        className="px-2 py-0.5 rounded-full text-2xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
      >
        {editing ? '✓ 다 고침' : '✏️ 문구'}
      </button>
    </div>
  );
}
