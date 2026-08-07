# Feature specs

Four self-contained specs, one per agent. Each is written to be handed off on its own —
no cross-reading required, though the dependency note below matters for sequencing.

| # | Spec | Summary |
|---|------|---------|
| 01 | [Automaten stock history](./01-automaten-stock-history.md) | Persist vending-machine scrapes, add trends + depletion forecasting + low-stock push |
| 02 | [Product pricing & spend analytics](./02-product-pricing-and-spend-analytics.md) | Cost price per product, price history, spend dashboards off existing order data |
| 03 | [Inventory / stocktelling port](./03-inventory-stocktelling-port.md) | Port the `inventory` module from `ordermailing-bouf`, plus non-orderable products |
| 04 | [Weather-aware order suggestions](./04-weather-aware-order-suggestions.md) | Feed weather + holidays + day-of-week into the Gemini order template |

## Sequencing

- **02 must land before 03.** The inventory count snapshots `price`/`priceUnit` off each
  product (`priceAtCount`), so the product price fields have to exist first. If 03 goes
  first, it must bring the price fields with it and 02 shrinks to just the analytics half.
- **01 and 04 are independent** of everything else and of each other.

## Shared conventions (all specs)

- Repo: this worktree, branch `Gezellligheid/feature-ideas`.
- Stack: Vike + Vue 3 SSR, Tailwind v4, shadcn-style components in `components/ui/`,
  Hono API in `server/`, Firestore via `server/firebase-admin.ts`, Supabase Storage via
  `server/supabase.ts`.
- New routers are registered in `server/entry.ts` (see the `app.route(...)` block, ~line 52).
- Every API router repeats the same Bearer-token auth middleware — copy the pattern from
  `server/api/orders.ts:147-162` (it also resolves `role` from the `users` collection).
- Client calls go through `lib/apiFetch.ts`, which attaches the Firebase ID token.
- UI language: the newer pages (`automaten`, `reservations`, `sollicitaties`) are Dutch.
  **Write all new user-facing strings in Dutch.**
- Follow the visual language of `pages/index/+Page.vue`: `rounded-lg border bg-card p-4`
  stat cards, `tabular-nums` for figures, CSS-only bar charts, `TopLoader` wrapper.
- No test framework is configured. Verify by running `bun dev` and exercising the page.
