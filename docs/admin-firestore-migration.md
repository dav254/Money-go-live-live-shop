# Admin sections: Firestore → VPS (PocketBase) migration status

Last updated: 2026-10-28 (commits `06b9865c` + the auth-hardening batch).

**Legend** — data source of the admin console itself:
- ✅ **VPS-capable** — reads/writes PocketBase first (or has a VPS-backed route); works when the Firestore project is blocked.
- ⚠️ **Partial** — VPS-first where marked, but at least one read/write still goes to Firestore directly; degrades honestly.
- ❌ **Firestore-only (data)** — the page reads Firestore client-side; shows empty/unavailable when blocked.

**Authorization:** EVERY admin API gate resolves the role in this order:

1. `ADMIN_EMAILS` env allowlist — no database at all (set in `/root/app/.env`,
   comma-separated emails or uids; restart PM2 after editing).
2. Local PocketBase `admins` grant — written by `scripts/promote-admin.ts
   promote <email>` (Firestore-independent; the script's Firestore writes are
   now best-effort so it works while Firestore is blocked).
3. Local PocketBase `user_profiles` role (mirrored at signup/heal).
4. Firestore profile — last resort; on success the grant SELF-HEALS into the
   local store so later requests survive a new block.

Role changes through `users/[uid]/role` mirror to the VPS store on success, so
demotions revoke the local grant too. `ensureUserProfile` no longer lets a
client-supplied role (`admin` included) reach either store — that path could
self-escalate to admin.

## Section-by-section

| Area | Section / page | Data source | Status | Notes |
|---|---|---|---|---|
| Auth | All admin API gates (24 routes) + `admin-guard` | PB → Firestore | ✅ | Includes boosts, campaigns, complaints, users/[uid], tiers |
| Products | Products → All | `/api/admin/products/list` (PB+Firestore merged) | ✅ | Buttons wired: view/feature/unpublish/delete |
| Products | Products → Reported | Firestore docs + VPS-first DELETE route | ⚠️ | Delete works VPS-side; report list still client-Firestore |
| Orders | Orders → All | `/api/admin/orders/list` (PB+Firestore merged) | ✅ | Status/refund buttons VPS-first |
| Orders | Orders → Seller / Reseller / Disputes | client Firestore `orders` | ❌ | Same pattern as All — next to migrate |
| Distribution | Control Center (overview/queues/errors) | Firestore → PB fallback + write mirroring | ✅ | Backfill: `scripts/migrate-growth-jobs.ts` |
| Opportunities | Review queue | Firestore → PB fallback + review mirror | ⚠️ | Queue visible on VPS; approve/reject still needs Firestore (transactional) |
| System | WhatsApp Alerts | Firebase Auth + server-local bridge | ✅ | No Firestore in path |
| System | Roles | client Firestore `userProfiles` | ❌ | Writes role docs; route `users/[uid]/role` is VPS-first |
| System | Server status / Backup / Security | API labels or static | ✅ | Labels mention Firestore but no data dependency |
| Finance | Payouts / Seller-payouts / Payments / Tax / Invoices / Analytics | client Firestore (`payouts`, `payments`, `orders`, `walletTransactions`) | ❌ | Mirrors already exist in PB (`payouts`, `payments`, `wallet_transactions`); admin read routes are the next step (pattern: `payout-analytics`) |
| Users | Buyers / Sellers / Resellers / Suspended / Verification / Admins / Referrals | client Firestore `userProfiles` | ❌ | PB `user_profiles` mirror exists; `/api/admin/users/list` already merges it |
| Live | Live-shopping (Sessions / Approved / Flagged / Analytics) | client Firestore `liveSessions` + `useDoc` | ❌ | PB `live_sessions` mirror exists; `/api/live` route already reads VPS-first |
| Marketing | Banners / Sliders | client Firestore `homepageSlides` | ❌ | No PB mirror yet |
| Support | Tickets / Help center / Conversations / Complaints / Seller-buyer issues | client Firestore (`supportTickets`, `helpArticles`, `chats`, `complaints`) | ❌ | Complaints API routes are VPS-first-gated but Firestore-data |
| Analytics | Activity / Users / Errors | client Firestore (`activityLogs`, `errorLogs`, `userProfiles`) | ❌ | No PB mirrors yet |
| AI | Content moderation / Fraud / Recommendations / Chat | client Firestore (`contentModerationQueue`, `fraudAlerts`, `systemSettings`, `admins/{uid}/adminChat`) | ❌ | Settings docs + queues; no PB mirrors yet |
| Growth | Referrals | client Firestore (`referrals`, `referralGrants`) | ❌ | Money-adjacent: migrate carefully with transactions reviewed |
| Marketing | Boosts / Campaigns | Firestore `boost_requests` (API) | ⚠️ | Auth VPS-first; data Firestore-only; TikTok tokens in secure store |
| Dashboard | Admin overview (`/dashboard/admin`) | client Firestore (4 collections) | ❌ | Highest-traffic page after All Products/Orders |

## Collections: mirror availability

| Collection | PocketBase mirror | Used by admin |
|---|---|---|
| `userProfiles` | ✅ `user_profiles` | Users, Roles, Analytics, dialogs everywhere |
| `orders` | ✅ `orders` | Orders All (+ new list route), Finance |
| `products` | ✅ `products` | Products All (+ new list route) |
| `payouts` / `payments` / wallet txs | ✅ `payouts` / `payments` / `wallet_transactions` | Finance |
| `liveSessions` | ✅ `live_sessions` | Live-shopping |
| `sellerShops` | ✅ `seller_shops` | (admin dialogs) |
| `distributionJobs` | ✅ `distribution_jobs` (new) | Control Center |
| `opportunityApplications` | ✅ `opportunity_applications` (new) | Review queue |
| `chats` | ✅ per-user mirror (`user_data`) | Support conversations |
| `homepageSlides`, `supportTickets`, `helpArticles`, `complaints`, `activityLogs`, `errorLogs`, `fraudAlerts`, `contentModerationQueue`, `referrals`, `referralGrants`, `boost_requests`, `systemSettings` | ❌ none | Finance/Support/Analytics/AI/Marketing pages |

## Recommended next migrations (order by impact)

1. **Orders → Seller/Reseller/Disputes + Admin overview page** — reuse `/api/admin/orders/list` and `/api/admin/products/list` (they already return the merged data; only the pages change).
2. **Users sections** — one VPS-first list route per role (`pbListProfilesByRole` exists; `users/list` already returns `extraProfiles`).
3. **Finance** — the PB mirrors exist; add `/api/admin/finance/*` list routes following `payout-analytics` (already VPS-first).
4. **Live-shopping** — `pbListLiveSessions` exists; add an admin list route.
5. **Support + Analytics + AI + Marketing** — needs new PB mirrors (same helper pattern: `src/lib/pocketbase/*.ts`) plus backfill scripts (copy `scripts/migrate-growth-jobs.ts`).
6. **Referrals** — last: transactional, money-adjacent; requires its own review.

Each step follows the same recipe: VPS-first auth (done everywhere), a PocketBase
mirror + `fsId` key, a server list route merged VPS-first, page switch from
client `useCollection` to that route, and a backfill script.
