"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({
  nextPath,
  initialMessage = "",
}: {
  nextPath: string;
  initialMessage?: string;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState(initialMessage);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const displayName = String(form.get("displayName") ?? "").trim();
    const supabase = createClient();

    if (mode === "signup") {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", nextPath);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName }, emailRedirectTo: callback.toString() },
      });
      if (error) setMessage(error.message);
      else if (data.session) window.location.assign(nextPath);
      else setMessage("확인 이메일을 보냈습니다. 이메일의 링크를 눌러 가입을 마쳐주세요.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else window.location.assign(nextPath);
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      {mode === "signup" && (
        <label className="block text-sm font-medium">이름
          <input name="displayName" required maxLength={40} className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4" />
        </label>
      )}
      <label className="block text-sm font-medium">이메일
        <input name="email" type="email" required autoComplete="email" className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4" />
      </label>
      <label className="block text-sm font-medium">비밀번호
        <input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4" />
      </label>
      {message && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
      <button disabled={pending} className="min-h-12 w-full rounded-xl bg-stone-900 px-4 font-semibold text-white disabled:opacity-50">
        {pending ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}
      </button>
      <button type="button" onClick={() => { setMessage(""); setMode(mode === "login" ? "signup" : "login"); }} className="min-h-12 w-full text-sm underline underline-offset-4">
        {mode === "login" ? "처음이라면 계정 만들기" : "이미 계정이 있다면 로그인"}
      </button>
    </form>
  );
}
