# Static member detail pages

Member detail URLs keep the existing `/yixiao-member-preview.html?id=...` format. The Worker serves a complete HTML snapshot directly, bypassing the encrypted client page loader. No browser requests are required to populate the post or its history.

Publishing prepares a snapshot in the existing ASSETS_KV binding. If preparation fails, the post is still saved and the admin receives a pending-generation notice. Existing posts without a snapshot are generated on first access; prewarm their URLs after deployment. Cached pages older than 15 minutes are served immediately and refreshed in the background. The existing hourly scheduled handler also rebuilds the 50 most recent published member posts, sharing upstream requests within that run. Older posts refresh when visited.

Every request checks the current published record in D1 before serving saved HTML, so hidden or deleted posts cannot be opened from a stale snapshot. The snapshot key includes the record's updated_at value. Responses use no-store to preserve these visibility checks. Registration buttons keep `/api/member-post-register`, which resolves the current 123LH registration setting at click time.

Run `node --test tests/member-static.test.mjs` to verify full HTML rendering, cached reads, visibility, background refresh and error handling. Verify production HTML contains `data-member-static="v1"` and rendered `.record` elements. A successful build alone does not verify the live version: overlapping Cloudflare builds can finish out of order; confirm the final deployed response after all builds finish.
