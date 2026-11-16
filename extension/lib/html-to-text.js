// Turns the HTML part of an email into plain text lines for extractItems().
//
// This is a text conversion, not an HTML renderer: nothing is loaded, nothing is executed, and the result is only
// ever shown with textContent. Table cells of one row stay on one line, separated by a tab, so that a product title
// and its price in the next cell can be read together. Block elements and <br> start a new line. Struck-through
// text (<s>, <del>, <strike>, style="text-decoration: line-through") is dropped, because in deal emails it is the
// old price.
import { unescapeHtml } from "../vendor/gunsnprices/src/util.js";

const BLOCK_TAGS =
  "address|article|aside|blockquote|br|caption|center|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|" +
  "h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|tfoot|thead|ul";

const DROP_WHOLE = [
  /<!--[\s\S]*?-->/g, // comments, including Outlook conditional comments
  /<head\b[\s\S]*?<\/head\s*>/gi,
  /<style\b[\s\S]*?<\/style\s*>/gi,
  /<script\b[\s\S]*?<\/script\s*>/gi,
  /<template\b[\s\S]*?<\/template\s*>/gi,
  /<title\b[\s\S]*?<\/title\s*>/gi,
  /<(s|strike|del)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, // old prices
  /<(span|font|div|p|td|a|b|strong)\b[^>]*line-through[^>]*>[^<]*<\/\1\s*>/gi, // old prices, styled
  /<(div|span|p|td|table)\b[^>]*(?:display\s*:\s*none|mso-hide\s*:\s*all)[^>]*>[\s\S]*?<\/\1\s*>/gi, // hidden preview text
];

/**
 * Convert an HTML email body to text. Rows of tables become lines, their cells are separated by "\t".
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  let s = String(html || "");
  for (const re of DROP_WHOLE) s = s.replace(re, " ");
  s = s.replace(/\s+/g, " "); // line breaks in the HTML source are spaces; tags decide the lines
  s = s.replace(/<\/t[dh]\s*>/gi, "\t"); // end of a cell
  s = s.replace(/<\/?tr\b[^>]*>/gi, "\n"); // start or end of a row
  s = s.replace(new RegExp(`<\\/?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n");
  s = s.replace(/<[^>]*>/g, ""); // every other tag is inline: drop it, keep its text
  s = unescapeHtml(s);
  return normalizeText(s);
}

/**
 * Clean up text: unify line breaks and spaces, remove invisible characters, trim every cell and drop empty lines.
 * Used for both text/plain parts and converted HTML.
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ") // no-break spaces
    .replace(/[­͏​-‍⁠﻿]/g, "") // soft hyphen, zero-width characters
    .replace(/ {3,}/g, "\t") // columns aligned with spaces in plain text emails
    .split("\n")
    .map((line) =>
      line
        .split("\t")
        .map((cell) => cell.replace(/[ \f\v]+/g, " ").trim())
        .filter(Boolean)
        .join("\t"),
    )
    .filter(Boolean)
    .join("\n");
}
