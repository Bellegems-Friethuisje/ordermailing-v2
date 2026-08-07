# 02 — Product cost prices, price history & spend analytics

**Repo:** this worktree (`Gezellligheid/feature-ideas`)
**Depends on:** nothing. **Blocks:** spec 03 (inventory counts snapshot these price fields).
**Language of all user-facing strings:** Dutch

---

## Problem

There is no price anywhere in the app. Products carry `internalName`, `supplierName`,
`idealStock`, `manualOrder`, `isActive` — and nothing about cost. So the order history in
Firestore, which already records every line and quantity ever sent, cannot answer the one
question that matters to the owner: **what did we spend, at which supplier, and is it going
up?**

## Goal

Add a cost price (with unit and history) to each product, then turn the *existing* order
data into spend analytics. No new data entry beyond filling in prices once.

---

## Reference implementation — read this first

**`C:\Users\Elias\Desktop\ordermailing-bouf`** (branch `inventories`) already implements the
product-price half of this feature. Port it rather than reinventing:

| bouf file | What to take |
|-----------|--------------|
| `server/api/suppliers.ts:98-160` | `price`, `supplierUrl`, `priceHistory` on the product doc; the `_priceHistoryEntry` write pattern using `FieldValue.arrayUnion` |
| `server/api/inventory.ts:24-70` | `POST /scrape-price` — fetches a `supplierUrl` and pulls the price out with a cheerio selector cascade |
| `pages/history/+Page.vue` | Price-history UI (~654 lines). Read it for the shape, adapt the styling to this repo. |

bouf's product also has `priceUnit` (`"stuk"` default) and `displayOrder`. Bring both.

Diff carefully — bouf diverged from this branch (it has no `automaten`, and its
`suppliers.ts` differs). Port the price concern, not the whole file.

---

## Current state in *this* repo

| File | Note |
|------|------|
| `server/api/suppliers.ts` | 247 lines. Suppliers in `suppliers`, products in the `products` subcollection. This is where the new fields go. |
| `pages/suppliers/+Page.vue` | 747 lines. Supplier table + the product side-panel with the add/edit product form. |
| `server/api/orders.ts:224-266` | `POST /api/orders` writes `lines: [{productId, supplierName, internalName, quantity}]`. |
| `pages/orders/new/+Page.vue` | 1040 lines. Quantity stepper UI. |
| `pages/index/+Page.vue` | Dashboard stat-card + CSS bar chart pattern to mirror. |

---

## Scope

### 1. Product price fields

Extend the product document:

```ts
{
  // ...existing
  price: number;              // cost price excl. VAT, default 0
  priceUnit: string;          // "stuk" | "kg" | "doos" | "liter" | ... default "stuk"
  supplierUrl?: string;       // optional product page, used by the scraper
  priceHistory: Array<{
    price: number;
    date: string;             // ISO
    source: "manual" | "scrape";
  }>;
}
```

Rules:

- `priceHistory` is append-only via `FieldValue.arrayUnion`. Never rewrite the array.
- Append an entry **only when the price actually changes**. Saving the form with an
  unchanged price must not add a row.
- Existing products have no `price` — treat missing as `0` everywhere and never crash on it.
- Keep the allow-list update pattern already in `suppliers.ts` (only permitted keys are
  written) and add the new fields to it.

### 2. Price scraping

Port `POST /api/suppliers/scrape-price` from bouf's `inventory.ts:24-70` (put it on the
suppliers router here, since that is where products live). Body `{ url }`, returns
`{ price, raw, error? }`. Keep the 10s `AbortSignal.timeout` and the selector cascade.

In the product form: a **"Prijs ophalen"** button next to `supplierUrl` that fills the price
field and shows the raw scraped string for confirmation. The user still has to press Save —
never write a scraped price silently.

### 3. Snapshot the price onto order lines

This is the load-bearing change. When an order is created or sent, each line must record
what the product cost **at that moment**:

