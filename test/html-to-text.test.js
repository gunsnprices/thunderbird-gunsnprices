import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlToText, normalizeText } from "../extension/lib/html-to-text.js";

test("table rows become lines and cells are separated by tabs", () => {
  const html = "<table><tr><td>Federal 9mm</td><td>2</td><td>$37.98</td></tr><tr><td>Subtotal</td><td>$37.98</td></tr></table>";
  assert.equal(htmlToText(html), "Federal 9mm\t2\t$37.98\nSubtotal\t$37.98");
});

test("block elements and <br> start new lines, inline elements do not", () => {
  assert.equal(htmlToText("<p>One <b>two</b></p><div>three<br>four</div>"), "One two\nthree\nfour");
});

test("line breaks in the HTML source are spaces", () => {
  assert.equal(htmlToText("<p>Federal\n   American Eagle\n9mm</p>"), "Federal American Eagle 9mm");
});

test("head, style, script, comments and hidden preview text are dropped", () => {
  const html =
    "<html><head><title>T</title><style>p{color:red}</style></head><body>" +
    "<!-- comment --><script>alert(1)</script>" +
    '<div style="display:none">Preview text</div>' +
    '<span style="mso-hide: all">Outlook only</span>' +
    "<p>Body</p></body></html>";
  assert.equal(htmlToText(html), "Body");
});

test("struck-through old prices are dropped", () => {
  assert.equal(htmlToText("<p><s>$34.99</s> $27.99</p>"), "$27.99");
  assert.equal(htmlToText("<p><del>$34.99</del> <strike>$30</strike> $27.99</p>"), "$27.99");
  assert.equal(htmlToText('<p><span style="text-decoration: line-through">$44.99</span> $39.99</p>'), "$39.99");
});

test("entities are decoded and invisible characters removed", () => {
  assert.equal(htmlToText("<p>Smith &amp; Wesson M&amp;P9&nbsp;&times;&nbsp;2 &#8212; 28.0&cent;/rd&zwnj;&#847;</p>"), "Smith & Wesson M&P9 × 2 — 28.0¢/rd");
  assert.equal(htmlToText('<p>4.02&quot; barrel</p>'), '4.02" barrel');
});

test("images are dropped, link text is kept", () => {
  assert.equal(htmlToText('<a href="https://example.com/p/1"><img alt="Logo" src="x.png">Federal 9mm</a>'), "Federal 9mm");
});

test("normalizeText: CRLF, no-break spaces, aligned columns, empty lines", () => {
  assert.equal(normalizeText("A\r\n\r\nB  C     $1.00\n\n"), "A\nB C\t$1.00");
  assert.equal(normalizeText(""), "");
  assert.equal(normalizeText(null), "");
});
