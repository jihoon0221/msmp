alter table public.financial_goals
drop constraint if exists financial_goals_goal_type_check;

alter table public.financial_goals
add constraint financial_goals_goal_type_check
check (goal_type in ('jeonse', 'seed', 'car', 'wedding', 'other'));
