# 03 — Inventaris / stocktelling (port from `ordermailing-bouf`) + non-orderable products

**Repo:** this worktree (`Gezellligheid/feature-ideas`)
**Depends on:** spec 02 (product `price` / `priceUnit`). See "If 02 has not landed" below.
**Language of all user-facing strings:** Dutch

---

## Problem

The yearly stocktelling exists in a **different checkout** and never made it into this
branch. It also only counts things you can order from a supplier — but a real inventaris
includes plenty that is not on any supplier's order form: verpakking, schoonmaakmiddelen,
gas, olie, drank bought at the cash-and-carry, equipment. Those currently cannot be counted
at all.

## Goal

1. Port the inventory module from `ordermailing-bouf` into this branch.
2. Extend it so **non-orderable products** can be counted alongside supplier products.

---

## Source to port

**`C:\Users\Elias\Desktop\ordermailing-bouf`** — branch `inventories`, commit `a604b1a`.

| bouf file | Lines | Port as |
|-----------|-------|---------|
| `server/api/inventory.ts` | 243 | `server/api/inventory.ts` |
| `pages/inventory/+Page.vue` | 284 | Inventory list — one card per year, status, totals |
| `pages/inventory/@id/+Page.vue` | — | The counting matrix (the "matrix edit" commits) |
| `pages/inventory/statistics/+Page.vue` | — | KPI cards, year-over-year, per-supplier breakdown |

Register the router in `server/entry.ts` alongside the others, and add the sidebar entry in
`pages/+Layout.vue`.

### What the bouf implementation already does

- `inventory_counts` collection, one document per year, `status: "open" | "closed"`, with a
  denormalised `items[]` array on the document.
- `POST /api/inventory` builds `items[]` by walking every **active** supplier and its
  **active** products (`inventory.ts:160-187`), snapshotting `priceAtCount` and `priceUnit`
  off each product so a later price change cannot rewrite history.
- `PUT /:id/items` recomputes `totalValue = quantity * priceAtCount` server-side
  (`:224-233`) — the client never sends totals.
- `GET /` returns per-year rollups (`totalValue`, `countedProducts`, `totalItems`).
- One inventory per year, enforced at `:155`.

**Keep all of that.** The changes below are additive.

### Do not port

`POST /api/inventory/parse-delivery` (`inventory.ts:73-124`) — the PDF/CSV delivery-note
parser. It belongs to a different feature and pulls in a `pdf-parse` dependency. Leave it in
bouf.

`pages/history/+Page.vue` belongs to spec 02, not this one.

### Porting notes

bouf diverged from this branch: it has **no** `automaten` module and its `server/api/suppliers.ts`
differs. Port the inventory files and their imports; do not copy bouf's `suppliers.ts` or
`entry.ts` wholesale. Match this repo's component imports (`components/ui/`) — bouf may
reference components that do not exist here.

### If 02 has not landed yet

bouf's product docs already carry `price` and `priceUnit`; this branch's do not. Inventory
depends on them (`priceAtCount`). Either wait for spec 02, or bring **only** the
`price` + `priceUnit` product fields across as part of this work and let 02 build the rest
on top. Coordinate — do not implement price history twice.

---

## New scope: non-orderable products

### Data model

New top-level collection `inventory_products` — things that are counted but never ordered
through the app:

```ts
{
  name: string;               // "Frietzakken groot"
  category: string;           // free text, e.g. "Verpakking" | "Schoonmaak" | "Drank"
  price: number;              // cost price per unit
  priceUnit: string;          // "stuk" | "doos" | "kg" | "liter" | "rol" | ...
  supplierLabel?: string;     // free-text origin, e.g. "Makro" — NOT a suppliers ref
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  createdBy: string;
}
```

Deliberately **not** a product under a supplier: these have no supplier document, must never
show up in `/orders/new`, and must never be pulled into the AI order template.

### Item shape

`items[]` in an inventory count becomes a union, discriminated by a new `source` field:

```ts
// supplier product (existing shape + source)
{ source: "supplier", productId, supplierId, supplierCompanyName,
  internalName, supplierProductName, quantity, priceAtCount, priceUnit, totalValue }

// non-orderable product
{ source: "standalone", productId,          // → inventory_products doc id
  supplierId: null, supplierCompanyName: "Overige",
  internalName: name, supplierProductName: category,
  quantity, priceAtCount, priceUnit, totalValue }
```

Filling `supplierCompanyName` with the category-agnostic `"Overige"` (or the category name —
pick one and be consistent) means the existing grouping, statistics and totals code keeps
working untouched. **This is the point of the design: no consumer of `items[]` should need
to branch on `source` except where explicitly listed below.**

Existing count documents have no `source` on their items. Treat missing as `"supplier"`.

### API additions

```
GET    /api/inventory/products              → list, ?includeInactive=true
POST   /api/inventory/products              → create
PATCH  /api/inventory/products/:id          → update (allow-list the fields)
DELETE /api/inventory/products/:id          → delete; refuse with 409 if the product
                                              appears in any count that is still "open"
POST   /api/inventory/:id/items/add         → add products to an already-started count
       Body: { items: [{ source, productId }] }
```

Route ordering matters — `/products` must be registered **before** `/:id`, exactly as bouf
does for `/scrape-price` (`inventory.ts:23`). Getting this wrong makes `/products` resolve
as an id.

`POST /api/inventory` (start a count) must now also append every **active**
`inventory_products` document to `items[]`, snapshotting price the same way.

`/items/add` exists because someone will always find a forgotten crate mid-count. It
appends without disturbing already-entered quantities, and must be idempotent — adding a
product already present is a no-op, not a duplicate row.

### UI

**New page `pages/inventory/products/+Page.vue`** — manage the non-orderable catalogue.
Table with name, category, price, unit, active toggle, inline add/edit/delete. Group by
category. Reachable from a button on the inventory list page.

**Counting matrix (`pages/inventory/@id/+Page.vue`):**
- Non-orderable items group under their own heading, after the supplier groups.
- A distinguishing badge (e.g. a muted "Overig" chip) on those rows so it is obvious they
  are not orderable.
- A **"Product toevoegen"** button in the header → dialog to pick from
  `inventory_products`, or create a new one inline and add it to the open count in one step.
- Everything else — the quantity inputs, autosave, running total — stays as ported.

**Statistics page:** add a split of total value between "Leverancierproducten" and "Overige",
since that ratio is genuinely interesting to the owner. Otherwise unchanged.

---

## Acceptance criteria

- [ ] `/inventory` lists counts; starting a count for a year that already has one is refused.
- [ ] A new count contains every active supplier product **and** every active
      `inventory_products` entry.
- [ ] `totalValue` is computed server-side; a client sending a bogus total cannot poison it.
- [ ] Non-orderable products never appear in `/orders/new` or in the Gemini order template.
- [ ] Adding a product mid-count preserves all previously entered quantities, and adding the
      same product twice does not duplicate the row.
- [ ] Deleting an `inventory_products` doc used by an open count returns 409.
- [ ] Closing a count freezes it — quantities are read-only afterwards.
- [ ] The statistics page splits value between supplier and overige products.
- [ ] `bun run build` passes.

## Out of scope

- The delivery-note parser (`parse-delivery`).
- Continuous/perpetual stock tracking — this is a periodic count, not live inventory.
- Wiring counts to the automaten stock data.
