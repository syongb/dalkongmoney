import { redirect } from "next/navigation";
import { BackLink } from "@/app/back-link";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/app/realtime-refresh";
import { DisplayNameForm } from "./display-name-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("household_members").select("household_id, households(name)").eq("user_id", user.id).maybeSingle(),
  ]);

  const household = Array.isArray(membership?.households) ? membership.households[0] : membership?.households;
  if (!profile || !membership || !household) redirect("/");

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <BackLink fallback="/" />
      <RealtimeRefresh householdId={membership.household_id} includeTransactions={false} includeBudgets includeCategories={false} />
      <h1 className="mt-3 text-xl font-bold">설정</h1>
      <p className="mt-1 text-xs text-stone-500">내 이름과 함께 쓰는 가계부 이름을 관리합니다.</p>
      <section className="mt-4 rounded-lg bg-white p-3 shadow-sm">
        <DisplayNameForm displayName={profile.display_name} householdName={household.name} />
      </section>
    </main>
  );
}
