"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type {
  DocumentationAsset,
  DocumentationCanvasMetadata,
  DocumentationNode,
} from "../../../shared/types";
import { getSupabase } from "./data";
import {
  authorizeMutation,
  SERVICE_AUTHORIZATION,
} from "./service-authorization";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; code?: "conflict" | "invalid" | "not_configured" };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_TYPES = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function revalidateDocumentation() {
  revalidatePath("/");
  revalidatePath("/docs");
}

function validateIdentity(title: string, slug: string): string | null {
  if (!title.trim()) return "Title is required.";
  if (!SLUG_PATTERN.test(slug)) {
    return "Slug must contain lowercase letters, numbers, and single hyphens only.";
  }
  return null;
}

function notConfigured(): ActionResult<never> {
  return {
    ok: false,
    code: "not_configured",
    error: "Supabase is not configured.",
  };
}

export type CreateDocumentationNodeInput = {
  project_id: string;
  parent_id?: string | null;
  slug: string;
  title: string;
  markdown?: string;
  sort_order?: number;
  canvas_x?: number;
  canvas_y?: number;
  canvas_width?: number | null;
  canvas_height?: number | null;
  canvas_metadata?: DocumentationCanvasMetadata;
};

export async function createDocumentationNode(
  input: CreateDocumentationNodeInput,
  authorization?: typeof SERVICE_AUTHORIZATION,
): Promise<ActionResult<DocumentationNode>> {
  await authorizeMutation(authorization);
  const invalid = validateIdentity(input.title, input.slug);
  if (invalid) return { ok: false, code: "invalid", error: invalid };

  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase
    .from("documentation_nodes")
    .insert({
      project_id: input.project_id,
      parent_id: input.parent_id ?? null,
      slug: input.slug,
      title: input.title.trim(),
      markdown: input.markdown ?? "",
      sort_order: input.sort_order ?? 0,
      canvas_x: input.canvas_x ?? 0,
      canvas_y: input.canvas_y ?? 0,
      canvas_width: input.canvas_width ?? null,
      canvas_height: input.canvas_height ?? null,
      canvas_metadata: input.canvas_metadata ?? {},
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateDocumentation();
  return { ok: true, data: data as DocumentationNode };
}

export type UpdateDocumentationContentInput = {
  id: string;
  expected_lock_version: number;
  slug: string;
  title: string;
  markdown: string;
};

export async function updateDocumentationContent(
  input: UpdateDocumentationContentInput,
  authorization?: typeof SERVICE_AUTHORIZATION,
): Promise<ActionResult<DocumentationNode>> {
  await authorizeMutation(authorization);
  const invalid = validateIdentity(input.title, input.slug);
  if (invalid) return { ok: false, code: "invalid", error: invalid };

  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase
    .rpc("update_documentation_content", {
      p_node_id: input.id,
      p_expected_lock_version: input.expected_lock_version,
      p_slug: input.slug,
      p_title: input.title.trim(),
      p_markdown: input.markdown,
    })
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      code: "conflict",
      error: "The document changed after it was opened. Reload before saving.",
    };
  }
  revalidateDocumentation();
  return { ok: true, data: data as DocumentationNode };
}

export type MoveDocumentationNodeInput = {
  id: string;
  expected_lock_version: number;
  parent_id: string | null;
  sort_order: number;
  canvas_x: number;
  canvas_y: number;
  canvas_width: number | null;
  canvas_height: number | null;
  canvas_metadata: DocumentationCanvasMetadata;
};

export async function moveDocumentationNode(
  input: MoveDocumentationNodeInput,
  authorization?: typeof SERVICE_AUTHORIZATION,
): Promise<ActionResult<DocumentationNode>> {
  await authorizeMutation(authorization);
  const values = [
    input.sort_order,
    input.canvas_x,
    input.canvas_y,
    input.canvas_width,
    input.canvas_height,
  ].filter((value): value is number => value !== undefined && value !== null);
  if (!values.every(Number.isFinite)) {
    return { ok: false, code: "invalid", error: "Canvas values must be finite numbers." };
  }

  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase
    .rpc("move_documentation_node", {
      p_node_id: input.id,
      p_expected_lock_version: input.expected_lock_version,
      p_parent_id: input.parent_id,
      p_sort_order: input.sort_order,
      p_canvas_x: input.canvas_x,
      p_canvas_y: input.canvas_y,
      p_canvas_width: input.canvas_width,
      p_canvas_height: input.canvas_height,
      p_canvas_metadata: input.canvas_metadata,
    })
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      code: "conflict",
      error: "The node changed while it was being moved. Reload the canvas.",
    };
  }
  revalidateDocumentation();
  return { ok: true, data: data as DocumentationNode };
}

