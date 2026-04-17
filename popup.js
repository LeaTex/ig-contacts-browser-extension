const openPanelButton = document.getElementById("openPanel");
const popupStatus = document.getElementById("popupStatus");

function setPopupStatus(text, type) {
  popupStatus.textContent = text;
  popupStatus.classList.remove("status-loading", "status-success", "status-error");
  if (type) {
    popupStatus.classList.add(type);
  }
}

function sendToggleMessage(tabId, callback) {
  chrome.tabs.sendMessage(tabId, { action: "toggleInPagePanel" }, callback);
}

function injectPanelScripts(tabId, callback) {
  chrome.scripting.insertCSS(
    {
      target: { tabId },
      files: ["content.css"]
    },
    () => {
      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: ["content.js"]
        },
        callback
      );
    }
  );
}

openPanelButton.addEventListener("click", () => {
  setPopupStatus("Opening panel...", "status-loading");
  openPanelButton.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs && tabs[0];

    if (!activeTab?.id || !activeTab.url || !activeTab.url.includes("instagram.com")) {
      setPopupStatus("Open instagram.com in this tab first.", "status-error");
      openPanelButton.disabled = false;
      return;
    }

    sendToggleMessage(activeTab.id, (response) => {
      if (!chrome.runtime.lastError && response?.ok) {
        openPanelButton.disabled = false;
        setPopupStatus("Panel opened on Instagram.", "status-success");
        setTimeout(() => window.close(), 250);
        return;
      }

      injectPanelScripts(activeTab.id, () => {
        if (chrome.runtime.lastError) {
          openPanelButton.disabled = false;
          setPopupStatus("Could not inject panel in this tab.", "status-error");
          return;
        }

        sendToggleMessage(activeTab.id, (retryResponse) => {
          openPanelButton.disabled = false;

          if (chrome.runtime.lastError || !retryResponse?.ok) {
            setPopupStatus("Could not open panel in this tab.", "status-error");
            return;
          }

          setPopupStatus("Panel opened on Instagram.", "status-success");
          setTimeout(() => window.close(), 250);
        });
      });
    });
  });
});
