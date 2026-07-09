const ASSET_TOKEN = /asset:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

/** Converts durable asset tokens into stable same-origin image routes for rendering. */
export function resolveDocumentationAssetUrls(markdown: string): string {
  return markdown.replace(ASSET_TOKEN, (_match, assetId: string) => {
    return `/api/docs/assets/${assetId}/content`;
  });
}
