# Round one privacy and authorization changes

Regular and Institute tracking now requires an owned child, confirmed monthly service/payment and an active matching child trip. Saved driver IDs are preferences, not tracking credentials. Both HTTP tracking endpoints use the same authorization service. The response includes only the parent's eligible children.

Parent sockets join a dedicated tracking room, never the driver's operational room. Every live location delivery validates the session and current child/payment/trip access again. Access revoked between packets prevents the next delivery. This intentionally adds database work per subscribed parent; batching can be optimized later while retaining per-delivery enforcement.

Institute directory links and refreshes require the current Institute ID and Institute-managed account source. Existing foreign links are not trusted; profile enrichment is removed from returned rows. Unapproved linking to individual accounts is no longer supported. The server enforces staff write permissions for modules and dedicated routes, including direct API calls.

Sensitive Cloudinary fallback uploads use authenticated delivery and expiring signed download links; profile photos remain public. R2 stays private. File signatures require the reference to occur in an authoritative upload field owned by the requesting account/Institute, or an authenticated ASAN admin. An editable avatar/directory value is not enough to request a signature.

Legacy inventory: `node scripts/secureLegacyDocuments.js` is read-only by default. Use `--env /path/to/private.env` only outside Render if needed. It prints category counts, not names, URLs or credentials. After deployment, `node scripts/secureLegacyDocuments.js --apply` moves public document assets to authenticated Cloudinary delivery, requests CDN invalidation and updates their MongoDB references. It does not delete files or overwrite another asset. Assets also used as public profile photos are skipped and reported for manual review. Provider/CDN propagation must be checked separately. Retry can recover a completed asset move with an interrupted database update.

Do not run legacy migration before deploying support for private references. Do not call unmatched URL formats or a missing credential configuration a clean inventory. Review any unmatched public references and migration errors before marking legacy privacy complete.

Verification uses synthetic accounts and mocked providers plus local HTTP servers. No live attack testing or real-user test messages are needed. No frontend/Android rebuild is required for these backend protections. Rounds two and three remain outstanding; round one is not a claim of zero risk.
