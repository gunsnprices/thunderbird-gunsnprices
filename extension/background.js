// Background script. It only adds the "Parse gun/ammo title" item to the context menu of selected text (in a
// displayed message and in the compose editor) and opens the result window. The parsing happens in that window
// (popup/popup.js), on this computer.
const api = globalThis.messenger || globalThis.browser;

const MENU_ID = "gunsnprices-parse-selection";
const MAX_SELECTION = 8000; // characters passed to the result window

async function createMenu() {
  await api.menus.removeAll();
  api.menus.create({
    id: MENU_ID,
    title: "Parse gun/ammo title",
    contexts: ["selection"],
  });
}

api.runtime.onInstalled.addListener(createMenu);
api.runtime.onStartup.addListener(createMenu);

api.menus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = String(info.selectionText || "").slice(0, MAX_SELECTION);
  const url = api.runtime.getURL("popup/popup.html") + "#selection=" + encodeURIComponent(text);
  await api.windows.create({ url, type: "popup", width: 820, height: 420 });
});
