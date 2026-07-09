import type {
  DocumentationAsset,
  DocumentationNode,
  DocumentationRevision,
} from "../../../shared/types";
import { getSupabase } from "./data";

export type DocumentationTreeNode = DocumentationNode & {
  children: DocumentationTreeNode[];
};

export type DocumentationTree = {
  roots: DocumentationTreeNode[];
  orphaned: DocumentationTreeNode[];
};

function compareNodes(a: DocumentationNode, b: DocumentationNode): number {
  return a.sort_order - b.sort_order || a.title.localeCompare(b.title);
}

/**
 * Converts the flat database representation into a forest. Nodes whose parent
 * is missing are returned separately so corrupted/partially loaded data is visible.
 */
export function buildDocumentationTree(nodes: DocumentationNode[]): DocumentationTree {
  const byId = new Map<string, DocumentationTreeNode>();
  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [] });
  }

  const roots: DocumentationTreeNode[] = [];
  const orphaned: DocumentationTreeNode[] = [];
  for (const node of byId.values()) {
    if (!node.parent_id) {
      roots.push(node);
      continue;
    }
    const parent = byId.get(node.parent_id);
    if (parent) parent.children.push(node);
    else orphaned.push(node);
  }

  const sortRecursively = (items: DocumentationTreeNode[]) => {
    items.sort(compareNodes);
    for (const item of items) sortRecursively(item.children);
  };
  sortRecursively(roots);
  sortRecursively(orphaned);

  return { roots, orphaned };
}

export async function loadDocumentationNodes(
  projectId: string,
): Promise<DocumentationNode[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("documentation_nodes")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order")
    .order("title");

  if (error) throw new Error(`Unable to load documentation: ${error.message}`);
  return (data ?? []) as DocumentationNode[];
}

export async function loadDocumentationTree(
  projectId: string,
): Promise<DocumentationTree> {
  return buildDocumentationTree(await loadDocumentationNodes(projectId));
}

export async function loadDocumentationRevisions(
  nodeId: string,
): Promise<DocumentationRevision[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("documentation_revisions")
    .select("*")
    .eq("node_id", nodeId)
    .order("content_version", { ascending: false });

  if (error) throw new Error(`Unable to load document history: ${error.message}`);
  return (data ?? []) as DocumentationRevision[];
}

export type DocumentationAssetWithUrl = DocumentationAsset & {
  signed_url: string;
};

export async function loadDocumentationAssets(
  nodeId: string,
): Promise<DocumentationAssetWithUrl[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("documentation_assets")
    .select("*")
    .eq("node_id", nodeId)
    .order("created_at");
  if (error) throw new Error(`Unable to load document images: ${error.message}`);

  const assets = (data ?? []) as DocumentationAsset[];
  return Promise.all(
    assets.map(async (asset) => {
      const { data: signed, error: signError } = await supabase.storage
        .from(asset.storage_bucket)
        .createSignedUrl(asset.storage_path, 60 * 60);
      if (signError) {
        throw new Error(`Unable to sign image URL: ${signError.message}`);
      }
      return { ...asset, signed_url: signed.signedUrl };
    }),
  );
}
