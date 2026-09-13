"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentKoreaMonth } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/server";

export type BudgetActionState = { message: string };

function previousMonthStart(monthStart: string) {
  const year = Number(monthStart.slice(0, 4));
  const month = Number(monthStart.slice(5, 7));
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function importPreviousMonthBudgets() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/budget");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/");

  const monthStart = getCurrentKoreaMonth().monthStart;
  const [{ data: activeCategories }, { data: previousBudgets }, { data: currentBudgets }] = await Promise.all([
    supabase.from("categories").select("id").eq("household_id", membership.household_id).eq("type", "expense").eq("is_active", true),
    supabase.from("budgets").select("category_id, amount").eq("household_id", membership.household_id).eq("budget_month", previousMonthStart(monthStart)).not("category_id", "is", null),
    supabase.from("budgets").select("category_id").eq("household_id", membership.household_id).eq("budget_month", monthStart).not("category_id", "is", null),
  ]);

  const activeIds = new Set((activeCategories ?? []).map((category) => category.id));
  const existingIds = new Set((currentBudgets ?? []).map((budget) => budget.category_id));
  const rows = (previousBudgets ?? [])
    .filter((budget) => budget.category_id && activeIds.has(budget.category_id) && !existingIds.has(budget.category_id))
    .map((budget) => ({
      household_id: membership.household_id,
      budget_month: monthStart,
      category_id: budget.category_id,
      amount: budget.amount,
    }));

  if (rows.length === 0 && (currentBudgets ?? []).length === 0) {
    redirect("/budget?import=empty");
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("budgets").insert(rows);
    if (error) throw new Error(error.message);
  }

  const { data: savedBudgets } = await supabase.from("budgets").select("amount").eq("household_id", membership.household_id).eq("budget_month", monthStart).not("category_id", "is", null);
  const total = (savedBudgets ?? []).reduce((sum, budget) => sum + Number(budget.amount), 0);
  const { data: overall } = await supabase.from("budgets").update({ amount: total }).eq("household_id", membership.household_id).eq("budget_month", monthStart).is("category_id", null).select("id").maybeSingle();
  if (!overall) await supabase.from("budgets").insert({ household_id: membership.household_id, budget_month: monthStart, amount: total, category_id: null });

  revalidatePath("/");
  revalidatePath("/budget");
  redirect("/budget");
}

type SubmittedCategory = {
  id: string;
  name: string;
  amount: number | null;
  isActive: boolean;
};

