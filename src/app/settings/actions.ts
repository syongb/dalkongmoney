"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DisplayNameActionState = { message: string; success?: boolean };

export async function updateDisplayName(
  _state: DisplayNameActionState,
  formData: FormData,
): Promise<DisplayNameActionState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName) return { message: "이름을 입력해주세요." };
  if (displayName.length > 60) return { message: "이름은 60자 이하로 입력해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { message: "로그인 상태를 다시 확인해주세요." };

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { message: error.message };
  if (!data) return { message: "이름을 변경할 수 없습니다." };

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/settings");
  return { message: "이름을 변경했습니다.", success: true };
}
