(function() {
  // Cache an explicitly highlighted customer message for the side panel. Keep it in
  // session storage only; selections are never persisted across browser restarts.
  const captureSelection = () => {
    const active = document.activeElement;
    const value = typeof active?.value === "string" && Number.isInteger(active.selectionStart) && active.selectionEnd > active.selectionStart
      ? active.value.slice(active.selectionStart, active.selectionEnd)
      : window.getSelection?.();
    const text = String(value || "").trim().slice(0, 4000);
    if (text) chrome.runtime.sendMessage({ action: "rea_selection", text });
  };
  document.addEventListener("mouseup", captureSelection, true);
  document.addEventListener("keyup", (event) => {
    if (["Shift", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) captureSelection();
  }, true);

  // Check if button already exists
  if (document.getElementById("rea-floating-btn")) {
    return;
  }

  // Create floating button container
  const container = document.createElement("div");
  container.id = "rea-floating-btn-container";
  container.className = "rea-floating-wrapper";

  // Create button
  const btn = document.createElement("button");
  btn.id = "rea-floating-btn";
  btn.title = "Open REA (Response & Escalation Assistant)";
  
  // Create an inner span for the icon/text
  const iconSpan = document.createElement("span");
  iconSpan.textContent = "REA";
  iconSpan.style.fontWeight = "bold";
  iconSpan.style.fontSize = "14px";
  
  btn.appendChild(iconSpan);

  // Create a close/dismiss button
  const closeBtn = document.createElement("button");
  closeBtn.id = "rea-floating-close-btn";
  closeBtn.title = "Dismiss REA button";
  closeBtn.innerHTML = "&times;";

  container.appendChild(btn);
  container.appendChild(closeBtn);

  // Add click event for main button to open side panel
  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "open_side_panel" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("REA Extension Error:", chrome.runtime.lastError);
      } else {
        console.log("REA Side Panel opened");
      }
    });
  });

  // Add click event to dismiss button
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    container.style.display = "none";
    // Optionally save state to chrome.storage to remember it's dismissed
    chrome.storage.local.set({ reaFloatingButtonDismissed: true });
  });

  // Check if previously dismissed
  chrome.storage.local.get(["reaFloatingButtonDismissed"], (result) => {
    if (!result.reaFloatingButtonDismissed) {
      document.body.appendChild(container);
    }
  });

})();
