import type { Project } from "../../../shared/types";
import { getSupabase } from "./data";

export type DocumentationProject = Pick<Project, "id" | "slug" | "name">;

export async function loadDocumentationProject(): Promise<DocumentationProject | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const slug = process.env.NEXT_PUBLIC_PROJECT_SLUG || "cursor-cto-hack";
  const { data, error } = await supabase
    .from("projects")
    .select("id,slug,name")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Unable to load documentation project: ${error.message}`);
  return data as DocumentationProject | null;
}
