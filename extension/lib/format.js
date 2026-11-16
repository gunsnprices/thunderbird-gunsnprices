// Text for the popup table, the "Copy" buttons and the tab-separated table copy.

/** "$1,299.99", or "" without a price. */
export function formatPrice(value) {
  if (value == null) return "";
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Cost per round: "38.0¢" under a dollar, "$1.60" from a dollar up, "" when unknown. */
export function formatCostPerRound(value) {
  if (value == null) return "";
  return value < 1 ? (value * 100).toFixed(1) + "¢" : "$" + value.toFixed(2);
}

/** All calibers of an item: ".357 Magnum / .38 S&W Special". */
export function caliberText(item) {
  return item.calibers.map((c) => c.name).join(" / ");
}

/** The numbers: "15-round magazine, 4.02-inch barrel" for a firearm, "50 rounds" for ammo. */
export function specsText(item) {
  const parts = [];
  if (item.kind === "ammo") {
    if (item.rounds) parts.push(`${item.rounds} ${item.rounds === 1 ? "round" : "rounds"}`);
  } else {
    if (item.capacity) parts.push(`${item.capacity}-round magazine`);
    if (item.barrelLength) parts.push(`${item.barrelLength}-inch barrel`);
  }
  return parts.join(", ");
}

/**
 * One line to paste into a message:
 * "Glock 19 Gen 5 MOS, 9×19mm Parabellum, 15-round magazine, 4.02-inch barrel" or
 * "9×19mm Parabellum, 50 rounds, 38.0¢ per round".
 */
export function specLine(item) {
  const parts = [];
  if (item.model) parts.push(item.model);
  if (item.calibers.length) parts.push(caliberText(item));
  const specs = specsText(item);
  if (specs) parts.push(specs);
  if (item.costPerRound != null) parts.push(`${formatCostPerRound(item.costPerRound)} per round`);
  return parts.join(", ");
}

const COLUMNS = [
  ["Title", (it) => it.title],
  ["Type", (it) => it.kind],
  ["Brand", (it) => it.brand],
  ["Model", (it) => it.model],
  ["Caliber", (it) => caliberText(it)],
  ["Capacity", (it) => it.capacity],
  ["Barrel (in)", (it) => it.barrelLength],
  ["Rounds", (it) => it.rounds],
  ["Qty", (it) => it.quantity],
  ["Price", (it) => (it.price == null ? "" : it.price.toFixed(2))],
  ["Cost per round", (it) => (it.costPerRound == null ? "" : it.costPerRound.toFixed(4))],
];

/** The items as tab-separated text with a header row, for pasting into a spreadsheet. */
export function toTSV(items) {
  const clean = (v) => (v == null ? "" : String(v).replace(/[\t\r\n]+/g, " "));
  const lines = [COLUMNS.map(([name]) => name).join("\t")];
  for (const it of items) lines.push(COLUMNS.map(([, get]) => clean(get(it))).join("\t"));
  return lines.join("\n") + "\n";
}
