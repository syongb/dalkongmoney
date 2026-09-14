"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function BackLink({ fallback }: { fallback: string }) {
  const router = useRouter();

  const linkClassName =
    "inline-flex min-h-10 items-center rounded-md border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-600 shadow-sm";

  return (
    <nav aria-label="서브 화면 이동" className="flex items-center justify-between gap-3">
      <a
        href={fallback}
        onClick={(event) => {
          const referrerIsInternal = document.referrer
            ? new URL(document.referrer).origin === window.location.origin
            : false;
          if (referrerIsInternal && window.history.length > 1) {
            event.preventDefault();
            router.back();
          }
        }}
        className={linkClassName}
      >
        ← 이전
      </a>
      <Link href="/" className={linkClassName}>
        홈
      </Link>
    </nav>
  );
}
