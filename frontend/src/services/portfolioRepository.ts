import { supabase } from "../lib/supabase";
import type { FinancialInputs, PortfolioModel, SimulationStats } from "../types/domain";

type SavePortfolioDraftResult =
  | { status: "skipped"; reason: "supabase-not-configured" | "not-authenticated" }
  | { status: "saved"; goalId: string; planId: string };

export async function savePortfolioDraft(
  inputs: FinancialInputs,
  model: PortfolioModel,
  simulation: SimulationStats,
): Promise<SavePortfolioDraftResult> {
  if (!supabase) {
    return { status: "skipped", reason: "supabase-not-configured" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "skipped", reason: "not-authenticated" };
  }

  const { data: goal, error: goalError } = await supabase
    .from("financial_goals")
    .insert({
      user_id: user.id,
      goal_type: inputs.goalType,
      target_amount: inputs.goalAmountManwon * 10000,
      current_assets: inputs.currentAssetsManwon * 10000,
      monthly_salary: inputs.monthlySalaryManwon * 10000,
      monthly_spend: inputs.monthlySpendManwon * 10000,
      years: inputs.goalYears,
      risk_profile: inputs.riskProfile,
      status: "draft",
    })
    .select("id")
    .single();

  if (goalError) throw goalError;

  const { data: plan, error: planError } = await supabase
    .from("portfolio_plans")
    .insert({
      user_id: user.id,
      goal_id: goal.id,
      expected_return_pct: model.expectedReturnPercent,
      volatility_pct: model.volatilityPercent,
      rebalance_cycle_months: model.rebalanceCycleMonths,
      allocation: model.allocations,
      rationale: {
        xaiSummary: model.xaiSummary,
        factors: model.rationaleFactors,
      },
      simulation,
    })
    .select("id")
    .single();

  if (planError) throw planError;

  return { status: "saved", goalId: goal.id, planId: plan.id };
}

