import assert from "node:assert/strict";
import { test } from "node:test";
import { extractItems } from "../extension/lib/extract.js";
import { caliberText, formatCostPerRound, formatPrice, specLine, specsText, toTSV } from "../extension/lib/format.js";

const [ammo, glock] = extractItems(
  [
    "Federal American Eagle 9mm Luger 115gr FMJ 50 Rounds × 4    $75.96",
    'Glock 19 Gen 5 MOS 9mm 4.02" 15rd Pistol × 1    $619.99',
  ].join("\n"),
);

test("prices and cost per round", () => {
  assert.equal(formatPrice(1299.9), "$1,299.90");
  assert.equal(formatPrice(null), "");
  assert.equal(formatCostPerRound(0.3798), "38.0¢");
  assert.equal(formatCostPerRound(0.065), "6.5¢");
  assert.equal(formatCostPerRound(1.4995), "$1.50");
  assert.equal(formatCostPerRound(null), "");
});

test("spec lines to paste into a message", () => {
  assert.equal(specLine(glock), "Glock 19 Gen 5 MOS, 9×19mm Parabellum, 15-round magazine, 4.02-inch barrel");
  assert.equal(specLine(ammo), "9×19mm Parabellum, 50 rounds, 38.0¢ per round");
  assert.equal(specsText(glock), "15-round magazine, 4.02-inch barrel");
  assert.equal(caliberText(ammo), "9×19mm Parabellum");
});

test("tab-separated table", () => {
  const tsv = toTSV([ammo, glock]).split("\n");
  assert.equal(tsv[0], "Title\tType\tBrand\tModel\tCaliber\tCapacity\tBarrel (in)\tRounds\tQty\tPrice\tCost per round");
  assert.equal(
    tsv[1],
    "Federal American Eagle 9mm Luger 115gr FMJ 50 Rounds\tammo\t\t\t9×19mm Parabellum\t\t\t50\t4\t18.99\t0.3798",
  );
  assert.equal(
    tsv[2],
    'Glock 19 Gen 5 MOS 9mm 4.02" 15rd Pistol\tfirearm\tGlock\tGlock 19 Gen 5 MOS\t9×19mm Parabellum\t15\t4.02\t\t1\t619.99\t',
  );
  assert.equal(tsv[3], "");
});
