import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { MemberOption } from "@/lib/transactions";

export async function getHouseholdMemberOptions(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<MemberOption[]> {
  const { data: householdMembers, error: membersError } = await supabase
    .from("household_members")
    .select("user_id, joined_at")
    .eq("household_id", householdId)
    .order("joined_at");

  if (membersError) {
    throw new Error(`구성원 목록을 불러오지 못했습니다: ${membersError.message}`);
  }

  const memberIds = householdMembers.map((member) => member.user_id);
  if (memberIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", memberIds);

  if (profilesError) {
    throw new Error(`구성원 이름을 불러오지 못했습니다: ${profilesError.message}`);
  }

  const displayNames = new Map(
    profiles.map((profile) => [profile.id, profile.display_name]),
  );

  return householdMembers.map((member) => ({
    id: member.user_id,
    label: displayNames.get(member.user_id) ?? "구성원",
  }));
}
