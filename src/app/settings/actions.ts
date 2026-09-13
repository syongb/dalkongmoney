"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DisplayNameActionState = { message: string; success?: boolean };

export async function updateNames(
  _state: DisplayNameActionState,
  formData: FormData,
): Promise<DisplayNameActionState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const householdName = String(formData.get("household_name") ?? "").trim();
  if (!displayName) return { message: "이름을 입력해주세요." };
  if (displayName.length > 60) return { message: "이름은 60자 이하로 입력해주세요." };
  if (!householdName) return { message: "가계부 이름을 입력해주세요." };
  if (householdName.length > 60) return { message: "가계부 이름은 60자 이하로 입력해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { message: "로그인 상태를 다시 확인해주세요." };

  const { data: membership, error: membershipError } = await supabase.from("household_members").select("household_id").eq("user_id", user.id).maybeSingle();
  if (membershipError || !membership) return { message: "함께 쓰는 가계부를 찾을 수 없습니다." };

  const [{ data, error }, { data: household, error: householdError }] = await Promise.all([
    supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id).select("id").maybeSingle(),
    supabase.from("households").update({ name: householdName }).eq("id", membership.household_id).select("id").maybeSingle(),
  ]);

  if (error) return { message: error.message };
  if (householdError) return { message: householdError.message };
  if (!data) return { message: "이름을 변경할 수 없습니다." };
  if (!household) return { message: "가계부 이름을 변경할 수 없습니다." };

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/settings");
  return { message: "이름을 저장했습니다.", success: true };
}
