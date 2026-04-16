export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Restaurant Platform</h1>
      <p className="text-slate-600">QR-code dine-in ordering for restaurants.</p>
      <div className="flex gap-3">
        <a className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600" href="/signup">
          Get started
        </a>
        <a className="rounded-md border px-4 py-2 hover:bg-slate-50" href="/login">
          Log in
        </a>
      </div>
    </main>
  );
}
