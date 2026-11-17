chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "rea_selection") {
    if (typeof message.text === "string" && sender.tab?.id) {
      chrome.storage.session.set({ reaHighlightedText: message.text.slice(0, 4000) });
      chrome.runtime.sendMessage({ action: "rea_selection_available" }).catch(() => {});
    }
    return;
  }
  if (message.action === "get_rea_selection") {
    chrome.storage.session.get(["reaHighlightedText"], (result) => {
      sendResponse({ text: result.reaHighlightedText || "" });
      chrome.storage.session.remove("reaHighlightedText");
    });
    return true;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "open_side_panel" || !sender.tab?.id) return;

  chrome.sidePanel.open({ tabId: sender.tab.id, windowId: sender.tab.windowId })
    .then(() => sendResponse({ success: true }))
    .catch((error) => {
      console.error("Failed to open REA side panel:", error);
      sendResponse({ success: false });
    });
  return true;
});
