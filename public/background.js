chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

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
