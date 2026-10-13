// 공유 그룹 창의 'V4 그룹 가져오기' 칸 (P8-4 ■2). 창을 열면 내가 든 V4 그룹을 읽어 보이고, 그룹마다 가져온다(구성원 누구나 - 여러 번 해도 겹치지 않는다).
// 가져온 그룹은 V4 이름·주인·구성원 그대로 `g_{V4 그룹 id}` 공간이 된다. 일은 import/v4/run의 runGroupImport가 한다.
import { useEffect, useState } from 'react';
import { useSession } from '../../data/session';
import { setSpaceChoice, useMySpaces } from '../../data/spaceChoice';
import { importedGroupSid } from '../../data/spaces';
import { readV4Groups, type V4Group } from '../../import/v4/read';
import { importTimeText } from '../../import/v4/record';
import { runGroupImport, useGroupImportRun } from '../../import/v4/run';
import { ResultNotes, ResultTable } from '../import/ImportResult';
import { Section } from '../settings/parts';

function V4GroupRow({ g, uid }: { g: V4Group; uid: string }) {
  const user = useSession((s) => s.user);
  const run = useGroupImportRun();
  const { groups, loaded } = useMySpaces();
  const sid = importedGroupSid(g.id);
  const inV5 = groups.some((x) => x.id === sid);
  const mine = run.gid === g.id;
  const running = mine && run.state === 'running';
  const busy = run.state === 'running';
  const result = run.results[g.id];
  const pct = run.total > 0 ? Math.round((run.done / run.total) * 100) : 0;

  const start = async () => {
    if (!user) return;
    const done = await runGroupImport(user, g);
    if (done) setSpaceChoice(user.uid, done);
  };

  return (
    <li data-v4-group={g.id} data-v4-group-state={inV5 ? 'imported' : 'new'} className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-black text-slate-800 truncate">👥 {g.name}</span>
        <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{g.ownerId === uid ? '그룹장' : '구성원'}</span>
        <span className="text-xs text-slate-500">구성원 {g.members.length}명</span>
        <button
          type="button"
          data-v4-group-import
          disabled={busy || !loaded}
          onClick={() => void start()}
          className="ml-auto px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
        >
          {running ? '가져오는 중…' : inV5 ? '📥 다시 가져오기' : '📥 가져오기'}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {inV5 ? 'V5에 있습니다 - 다시 가져오면 V4에서 바뀐 것만 고칩니다(V5에서 고친 것은 둡니다).' : 'V4 그룹장·구성원 그대로 V5 그룹이 됩니다. 구성원 누가 가져와도 같은 그룹입니다.'}
      </p>
      {running && (
        <div data-v4-group-progress={pct}>
          <p className="text-xs text-slate-500 mb-1">
            {run.step} {run.total > 0 && `(${run.done}/${run.total})`}
          </p>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {mine && run.state === 'failed' && (
        <p data-v4-group-failed className="text-xs font-bold text-red-500">
          다 가져오지 못했습니다. 다시 누르면 남은 것을 가져옵니다(가져온 것은 겹치지 않습니다).
        </p>
      )}
      {result && !running && (
        <div data-v4-group-result>
          <p className="text-xs text-slate-400">가져온 때 {importTimeText(result.at)}</p>
          <ResultTable counts={result.counts} />
          <ResultNotes notes={result.notes} />
        </div>
      )}
    </li>
  );
}

export default function V4GroupsSection() {
  const uid = useSession((s) => s.user?.uid);
  const [list, setList] = useState<V4Group[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    readV4Groups(uid)
      .then((g) => alive && setList(g))
      .catch((e: unknown) => {
        console.warn('[groups] V4 그룹을 읽지 못했습니다.', e);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  return (
    <Section
      id="groups-v4"
      title="V4 그룹 가져오기"
      desc="V4에서 쓰던 공유 그룹의 일정·수업·기록·메모·알림장·조사표를 V5 그룹으로 옮깁니다. V4는 그대로 두고 읽기만 합니다. 라벨은 그 그룹 자료가 쓰는 것만 내 V4 라벨에서 가져옵니다."
    >
      <div data-v4-groups={list ? list.length : failed ? 'failed' : 'loading'}>
        {failed ? (
          <p className="text-xs text-red-500">V4 그룹을 읽지 못했습니다. 네트워크를 확인하고 창을 다시 열어 주세요.</p>
        ) : !list ? (
          <p className="text-xs text-slate-400">V4 그룹을 찾는 중…</p>
        ) : list.length === 0 ? (
          <p data-v4-groups-empty className="text-xs text-slate-500">
            V4에서 든 공유 그룹이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((g) => (
              <V4GroupRow key={g.id} g={g} uid={uid ?? ''} />
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
