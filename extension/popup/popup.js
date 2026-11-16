// The popup of the "Gun & ammo specs" button in the message header, and the window opened by the
// "Parse gun/ammo title" context menu item (popup.html#selection=<text>).
//
// It reads the displayed message with messenger.messages.listInlineTextParts(), finds gun and ammo products with
// lib/extract.js and shows them in a table. Nothing is stored and nothing is sent: all parsing is local.
import { extractFromParts, parseSelection } from "../lib/extract.js";
import { caliberText, formatCostPerRound, formatPrice, specLine, specsText, toTSV } from "../lib/format.js";

const api = globalThis.messenger || globalThis.browser;
const MAX_MESSAGES = 10;

const $ = (id) => document.getElementById(id);

function setStatus(text) {
  $("status").textContent = text;
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

/** Open a link in the system browser. Links are only opened when the user clicks them. */
function openLink(url) {
  if (api && api.windows && api.windows.openDefaultBrowser) api.windows.openDefaultBrowser(url);
  else window.open(url, "_blank", "noopener");
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = el("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  const label = button.textContent;
  button.textContent = "Copied";
  setTimeout(() => {
    button.textContent = label;
  }, 1200);
}

function caliberCell(item) {
  const td = el("td");
  item.calibers.forEach((c, i) => {
    if (i) td.append(" / ");
    if (c.url) {
      const a = el("a", { href: c.url, title: `${c.name}: prices on GunsNPrices`, text: c.name });
      a.addEventListener("click", (event) => {
        event.preventDefault();
        openLink(c.url);
      });
      td.append(a);
    } else {
      td.append(c.name);
    }
  });
  return td;
}

function itemRow(item) {
  const sub = [];
  if (item.model && item.model !== item.title) sub.push(item.model);
  else if (item.brand && !item.model) sub.push(item.brand);
  const itemCell = el("td", {}, [
    el("span", { className: "title" }, [
      el("span", { className: "kind", text: item.kind === "ammo" ? "Ammo" : "Gun" }),
      item.title,
    ]),
  ]);
  if (sub.length) itemCell.append(el("span", { className: "sub", text: sub.join(" · ") }));

  const copy = el("button", { type: "button", title: "Copy the spec line", text: "Copy" });
  copy.addEventListener("click", () => copyText(specLine(item) || item.title, copy));

  return el("tr", {}, [
    itemCell,
    caliberCell(item),
    el("td", { text: specsText(item) }),
    el("td", { className: "num", text: item.quantity ? String(item.quantity) : "" }),
    el("td", { className: "num", text: formatPrice(item.price) }),
    el("td", { className: "num", text: formatCostPerRound(item.costPerRound) }),
    el("td", {}, [copy]),
  ]);
}

function showItems(items) {
  const tbody = $("items").querySelector("tbody");
  tbody.replaceChildren(...items.map(itemRow));
  $("items").hidden = items.length === 0;
  $("actions").hidden = items.length === 0;
  $("copy-table").onclick = (event) => copyText(toTSV(items), event.currentTarget);
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

async function readDisplayedMessages() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const shown = await api.messageDisplay.getDisplayedMessages(tab.id);
  // Manifest V3 returns a MessageList ({messages: [...]}); keep working if an array comes back.
  const messages = (Array.isArray(shown) ? shown : (shown && shown.messages) || []).slice(0, MAX_MESSAGES);
  const items = [];
  for (const message of messages) {
    const parts = await api.messages.listInlineTextParts(message.id);
    items.push(...extractFromParts(parts));
  }
  return { messages, items };
}

async function showMessage() {
  const { messages, items } = await readDisplayedMessages();
  if (!messages.length) {
    setStatus("No message is displayed.");
    return;
  }
  const where = messages.length === 1 ? `“${messages[0].subject || "(no subject)"}”` : plural(messages.length, "message");
  setStatus(
    items.length
      ? `${plural(items.length, "product")} in ${where}.`
      : `No gun or ammo products found in ${where}.`,
  );
  showItems(items);
  $("tip").hidden = items.length > 0;
}

function showSelection(text) {
  document.body.classList.add("window");
  document.title = "Gun & ammo specs: selected text";
  const items = parseSelection(text);
  setStatus(
    items.length
      ? `Selected text: ${plural(items.length, "product")}. Use "Copy" to paste a spec line into a message.`
      : "No gun or ammo specs found in the selected text.",
  );
  showItems(items);
}

for (const a of document.querySelectorAll("a[data-external]")) {
  a.addEventListener("click", (event) => {
    event.preventDefault();
    openLink(a.href);
  });
}

const selection = new URLSearchParams(location.hash.slice(1)).get("selection");
try {
  if (selection !== null) showSelection(selection);
  else await showMessage();
} catch (error) {
  setStatus(`Could not read the message: ${error && error.message ? error.message : error}`);
}
