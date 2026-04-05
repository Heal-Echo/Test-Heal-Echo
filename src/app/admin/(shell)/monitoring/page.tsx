export default function AdminMonitoringPage() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-slate-100 mb-2">실시간 모니터링 (UI 목업)</h2>
        <p className="text-xs text-slate-400 mb-4">
          현재는 하드코딩 UI만 있습니다. 나중에 WebSocket / SSE를 연결해 실제 데이터가 들어오도록
          만들 예정입니다.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="text-sm font-semibold mb-2 text-slate-100">현재 접속자 수</h3>
            <p className="text-3xl font-bold">0</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="text-sm font-semibold mb-2 text-slate-100">서버 상태</h3>
            <p className="inline-flex items-center rounded-full bg-emerald-900/40 px-3 py-1 text-xs text-emerald-300 border border-emerald-700/60">
              ● 정상 (목업)
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:col-span-2">
            <h3 className="text-sm font-semibold mb-2 text-slate-100">최근 트래픽 그래프 (목업)</h3>
            <div className="h-40 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 flex items-center justify-center text-xs text-slate-500">
              여기에 나중에 실제 차트가 들어갑니다.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
