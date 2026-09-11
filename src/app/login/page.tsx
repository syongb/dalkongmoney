import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;
  const nextPath =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/";

  if (user) redirect(nextPath);

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-16">
      <p className="text-sm font-semibold text-emerald-700">우리 가계부</p>
      <h1 className="mt-2 text-3xl font-bold">둘이 쓰는 가계부</h1>
      <p className="mt-3 text-stone-600">
        각자 계정으로 로그인하고 같은 가계부를 안전하게 공유합니다.
      </p>
      <LoginForm
        nextPath={nextPath}
        initialMessage={params.error ? `Supabase 인증 오류: ${params.error}` : ""}
      />
    </main>
  );
}
