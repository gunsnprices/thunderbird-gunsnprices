import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  cleanTitle,
  extractFromParts,
  extractItems,
  findPrices,
  findQuantity,
  parseSelection,
  resolvePrice,
} from "../extension/lib/extract.js";
import { htmlToText } from "../extension/lib/html-to-text.js";

const fixture = (name) => readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8");

/** The fields that matter, in a form that is easy to compare. */
function brief(items) {
  return items.map((it) => ({
    title: it.title,
    kind: it.kind,
    model: it.model,
    caliber: it.calibers.map((c) => c.name).join(" / "),
    capacity: it.capacity,
    barrel: it.barrelLength,
    rounds: it.rounds,
    qty: it.quantity,
    price: it.price,
    cpr: it.costPerRound,
  }));
}

const ORDER = [
  {
    title: "Federal American Eagle 9mm Luger 115gr FMJ 50 Rounds",
    kind: "ammo",
    model: "",
    caliber: "9×19mm Parabellum",
    capacity: null,
    barrel: null,
    rounds: 50,
    qty: 4,
    price: 18.99,
    cpr: 0.3798,
  },
  {
    title: 'Glock 19 Gen 5 MOS 9mm 4.02" 15rd Pistol PA195S203MOS',
    kind: "firearm",
    model: "Glock 19 Gen 5 MOS",
    caliber: "9×19mm Parabellum",
    capacity: 15,
    barrel: 4.02,
    rounds: null,
    qty: 1,
    price: 619.99,
    cpr: null,
  },
  {
    title: "CCI Mini-Mag 22 LR 40gr Copper-Plated Round Nose 100 Rounds",
    kind: "ammo",
    model: "",
    caliber: ".22 LR",
    capacity: null,
    barrel: null,
    rounds: 100,
    qty: 2,
    price: 11.99, // line total $23.98 for 2
    cpr: 0.1199,
  },
  // The Magpul magazine is gear, not a gun or ammo, and is left out. So are the order summary and the address
  // ("1911 Elm St, Springfield").
];

test("order confirmation, HTML part: items, quantities, unit prices, cost per round", () => {
  assert.deepEqual(brief(extractItems(htmlToText(fixture("order-confirmation.html")))), ORDER);
});

test("order confirmation, plain text part with columns aligned by spaces", () => {
  assert.deepEqual(brief(extractItems(fixture("order-confirmation.txt"))), ORDER);
});

test("receipt with labeled fields (Item / Price / Qty / Total)", () => {
  assert.deepEqual(brief(extractItems(fixture("receipt-labeled.txt"))), [
    {
      title: "Hornady Critical Defense 380 ACP 90gr FTX 25/Box",
      kind: "ammo",
      model: "",
      caliber: ".380 ACP",
      capacity: null,
      barrel: null,
      rounds: 25,
      qty: 3,
      price: 26.99,
      cpr: 1.0796,
    },
    {
      title: 'Remington 870 Express 12 Gauge 28" Pump Shotgun',
      kind: "firearm",
      model: "Remington 870 Express",
      caliber: "12 Gauge",
      capacity: null,
      barrel: 28,
      rounds: null,
      qty: 1,
      price: 449,
      cpr: null,
    },
    {
      // the parser alone reads "5 Rounds" as a magazine capacity; "00 Buck" makes it ammo
      title: 'Federal Premium 12 Gauge 2-3/4" 00 Buck 9 Pellets 5 Rounds',
      kind: "ammo",
      model: "",
      caliber: "12 Gauge",
      capacity: null,
      barrel: null,
      rounds: 5,
      qty: 10,
      price: 7.49,
      cpr: 1.498,
    },
  ]);
});

const NEWSLETTER = [
  ["Winchester USA 9mm Luger 115 Grain FMJ 100 Round Value Pack", "", "9×19mm Parabellum", 100, 27.99, 0.2799],
  ["Speer Gold Dot 45 ACP 230gr JHP 50/Box", "", ".45 ACP", 50, 39.99, 0.7998],
  ["PMC X-TAC 5.56x45mm NATO 55gr FMJ 20 Rounds", "", "5.56×45mm NATO", 20, 10.49, 0.5245],
  ["Hornady American Whitetail 308 Win 150gr InterLock SP 20rd Box", "", ".308 Win", 20, 29.99, 1.4995],
  ['Glock 19 Gen 5 9mm 4.02" Barrel 15 Rounds', "Glock 19 Gen 5", "9×19mm Parabellum", null, 529.99, null],
  ['Smith & Wesson M&P9 Shield Plus 9mm 3.1" 13rd', "S&W M&P Shield Plus", "9×19mm Parabellum", null, 449.99, null],
  [
    'Ruger 10/22 Carbine .22 LR 18.5" Barrel 10 Round Rotary Magazine Blued',
    "Ruger 10/22 Carbine",
    ".22 LR",
    null,
    279.99,
    null,
  ],
];