```ts
lines: [{
  productId, supplierName, internalName, quantity,
  unitPrice: number,        // copied from product.price at write time
  priceUnit: string,
  lineTotal: number,        // quantity * unitPrice
}]
```

Also store `orderTotal` on the order document.

Resolve the prices **server-side** in `POST /api/orders` and in the `PATCH` that flips
status to `sent` — read the products from Firestore rather than trusting a client-sent
price. Historic orders keep their missing fields; every consumer must tolerate `undefined`.

### 4. Show cost during ordering

In `pages/orders/new/+Page.vue`:

- Each product row shows `€ x,xx / <priceUnit>` under the name (muted, small).
- A running **order total** in the sticky header next to the existing item count.
- The review step gets a price column and a total row.

If a product has `price === 0`, show `—` rather than `€ 0,00`, so unpriced products are
visibly unpriced.

### 5. Order email

`sendOrderEmail` (`server/api/orders.ts:17-100`) builds an HTML table and an xlsx. Add a
price column and a total row to both — but only when at least one line has a non-zero
price, otherwise leave the current two-column layout untouched.

### 6. Spend analytics

New page `pages/analytics/+Page.vue`, route `/analytics`, added to the sidebar in
`pages/+Layout.vue`. Backed by `GET /api/orders/analytics?from=&to=`, computed server-side
from `status == "sent"` orders in the range.

Response:

```ts
{
  totalSpend: number;
  orderCount: number;
  bySupplier:  [{ supplierId, supplierName, spend, orderCount }];   // desc by spend
  byMonth:     [{ month: "2026-08", spend }];
  topProducts: [{ productId, internalName, totalQuantity, spend }]; // top 20 by spend
  priceChanges:[{ productId, internalName, supplierName, oldPrice, newPrice, changedAt, pct }];
}
```

`priceChanges` comes from scanning `priceHistory` across products for entries in the range —
surface anything that moved more than 5%, newest first. This is the feature that earns the
page: it tells the owner a supplier quietly raised a price.

Page layout, reusing the dashboard's visual language:

- Four stat cards: totale uitgaven, aantal bestellingen, gemiddelde bestelwaarde,
  aantal prijsstijgingen.
- Month bar chart (CSS, same as dashboard).
- Supplier table sorted by spend, with a share-of-total bar in the cell.
- Top-products table.
- A "Prijswijzigingen" list with ▲/▼ and percentage, red for increases.
- A period picker: deze maand / vorige maand / dit jaar / vrij bereik. Default: dit jaar.

**Access:** admins only — check `c.get("role") === "admin"` in the endpoint and hide the
sidebar link for non-admins.

### 7. Bulk price entry

Filling in prices product-by-product through a side panel is painful for a first run. Add a
**"Prijzen bewerken"** mode on `pages/suppliers/+Page.vue` that lists every product of the
expanded supplier as a flat editable price column, saved in one request:

```
PUT /api/suppliers/:id/products/prices
Body: { prices: [{ productId, price, priceUnit }] }
```

Write it as one Firestore batch, appending `priceHistory` entries only for changed values.

---

## Acceptance criteria

- [ ] Saving a product with a changed price appends exactly one `priceHistory` entry;
      saving it again unchanged appends none.
- [ ] An order sent after prices are set stores `unitPrice`/`lineTotal` per line and a
      correct `orderTotal`.
- [ ] Orders created before this change still render everywhere without errors.
- [ ] `/analytics` totals match a hand-summed Firestore query for a known month.
- [ ] A product whose price went 10,00 → 11,00 appears in `priceChanges` at +10%.
- [ ] Non-admin users get 403 from the analytics endpoint and see no sidebar link.
- [ ] `bun run build` passes.

## Out of scope

- VAT handling — prices are excl. VAT, single rate assumed.
- Selling prices / margin. Cost side only.
- Reconciling against supplier invoices.
