# Changelog

## 1.0.0 (2026-11-16)

First release.

- **Gun & ammo specs** button in the message header: finds gun and ammo products in the displayed message (order
  confirmations, receipts, deal newsletters; plain text and HTML) and shows a table with type, model, caliber,
  magazine capacity, barrel length, rounds per box, quantity, price and cost per round.
- Prices: old (struck-through, "was", "reg."), savings, rebates, shipping and "orders over $99" amounts are ignored;
  a line total is divided by the quantity.
- **Parse gun/ammo title** in the context menu of selected text, in a message or in the compose editor. Opens a
  window with the specs of the selected title or lines.
- **Copy** on a row copies a spec line ("Glock 19 Gen 5 MOS, 9×19mm Parabellum, 15-round magazine, 4.02-inch
  barrel") to paste into a message; **Copy table** copies all rows as tab-separated text.
- Caliber names link to the GunsNPrices price page of that caliber (opened in the browser only when clicked).
- Works offline: bundles the [`gunsnprices`](https://www.npmjs.com/package/gunsnprices) parser 0.1.2 unchanged.
  No network requests, no storage, no telemetry. Permissions: `messagesRead`, `menus`.
- Thunderbird 140 and newer (Manifest V3).