function newsletterBrief(items) {
  return brief(items).map((it) => [it.title, it.model, it.caliber, it.rounds, it.price, it.cpr]);
}

test("deal newsletter, HTML: old prices struck through, rebates, grid of cards, boilerplate ignored", () => {
  assert.deepEqual(newsletterBrief(extractItems(htmlToText(fixture("newsletter.html")))), NEWSLETTER);
});

test("deal newsletter, plain text: was/now, (reg. $x), cost per round notes, bullets, ' | ' columns", () => {
  assert.deepEqual(newsletterBrief(extractItems(fixture("newsletter.txt"))), NEWSLETTER);
});

test("firearm specs in the newsletter", () => {
  const glock = extractItems(fixture("newsletter.txt")).find((it) => it.model === "Glock 19 Gen 5");
  assert.equal(glock.kind, "firearm");
  assert.equal(glock.brand, "Glock");
  assert.equal(glock.capacity, 15);
  assert.equal(glock.barrelLength, 4.02);
  assert.equal(glock.calibers[0].url, "https://gunsnprices.com/ammo/handgun-ammo/9-19mm-parabellum");
});

test("extractFromParts picks the part with more products and handles text/html", () => {
  const parts = [
    { contentType: "text/plain", content: "Your order has shipped. Tracking: 1Z999" },
    { contentType: "text/html", content: fixture("order-confirmation.html") },
  ];
  assert.deepEqual(brief(extractFromParts(parts)), ORDER);
  assert.deepEqual(extractFromParts([]), []);
});

test("emails without guns or ammo give nothing", () => {
  const text = [
    "Hi Sam,",
    "Your Pro plan renews on 12/01 for $9.99/month. Upgrade to Team for $19.99.",
    "Thanks for being a customer! Shop now and save up to 40% off.",
    "Order #1911 shipped to 1911 Elm St, Springfield, IL 62701.",
    "Your Glock 19 has shipped to your FFL dealer.",
    "Looking for 9mm? Shop all handgun ammo deals from $14.99.",
    "9mm Ammo",
    "Magpul PMAG 30 AR/M4 GEN M3 5.56x45 30rd Magazine $14.95",
    "https://example.com/p/winchester-9mm-100",
  ].join("\n");
  assert.deepEqual(extractItems(text), []);
});

test("a heading with a caliber does not take the price of the product under it", () => {
  const items = extractItems("9mm Ammo\nFederal American Eagle 9mm 115gr FMJ\n$18.99");
  assert.deepEqual(
    items.map((it) => [it.title, it.price]),
    [["Federal American Eagle 9mm 115gr FMJ", 18.99]],
  );
});

test("the same product listed twice is shown once", () => {
  const items = extractItems("Federal 9mm 115gr FMJ 50 Rounds\nFederal 9mm 115gr FMJ 50 Rounds $18.99");
  assert.equal(items.length, 1);
  assert.equal(items[0].price, 18.99);
});

test("findPrices: labels, old prices, savings, thresholds, cost per round", () => {
  assert.deepEqual(findPrices("Was $34.99 - Now $27.99 ($0.28/rd)"), [{ value: 27.99, kind: "unit" }]);
  assert.deepEqual(findPrices("Price: $1,299.99"), [{ value: 1299.99, kind: "unit" }]);
  assert.deepEqual(findPrices("Total: $80.97"), [{ value: 80.97, kind: "total" }]);
  assert.deepEqual(findPrices("$449.99 after $50 mail-in rebate"), [{ value: 449.99, kind: "plain" }]);
  assert.deepEqual(findPrices("Free shipping on orders over $99. Save $5. Discount -$5.00"), []);
  assert.deepEqual(findPrices("$18.99/box"), [{ value: 18.99, kind: "unit" }]);
  assert.deepEqual(findPrices("USD 18.99"), [{ value: 18.99, kind: "plain" }]);
});

test("findQuantity: labels, multiplication signs, prefixes; not dimensions", () => {
  assert.equal(findQuantity("Qty: 3"), 3);
  assert.equal(findQuantity("Quantity 12"), 12);
  assert.equal(findQuantity("Federal 9mm 50 Rounds × 4"), 4);
  assert.equal(findQuantity("2 x Federal 9mm 50 Rounds"), 2);
  assert.equal(findQuantity("Federal 9mm (x2)"), 2);
  assert.equal(findQuantity("2 @ $18.99"), 2);
  assert.equal(findQuantity("Wolf 7.62 x 39 122gr FMJ 20rd"), null);
  assert.equal(findQuantity("PMC 5.56×45mm 55gr"), null);
});

