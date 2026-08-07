# 04 — Weather- and calendar-aware AI order suggestions

**Repo:** this worktree (`Gezellligheid/feature-ideas`)
**Depends on:** nothing
**Language of all user-facing strings:** Dutch

---

## Problem

`POST /api/orders/generate-template` asks Gemini to propose quantities from the last 5 sent
orders and each product's `idealStock` (`server/api/orders.ts:165-221`, prompt built at
`:108-142`). That is the only signal it has.

For a frituur it is the wrong dominant signal. Demand is driven by **weather** — a dry,
warm weekend versus a cold, wet one is a large swing — and by **school holidays and public
holidays**. The model currently cannot see any of it, so it extrapolates a trend through
conditions that no longer apply.

## Goal

Feed the coming week's weather forecast, the day of week, and the Belgian school/public
holiday calendar into the prompt, and surface the reasoning in the UI so staff can sanity-check
the suggestion instead of trusting it blindly.

---

## Current state — read these first

| File | Note |
|------|------|
| `server/api/orders.ts:108-142` | `buildGeminiPrompt(pastOrders, products)`. Note it already asks for a Dutch `note` field on unusual quantities — extend that mechanism rather than inventing a parallel one. |
| `server/api/orders.ts:165-221` | The endpoint. Model `gemini-3.1-flash-lite`, `responseMimeType: "application/json"`, key from `GEMINI_API_KEY`. |
| `pages/orders/new/+Page.vue` | 1040 lines. Calls the endpoint and pre-fills the steppers; already renders the AI `note` somewhere — find it and extend that surface. |

---

## Scope

### 1. Weather provider

`server/lib/weather.ts`. Use **Open-Meteo** — free, no API key, no attribution requirement.

```
https://api.open-meteo.com/v1/forecast
  ?latitude=50.7817&longitude=3.2456
  &daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code
  &timezone=Europe/Brussels
  &forecast_days=7
```

Those coordinates are Bellegem (Kortrijk). Put them in `SHOP_LAT` / `SHOP_LON` env vars with
those values as defaults.

Requirements:

- `AbortSignal.timeout(5000)`.
- Cache in-module for 3 hours — the forecast does not move faster than that and the endpoint
  may be called repeatedly.
- **Never fail the order-template request because of weather.** On any error return `null`
  and build the prompt exactly as it is today. Log and continue.
- Map WMO `weather_code` to a short Dutch label (`0 → "onbewolkt"`, `61 → "regen"`, …). A
  compact lookup covering the common codes is enough; unknown codes fall back to `"wisselend"`.

Also derive a per-day `terrasScore` (0-10) — a single number capturing "is this good frituur
weather": driven up by max temperature in the 15-25 °C band and low precipitation, down by
rain probability and strong wind. Keep the formula simple, deterministic, and commented; it
is a heuristic for the model to read, not a forecast product.

### 2. Calendar context

`server/lib/calendar.ts`, no external API:

- Belgian **public holidays** — computable (fixed dates + Easter-derived; a small Easter
  algorithm covers Paasmaandag, O.H. Hemelvaart, Pinkstermaandag).
- Belgian **school holidays** (Flemish community) — a static table of ranges. Cover the
  current and next school year and add a code comment saying it needs a yearly refresh.
- Day of week in Dutch.

Return, for each of the next 7 days: `{ date, dayName, isPublicHoliday, holidayName?, isSchoolHoliday }`.

### 3. Extend the prompt

Add a context block to `buildGeminiPrompt`, before the products list:

```
Vandaag is <weekdag> <datum>.

Weersverwachting komende 7 dagen (Bellegem, BE):
  ma 10/08  18°C, 0.0mm neerslag, onbewolkt, terrasscore 8/10  [schoolvakantie]
  di 11/08  14°C, 6.2mm neerslag, regen,     terrasscore 3/10
  ...

Richtlijn: warm en droog weer (terrasscore 7+), weekends, feestdagen en schoolvakanties
verhogen de vraag. Koud, nat weer verlaagt ze. Weeg dit mee bovenop de historische trend.
```

Then extend the existing instruction so the model explains itself: when weather or calendar
materially changed a quantity, it must say so in the Dutch `note` field
(e.g. `"Warm weekend op komst — hoger dan gemiddeld"`).

Keep the response schema backward compatible and add one optional field:

```json
{"suggestions": [{"productId": "...", "quantity": 4, "note": "...", "driver": "weer|trend|vakantie|normaal"}]}
```

`driver` is optional; the client must not break when it is absent.

The endpoint response gains a `context` object so the UI can render what the model saw:

```ts
{ suggestions: [...], context: { weather: [...] | null, holidays: [...] } | null }
```

### 4. UI

In `pages/orders/new/+Page.vue`, when the AI template returns a `context`:

- A collapsible **"Waarom deze suggestie?"** strip above the product list showing the 7-day
  forecast as compact day chips — weekday, icon or label, temperature, and the terrasscore
  as a small coloured dot. Highlight holiday/vacation days.
- Products whose `driver` is `"weer"` or `"vakantie"` get a small badge next to the existing
  note, so the weather-driven adjustments are visibly distinct from trend-driven ones.
- When weather lookup failed (`context.weather === null`), show nothing extra. No error
  toast — the suggestion is still valid, just less informed.

Match the amber suggestion-card styling already used on the dashboard
(`pages/index/+Page.vue:31-58`).

---

## Acceptance criteria

- [ ] With Open-Meteo reachable, the generated prompt contains a 7-day forecast block; log it
      once in dev and eyeball it.
- [ ] With the weather fetch forced to fail, `generate-template` still returns suggestions and
      the page behaves exactly as before this change.
- [ ] Two calls within 3 hours produce one upstream Open-Meteo request.
- [ ] A public holiday and a school-holiday day inside the window are both flagged in the
      prompt; verify against a known date.
- [ ] Suggestions with `driver: "weer"` render their badge; suggestions without `driver`
      render as they do today.
- [ ] Quantities still never exceed each product's `idealStock` unless `manualOrder` is set —
      the existing constraint must survive the prompt rewrite.
- [ ] `bun run build` passes.

## Out of scope

- Historical weather correlation (fitting past orders against past weather). Worth doing once
  spec 01-style history exists, but not here.
- Any paid weather API.
- Auto-sending orders without human review.
