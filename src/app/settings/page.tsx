import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DisplayNameForm } from "./display-name-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/");

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <Link href="/" className="text-sm text-stone-600">← 홈</Link>
      <h1 className="mt-4 text-2xl font-bold">설정</h1>
      <p className="mt-2 text-sm leading-6 text-stone-500">
        거래에서 구성원을 구분할 때 표시할 내 이름입니다.
      </p>
      <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
        <DisplayNameForm displayName={profile.display_name} />
      </section>
    </main>
  );
}
