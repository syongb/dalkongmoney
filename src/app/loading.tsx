export default function Loading() {
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-4" aria-live="polite" aria-busy="true">
      <div className="flex min-h-10 items-center justify-between">
        <div className="h-3 w-14 animate-pulse rounded bg-stone-200" />
        <div className="h-9 w-12 animate-pulse rounded-md bg-stone-200" />
      </div>
      <div className="mt-2 h-5 w-28 animate-pulse rounded bg-stone-300" />
      <div className="mt-3 space-y-2 rounded-lg bg-white p-3 shadow-sm">
        <div className="h-10 animate-pulse rounded-md bg-stone-100" />
        <div className="h-10 animate-pulse rounded-md bg-stone-100" />
        <div className="h-10 animate-pulse rounded-md bg-stone-100" />
      </div>
      <span className="sr-only">화면을 불러오는 중입니다.</span>
    </main>
  );
}
