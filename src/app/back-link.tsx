"use client";

import { useRouter } from "next/navigation";

export function BackLink({ fallback }: { fallback: string }) {
  const router = useRouter();

  return (
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
      className="inline-flex min-h-11 items-center text-sm text-stone-600"
    >
      ← 이전
    </a>
  );
}
