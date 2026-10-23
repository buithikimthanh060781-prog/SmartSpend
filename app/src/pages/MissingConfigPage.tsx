export function MissingConfigPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-lg rounded-2xl border border-danger/30 bg-white p-8 shadow-card">
        <h1 className="text-xl font-extrabold text-navy">Thiếu cấu hình Supabase</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tạo file <code className="rounded bg-slate-100 px-1">.env.local</code> từ <code className="rounded bg-slate-100 px-1">.env.example</code>{' '}
          và điền <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code>,{' '}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code>, rồi khởi động lại <code className="rounded bg-slate-100 px-1">npm run dev</code>.
        </p>
      </div>
    </div>
  );
}