export async function restoreDocumentationRevision(input: {
  node_id: string;
  content_version: number;
  expected_lock_version: number;
}, authorization?: typeof SERVICE_AUTHORIZATION): Promise<ActionResult<DocumentationNode>> {
  await authorizeMutation(authorization);
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data: revision, error: revisionError } = await supabase
    .from("documentation_revisions")
    .select("slug,title,markdown")
    .eq("node_id", input.node_id)
    .eq("content_version", input.content_version)
    .maybeSingle();
  if (revisionError) return { ok: false, error: revisionError.message };
  if (!revision) {
    return { ok: false, code: "invalid", error: "Document revision was not found." };
  }

  return updateDocumentationContent({
    id: input.node_id,
    expected_lock_version: input.expected_lock_version,
    slug: revision.slug as string,
    title: revision.title as string,
    markdown: revision.markdown as string,
  });
}

export async function deleteDocumentationNode(input: {
  id: string;
  expected_lock_version: number;
}, authorization?: typeof SERVICE_AUTHORIZATION): Promise<ActionResult> {
  await authorizeMutation(authorization);
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase.rpc("delete_documentation_node", {
    p_node_id: input.id,
    p_expected_lock_version: input.expected_lock_version,
  });

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      code: "conflict",
      error: "The document changed or no longer exists.",
    };
  }
  revalidateDocumentation();
  return { ok: true };
}

export async function uploadDocumentationImage(
  formData: FormData,
  authorization?: typeof SERVICE_AUTHORIZATION,
): Promise<ActionResult<{ asset: DocumentationAsset; signed_url: string; markdown: string }>> {
  await authorizeMutation(authorization);
  const projectId = formData.get("project_id");
  const nodeId = formData.get("node_id");
  const altText = formData.get("alt_text");
  const file = formData.get("file");
  if (typeof projectId !== "string" || typeof nodeId !== "string" || !(file instanceof File)) {
    return { ok: false, code: "invalid", error: "Project, document, and image are required." };
  }
  if (!(file.type in IMAGE_TYPES)) {
    return { ok: false, code: "invalid", error: "Use a GIF, JPEG, PNG, or WebP image." };
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return { ok: false, code: "invalid", error: "Images must be between 1 byte and 10 MB." };
  }

  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  const extension = IMAGE_TYPES[file.type as keyof typeof IMAGE_TYPES];
  const path = `${projectId}/${nodeId}/${randomUUID()}.${extension}`;
  const bucket = "documentation-assets";
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data, error } = await supabase
    .from("documentation_assets")
    .insert({
      project_id: projectId,
      node_id: nodeId,
      storage_bucket: bucket,
      storage_path: path,
      original_filename: file.name,
      mime_type: file.type,
      byte_size: file.size,
      alt_text: typeof altText === "string" && altText.trim() ? altText.trim() : null,
    })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(bucket).remove([path]);
    return { ok: false, error: error.message };
  }

  const asset = data as DocumentationAsset;
  const { data: signed, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);
  if (signError) return { ok: false, error: signError.message };

  revalidateDocumentation();
  const label = asset.alt_text ?? asset.original_filename;
  return {
    ok: true,
    data: {
      asset,
      signed_url: signed.signedUrl,
      markdown: `![${label}](asset:${asset.id})`,
    },
  };
}

export async function deleteDocumentationImage(
  assetId: string,
  authorization?: typeof SERVICE_AUTHORIZATION,
): Promise<ActionResult> {
  await authorizeMutation(authorization);
  const supabase = getSupabase();
  if (!supabase) return notConfigured();

  // Keep the object and metadata so old immutable revisions remain renderable.
  // A future editor should hide archived assets from its insert-image gallery.
  const { data, error } = await supabase.rpc("archive_documentation_asset", {
    p_asset_id: assetId,
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, code: "invalid", error: "Image was not found." };

  revalidateDocumentation();
  return { ok: true };
}
