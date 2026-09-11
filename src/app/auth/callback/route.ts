import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  let errorMessage =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
    errorMessage = error.message;
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set(
    "error",
    errorMessage ?? "이메일 확인 링크에 인증 코드가 없습니다.",
  );
  if (safeNext !== "/") loginUrl.searchParams.set("next", safeNext);

  return NextResponse.redirect(loginUrl);
}