test("resolvePrice: unit label wins, line totals are divided by the quantity, sale beats old price", () => {
  assert.equal(resolvePrice([{ value: 37.98, kind: "plain" }], 2), 18.99);
  assert.equal(resolvePrice([{ value: 18.99, kind: "plain" }, { value: 37.98, kind: "plain" }], 2), 18.99);
  assert.equal(resolvePrice([{ value: 18.99, kind: "unit" }, { value: 37.98, kind: "total" }], 2), 18.99);
  assert.equal(resolvePrice([{ value: 80.97, kind: "total" }], 3), 26.99);
  assert.equal(resolvePrice([{ value: 24.99, kind: "plain" }, { value: 18.99, kind: "plain" }], null), 18.99);
  assert.equal(resolvePrice([], 2), null);
});

test("cleanTitle removes prices, quantities, cost per round notes and labels", () => {
  assert.equal(cleanTitle("Speer Gold Dot 45 ACP 230gr JHP 50/Box - $39.99 (reg. $44.99)"), "Speer Gold Dot 45 ACP 230gr JHP 50/Box");
  assert.equal(cleanTitle("* PMC X-TAC 5.56x45mm 55gr FMJ 20 Rounds: $10.49 ($0.52/rd)"), "PMC X-TAC 5.56x45mm 55gr FMJ 20 Rounds");
  assert.equal(cleanTitle("Item: Federal 9mm 50 Rounds × 4"), "Federal 9mm 50 Rounds");
  assert.equal(cleanTitle("2 x Federal 9mm 50 Rounds"), "Federal 9mm 50 Rounds");
  assert.equal(cleanTitle("1. Glock 19 Gen 5 9mm | Price: $529.99"), "Glock 19 Gen 5 9mm");
  assert.equal(cleanTitle("Wolf 7.62 x 39 122gr FMJ 20rd"), "Wolf 7.62 x 39 122gr FMJ 20rd");
});

test("parseSelection: one title, with or without a price", () => {
  const [glock] = parseSelection("Glock 19 Gen5 MOS 9mm 15rd");
  assert.equal(glock.model, "Glock 19 Gen 5 MOS");
  assert.equal(glock.capacity, 15);

  const [ammo] = parseSelection("Federal American Eagle 5.56x45mm 55gr FMJ 1000 Rounds $449.99");
  assert.equal(ammo.kind, "ammo");
  assert.equal(ammo.rounds, 1000);
  assert.equal(ammo.price, 449.99);
  assert.equal(ammo.costPerRound, 0.45);
});

test("parseSelection: lenient for text the user picked, empty for text without specs", () => {
  // "Thanks" would mark this as boilerplate in a message, but the user selected it
  const [it] = parseSelection("Thanks! 9mm 115gr FMJ, 50 rounds");
  assert.equal(it.calibers[0].name, "9×19mm Parabellum");
  assert.equal(it.rounds, 50);
  assert.deepEqual(parseSelection("Gift card $50"), []);
  assert.deepEqual(parseSelection("   "), []);
});

test("parseSelection: several lines give several items", () => {
  const items = parseSelection(fixture("order-confirmation.txt"));
  assert.equal(items.length, 3);
});

test("large input stays bounded", () => {
  const line = "Federal American Eagle 9mm Luger 115gr FMJ 50 Rounds $18.99";
  const text = Array.from({ length: 400 }, (_, i) => `${line} #${i}`).join("\n");
  const items = extractItems(text);
  assert.ok(items.length <= 100);
  assert.ok(items.length > 0);
});

/** The inline text parts of a sample .eml, like messenger.messages.listInlineTextParts() returns them. */
function emlParts(name) {
  const raw = fixture(name).replace(/\r\n/g, "\n");
  const boundary = /boundary="([^"]+)"/.exec(raw)[1];
  return raw
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((chunk) => {
      const [head, ...body] = chunk.replace(/^\n/, "").split("\n\n");
      return { contentType: /Content-Type:\s*([^;\s]+)/i.exec(head)[1], content: body.join("\n\n") };
    });
}

test("sample .eml files (to open in Thunderbird) give the same items as their parts", () => {
  const order = emlParts("sample-order.eml");
  assert.deepEqual(order.map((p) => p.contentType), ["text/plain", "text/html"]);
  assert.deepEqual(brief(extractFromParts(order)), ORDER);
  assert.deepEqual(newsletterBrief(extractFromParts(emlParts("sample-newsletter.eml"))), NEWSLETTER);
});
