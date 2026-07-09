"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "./data";

export type StepUpdate = {
  id: string;
  title: string;
  implementation_plan: string;
  validation_requirements: string;
  status: string;
  sort_order: number;
};

export async function updateWorkplanStep(step: StepUpdate) {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false as const,
      error:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const { error } = await supabase
    .from("workplan_steps")
    .update({
      title: step.title,
      implementation_plan: step.implementation_plan,
      validation_requirements: step.validation_requirements,
      status: step.status,
      sort_order: step.sort_order,
    })
    .eq("id", step.id);

  if (error) return { ok: false as const, error: error.message };

  const { data: row } = await supabase
    .from("workplan_steps")
    .select("workplan_id")
    .eq("id", step.id)
    .maybeSingle();

  if (row?.workplan_id) {
    const { data: plan } = await supabase
      .from("workplans")
      .select("version")
      .eq("id", row.workplan_id)
      .maybeSingle();
    if (plan) {
      await supabase
        .from("workplans")
        .update({ version: (plan.version as number) + 1 })
        .eq("id", row.workplan_id);
    }
  }

  revalidatePath("/");
  return { ok: true as const };
}
