// 아직 채우지 않은 화면의 자리 (P1-3 껍데기). 그 화면 세션에서 진짜 화면으로 바뀐다.
export default function EmptyScreen({ scope, title, session }: { scope: string; title: string; session: string }) {
  return (
    <section data-screen={scope} className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
      <h2 className="text-base font-black text-slate-700">{title}</h2>
      <p className="mt-1 text-xs text-slate-400">{session}에서 채웁니다.</p>
    </section>
  );
}
