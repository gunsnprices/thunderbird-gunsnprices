// Finds gun and ammo products in the text of an email (order confirmations, receipts, deal newsletters) and reads
// their specs with the gunsnprices title parser: model, caliber, magazine capacity, barrel length, rounds per box,
// quantity, price and cost per round.
//
// The input is text with one line per row and "\t" between table cells (see html-to-text.js). A product is a line
// (or a table cell) that the parser recognizes as a firearm or ammunition title. Its price and quantity are read
// from the same line and from the next few lines, until the next product or an order summary line.
//
// Everything here is plain string work: no DOM, no network, no storage.
import { costPerRound, parseTitle } from "../vendor/gunsnprices/src/index.js";
import { htmlToText, normalizeText } from "./html-to-text.js";

const MAX_ITEMS = 100;
const MAX_LINES = 3000;
const MAX_TITLE = 200; // longer cells are paragraphs, not titles
const WINDOW = 4; // lines after a title that can hold its quantity and price

// Cells: tabs (from HTML tables), " | " and runs of spaces were turned into tabs by normalizeText().
const CELL_SPLIT = /\t|\s+\|\s+/;

// --- prices --------------------------------------------------------------------------------------------------------

const PRICE = /(?:\$|\bUSD\s?)\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{1,6}(?:\.\d{1,2})?)(?![\d,]*\d)/gi;
// Amounts that are not the price of the item: old prices, savings, shipping, thresholds, cost per round.
const NOT_PRICE_BEFORE =
  /(?:\bsave|\bsavings|\byou save|\bwas|\breg\.?|\bregular(?:\s+price)?|\bmsrp|\blist(?:\s+price)?|\bcompare(?:\s+at)?|\bretail|\borig\.?|\boriginal(?:\s+price)?|\bmap|\bdiscount|\bcoupon|\bshipping|\btax|\bover|\bunder|\bup\s+to|\bfrom|\bstarting\s+at|\brebate|\bcredit|\bgift\s+card|\bfee)\s*:?\s*\(?\s*$|[-−]$/;
const NOT_PRICE_AFTER =
  /^\s*(?:off\b|savings\b|instant\s+savings|rebate|mail-in|\/\s*(?:rd|rnd|round|shell)s?\b|per\s+(?:rd|rnd|round|shell)\b|cpr\b|shipping|s&h|flat\s+rate|or\s+more|\+\s*(?:shipping|tax)|minimum)/;
const UNIT_BEFORE =
  /(?:\bunit\s+price|\bprice\s+each|\beach|\bea\.?|\bsale(?:\s+price)?|\bour\s+price|\byour\s+price|\bprice|\bnow|\bonly|\bjust|@|\bat)\s*:?\s*$/;
const UNIT_AFTER = /^\s*(?:each\b|ea\b|\/\s*(?:ea|each|box|bx|pk|pack|item|unit)\b|per\s+(?:box|item|unit|pack)\b)/;
const TOTAL_BEFORE = /(?:\bline\s+total|\bitem\s+total|\btotal|\bamount|\bsubtotal|\bext\.?(?:\s+price)?)\s*:?\s*$/;

/**
 * Dollar amounts in a piece of text, each marked "unit" (labeled as the price of one item), "total" (labeled as a
 * line total) or "plain". Old prices, savings, shipping, thresholds ("orders over $99") and costs per round are left
 * out.
 * @param {string} text
 * @returns {{value: number, kind: "unit" | "total" | "plain"}[]}
 */
export function findPrices(text) {
  const out = [];
  for (const m of String(text || "").matchAll(PRICE)) {
    const value = parseFloat(m[1].replace(/,/g, ""));
    if (!(value > 0) || value > 100000) continue;
    const before = text.slice(Math.max(0, m.index - 30), m.index).toLowerCase();
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 30).toLowerCase();
    if (NOT_PRICE_BEFORE.test(before) || NOT_PRICE_AFTER.test(after)) continue;
    let kind = "plain";
    if (UNIT_BEFORE.test(before) || UNIT_AFTER.test(after)) kind = "unit";
    else if (TOTAL_BEFORE.test(before)) kind = "total";
    out.push({ value, kind });
  }
  return out;
}

