// Handle clicks on the extension toolbar icon to open the side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "open_side_panel") {
    // Programmatically open the side panel
    // Note: In Manifest V3, chrome.sidePanel.open requires a user gesture.
    // Clicking a button in the content script qualifies as a user gesture.
    chrome.sidePanel.open({ tabId: sender.tab.id, windowId: sender.tab.windowId }).catch((error) => {
      console.error("Failed to open side panel:", error);
    });
    sendResponse({ success: true });
  }
});
