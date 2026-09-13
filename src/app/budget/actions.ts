"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentKoreaMonth } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/server";

export type BudgetActionState = { message: string };

export async function saveMonthlyBudget(
  _state: BudgetActionState,
  formData: FormData,
): Promise<BudgetActionState> {
  const rawAmount = String(formData.get("amount") ?? "").trim();
  if (!/^\d+$/.test(rawAmount)) {
    return { message: "예산을 0원 이상의 숫자로 입력해주세요." };
  }

  const amount = Number(rawAmount);
  if (!Number.isSafeInteger(amount)) {
    return { message: "예산 금액이 너무 큽니다." };
  }

  const categoryIds = formData.getAll("category_id").map(String);
  const rawCategoryAmounts = formData.getAll("category_amount").map((value) => String(value).trim());
  if (categoryIds.length !== rawCategoryAmounts.length || new Set(categoryIds).size !== categoryIds.length) {
    return { message: "카테고리 예산 입력을 다시 확인해주세요." };
  }

  const categoryBudgets: { categoryId: string; amount: number }[] = [];
  for (let index = 0; index < categoryIds.length; index += 1) {
    const rawCategoryAmount = rawCategoryAmounts[index];
    if (!rawCategoryAmount) continue;
    if (!/^\d+$/.test(rawCategoryAmount)) {
      return { message: "카테고리 예산은 0원 이상의 숫자로 입력해주세요." };
    }
    const categoryAmount = Number(rawCategoryAmount);
    if (!Number.isSafeInteger(categoryAmount)) {
      return { message: "카테고리 예산 금액이 너무 큽니다." };
    }
    categoryBudgets.push({ categoryId: categoryIds[index], amount: categoryAmount });
  }

  const allocation = categoryBudgets.reduce((sum, budget) => sum + budget.amount, 0);
  if (!Number.isSafeInteger(allocation) || allocation > amount) {
    return { message: "카테고리별 예산 합계는 전체 생활비보다 클 수 없습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { message: "로그인 상태를 다시 확인해주세요." };

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership) {
    return { message: "함께 쓰는 가계부를 찾을 수 없습니다." };
  }

  if (categoryBudgets.length > 0) {
    const { data: validCategories, error: categoriesError } = await supabase
      .from("categories")
      .select("id")
      .eq("household_id", membership.household_id)
      .eq("type", "expense")
      .in("id", categoryBudgets.map((budget) => budget.categoryId));
    if (categoriesError) return { message: categoriesError.message };
    if ((validCategories ?? []).length !== categoryBudgets.length) {
      return { message: "지출 카테고리에만 예산을 설정할 수 있습니다." };
    }
  }

  const { monthStart } = getCurrentKoreaMonth();
  const { error: deleteError } = await supabase
    .from("budgets")
    .delete()
    .eq("household_id", membership.household_id)
    .eq("budget_month", monthStart)
    .not("category_id", "is", null);
  if (deleteError) return { message: deleteError.message };

  const { data: existing, error: updateError } = await supabase
    .from("budgets")
    .update({ amount })
    .eq("household_id", membership.household_id)
    .eq("budget_month", monthStart)
    .is("category_id", null)
    .select("id")
    .maybeSingle();

  if (updateError) return { message: updateError.message };

  if (!existing) {
    const { error: insertError } = await supabase.from("budgets").insert({
      household_id: membership.household_id,
      budget_month: monthStart,
      amount,
      category_id: null,
    });

    if (insertError?.code === "23505") {
      const { error: retryError } = await supabase
        .from("budgets")
        .update({ amount })
        .eq("household_id", membership.household_id)
        .eq("budget_month", monthStart)
        .is("category_id", null);
      if (retryError) return { message: retryError.message };
    } else if (insertError) {
      return { message: insertError.message };
    }
  }

  if (categoryBudgets.length > 0) {
    const { error: categoryInsertError } = await supabase.from("budgets").insert(
      categoryBudgets.map((budget) => ({
        household_id: membership.household_id,
        budget_month: monthStart,
        amount: budget.amount,
        category_id: budget.categoryId,
      })),
    );
    if (categoryInsertError) return { message: categoryInsertError.message };
  }

  revalidatePath("/");
  revalidatePath("/budget");
  redirect("/");
}
