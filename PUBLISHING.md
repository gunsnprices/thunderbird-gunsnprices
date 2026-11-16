# Publishing

How this add-on gets to addons.thunderbird.net (ATN), the texts for the listing, and how to release new versions.

## ATN rules and how this add-on meets them

Checked on 2026-11-16 in the [ATN review policy](https://thunderbird.github.io/atn-review-policy/), the
[Thunderbird WebExtension API docs](https://webextension-api.thunderbird.net/en/mv3/) and the ATN server code
([thunderbird/addons-server](https://github.com/thunderbird/addons-server), branch `stage-eks`).

| Rule | Here |
|---|---|
| Manifest V3 is supported since Thunderbird 128 ESR. Current versions: 153 ESR (July 2026; 140 ESR support ended in September 2026) and the monthly release channel (API docs for 159). | `manifest_version: 3`, `strict_min_version: "140.0"`, no `strict_max_version` |
| MV3 add-ons need `browser_specific_settings.gecko.id`. It identifies the add-on on ATN and must never change. | `thunderbird@gunsnprices.com` |
| `message_display_action` is the MV3 key for a button in the message header. In MV3, `messageDisplay.getDisplayedMessages(tabId)` returns a `MessageList`. | `manifest.json`, `popup/popup.js` |
| `messages.listInlineTextParts()` (Thunderbird 128+) needs `messagesRead`. | the only data permission |
| Request only the permissions the add-on needs. Access to messages means a manual review. | `messagesRead`, `menus`; no host permissions |
| Self-contained: no remote code, no experiments when a WebExtension API exists. | no network code at all (a test checks for `fetch`, `XMLHttpRequest`, `eval` ...), no experiments |
| Minified, bundled or generated code needs the human-readable source and build instructions. Open source third-party libraries are exempt. | No build step: the .xpi is a zip of `extension/` as committed. The parser is an open source library |
| Third-party libraries: release versions only, not modified. | `gunsnprices` 0.1.2 from npm, copied unchanged; SHA-256 of every file in `extension/vendor/SOURCES.txt`; CI re-copies it and fails on any difference |
| Data collection only with consent and a privacy policy (full text, not a link). The listing must say what data is collected. | Collects nothing; the description says so; an optional policy text is below |
| Must not hurt Thunderbird's performance. | Runs only on a click; at most 10 messages, and 3,000 lines and 100 products per message; under 0.1 s for the sample emails including loading the parser, about 1 s for a 3,000-line email |
| Answer reviewer questions within 10 days. | |
| Uploads are validated with addons-linter `~6.15.0` (`package.json` of addons-server). | 0 errors, 1 warning: `messagesRead` is unknown to the Firefox schemas, as for every add-on that reads messages |

Firefox-only rules that do not apply: `data_collection_permissions` is required for new Firefox add-ons, but the
feature is disabled in Thunderbird (Mozilla bug 1987828), so the key is not in the manifest. Current `web-ext lint`
reports it as a warning (`MISSING_DATA_COLLECTION_PERMISSIONS`); the ATN linter does not.

### Listing fields (from the ATN submission forms)

- Submission step "Describe": name (max 50), URL slug (max 30), summary (max 250), description, "experimental",
  "requires payment", up to 2 categories, support email, support website, license, privacy policy, notes to reviewer.
- After submission, in "Edit Product Page": **Additional Details** has the homepage, up to 20 tags and a
  contributions URL; **Media** has the icon and screenshots.
- The listing page shows the homepage as an **Add-on home page** link in the sidebar, next to **Support site** and
  **Support E-mail** (template `addons/impala/details.html`). The live pages are behind a bot check, so this was read
  from the code, not from a live page.

## Listing texts

**Name** (29 characters)

```
GunsNPrices: Gun & Ammo Specs
```

**URL slug**

```
gunsnprices
```

**Summary** (219 characters)

```
Finds gun and ammo products in an email, such as an order confirmation or a deal newsletter, and shows caliber, model, magazine capacity, barrel length, rounds per box and cost per round. Works offline; nothing is sent.
```

If the form limits name and summary to 70 characters together, use: `Gun and ammo specs from emails, offline.`

**Description**

```
Click the "Gun & ammo specs" button above a message to see the gun and ammunition products in it, with their specs. It is made for order confirmations, receipts and deal newsletters from gun and ammo stores.

For each product the table shows:
- firearm or ammo, the model (50 brands) and the caliber (293 calibers);
- magazine capacity and barrel length for firearms;
- rounds per box, quantity, price and cost per round for ammo.

Old prices, savings, rebates and shipping amounts are not taken as prices. When an order shows a line total for several boxes, it is divided by the quantity.

Select a product title in a message or in the compose editor, right-click it and choose "Parse gun/ammo title" to read it on its own. "Copy" puts a spec line on the clipboard to paste into a message, for example "Glock 19 Gen 5 MOS, 9×19mm Parabellum, 15-round magazine, 4.02-inch barrel". "Copy table" copies all rows for a spreadsheet.

Privacy: the add-on reads the displayed message only when you click its button, and selected text only when you choose the menu item. Everything is processed on your computer. It makes no network requests, stores nothing and collects no data. Caliber names link to the GunsNPrices price page for that caliber; links open in your browser only when you click them.

It uses the open source title parser of GunsNPrices (gunsnprices.com), a US gun and ammo price comparison site. It reads titles from US stores in English, with prices in US dollars.

Source code: https://github.com/gunsnprices/thunderbird-gunsnprices
```

**Categories**: Message and News Reading; Message Composition

**Tags**: `ammo, ammunition, firearms, guns, caliber, cost per round, order confirmation, newsletter`

**Homepage**: https://gunsnprices.com/developers

**Support website**: https://github.com/gunsnprices/thunderbird-gunsnprices/issues

**Support email**: app@gunsnprices.com

**License**: MIT/X11 License (the bundled caliber and model data are CC BY 4.0; both are in the repository)

**Privacy policy**: not required, since nothing is collected. If you want to add one, the full text:

```
GunsNPrices: Gun & Ammo Specs does not collect, store or transmit any data. It reads the displayed message only when you click its button, and text you selected only when you choose its context menu item. The text is processed inside Thunderbird on your computer and is discarded when the popup or window closes. The add-on makes no network requests. Links to gunsnprices.com and to the license open in your web browser only when you click them.
```

**Notes to reviewer**

```
- No build step. The .xpi is a zip of the extension/ folder of https://github.com/gunsnprices/thunderbird-gunsnprices (tag v1.0.0). Nothing is bundled, transpiled or minified.
- vendor/gunsnprices/ is an unmodified copy of the open source npm package gunsnprices 0.1.2 (MIT, data CC BY 4.0): https://registry.npmjs.org/gunsnprices/-/gunsnprices-0.1.2.tgz, source https://github.com/gunsnprices/gunsnprices-js. vendor/SOURCES.txt lists the SHA-256 of every file. To check: npm pack gunsnprices@0.1.2 && tar xzf gunsnprices-0.1.2.tgz && diff -r package/src vendor/gunsnprices/src. The files in src/data/ are the library's data (model dictionaries, caliber list, HTML entity table) as one-line object literals, generated by the library from its Python package (see the header comment of each file).
- Permissions: messagesRead reads the inline text parts (messages.listInlineTextParts) of the displayed message, only when the user clicks the message display action. menus adds one context menu item for selected text.
- No network requests, no storage, no remote code, no experiments. Links open with windows.openDefaultBrowser only when clicked.
- To test: open https://github.com/gunsnprices/thunderbird-gunsnprices/blob/v1.0.0/test/fixtures/sample-order.eml with File > Open > Saved Message and click "Gun & ammo specs" in the message header: three products (Federal 9mm, Glock 19, CCI 22 LR) with quantities, unit prices and cost per round. Then select a product title, right-click it and choose "Parse gun/ammo title".
- Unit tests: npm ci && npm test (Node 22).
```

**Release notes for 1.0.0**

```
First release.
```

**Screenshots**: `screenshots/popup-order-confirmation.png`, `screenshots/popup-newsletter.png`,
`screenshots/selection-window.png`. These are renders of the popup's HTML in a browser with the sample emails
(`tools/preview/`), not captures of Thunderbird. Replace them with screenshots taken in Thunderbird when possible.

## Upload steps

Needs an account on addons.thunderbird.net, signed in. Nothing has been uploaded yet.

1. Build and test: `npm ci && npm test && npm run build -- --source`. This gives
   `dist/gunsnprices-thunderbird-1.0.0.xpi` and `dist/thunderbird-gunsnprices-1.0.0-source.zip` (git archive of HEAD;
   build it from the `v1.0.0` tag).
2. Open https://addons.thunderbird.net/en-US/developers/addon/submit/ and accept the developer agreement if asked.
3. **How to Distribute this Version**: "On this site". Continue.
4. **Upload Version**: choose `gunsnprices-thunderbird-1.0.0.xpi`, wait for the validation (expected: 0 errors,
   1 warning about `messagesRead`), check that Thunderbird is ticked under compatible applications. Continue.
5. **Do You Need to Submit Source Code?**: No (no minifier, bundler, template engine or other generator is used).
   If a reviewer asks for it later, upload `thunderbird-gunsnprices-1.0.0-source.zip`; its README has the build
   steps.
6. **Describe Add-on**: name, slug, summary, description, categories, support email, support website, license and
   notes to reviewer from the texts above. Leave "experimental" and "requires payment" unticked. Privacy policy:
   leave empty or paste the text above. Submit.
7. **Edit Product Page**: in Additional Details set the homepage `https://gunsnprices.com/developers` and the tags;
   in Media add the screenshots (the icon comes from the .xpi).
8. Wait for the review. Reply to reviewer messages within 10 days.

## Releasing a new version

1. Make the change, add tests, update `CHANGELOG.md`.
2. Bump `version` in `extension/manifest.json` and `package.json` (a test checks that they match).
3. `npm test && npm run build`, commit, tag `vX.Y.Z`, push with the tag.
4. On ATN: the add-on's page in the Developer Hub, "Upload New Version", the new .xpi, release notes from the
   changelog.

## Updating the bundled parser

1. `npm install gunsnprices@<version> --save-dev --save-exact`
2. `npm run vendor` (copies the files and rewrites `extension/vendor/SOURCES.txt`)
3. `npm test`, then update the version in the notes to reviewer and in `CHANGELOG.md`.