// --- quantities ----------------------------------------------------------------------------------------------------

const QTY_LABEL = /\b(?:qty|quantity|quant)\.?\s*[:#=]?\s*(\d{1,4})\b/i;
const QTY_TIMES = /(?:^|[^\d.\s])\s*[×✕]\s*(\d{1,4})\b(?!\s*(?:mm|in\b|"))/; // "Federal 9mm × 2", not "5.56×45"
const QTY_X_END = /(?:^|[^\d.\s])\s+x\s*(\d{1,4})\s*$/i; // "... x 2" at the end, not "7.62 x 39"
const QTY_PAREN = /\(\s*x\s*(\d{1,4})\s*\)|\(\s*(\d{1,4})\s*x\s*\)/i; // "(x2)", "(2x)"
const QTY_AT = /\b(\d{1,4})\s*@\s*\$/; // "2 @ $18.99"
const QTY_PREFIX = /^(\d{1,3})\s*[x×]\s+(?=\D)/i; // "2 x Federal ..."
const QTY_ALONE = /^(\d{1,3})$/; // a cell or line with only the quantity

/**
 * Quantity written in a piece of text ("Qty: 2", "× 2", "2 @ $18.99", "2 x Title"), or null.
 * @param {string} text
 * @returns {number | null}
 */
export function findQuantity(text) {
  const s = String(text || "");
  for (const re of [QTY_LABEL, QTY_TIMES, QTY_X_END, QTY_PAREN, QTY_AT, QTY_PREFIX]) {
    const m = re.exec(s);
    if (m) {
      const n = parseInt(m[1] || m[2], 10);
      if (n >= 1 && n <= 9999) return n;
    }
  }
  return null;
}

const MPN = /\b(?:mpn|mfr\.?\s*(?:part\s*)?(?:#|no\.?|number)?|manufacturer\s+part\s+(?:#|no\.?|number)|part\s*(?:#|no\.?|number)|model\s*(?:#|no\.?|number))\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,24})\b/i;

// --- titles --------------------------------------------------------------------------------------------------------

// The parser decides firearm or ammo from words like "gr", "rounds", "/box". These also mean ammo when it found no
// firearm model: "Federal 12 Gauge 2-3/4" 00 Buck 5 Rounds".
const MORE_AMMO =
  /\b(?:fmj|jhp|tmj|jsp|hollow\s*points?|v-?max|ballistic\s*tip|#?\d{1,3}\s*buck|buck\s*shot|bird\s*shot|target\s+loads?|shells?|rounds?\s+of|case\s+of|\d+\s*(?:rds?|rounds?)\s*(?:box|case|pack|tin))\b/i;
// Gear that mentions a caliber or a capacity but is not a gun or ammo. Kept short on purpose.
const ACCESSORY =
  /\b(?:magazines?|mags|pmags?|holsters?|slings?|riflescopes?|scopes?|bipods?|choke\s*tubes?|cleaning\s*(?:kits?|rods?|supplies)|bore\s*snakes?|gun\s*safes?|ear\s*(?:muffs?|plugs?)|hearing\s+protection|eye\s+protection|safety\s+glasses|shooting\s+glasses|(?:gun|rifle|pistol|shotgun)\s+cases?|range\s+bags?|t-?shirts?|hoodies?|gift\s*cards?|suppressors?|silencers?|muzzle\s*brakes?|compensators?|speed\s*loaders?|mag(?:azine)?\s*loaders?|weapon\s*lights?|flashlights?|lasers?|targets|target\s+(?:stands?|systems?|throwers?))\b/i;
const FIREARM_WORD =
  /\b(?:pistol|rifle|shotgun|revolver|handgun|carbine|semi-?auto(?:matic)?|bolt[-\s]?action|lever[-\s]?action|pump[-\s]?action|single[-\s]?shot|over[-\s]?under|side[-\s]?by[-\s]?side)\b/i;
// Sentences and email boilerplate rather than product titles.
const NOISE =
  /\b(?:thank(?:s| you)|your\s+order|order\s+(?:number|#|no\.?|confirmation|status)|has\s+(?:been\s+)?shipped|tracking|shop\s+(?:now|all|our)|view\s+(?:all|in\s+browser|online)|unsubscribe|privacy\s+policy|sale\s+ends|ends\s+(?:today|tonight|soon)|free\s+shipping|%\s*off|save\s+up\s+to|deals?|click\s+here|sign\s+up|follow\s+us|newsletter|copyright|all\s+rights\s+reserved|customer\s+service|contact\s+us)\b/i;
const FUNCTION_WORDS = /\b(?:the|is|are|was|were|your|our|we|you|this|that|these|those|will|have|has|been|here|it|they|can)\b/gi;
// Lines that end the list of products: the order summary.
const STOP =
  /^(?:sub-?total|order\s+(?:total|summary)|grand\s+total|total|shipping|tax|sales\s+tax|discount|payment|billing|ship(?:ping)?\s+(?:to|address|method)|bill(?:ing)?\s+(?:to|address)|estimated|fees?)\b/i;

function looksLikeProse(title) {
  const words = title.split(/\s+/).length;
  if (NOISE.test(title) || words > 24) return true;
  if ((title.match(FUNCTION_WORDS) || []).length >= 2) return true;
  return words >= 6 && /[a-z]{2,}[.!?](?:\s|$)/i.test(title);
}

/**
 * The product title in a cell: without prices, quantities, cost per round notes, part numbers, bullets and labels.
 * @param {string} cell
 * @returns {string}
 */
export function cleanTitle(cell) {
  return String(cell || "")
    .replace(QTY_PREFIX, "")
    .replace(/^\s*(?:[•*·▪►▸◦–—-]|\d{1,2}[.)])\s+/, "")
    .replace(/^\s*(?:product|item|description|name)\s*:\s*/i, "")
    .replace(/\(?\s*(?:\$\s?\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*¢)\s*(?:\/\s*(?:rd|rnd|round|shell)|per\s+(?:rd|rnd|round|shell))\s*\)?/gi, " ")
    .replace(/\b(?:cpr|cost\s+per\s+round)\s*:?\s*\$?\d+(?:\.\d+)?¢?/gi, " ")
    .replace(PRICE, " ")
    .replace(MPN, " ")
    .replace(/\b(?:sku|item\s*#|item\s+no\.?)\s*[:#]?\s*[A-Z0-9-]{3,}\b/gi, " ")
    .replace(new RegExp(QTY_LABEL.source, "gi"), " ")
    .replace(/(^|[^\d.\s])\s*[×✕]\s*\d{1,4}\b/g, "$1 ")
    .replace(QTY_PAREN, " ")
    .replace(/(^|[^\d.\s])\s+x\s*\d{1,4}\s*$/i, "$1")
    .replace(/\(\s*(?:reg\.?|regular|was|msrp|list|retail|orig\.?|save|now|only)?\s*:?\s*\)/gi, " ") // "(reg. )" left by a removed price
    .replace(
      /(?:\s|[|:;,–—\-/(]|\b(?:sale|now|only|was|reg|regular|price|msrp|each|ea|just|from|save|you|off|in\s+stock)\b\.?)+$/i,
      "",
    )
    .replace(/^[\s|:;,–—-]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Read one cell as a possible product title. Returns null when it is not a gun or ammo title.
 * "strong" titles are products on their own; the others (a caliber and nothing else) count only with a price.
 * @param {string} cell
 * @param {{lenient?: boolean, mpn?: string}} [opts] lenient: for text the user selected, skip the boilerplate checks
 */
export function readTitle(cell, opts = {}) {
  if (String(cell).length > MAX_TITLE + 100) return null; // a paragraph
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(String(cell).trim())) return null; // a bare link
  const title = cleanTitle(cell);
  if (title.length < 4 || title.length > MAX_TITLE || !/[a-z]/i.test(title)) return null;
  let info = parseTitle(title, opts.mpn ? { mpn: opts.mpn } : {});
  if (info.kind === "firearm" && !info.model && MORE_AMMO.test(title)) info = parseTitle(title, { kind: "ammo" });
  const hasModel = Boolean(info.model);
  const hasCaliber = info.calibers.length > 0;
  // In a message a product needs a model or a caliber ("Box of 20 rounds" alone is a detail line). In a selection,
  // a round count is enough.
  if (!hasModel && !hasCaliber && !(opts.lenient && info.kind === "ammo" && info.rounds)) return null;
  const strong =
    hasModel ||
    (info.kind === "ammo" && Boolean(info.rounds)) ||
    (info.kind === "firearm" && hasCaliber && Boolean(info.capacity || info.barrelLength || FIREARM_WORD.test(title)));
  if (opts.lenient) return { title, info, strong: true, prose: false, accessory: false };
  // Gear is not listed, but it is a product line: it ends the lines that belong to the product above it.
  if (!hasModel && !(info.kind === "ammo" && info.rounds) && ACCESSORY.test(title)) {
    return { title, info, strong: true, prose: false, accessory: true };
  }
  return { title, info, strong, prose: looksLikeProse(title), accessory: false };
}

// --- items ---------------------------------------------------------------------------------------------------------

function round2(x) {
  return Math.round(x * 100) / 100;
}

/**
 * Price of one item from the amounts found around a title. An amount labeled as a unit price wins. With a quantity
 * above 1, a single unlabeled amount is taken as the line total and divided by the quantity, the way most order
 * confirmations show it. Several unlabeled amounts without a quantity are an old and a new price: the lower one is
 * the price.
 */
export function resolvePrice(prices, quantity) {
  const q = quantity && quantity > 1 ? quantity : 1;
  const unit = prices.find((p) => p.kind === "unit");
  if (unit) return unit.value;
  const plain = prices.filter((p) => p.kind === "plain").map((p) => p.value);
  if (plain.length) {
    const lo = Math.min(...plain);
    const hi = Math.max(...plain);
    if (q === 1) return lo;
    if (plain.length > 1 && Math.abs(hi - lo * q) <= 0.011 * q) return lo; // unit price and line total
    return plain.length === 1 ? round2(hi / q) : lo;
  }
  const total = prices.find((p) => p.kind === "total");
  return total ? round2(total.value / q) : null;
}

function splitCells(line) {
  return line
    .split(CELL_SPLIT)
    .map((c) => c.trim())
    .filter(Boolean);
}

function makeItem(found, { price, quantity, mpn, extraCalibers }) {
  let info = found.info;
  if (mpn && !info.model && info.kind === "firearm") {
    const again = parseTitle(found.title, { mpn });
    if (again.model) info = again;
  }
  const calibers = info.calibers.length ? info.calibers : extraCalibers || [];
  return {
    title: found.title,
    kind: info.kind,
    brand: info.brand || "",
    model: info.model ? info.model.model : "",
    calibers: calibers.map((c) => ({ name: c.name, type: c.type, url: c.url })),
    capacity: info.capacity,
    barrelLength: info.barrelLength,
    rounds: info.rounds,
    quantity: quantity || null,
    price: price == null ? null : price,
    costPerRound: info.kind === "ammo" && price != null ? costPerRound(price, info.rounds) : null,
  };
}

function itemKey(title) {
  return title.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
}

/**
 * Find gun and ammo products in the text of an email.
 * @param {string} text plain text, or the output of htmlToText()
 * @param {{maxItems?: number}} [opts]
 * @returns {Item[]}
 *
 * @typedef {{name: string, type: string, url: string}} Caliber
 * @typedef {{title: string, kind: "firearm" | "ammo", brand: string, model: string, calibers: Caliber[],
 *   capacity: number | null, barrelLength: number | null, rounds: number | null, quantity: number | null,
 *   price: number | null, costPerRound: number | null}} Item
 */
export function extractItems(text, opts = {}) {
  const maxItems = opts.maxItems || MAX_ITEMS;
  const lines = normalizeText(text).split("\n").slice(0, MAX_LINES);
  const rows = lines.map(splitCells);
  const reads = rows.map((cells) => cells.map((c) => readTitle(c)));
  const items = [];
  const byKey = new Map();
  const consumed = new Set();

  const add = (item) => {
    const key = itemKey(item.title);
    const prev = byKey.get(key);
    if (prev) {
      // the same product twice (a link and its text, a preview line): keep the first, fill in what it lacks
      for (const k of ["price", "quantity", "costPerRound"]) if (prev[k] == null && item[k] != null) prev[k] = item[k];
      return;
    }
    byKey.set(key, item);
    items.push(item);
  };

  for (let i = 0; i < rows.length && items.length < maxItems; i++) {
    if (consumed.has(i)) continue;
    const found = [];
    reads[i].forEach((r, cell) => r && !r.accessory && found.push({ ...r, cell }));
    if (!found.length) continue;

    // Lines below that belong to this row: until the next product title or the order summary.
    // A weak title (a caliber alone) stops at any title, so a heading such as "9mm Ammo" never takes the price
    // of the product listed under it.
    const anyStrong = found.some((f) => f.strong);
    const below = [];
    for (let j = i + 1; j < rows.length && below.length < WINDOW; j++) {
      const next = reads[j];
      if (next.some((r) => r && (r.strong || !anyStrong)) || STOP.test(rows[j][0] || "")) break;
      below.push(j);
    }

    const accepted = [];
    if (found.length === 1) {
      const f = found[0];
      const sameRow = rows[i].join("\t");
      const others = rows[i].filter((_, k) => k !== f.cell);
      const belowText = below.map((j) => rows[j].join("\t"));
      // The price is on the title's own line, or else on the first line below that has one. Lines further down
      // may already be about the next item (gear, a fee) that is not recognized as a product.
      const rowPrices = findPrices(sameRow);
      const prices = rowPrices.length ? rowPrices : belowText.map(findPrices).find((p) => p.length) || [];
      let quantity = findQuantity(rows[i][f.cell]);
      for (const t of others.concat(belowText)) {
        if (quantity) break;
        quantity = findQuantity(t) || (QTY_ALONE.test(t) ? parseInt(t, 10) : null);
      }
      const mpnMatch = MPN.exec([sameRow, ...belowText].join("\n"));
      const extraCalibers = below.flatMap((j) => reads[j].flatMap((r) => (r && !r.accessory ? r.info.calibers : [])));
      const price = resolvePrice(prices, quantity);
      if (f.prose && !rowPrices.length) continue;
      if (!f.strong && price == null) continue;
      accepted.push(makeItem(f, { price, quantity, mpn: mpnMatch && mpnMatch[1], extraCalibers }));
    } else {
      // Several titles side by side (a product grid): each takes the prices in its own column.
      const aligned = below.filter((j) => rows[j].length === rows[i].length);
      for (const f of found) {
        const rowPrices = findPrices(rows[i][f.cell]);
        const prices = rowPrices.length
          ? rowPrices
          : aligned.map((j) => findPrices(rows[j][f.cell])).find((p) => p.length) || [];
        const price = resolvePrice(prices, null);
        if (f.prose && !rowPrices.length) continue;
        if (!f.strong && price == null) continue;
        accepted.push(makeItem(f, { price, quantity: null }));
      }
    }
    if (accepted.length) {
      accepted.forEach(add);
      below.forEach((j) => consumed.add(j));
    }
  }
  return items.slice(0, maxItems);
}

/**
 * Find products in the inline text parts of a message (messenger.messages.listInlineTextParts). Every part is read;
 * the part that gives the most products wins (an email usually has the same content as text/plain and text/html).
 * @param {{contentType: string, content: string}[]} parts
 * @returns {Item[]}
 */
export function extractFromParts(parts) {
  let best = [];
  let bestScore = -1;
  for (const part of parts || []) {
    const type = String(part.contentType || "").toLowerCase();
    const text = type.includes("html") ? htmlToText(part.content) : String(part.content || "");
    const items = extractItems(text);
    const score = items.length * 10 + items.filter((it) => it.price != null).length;
    if (score > bestScore) {
      best = items;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Read text the user selected. Several products are listed like in a message. If none is found, the whole
 * selection is read as one title, without the checks for email boilerplate: the user picked it.
 * @param {string} text
 * @returns {Item[]}
 */
export function parseSelection(text) {
  const items = extractItems(text);
  if (items.length) return items;
  const one = normalizeText(text).replace(/\s+/g, " ").trim().slice(0, 400);
  if (!one) return [];
  const found = readTitle(one, { lenient: true });
  if (!found) return [];
  const quantity = findQuantity(one);
  return [makeItem(found, { price: resolvePrice(findPrices(one), quantity), quantity })];
}
