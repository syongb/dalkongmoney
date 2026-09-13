export type MonthlyBudgetSummary = {
  budgetAmount: number | null;
  spentAmount: number;
  categories: CategoryBudgetSummary[];
};

export type CategoryBudgetSummary = {
  categoryId: string;
  name: string;
  isActive: boolean;
  budgetAmount: number | null;
  spentAmount: number;
};

type CategoryRow = {
  id: string;
  name: string;
  is_active: boolean;
  type: string;
  sort_order: number;
};

type BudgetRow = { amount: number; category_id: string | null };
type ExpenseRow = { amount: number; category_id: string };

export function sumAmounts(rows: { amount: number }[] | null) {
  return (rows ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

export function buildMonthlyBudgetSummary(
  categories: CategoryRow[],
  budgets: BudgetRow[] | null,
  expenses: ExpenseRow[] | null,
): MonthlyBudgetSummary {
  const budgetRows = budgets ?? [];
  const expenseRows = expenses ?? [];
  const categoryBudgets = new Map(
    budgetRows
      .filter((budget) => budget.category_id !== null)
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
    budgetAmount: budgetRows.find((budget) => budget.category_id === null)?.amount ?? null,
    spentAmount: sumAmounts(expenseRows),
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
