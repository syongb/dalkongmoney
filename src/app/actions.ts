"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { message: string; inviteUrl?: string };

export async function createHousehold(_state: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { message: "가계부 이름을 입력해주세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", { p_name: name });
  if (error) return { message: error.message };
  revalidatePath("/");
  return { message: "가계부를 만들었습니다." };
}

export async function createInvitation(state: ActionState, formData: FormData): Promise<ActionState> {
  void state;
  void formData;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_household_invitation");
  if (error) return { message: error.message };
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? `${headerStore.get("x-forwarded-proto") ?? "http"}://${headerStore.get("host") ?? "localhost:3000"}`;
  return { message: "24시간 동안 한 번만 사용할 수 있는 초대 링크입니다.", inviteUrl: `${origin}/join?token=${encodeURIComponent(String(data))}` };
}

export async function acceptInvitation(_state: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { message: "초대 토큰이 없습니다." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_household_invitation", { p_token: token });
  if (error) return { message: error.message };
  revalidatePath("/");
  return { message: "가계부에 참여했습니다." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
