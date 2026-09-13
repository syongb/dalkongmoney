export type MonthlyBudgetSummary = {
  budgetAmount: number | null;
  spentAmount: number;
  todaySpentAmount: number;
  categories: CategoryBudgetSummary[];
};

export type CategoryBudgetSummary = {
  categoryId: string;
  name: string;
  isActive: boolean;
  budgetAmount: number | null;
  spentAmount: number;
};

export type BudgetStatusLabel = "여유" | "주의" | "위험" | "초과";

export function getBudgetStatus(spent: number, budget: number): BudgetStatusLabel {
  if (spent > budget) return "초과";
  const rate = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  if (rate >= 85) return "위험";
  if (rate >= 60) return "주의";
  return "여유";
}

type CategoryRow = {
  id: string;
  name: string;
  is_active: boolean;
  type: string;
  sort_order: number;
};

type BudgetRow = { amount: number; category_id: string | null };
type ExpenseRow = { amount: number; category_id: string; transaction_date?: string };

export function sumAmounts(rows: { amount: number }[] | null) {
  return (rows ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

export function buildMonthlyBudgetSummary(
  categories: CategoryRow[],
  budgets: BudgetRow[] | null,
  expenses: ExpenseRow[] | null,
  todayDate?: string,
): MonthlyBudgetSummary {
  const budgetRows = budgets ?? [];
  const expenseRows = expenses ?? [];
  const categoryBudgetRows = budgetRows.filter((budget) => budget.category_id !== null);
  const categoryBudgets = new Map(
    categoryBudgetRows
      .map((budget) => [budget.category_id as string, Number(budget.amount)]),
  );
  const categorySpending = new Map<string, number>();

  for (const expense of expenseRows) {
    categorySpending.set(
      expense.category_id,
      (categorySpending.get(expense.category_id) ?? 0) + Number(expense.amount),
    );
  }

  return {
    budgetAmount: categoryBudgetRows.length > 0 ? sumAmounts(categoryBudgetRows) : null,
    spentAmount: sumAmounts(expenseRows),
    todaySpentAmount: todayDate
      ? sumAmounts(expenseRows.filter((expense) => expense.transaction_date === todayDate))
      : 0,
    categories: categories
      .filter((category) => category.type === "expense")
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((category) => ({
        categoryId: category.id,
        name: category.name,
        isActive: category.is_active,
        budgetAmount: categoryBudgets.get(category.id) ?? null,
        spentAmount: categorySpending.get(category.id) ?? 0,
      })),
  };
}