export async function saveBudgetCategories(
  _state: BudgetActionState,
  formData: FormData,
): Promise<BudgetActionState> {
  const ids = formData.getAll("category_id").map(String);
  const names = formData.getAll("category_name").map((value) => String(value).trim());
  const amounts = formData.getAll("category_amount").map((value) => String(value).trim());
  const activeValues = formData.getAll("category_active").map(String);

  if (ids.length !== names.length || ids.length !== amounts.length || ids.length !== activeValues.length) {
    return { message: "카테고리 입력을 다시 확인해주세요." };
  }

  const categories: SubmittedCategory[] = [];
  for (let index = 0; index < ids.length; index += 1) {
    const isActive = activeValues[index] === "true";
    const name = names[index];
    if (isActive && !name) return { message: "카테고리 이름을 입력해주세요." };
    if (name.length > 50) return { message: "카테고리 이름은 50자 이하로 입력해주세요." };

    const rawAmount = amounts[index];
    if (rawAmount && !/^\d+$/.test(rawAmount)) return { message: "예산은 0원 이상의 숫자로 입력해주세요." };
    const amount = rawAmount ? Number(rawAmount) : null;
    if (amount !== null && !Number.isSafeInteger(amount)) return { message: "예산 금액이 너무 큽니다." };

    categories.push({ id: ids[index], name, amount, isActive });
  }

  const activeNames = categories.filter((category) => category.isActive).map((category) => category.name);
  if (new Set(activeNames).size !== activeNames.length) return { message: "같은 이름의 지출 카테고리를 두 번 사용할 수 없습니다." };
  if (activeNames.length === 0) return { message: "사용할 지출 카테고리를 하나 이상 남겨주세요." };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { message: "로그인 상태를 다시 확인해주세요." };

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership) return { message: "함께 쓰는 가계부를 찾을 수 없습니다." };

  const existingIds = categories.map((category) => category.id).filter(Boolean);
  if (existingIds.length > 0) {
    const { data: existingCategories, error } = await supabase
      .from("categories")
      .select("id")
      .eq("household_id", membership.household_id)
      .eq("type", "expense")
      .in("id", existingIds);
    if (error) return { message: error.message };
    if ((existingCategories ?? []).length !== new Set(existingIds).size) return { message: "수정할 수 없는 카테고리가 포함되어 있습니다." };
  }

  const monthStart = getCurrentKoreaMonth().monthStart;
  for (let index = 0; index < categories.length; index += 1) {
    const category = categories[index];
    let categoryId = category.id;

    if (categoryId && !category.isActive) {
      const { error } = await supabase.from("categories").update({ is_active: false }).eq("id", categoryId).eq("household_id", membership.household_id).eq("type", "expense");
      if (error) return { message: error.message };
      continue;
    }

    if (categoryId) {
      const { error } = await supabase.from("categories").update({ name: category.name, sort_order: index, is_active: true }).eq("id", categoryId).eq("household_id", membership.household_id).eq("type", "expense");
      if (error) return { message: error.message };
    } else {
      const { data: sameName } = await supabase.from("categories").select("id, is_active").eq("household_id", membership.household_id).eq("type", "expense").eq("name", category.name).maybeSingle();
      if (sameName?.is_active) return { message: `'${category.name}' 카테고리가 이미 있습니다.` };
      if (sameName) {
        const { error } = await supabase.from("categories").update({ is_active: true, sort_order: index }).eq("id", sameName.id);
        if (error) return { message: error.message };
        categoryId = sameName.id;
      } else {
        const { data: inserted, error } = await supabase.from("categories").insert({ household_id: membership.household_id, type: "expense", name: category.name, sort_order: index, is_active: true }).select("id").single();
        if (error) return { message: error.message };
        categoryId = inserted.id;
      }
    }

    if (category.amount === null) {
      const { error } = await supabase.from("budgets").delete().eq("household_id", membership.household_id).eq("budget_month", monthStart).eq("category_id", categoryId);
      if (error) return { message: error.message };
      continue;
    }

    const { data: updated, error: updateError } = await supabase.from("budgets").update({ amount: category.amount }).eq("household_id", membership.household_id).eq("budget_month", monthStart).eq("category_id", categoryId).select("id").maybeSingle();
    if (updateError) return { message: updateError.message };
    if (!updated) {
      const { error } = await supabase.from("budgets").insert({ household_id: membership.household_id, budget_month: monthStart, amount: category.amount, category_id: categoryId });
      if (error) return { message: error.message };
    }
  }

  const { data: savedBudgets, error: budgetError } = await supabase.from("budgets").select("amount").eq("household_id", membership.household_id).eq("budget_month", monthStart).not("category_id", "is", null);
  if (budgetError) return { message: budgetError.message };
  const total = (savedBudgets ?? []).reduce((sum, budget) => sum + Number(budget.amount), 0);

  const { data: updatedOverall, error: overallUpdateError } = await supabase.from("budgets").update({ amount: total }).eq("household_id", membership.household_id).eq("budget_month", monthStart).is("category_id", null).select("id").maybeSingle();
  if (overallUpdateError) return { message: overallUpdateError.message };
  if (!updatedOverall) {
    const { error } = await supabase.from("budgets").insert({ household_id: membership.household_id, budget_month: monthStart, amount: total, category_id: null });
    if (error) return { message: error.message };
  }

  revalidatePath("/");
  revalidatePath("/budget");
  revalidatePath("/transactions/new");
  revalidatePath("/monthly-summary");
  redirect("/?view=budget");
}
