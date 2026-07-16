console.log("[ContentScript] Lovable started");
/* ============================================================
 * BYPASS STATE AND REQUEST HELPERS
 * ============================================================ */
function activateBypass() {
  try {
    localStorage.setItem("__ql_bypass_active", "1");
  } catch (value) {}
  window.postMessage({
    type: "qlBypassState",
    active: true
  }, "*");
}
function deactivateBypass() {
  try {
    localStorage.removeItem("__ql_bypass_active");
  } catch (value) {}
  window.postMessage({
    type: "qlBypassState",
    active: false
  }, "*");
}
function buildSessionHeaders(projectId) {
  return new Promise(function (resolve) {
    var value = navigator.userAgent || "";
    var value2 = navigator.userAgentData && navigator.userAgentData.brands ? navigator.userAgentData.brands : [];
    var text = "";
    for (var count = 0; count < value2.length; count++) {
      if (count > 0) {
        text += ", ";
      }
      text += "\"" + value2[count].brand + "\";v=\"" + value2[count].version + "\"";
    }
    var value3 = navigator.userAgentData && navigator.userAgentData.platform ? navigator.userAgentData.platform : "Windows";
    var value4 = navigator.userAgentData && navigator.userAgentData.mobile ? "?1" : "?0";
    var value5 = navigator.languages && navigator.languages.length ? navigator.languages.slice(0, 3).join(",") : navigator.language || "en-US";
    var options = {
      "user-agent": value,
      "sec-ch-ua": text,
      "sec-ch-ua-mobile": value4,
      "sec-ch-ua-platform": "\"" + value3 + "\"",
      "accept-language": value5,
      "accept-encoding": "gzip, deflate, br, zstd",
      origin: "https://lovable.dev",
      referer: "https://lovable.dev/projects/" + (projectId || ""),
      priority: "u=1, i",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site"
    };
    try {
      chrome.runtime.sendMessage({
        action: "getLovableCookies"
      }, function (response) {
        if (response && response.cookie) {
          options.cookie = response.cookie;
        }
        resolve(options);
      });
    } catch (value6) {
      resolve(options);
    }
  });
}
function escapeHtml(value) {
  if (!value) {
    return "";
  }
  const element = document.createElement("div");
  element.textContent = String(value);
  return element.innerHTML;
}
function sanitizeUrl(url) {
  if (!url) {
    return "";
  }
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      return url;
    }
    return "";
  } catch (value) {
    return "";
  }
}
function decodeJwtPayload(token) {
  try {
    const value = String(token || "").replace(/^Bearer\s+/i, "").trim();
    const parts = value.split(".");
    if (parts.length < 2) {
      return null;
    }
    const value2 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const value3 = value2 + "=".repeat((4 - value2.length % 4) % 4);
    return JSON.parse(atob(value3));
  } catch (value) {
    return null;
  }
}
function bgFetch(url, response = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      action: "proxyFetch",
      url: url,
      method: response.method || "POST",
      headers: response.headers || {},
      body: response.body || null
    };
    chrome.runtime.sendMessage(options, response2 => {
      if (chrome.runtime.lastError) {
        console.error("[bgFetch] runtime error:", chrome.runtime.lastError.message);
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response2) {
        return reject(new Error("No response from background"));
      }
      if (response2.data && typeof response2.data === "object") {
        if (!response2.ok) {
          const value = response2.data.error || response2.data.message || response2.data.detail || JSON.stringify(response2.data);
          console.error("[bgFetch] HTTP " + response2.status + " →", response2.data);
          return reject(new Error("HTTP " + response2.status + ": " + value));
        }
        resolve(response2.data);
      } else if (!response2.ok) {
        reject(new Error("Fetch failed via background (status " + response2.status + ")"));
      } else {
        resolve(response2.data);
      }
    });
  });
}
/* ============================================================
 * LICENSE STATE AND BACKEND OPERATIONS
 * ============================================================ */
function euStoreLicenseState(licenseResponse) {
  const value = window.EUBackend.storageState(licenseResponse);
  qlSessionId = value.ql_session_id;
  qlUserName = value.ql_user_name;
  qlExpiresAt = value.ql_expires_at;
  qlActivatedAt = value.ql_activated_at;
  qlLicenseStatus = value.ql_license_status;
  qlOnlineCount = licenseResponse.online_count || 0;
  return value;
}
function euApplyActiveBranding() {
  chrome.storage.local.get(["eu_branding", "ql_branding", "eu_license_status", "ql_license_status"], input => {
    const value = input.eu_branding || input.ql_branding || {};
    if (window.EUBackend) {
      const value2 = input.eu_license_status || input.ql_license_status || "";
      const options = {
        ...value
      };
      options.statusText = value2;
      window.EUBackend.applyBranding(document, options);
    }
  });
}
function euRenderOperationBlock(element, operations) {
  if (!window.EUBackend || !element || !operations) {
    return false;
  }
  let text = "";
  if (window.EUBackend.isMaintenanceActive(operations)) {
    text = "maintenance";
  } else if (window.EUBackend.shouldBlockForUpgrade(operations)) {
    text = "upgrade";
  }
  if (!text) {
    return false;
  }
  element.innerHTML = window.EUBackend.renderBlockPage(text, operations);
  return true;
}
function euCheckOperationBlock(container) {
  chrome.storage.local.get(["eu_operations", "ql_operations"], input => {
    euRenderOperationBlock(container, input.eu_operations || input.ql_operations);
  });
}
function euMaybeShowOptionalUpgrade(operations) {
  if (!window.EUBackend || !operations || window.EUBackend.shouldBlockForUpgrade(operations)) {
    return;
  }
  if (!window.EUBackend.shouldShowUpgrade(operations)) {
    return;
  }
  const value = operations.forceUpgrade || {};
  const value2 = "eu_update_notice_" + (value.latestVersion || "latest");
  chrome.storage.local.get([value2], input => {
    if (input[value2]) {
      return;
    }
    const options = {
      [value2]: true
    };
    chrome.storage.local.set(options);
    const value3 = value.releaseNotes ? (value.message || "A new version is available.") + "\n\n" + value.releaseNotes : value.message || "A new version is available.";
    showCustomAlert("Update Available", value3);
  });
}
let qlSessionId = null;
let qlHeartbeatInterval = null;
let qlUserName = null;
let qlExpiresAt = null;
let qlActivatedAt = null;
let qlLicenseStatus = null;
let qlOnlineCount = 0;
let qlMinimized = false;
let qlHeight = 520;
let qlSpeechRecognition = null;
let qlIsRecording = false;
let qlDeviceId = null;
let qlShieldActive = false;
let qlSidebarActivateTimer = null;
let _qlLastStartupHb = 0;
let qlActiveTab = "prompt";
let qlChatHistory = [];
const QL_HISTORY_KEY = "ql_chat_history";
const QL_MAX_HISTORY = 200;
function getDeviceId() {
  return getHardwareFingerprint();
}
/* ============================================================
 * FLOATING PANEL BOOTSTRAP AND LICENSE UI
 * ============================================================ */
function createUI() {
  if (document.getElementById("ql-floating")) {
    return;
  }
  chrome.storage.local.get(["ql_sidebar_mode", "ql_native_chat", "ql_license_valid"], input => {
    if (input.ql_sidebar_mode === true) {
      qlRetryCount = qlRetryDelays.length;
      if (input.ql_license_valid) {
        activateBypass();
      }
      return;
    }
    if (input.ql_native_chat === true) {
      qlRetryCount = qlRetryDelays.length;
      return;
    }
    _buildFloatingUI();
  });
}
function _qlOpenSidePanel() {
  chrome.runtime.sendMessage({
    action: "openSidePanel"
  });
  var element = document.createElement("div");
  element.textContent = "Click the extension icon to open the panel";
  element.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;font-size:14px;font-family:sans-serif;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.4);";
  document.body.appendChild(element);
  setTimeout(function () {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }, 4000);
}
function _buildFloatingUI() {
  if (document.getElementById("ql-floating")) {
    return;
  }
  const element = document.createElement("div");
  element.id = "ql-floating";
  const value = Math.max(10, window.innerWidth - 400);
  element.style.left = value + "px";
  element.style.top = "80px";
  document.body.appendChild(element);
  element.addEventListener("click", function (event) {
    var value2 = event.target;
    while (value2 && value2 !== element) {
      if (value2.id === "ql-validate-btn") {
        validateLicense();
        return;
      }
      if (value2.id === "ql-sidepanel-btn") {
        _qlOpenSidePanel();
        return;
      }
      value2 = value2.parentElement;
    }
  });
  chrome.storage.local.get(["ql_license_valid", "ql_license_key", "eu_license_valid", "eu_license_key", "eu_user_name", "eu_expires_at", "eu_activated_at", "eu_license_status", "eu_session_id", "ql_minimized", "ql_height", "ql_dark_mode", "ql_user_name", "ql_expires_at", "ql_activated_at", "ql_license_status", "ql_session_id"], async input => {
    qlMinimized = input.ql_minimized || false;
    qlHeight = input.ql_height || 520;
    if (input.ql_dark_mode === false) {
      element.classList.add("ql-light");
    }
    if (qlMinimized) {
      element.classList.add("ql-minimized");
    }
    const value2 = input.eu_license_key || input.ql_license_key;
    const value3 = input.eu_license_valid || input.ql_license_valid;
    if (value3) {
      activateBypass();
    }
    qlDeviceId = await getDeviceId();
    const value4 = await new Promise(resolve => chrome.storage.local.get(["ql_sidebar_mode"], resolve));
    if (value4.ql_sidebar_mode === true) {
      if (value3) {
        activateBypass();
      }
      return;
    }
    if (value3) {
      qlUserName = input.eu_user_name || input.ql_user_name || null;
      qlExpiresAt = input.eu_expires_at || input.ql_expires_at || null;
      qlActivatedAt = input.eu_activated_at || input.ql_activated_at || null;
      qlLicenseStatus = input.eu_license_status || input.ql_license_status || null;
      qlSessionId = input.eu_session_id || input.ql_session_id || null;
      showMainUI(element);
      activateBypass();
      euApplyActiveBranding();
      if (value2 && Date.now() - _qlLastStartupHb > 5000) {
        _qlLastStartupHb = Date.now();
        const handler = input2 => {
          const options = {
            heartbeat: true,
            deviceId: qlDeviceId
          };
          window.EUBackend.validateLicense(value2, options).then(error => {
            console.log("[EU] Startup heartbeat (attempt " + input2 + "):", JSON.stringify(error));
            if (error.valid) {
              chrome.storage.local.set(euStoreLicenseState(error));
              activateBypass();
              const element2 = document.querySelector(".ql-profile-name");
              if (element2) {
                element2.textContent = qlUserName || "User";
              }
              updateTrialCountdown();
              euApplyActiveBranding();
              const element3 = document.getElementById("ql-floating");
              if (element3) {
                euCheckOperationBlock(element3);
              }
              euMaybeShowOptionalUpgrade(error.operations);
            } else if (error.reason === "device_conflict") {
              if (input2 < 2) {
                setTimeout(() => handler(input2 + 1), 5000);
                return;
              }
              chrome.storage.local.remove(window.EUBackend.clearKeys());
              deactivateBypass();
              const element2 = document.getElementById("ql-floating");
              if (element2) {
                showLicenseGate(element2);
              }
              setTimeout(() => showCustomAlert("Access Denied", error.message), 500);
            } else if (error.reason === "rate_limited") {
              if (input2 < 2) {
                setTimeout(() => handler(input2 + 1), 30000);
                return;
              }
            } else {
              chrome.storage.local.remove(window.EUBackend.clearKeys());
              deactivateBypass();
              const element2 = document.getElementById("ql-floating");
              if (element2) {
                showLicenseGate(element2);
              }
            }
          }).catch(() => {
            if (input2 < 2) {
              setTimeout(() => handler(input2 + 1), 10000);
            }
          });
        };
        handler(1);
      }
    } else {
      deactivateBypass();
      showLicenseGate(element);
    }
    setupDrag();
    setupResize();
  });
}
function showLicenseGate(element) {
  element.innerHTML = templateLicenseGate(qlMinimized);
  setTimeout(() => {
    const element2 = document.getElementById("ql-buy-license-btn");
    if (element2) {
      element2.addEventListener("click", () => window.open("https://lovable.dev", "_blank", "noopener,noreferrer"));
    }
    setupMinimize();
  }, 50);
}
async function validateLicense() {
  const element = document.getElementById("ql-license-input");
  const element2 = document.getElementById("ql-license-log");
  const value = element ? element.value.trim().toUpperCase() : "";
  if (!value) {
    if (element2) {
      element2.className = "ql-log-error";
      element2.innerText = "⚠ Enter a key";
    }
    return;
  }
  if (element2) {
    element2.className = "ql-log-info";
    element2.innerHTML = SVG_ICONS.clock + " Validating...";
  }
  try {
    if (!qlDeviceId) {
      qlDeviceId = await getDeviceId();
    }
    const options = {
      deviceId: qlDeviceId
    };
    const value2 = await window.EUBackend.validateLicense(value, options);
    if (value2.valid) {
      qlExpiredHandled = false;
      const value3 = euStoreLicenseState(value2);
      chrome.storage.local.set(value3, () => {
        activateBypass();
        if (element2) {
          element2.className = "ql-log-success";
          element2.innerText = "✓ " + value2.message;
        }
        try {
          if (typeof QLSounds !== "undefined") {
            QLSounds.activation();
          }
        } catch (value4) {}
        setTimeout(() => {
          const element3 = document.getElementById("ql-floating");
          if (element3) {
            if (!euRenderOperationBlock(element3, value2.operations)) {
              showMainUI(element3);
            }
            euApplyActiveBranding();
            euMaybeShowOptionalUpgrade(value2.operations);
          }
          startHeartbeat(value);
        }, 800);
      });
    } else if (element2) {
      element2.className = "ql-log-error";
      element2.innerText = "✗ " + value2.message;
    }
  } catch (value2) {
    if (element2) {
      element2.className = "ql-log-error";
      element2.innerText = "✗ Connection error";
    }
  }
}
function showMainUI(element) {
  const value = qlUserName || "User";
  const value2 = String(qlLicenseStatus).toLowerCase() === "trial" ? "<span class=\"ql-status-badge ql-badge-test\">TEST</span>" : "<span class=\"ql-status-badge ql-badge-pro\">ACTIVE</span>";
  element.innerHTML = templateMainUI(value, value2, qlMinimized);
  euCheckOperationBlock(element);
  element.style.height = qlHeight + "px";
  setTimeout(() => {
    euApplyActiveBranding();
    updateSyncStatus();
    setupSend();
    setupStorageWatch();
    setupMinimize();
    setupSuggestionChips();
    setupWatermarkButton();
    updateTrialCountdown();
    setupDrag();
    setupResize();
    setupDarkMode();
    setupOptimize();
    setupSpeech();
    setupNotifications();
    setupModoPlan();
    setupFileAttachment();
    setupShield();
    setupTabs();
    loadChatHistory();
    setupNativeChatButton();
    setupClipboardPaste();
    setupDownloadProject();
    checkForUpdatePopup();
    checkResellerRolePopup();
    chrome.storage.local.get(["eu_license_key", "eu_session_id", "ql_license_key", "ql_session_id"], input => {
      const value3 = input.eu_license_key || input.ql_license_key;
      if (value3) {
        qlSessionId = input.eu_session_id || input.ql_session_id || qlSessionId;
        startHeartbeat(value3);
      }
    });
    var element2 = document.getElementById("ql-sidepanel-btn");
    if (element2) {
      element2.addEventListener("click", function (event) {
        event.stopPropagation();
        _qlOpenSidePanel();
      });
    }
    const element3 = document.getElementById("ql-logout-btn");
    if (element3) {
      element3.addEventListener("click", () => {
        if (qlHeartbeatInterval) {
          clearInterval(qlHeartbeatInterval);
        }
        chrome.storage.local.remove(window.EUBackend.clearKeys(), () => {
          deactivateBypass();
          qlUserName = null;
          qlExpiresAt = null;
          qlActivatedAt = null;
          qlLicenseStatus = null;
          qlSessionId = null;
          showLicenseGate(element);
        });
      });
    }
  }, 30);
}
function showCustomAlert(title, message) {
  try {
    if (typeof QLSounds !== "undefined" && QLSounds.errorFromMessage) {
      var value = (title || "") + " " + (message || "");
      if (/error|fail|denied|invalid|expir|limit|payment|rate|token|credit|session/i.test(value)) {
        QLSounds.errorFromMessage(value);
      }
    }
  } catch (value2) {}
  const element = document.getElementById("ql-custom-alert");
  if (!element) {
    return;
  }
  const element2 = element.querySelector(".ql-alert-title");
  const element3 = element.querySelector(".ql-alert-message");
  const element4 = element.querySelector(".ql-alert-ok-btn");
  if (element2) {
    element2.textContent = title;
  }
  if (element3) {
    element3.textContent = message;
  }
  element.style.display = "flex";
  if (element4) {
    element4.onclick = () => {
      element.style.display = "none";
    };
  }
  setTimeout(() => {
    element.style.display = "none";
  }, 4000);
}
/* ============================================================
 * PROMPT TOOLS AND NOTIFICATIONS
 * ============================================================ */
function setupOptimize() {
  const element = document.getElementById("ql-optimize-btn");
  if (!element) {
    return;
  }
  element.addEventListener("click", async () => {
    const element2 = document.getElementById("ql-msg");
    if (!element2 || !element2.value.trim()) {
      showCustomAlert("Warning", "Enter a prompt before optimizing.");
      return;
    }
    const value = element2.value.trim();
    element.classList.add("ql-tool-loading");
    element.disabled = true;
    const value2 = await new Promise(resolve => chrome.storage.local.get(["eu_license_key", "ql_license_key"], resolve));
    const value3 = window.EUBackend.getLicenseKey(value2);
    try {
      const value4 = await window.EUBackend.improvePrompt(value, value3);
      if (value4.optimized_prompt) {
        element2.value = value4.optimized_prompt;
        showCustomAlert("Prompt Optimized!", "Your prompt was improved with AI and is ready to send.");
      } else if (value4.error) {
        showCustomAlert("Error", value4.error);
      }
    } catch (value4) {
      console.error("[Optimize] error:", value4);
      showCustomAlert("Error", "Failed to connect to the optimizer: " + (value4.message || ""));
    } finally {
      element.classList.remove("ql-tool-loading");
      element.disabled = false;
    }
  });
}
function setupSpeech() {
  const element = document.getElementById("ql-speech-btn");
  if (!element) {
    return;
  }
  const value = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!value) {
    element.title = "Speech is not supported in this browser";
    element.style.opacity = "0.4";
    element.style.cursor = "not-allowed";
    return;
  }
  element.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    if (qlIsRecording && qlSpeechRecognition) {
      qlSpeechRecognition.stop();
      return;
    }
    try {
      qlSpeechRecognition = new value();
      qlSpeechRecognition.lang = "en-US";
      qlSpeechRecognition.continuous = true;
      qlSpeechRecognition.interimResults = true;
      qlSpeechRecognition.maxAlternatives = 1;
      let text = "";
      const element2 = document.getElementById("ql-msg");
      qlSpeechRecognition.onstart = () => {
        qlIsRecording = true;
        element.classList.add("ql-recording");
        text = element2 ? element2.value : "";
        console.log("[QL Speech] Recording started");
      };
      qlSpeechRecognition.onresult = input => {
        let text2 = "";
        for (let value2 = input.resultIndex; value2 < input.results.length; value2++) {
          const value3 = input.results[value2][0].transcript;
          if (input.results[value2].isFinal) {
            text += value3 + " ";
          } else {
            text2 += value3;
          }
        }
        if (element2) {
          element2.value = text + text2;
        }
      };
      qlSpeechRecognition.onerror = input => {
        console.warn("[QL Speech] Error:", input.error);
        qlIsRecording = false;
        element.classList.remove("ql-recording");
        if (input.error === "not-allowed") {
          showCustomAlert("Permission Denied", "Allow microphone access in your browser settings.");
        } else if (input.error === "no-speech") {
          showCustomAlert("No Audio", "No speech detected. Try again.");
        } else if (input.error !== "aborted") {
          showCustomAlert("Voice Error", "Error: " + input.error);
        }
      };
      qlSpeechRecognition.onend = () => {
        qlIsRecording = false;
        element.classList.remove("ql-recording");
        if (element2) {
          element2.value = text.trim();
        }
        console.log("[QL Speech] Recording finished");
      };
      qlSpeechRecognition.start();
    } catch (value2) {
      console.error("[QL Speech] Failed to start:", value2);
      qlIsRecording = false;
      element.classList.remove("ql-recording");
      showCustomAlert("Error", "Could not start speech recognition.");
    }
  });
}
function setupNotifications() {
  const element = document.querySelector(".ql-notif-btn");
  const element2 = document.getElementById("ql-notif-panel");
  const element3 = document.getElementById("ql-notif-close");
  if (!element || !element2) {
    return;
  }
  element.addEventListener("click", event => {
    event.stopPropagation();
    const value = element2.style.display !== "none";
    element2.style.display = value ? "none" : "block";
    if (!value) {
      loadNotifications();
    }
  });
  if (element3) {
    element3.addEventListener("click", event => {
      event.stopPropagation();
      element2.style.display = "none";
    });
  }
  checkUnreadNotifications();
}
async function loadNotifications() {
  const element = document.getElementById("ql-notif-list");
  if (!element) {
    return;
  }
  element.innerHTML = "<p class=\"ql-notif-empty\">Loading...</p>";
  try {
    const value = await window.EUBackend.getNotifications();
    if (!value || value.length === 0) {
      element.innerHTML = "<p class=\"ql-notif-empty\">No notifications.</p>";
      return;
    }
    const mappedItems = value.map(item => item.id);
    const options = {
      ql_read_notifs: mappedItems
    };
    chrome.storage.local.set(options);
    const element2 = document.querySelector(".ql-notif-badge");
    if (element2) {
      element2.style.display = "none";
    }
    element.innerHTML = value.map(error => {
      const value2 = new Date(error.created_at).toLocaleDateString("en-US");
      const safeUrl = sanitizeUrl(error.link);
      const value3 = safeUrl ? "<a href=\"" + escapeHtml(safeUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"ql-notif-link\">Open link →</a>" : "";
      return "<div class=\"ql-notif-item\"><div class=\"ql-notif-item-title\">" + escapeHtml(error.title) + "</div><div class=\"ql-notif-item-msg\">" + escapeHtml(error.message) + "</div>" + value3 + "<div class=\"ql-notif-item-date\">" + value2 + "</div></div>";
    }).join("");
  } catch (value) {
    element.innerHTML = "<p class=\"ql-notif-empty\">Failed to load.</p>";
  }
}
async function checkUnreadNotifications() {
  try {
    const value = await window.EUBackend.getNotifications();
    if (!value || value.length === 0) {
      return;
    }
    chrome.storage.local.get(["ql_read_notifs"], input => {
      const value2 = input.ql_read_notifs || [];
      const value3 = value.filter(item => !value2.includes(item.id)).length;
      const element = document.querySelector(".ql-notif-badge");
      if (element) {
        if (value3 > 0) {
          element.textContent = value3;
          element.style.display = "flex";
        } else {
          element.style.display = "none";
        }
      }
    });
  } catch (value) {}
}
function setupSuggestionChips() {
  const element = document.getElementById("ql-chips");
  if (!element) {
    return;
  }
  PROMPT_TEMPLATES.forEach(item => {
    const element2 = document.createElement("button");
    element2.className = "ql-chip";
    element2.innerHTML = item.icon + " " + item.label;
    element2.title = item.prompt;
    element2.addEventListener("click", () => {
      const element3 = document.getElementById("ql-msg");
      if (element3) {
        element3.value = item.prompt;
      }
    });
    element.appendChild(element2);
  });
}
var WATERMARK_PROMPT = "use CSS to completely hide the Lovable badge (the 'Made with Lovable' element), without breaking the layout";
function setupWatermarkButton() {
  var element = document.getElementById("ql-remove-watermark");
  if (!element) {
    return;
  }
  element.addEventListener("click", async function () {
    var element2 = document.getElementById("ql-log");
    element.disabled = true;
    element.textContent = "⏳ Sending...";
    try {
      await sendNativeToLovable(WATERMARK_PROMPT);
      if (element2) {
        element2.className = "ql-log-success";
        element2.innerText = "✓ Prompt sent! Wait for Lovable to apply the CSS.";
      }
    } catch (value) {
      if (element2) {
        element2.className = "ql-log-error";
        element2.innerText = "✗ " + (value.message || value);
      }
    } finally {
      element.disabled = false;
      element.textContent = "Remove Watermark";
    }
  });
}
function updateTrialCountdown() {
  if (!qlExpiresAt) {
    return;
  }
  const element = document.getElementById("ql-trial-countdown");
  if (!element) {
    return;
  }
  element.style.display = "block";
  const value = Date.now();
  function value2() {
    const value3 = new Date(qlExpiresAt).getTime();
    const value4 = Math.max(value3 - value, 3600000);
    const value5 = value3 - Date.now();
    if (value5 <= 0) {
      element.innerHTML = "<span class=\"ql-countdown-expired\">" + t("countdown.expired") + "</span><div class=\"ql-trial-bar\"><div class=\"ql-trial-bar-fill ql-bar-expired\" style=\"width:0%\"></div></div>";
      handleLicenseExpired();
      return;
    }
    const value6 = Math.floor(value5 / 86400000);
    const value7 = Math.floor(value5 % 86400000 / 3600000);
    const value8 = Math.floor(value5 % 3600000 / 60000);
    const value9 = Math.floor(value5 % 60000 / 1000);
    const value10 = Math.max(0, Math.min(100, value5 / value4 * 100));
    let text = "";
    if (value6 > 0) {
      text = value6 + "d " + value7 + "h " + value8 + "m";
    } else if (value7 > 0) {
      text = value7 + "h " + value8 + "m " + String(value9).padStart(2, "0") + "s";
    } else {
      text = value8 + ":" + String(value9).padStart(2, "0");
    }
    const value11 = value10 < 20 ? " ql-bar-urgent" : "";
    const value12 = qlLicenseStatus === "trial" ? t("countdown.trial") : t("countdown.license");
    element.innerHTML = "<div class=\"ql-countdown-row\"><span class=\"ql-countdown-icon\">" + SVG_ICONS.clock + "</span><span class=\"ql-countdown-label\">" + value12 + "</span><span class=\"ql-countdown-time\">" + text + "</span></div><div class=\"ql-trial-bar\"><div class=\"ql-trial-bar-fill" + value11 + "\" style=\"width:" + value10 + "%\"></div></div>";
  }
  value2();
  if (window.qlCountdownInterval) {
    clearInterval(window.qlCountdownInterval);
  }
  window.qlCountdownInterval = setInterval(value2, 1000);
}
function setupMinimize() {
  const element = document.getElementById("ql-minimize");
  if (!element) {
    return;
  }
  element.addEventListener("click", event => {
    event.stopPropagation();
    const element2 = document.getElementById("ql-floating");
    if (!element2) {
      return;
    }
    qlMinimized = !qlMinimized;
    element2.classList.toggle("ql-minimized", qlMinimized);
    element.textContent = qlMinimized ? "□" : "−";
    const options = {
      ql_minimized: qlMinimized
    };
    chrome.storage.local.set(options);
  });
}
function setupDarkMode() {
  const element = document.querySelector(".ql-icon-btn[title=\"Tema\"]");
  if (!element) {
    return;
  }
  element.addEventListener("click", event => {
    event.stopPropagation();
    const element2 = document.getElementById("ql-floating");
    if (!element2) {
      return;
    }
    const value = element2.classList.toggle("ql-light");
    const options = {
      ql_dark_mode: !value
    };
    chrome.storage.local.set(options);
  });
}
function setupModoPlan() {
  const element = document.getElementById("ql-modo-plano");
  if (!element) {
    return;
  }
  chrome.storage.local.get(["ql_modo_plano"], input => {
    if (input.ql_modo_plano === true) {
      element.checked = true;
    }
  });
  element.addEventListener("change", () => {
    const options = {
      ql_modo_plano: element.checked
    };
    chrome.storage.local.set(options);
    if (element.checked) {
      showModoPlanAlert();
    }
  });
}
function showModoPlanAlert() {
  const element = document.querySelector(".ql-modo-plano-overlay");
  if (element) {
    element.remove();
  }
  const element2 = document.createElement("div");
  element2.className = "ql-modo-plano-overlay";
  element2.innerHTML = "<div class=\"ql-modo-plano-modal\"><div class=\"ql-modo-plano-icon\">⚠️</div><div class=\"ql-modo-plano-title\">Warning - Plan Mode</div><div class=\"ql-modo-plano-body\">The <strong>Plan/Think Mode</strong> can consume credits, but it provides useful help. Use it carefully!</div><div class=\"ql-modo-plano-steps\"><div class=\"ql-modo-plano-step\"><span class=\"ql-modo-plano-step-num\">1</span><span class=\"ql-modo-plano-step-text\">Enable <strong>Plan Mode</strong> to generate a plan.</span></div><div class=\"ql-modo-plano-step\"><span class=\"ql-modo-plano-step-num\">2</span><span class=\"ql-modo-plano-step-text\">In Lovable, <strong>do not click the Approve button</strong>; just copy the new plan.</span></div><div class=\"ql-modo-plano-step\"><span class=\"ql-modo-plano-step-num\">3</span><span class=\"ql-modo-plano-step-text\">Paste the copied plan into the extension prompt.</span></div><div class=\"ql-modo-plano-step\"><span class=\"ql-modo-plano-step-num\">4</span><span class=\"ql-modo-plano-step-text\"><strong>Turn off Plan Mode</strong> and send through the extension; no extra credits will be consumed.</span></div></div><div class=\"ql-modo-plano-check\"><input type=\"checkbox\" id=\"ql-modo-plano-dismiss\" /><label for=\"ql-modo-plano-dismiss\">Do not show again</label></div><button class=\"ql-modo-plano-btn\" id=\"ql-modo-plano-ok\">Got it!</button></div>";
  const element3 = document.getElementById("ql-floating");
  if (element3) {
    element3.appendChild(element2);
  } else {
    document.body.appendChild(element2);
  }
  requestAnimationFrame(() => element2.classList.add("ql-modo-plano-visible"));
  const handler = () => {
    element2.classList.remove("ql-modo-plano-visible");
    setTimeout(() => element2.remove(), 180);
  };
  const element4 = element2.querySelector("#ql-modo-plano-ok");
  if (element4) {
    element4.addEventListener("click", () => {
      const element5 = element2.querySelector("#ql-modo-plano-dismiss");
      if (element5 && element5.checked) {
        chrome.storage.local.set({
          ql_modo_plano_alert_dismissed: true
        });
      }
      handler();
    });
  }
  element2.addEventListener("click", event => {
    if (event.target === element2) {
      handler();
    }
  });
}
/* ============================================================
 * INTERACTION SHIELD AND LICENSE HEARTBEAT
 * ============================================================ */
function setupShield() {
  const element = document.getElementById("ql-shield-btn");
  if (!element) {
    return;
  }
  chrome.storage.local.get(["ql_shield_active"], input => {
    if (input.ql_shield_active === true) {
      qlShieldActive = true;
      element.classList.add("ql-shield-active");
      const element2 = document.getElementById("ql-shield-label");
      if (element2) {
        element2.textContent = "Disable Shield";
      }
      injectShieldOverlay();
    }
  });
  element.addEventListener("click", () => {
    qlShieldActive = !qlShieldActive;
    const options = {
      ql_shield_active: qlShieldActive
    };
    chrome.storage.local.set(options);
    const element2 = document.getElementById("ql-shield-label");
    if (qlShieldActive) {
      element.classList.add("ql-shield-active");
      if (element2) {
        element2.textContent = "Disable Shield";
      }
      injectShieldOverlay();
      showCustomAlert("Shield Enabled 🛡️", "The Lovable input is locked. Use the extension to send prompts.");
    } else {
      element.classList.remove("ql-shield-active");
      if (element2) {
        element2.textContent = "Enable Shield";
      }
      removeShieldOverlay();
      showCustomAlert("Shield Disabled", "The Lovable input is unlocked again.");
    }
  });
}
function injectShieldOverlay() {
  if (document.getElementById("ql-shield-overlay")) {
    return;
  }
  const element = document.querySelector("form#chat-input");
  if (!element) {
    setTimeout(injectShieldOverlay, 1000);
    return;
  }
  const value = getComputedStyle(element).position;
  if (value === "static") {
    element.style.position = "relative";
  }
  const element2 = document.createElement("div");
  element2.id = "ql-shield-overlay";
  element2.className = "ql-shield-overlay";
  element2.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/></svg><span class=\"ql-shield-overlay-text\">🛡️ Protected by Lovable</span><span class=\"ql-shield-overlay-sub\">Use the extension to send prompts</span>";
  element2.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);
  element2.addEventListener("mousedown", event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);
  element2.addEventListener("keydown", event => {
    event.preventDefault();
    event.stopPropagation();
  }, true);
  element.appendChild(element2);
  const elements = element.querySelectorAll("input, button, textarea, [contenteditable]");
  elements.forEach(item => {
    if (item.id !== "ql-shield-overlay") {
      item.dataset.qlShieldDisabled = item.disabled || "";
      item.dataset.qlShieldTabindex = item.getAttribute("tabindex") || "";
      item.setAttribute("tabindex", "-1");
      if (item.tagName !== "DIV") {
        item.disabled = true;
      }
      if (item.contentEditable === "true") {
        item.contentEditable = "false";
        item.dataset.qlShieldEditable = "true";
      }
    }
  });
}
function removeShieldOverlay() {
  const element = document.getElementById("ql-shield-overlay");
  if (element) {
    element.remove();
  }
  const element2 = document.querySelector("form#chat-input");
  if (!element2) {
    return;
  }
  const elements = element2.querySelectorAll("[data-ql-shield-disabled]");
  elements.forEach(item => {
    const value = item.dataset.qlShieldDisabled;
    if (value === "true") {
      item.disabled = true;
    } else if (value === "" || value === "false") {
      item.disabled = false;
    }
    delete item.dataset.qlShieldDisabled;
    const value2 = item.dataset.qlShieldTabindex;
    if (value2) {
      item.setAttribute("tabindex", value2);
    } else {
      item.removeAttribute("tabindex");
    }
    delete item.dataset.qlShieldTabindex;
    if (item.dataset.qlShieldEditable === "true") {
      item.contentEditable = "true";
      delete item.dataset.qlShieldEditable;
    }
  });
}
let qlHbConflictCount = 0;
let qlHbNetworkFailCount = 0;
function startHeartbeat(licenseKey) {
  if (qlHeartbeatInterval) {
    clearInterval(qlHeartbeatInterval);
  }
  qlHbConflictCount = 0;
  qlHbNetworkFailCount = 0;
  qlHeartbeatInterval = setInterval(async () => {
    try {
      const options = {
        heartbeat: true,
        deviceId: qlDeviceId
      };
      const value = await window.EUBackend.validateLicense(licenseKey, options);
      if (!value.valid) {
        const value2 = value.reason === "device_conflict";
        const value3 = value.reason === "expired" || value.reason === "suspended" || value.message && (value.message.includes("expired") || value.message.includes("suspended"));
        if (value2) {
          qlHbConflictCount++;
          if (qlHbConflictCount < 2) {
            return;
          }
        }
        if (value2 || value3) {
          clearInterval(qlHeartbeatInterval);
          deactivateBypass();
          chrome.storage.local.remove(window.EUBackend.clearKeys(), () => {
            const element3 = document.getElementById("ql-floating");
            if (element3) {
              showLicenseGate(element3);
            }
            if (value2) {
              setTimeout(() => showCustomAlert("Access Denied", value.message), 500);
            }
          });
        }
        return;
      }
      qlHbConflictCount = 0;
      qlHbNetworkFailCount = 0;
      activateBypass();
      qlOnlineCount = value.online_count || 0;
      const element = document.getElementById("ql-online-count");
      if (element) {
        element.textContent = qlOnlineCount;
      }
      chrome.storage.local.set(euStoreLicenseState(value));
      const element2 = document.getElementById("ql-floating");
      if (element2 && euRenderOperationBlock(element2, value.operations)) {
        return;
      }
      euApplyActiveBranding();
      euMaybeShowOptionalUpgrade(value.operations);
      if (value.user_name) {
        qlUserName = value.user_name;
        const options2 = {
          ql_user_name: qlUserName
        };
        chrome.storage.local.set(options2);
        const element3 = document.querySelector(".ql-profile-name");
        if (element3) {
          element3.textContent = value.user_name;
        }
      }
    } catch (value) {
      console.warn("[QL] Heartbeat error", value);
      qlHbNetworkFailCount++;
      if (qlHbNetworkFailCount >= 5) {
        deactivateBypass();
        qlHbNetworkFailCount = 0;
      }
    }
  }, 60000);
}
let qlExpiredHandled = false;
function handleLicenseExpired() {
  if (qlExpiredHandled) {
    return;
  }
  qlExpiredHandled = true;
  if (qlHeartbeatInterval) {
    clearInterval(qlHeartbeatInterval);
  }
  if (window.qlCountdownInterval) {
    clearInterval(window.qlCountdownInterval);
  }
  const element = document.createElement("div");
  element.className = "ql-sweetalert-overlay";
  element.innerHTML = templateExpiredOverlay();
  const element2 = document.getElementById("ql-floating");
  if (element2) {
    element2.appendChild(element);
  }
  requestAnimationFrame(() => element.classList.add("ql-sweetalert-visible"));
  const element3 = element.querySelector("#ql-sweetalert-close");
  if (element3) {
    element3.addEventListener("click", () => {
      element.classList.remove("ql-sweetalert-visible");
      setTimeout(() => {
        element.remove();
        chrome.storage.local.remove(window.EUBackend.clearKeys(), () => {
          if (element2) {
            showLicenseGate(element2);
          }
        });
      }, 300);
    });
  }
}
function qlBootstrap() {
  if (document.getElementById("ql-floating")) {
    return;
  }
  if (!document.body) {
    var observer = new MutationObserver(function () {
      if (document.body) {
        observer.disconnect();
        qlBootstrap();
      }
    });
    observer.observe(document.documentElement, {
      childList: true
    });
    return;
  }
  createUI();
}
if (document.readyState === "complete" || document.readyState === "interactive") {
  setTimeout(qlBootstrap, 50);
} else {
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(qlBootstrap, 50);
  });
}
var qlRetryCount = 0;
var qlRetryDelays = [300, 600, 1000, 1500, 2000, 3000, 4000, 5000];
function qlRetryInit() {
  if (document.getElementById("ql-floating") || qlRetryCount >= qlRetryDelays.length) {
    return;
  }
  var value = qlRetryDelays[qlRetryCount];
  qlRetryCount++;
  setTimeout(function () {
    if (!document.getElementById("ql-floating") && document.body) {
      createUI();
    }
    qlRetryInit();
  }, value);
}
qlRetryInit();
chrome.storage.onChanged.addListener((input, option2) => {
  if (option2 !== "local") {
    return;
  }
  if (input.ql_sidebar_mode) {
    if (input.ql_sidebar_mode.newValue === true) {
      if (qlSidebarActivateTimer) {
        clearTimeout(qlSidebarActivateTimer);
        qlSidebarActivateTimer = null;
      }
      const element = document.getElementById("ql-floating");
      if (element) {
        element.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        element.style.opacity = "0";
        element.style.transform = "scale(0.95)";
        setTimeout(() => {
          if (qlHeartbeatInterval) {
            clearInterval(qlHeartbeatInterval);
          }
          if (window.qlCountdownInterval) {
            clearInterval(window.qlCountdownInterval);
          }
          element.remove();
        }, 350);
      }
    } else if (input.ql_sidebar_mode.newValue === false) {
      qlSidebarActivateTimer = setTimeout(() => {
        qlSidebarActivateTimer = null;
        _buildFloatingUI();
        setTimeout(() => {
          const element = document.getElementById("ql-floating");
          if (element) {
            element.style.opacity = "0";
            element.style.transform = "scale(0.95) translateX(20px)";
            requestAnimationFrame(() => {
              element.style.transition = "opacity 0.4s ease, transform 0.4s ease";
              element.style.opacity = "1";
              element.style.transform = "scale(1) translateX(0)";
            });
          }
        }, 50);
      }, 100);
    }
  }
});
/* ============================================================
 * LOVABLE SESSION SYNC AND CHAT HISTORY
 * ============================================================ */
function updateSyncStatus() {
  chrome.storage.local.get(["lovable_projectId", "lovable_token"], input => {
    const element = document.getElementById("ql-sync-status");
    if (!element) {
      return;
    }
    if (input.lovable_projectId && input.lovable_token) {
      element.className = "ql-sync-status ql-sync-ok";
      const value = input.lovable_projectId.substring(0, 6);
      element.innerHTML = "<span class=\"ql-sync-text\">" + t("sync.ok") + " " + t("sync.project") + " " + value + "...</span>";
    } else {
      element.className = "ql-sync-status ql-sync-waiting";
      element.innerHTML = "<span class=\"ql-sync-text\">" + SVG_ICONS.clock + t("sync.waiting") + "</span>";
    }
  });
}
let _qlStorageWatchSetup = false;
function setupStorageWatch() {
  if (_qlStorageWatchSetup) {
    return;
  }
  _qlStorageWatchSetup = true;
  chrome.storage.onChanged.addListener(input => {
    if (input.lovable_projectId || input.lovable_token) {
      updateSyncStatus();
    }
  });
}
function requestLatestTokenFromHook(timeoutMs = 1200) {
  return new Promise(resolve => {
    let isActive = false;
    function value(input) {
      if (isActive) {
        return;
      }
      isActive = true;
      clearTimeout(value3);
      chrome.storage.onChanged.removeListener(value2);
      resolve(input);
    }
    function value2(input, option2) {
      if (option2 !== "local") {
        return;
      }
      if (input.lovable_token && input.lovable_token.newValue) {
        value(true);
      }
    }
    const value3 = setTimeout(() => value(false), Math.max(300, timeoutMs));
    chrome.storage.onChanged.addListener(value2);
    try {
      window.postMessage({
        type: "lovableRequestToken"
      }, "*");
      const options = {
        type: "lovableRequestToken"
      };
      setTimeout(() => window.postMessage(options, "*"), 120);
    } catch (value4) {
      value(false);
    }
  });
}
function loadChatHistory(onLoaded) {
  chrome.storage.local.get([QL_HISTORY_KEY], input => {
    qlChatHistory = input[QL_HISTORY_KEY] || [];
    updateHistoryBadge();
    if (onLoaded) {
      onLoaded();
    }
  });
}
function saveChatHistory() {
  if (qlChatHistory.length > QL_MAX_HISTORY) {
    qlChatHistory = qlChatHistory.slice(-QL_MAX_HISTORY);
  }
  const options = {
    [QL_HISTORY_KEY]: qlChatHistory
  };
  chrome.storage.local.set(options);
}
function addToChatHistory(text, status) {
  qlChatHistory.push({
    text: text,
    timestamp: new Date().toISOString(),
    status: status || "ok"
  });
  saveChatHistory();
  updateHistoryBadge();
}
function updateHistoryBadge() {
  const element = document.getElementById("ql-history-badge");
  if (!element) {
    return;
  }
  if (qlChatHistory.length > 0) {
    element.textContent = qlChatHistory.length;
    element.style.display = "inline-flex";
  } else {
    element.style.display = "none";
  }
}
function formatChatDate(timestamp) {
  var date = new Date(timestamp);
  var date2 = new Date();
  var date3 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  var date4 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  var value = (date3 - date4) / 86400000;
  if (value === 0) {
    return "Today";
  }
  if (value === 1) {
    return "Yesterday";
  }
  if (value < 7) {
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
  }
  return date.toLocaleDateString("en-US");
}
function formatChatTime(timestamp) {
  var date = new Date(timestamp);
  return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
}
function renderHistoryView() {
  const element = document.getElementById("ql-tab-content");
  if (!element) {
    return;
  }
  if (!qlChatHistory.length) {
    element.innerHTML = "<div class=\"ql-chat-empty\"><div style=\"font-size:28px;margin-bottom:8px\">💬</div><div style=\"font-size:13px;font-weight:600;color:var(--ql-text-primary,#f4f4f5)\">No messages</div><div style=\"font-size:11px;color:var(--ql-text-muted,#71717a);margin-top:4px\">Your sent prompts will appear here.</div></div>";
    return;
  }
  let text = "<div class=\"ql-chat-messages\">";
  let text2 = "";
  for (let count = 0; count < qlChatHistory.length; count++) {
    const response = qlChatHistory[count];
    const formattedDate = formatChatDate(response.timestamp);
    if (formattedDate !== text2) {
      text += "<div class=\"ql-chat-date-divider\"><span class=\"ql-chat-date-label\">" + formattedDate + "</span></div>";
      text2 = formattedDate;
    }
    const value = response.status === "error" ? "ql-chat-status-err" : "ql-chat-status-ok";
    const value2 = response.status === "error" ? "✗ Error" : "✓ Sent";
    const value3 = response.text.length > 300 ? escapeHtml(response.text.substring(0, 300)) + "…" : escapeHtml(response.text);
    text += "<div class=\"ql-chat-bubble\" title=\"" + escapeHtml(response.text) + "\">" + value3 + "<div class=\"ql-chat-meta\"><span class=\"" + value + "\">" + value2 + "</span><span class=\"ql-chat-time\">" + formatChatTime(response.timestamp) + "</span></div></div>";
  }
  text += "</div>";
  text += "<div class=\"ql-chat-actions\"><span class=\"ql-chat-count\">" + qlChatHistory.length + " mensagen" + (qlChatHistory.length === 1 ? "" : "s") + "</span><button class=\"ql-chat-clear\" id=\"ql-chat-clear\">🗑 Clean</button></div>";
  element.innerHTML = text;
  const element2 = element.querySelector(".ql-chat-messages");
  if (element2) {
    element2.scrollTop = element2.scrollHeight;
  }
  const element3 = document.getElementById("ql-chat-clear");
  if (element3) {
    element3.addEventListener("click", () => {
      qlChatHistory = [];
      saveChatHistory();
      updateHistoryBadge();
      renderHistoryView();
    });
  }
}
function renderPromptView() {
  const element = document.getElementById("ql-tab-content");
  if (!element) {
    return;
  }
  element.innerHTML = "<textarea id=\"ql-msg\" rows=\"3\" placeholder=\"Enter your command...\" spellcheck=\"false\"></textarea><div id=\"ql-attach-preview\" class=\"ql-attach-preview\" style=\"display:none\"></div><div class=\"ql-action-bar\"><div class=\"ql-action-left\"><label class=\"ql-toggle\"><input type=\"checkbox\" id=\"ql-modo-plano\"><span class=\"ql-toggle-slider\"></span></label><span class=\"ql-toggle-label-inline\">Plan Mode</span></div><div class=\"ql-action-center\"><button id=\"ql-attach-btn\" class=\"ql-attach-btn\" title=\"Attach file (max. 10)\">📎</button><button id=\"ql-optimize-btn\" class=\"ql-tool-btn\" title=\"Optimize with AI\">" + SVG_ICONS.openai + "</button><button id=\"ql-speech-btn\" class=\"ql-tool-btn\" title=\"Voice to text\">" + SVG_ICONS.mic + "</button></div><div class=\"ql-action-right-send\"><button id=\"ql-send\" class=\"ql-send-btn\">Send</button></div></div><input type=\"file\" id=\"ql-file-input\" multiple style=\"display:none\" accept=\"image/png,image/jpeg,image/webp\"><div id=\"ql-log\"></div><div class=\"ql-shortcuts-section\"><span class=\"ql-shortcuts-title\">QUICK SHORTCUTS</span><div class=\"ql-shortcuts-grid\" id=\"ql-chips\"></div></div><button id=\"ql-remove-watermark\" class=\"ql-watermark-btn\">Remove Watermark</button><button id=\"ql-shield-btn\" class=\"ql-shield-btn\"><span id=\"ql-shield-label\">Enable Shield</span></button><button id=\"ql-native-chat-btn\" class=\"ql-native-chat-btn\">Use Standard Chat</button><button id=\"ql-security-scan\" class=\"ql-watermark-btn\" style=\"background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(217,119,6,0.08));border-color:rgba(245,158,11,0.3);color:#fbbf24;margin-top:6px\">Security Analysis</button><button id=\"ql-download-project\" class=\"ql-watermark-btn\" style=\"background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(37,99,235,0.08));border-color:rgba(59,130,246,0.3);color:#60a5fa;margin-top:6px\">Download Source Code</button><div id=\"ql-download-status\" style=\"display:none\"></div>";
  setupSend();
  setupSuggestionChips();
  setupWatermarkButton();
  setupOptimize();
  setupSpeech();
  setupModoPlan();
  setupFileAttachment();
  setupShield();
  setupNativeChatButton();
  setupClipboardPaste();
  setupSecurityAnalysis();
  setupDownloadProject();
}
function setupTabs() {
  const elements = document.querySelectorAll(".ql-tab");
  elements.forEach(item => {
    item.addEventListener("click", () => {
      const attributeValue = item.getAttribute("data-tab");
      qlActiveTab = attributeValue;
      document.querySelectorAll(".ql-tab").forEach(element => element.classList.toggle("ql-tab-active", element.getAttribute("data-tab") === attributeValue));
      if (attributeValue === "history") {
        loadChatHistory(() => renderHistoryView());
      } else {
        renderPromptView();
      }
    });
  });
}
function _qlUlid() {
  const text = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let value = Date.now();
  let text2 = "";
  for (let count = 9; count >= 0; count--) {
    text2 = text[value % 32] + text2;
    value = Math.floor(value / 32);
  }
  for (let count = 0; count < 16; count++) {
    text2 += text[Math.floor(Math.random() * 32)];
  }
  return text2;
}
/* ============================================================
 * MESSAGE DELIVERY AND RUNTIME COMMAND BRIDGE
 * ============================================================ */
function sendViaWs(message, files) {
  return new Promise(function (resolve, reject) {
    const options = {
      id: "umsg_" + _qlUlid(),
      message: message,
      files: [],
      selected_elements: [],
      chat_only: false,
      view: "editor",
      view_description: "",
      optimisticImageUrls: [],
      ai_message_id: "aimsg_" + _qlUlid(),
      thread_id: "main",
      current_page: window.location.pathname || "/",
      current_viewport_width: window.innerWidth || 1280,
      current_viewport_height: window.innerHeight || 800,
      current_viewport_dpr: window.devicePixelRatio || 1,
      model: null
    };
    var value = setTimeout(function () {
      window.removeEventListener("message", value2);
      reject(new Error("Timeout: WebSocket did not respond"));
    }, 6000);
    function value2(input) {
      if (input.source !== window || !input.data) {
        return;
      }
      if (input.data.type !== "lovableWsSendResult") {
        return;
      }
      clearTimeout(value);
      window.removeEventListener("message", value2);
      if (input.data.success) {
        resolve();
      } else {
        reject(new Error(input.data.error || "WebSocket send failed"));
      }
    }
    window.addEventListener("message", value2);
    const options2 = {
      type: "lovableSendViaWs",
      payload: options
    };
    window.postMessage(options2, "*");
  });
}
chrome.runtime.onMessage.addListener(function (error, option2, option3) {
  if (option2.id !== chrome.runtime.id) {
    return;
  }
  if (error.action === "qlSendViaWs") {
    sendNativeToLovable(error.message).then(function () {
      option3({
        ok: true
      });
    }).catch(function (error2) {
      const options = {
        ok: false,
        error: error2.message
      };
      option3(options);
    });
    return true;
  }
  if (error.action === "qlActivateNativeChat") {
    activateNativeChat();
    option3({
      ok: true
    });
    return true;
  }
  if (error.action === "qlDeactivateNativeChat") {
    deactivateNativeChat();
    option3({
      ok: true
    });
    return true;
  }
  if (error.action === "qlActivateBypass") {
    activateBypass();
    option3({
      ok: true
    });
    return true;
  }
  if (error.action === "qlDeactivateBypass") {
    deactivateBypass();
    option3({
      ok: true
    });
    return true;
  }
  if (error.action === "qlQuickProjectInit") {
    quickProjectInit().then(function () {
      option3({
        ok: true
      });
    }).catch(function (error2) {
      const options = {
        ok: false,
        error: error2.message
      };
      option3(options);
    });
    return true;
  }
  if (error.action === "qlRequestToken") {
    requestLatestTokenFromHook().then(function () {
      option3({
        ok: true
      });
    }).catch(function () {
      option3({
        ok: false
      });
    });
    return true;
  }
  if (error.action === "qlPublishProject" || error.action === "PUBLISH_PROJECT") {
    (async () => {
      try {
        const {
          token: value,
          projectId: value2
        } = await getStoredLovableTokenAndProject();
        const options = {
          projectId: value2,
          token: value
        };
        const value3 = await publishProject(options);
        option3(value3);
      } catch (value) {
        const options = {
          ok: false,
          error: value.message
        };
        option3(options);
      }
    })();
    return true;
  }
  if (error.action === "qlGetSecurityData" || error.action === "GET_SECURITY_DATA") {
    (async () => {
      try {
        const {
          token: value,
          projectId: value2
        } = await getStoredLovableTokenAndProject();
        const options = {
          projectId: value2,
          token: value
        };
        const value3 = await getSecurityData(options);
        option3(value3);
      } catch (value) {
        const options = {
          ok: false,
          error: value.message
        };
        option3(options);
      }
    })();
    return true;
  }
  if (error.action === "qlRunSecurityScan" || error.action === "RUN_SECURITY_SCAN") {
    (async () => {
      try {
        const {
          token: value,
          projectId: value2
        } = await getStoredLovableTokenAndProject();
        const options = {
          projectId: value2,
          token: value,
          force: error.force
        };
        const value3 = await runSecurityScan(options);
        option3(value3);
      } catch (value) {
        const options = {
          ok: false,
          error: value.message
        };
        option3(options);
      }
    })();
    return true;
  }
  if (error.action === "qlFixAllSecurity" || error.action === "FIX_ALL_SECURITY") {
    (async () => {
      try {
        const {
          token: value,
          projectId: value2
        } = await getStoredLovableTokenAndProject();
        const options = {
          projectId: value2,
          token: value,
          findings: error.findings || _lastSecurityFindings
        };
        const value3 = await fixAllSecurityFindings(options);
        option3(value3);
      } catch (value) {
        const options = {
          ok: false,
          error: value.message
        };
        option3(options);
      }
    })();
    return true;
  }
});
async function quickProjectInit() {
  if (window.location.pathname.match(/\/projects\/[a-f0-9-]{36}/i)) {
    throw new Error("Use this button on the Lovable home screen, with no project open.");
  }
  const element = document.querySelector("form#chat-input");
  if (!element) {
    throw new Error("Form not found. Make sure you are on the Lovable home screen.");
  }
  const element2 = element.querySelector("[contenteditable=\"true\"]");
  if (!element2) {
    throw new Error("Text field not found.");
  }
  const element3 = document.getElementById("chatinput-send-message-button");
  if (!element3) {
    throw new Error("Create button not found.");
  }
  element2.focus();
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, ".");
  await new Promise(resolve => setTimeout(resolve, 300));
  if (element3.disabled) {
    element3.removeAttribute("disabled");
  }
  element3.click();
  const value = await new Promise(function (resolve) {
    const count = 25000;
    const value2 = Date.now();
    const value3 = setInterval(function () {
      if (Date.now() - value2 > count) {
        clearInterval(value3);
        resolve(false);
        return;
      }
      const element4 = document.querySelector("button[aria-label=\"Stop generating\"]");
      if (element4 && !element4.disabled) {
        clearInterval(value3);
        element4.click();
        resolve(true);
      }
    }, 200);
  });
  if (!value) {
    throw new Error("Timeout waiting for Stop. Check if a project was created in your list.");
  }
}
const MAX_FILES = 10;
const MAX_FILE_SIZE = 20971520;
let qlAttachedFiles = [];
/* ============================================================
 * FILE ATTACHMENT AND MEDIA UPLOAD
 * ============================================================ */
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + " B";
  }
  if (bytes < 1048576) {
    return (bytes / 1024).toFixed(1) + " KB";
  }
  return (bytes / 1048576).toFixed(1) + " MB";
}
function isImageType(mimeType) {
  return ["image/png", "image/jpeg", "image/webp"].includes(mimeType);
}
async function compressImage(error) {
  return new Promise(resolve => {
    const value = new Image();
    const value2 = URL.createObjectURL(error);
    value.onload = () => {
      URL.revokeObjectURL(value2);
      const count = 1280;
      let value3 = value.width;
      let value4 = value.height;
      if (value3 > count || value4 > count) {
        const value8 = Math.min(count / value3, count / value4);
        value3 = Math.round(value3 * value8);
        value4 = Math.round(value4 * value8);
      }
      const element = document.createElement("canvas");
      element.width = value3;
      element.height = value4;
      const value5 = element.getContext("2d");
      value5.drawImage(value, 0, 0, value3, value4);
      const value6 = error.type === "image/png" ? "image/png" : "image/jpeg";
      const value7 = error.type === "image/png" ? undefined : 0.8;
      element.toBlob(input => {
        if (!input) {
          const options3 = {
            file: error,
            previewUrl: null
          };
          return resolve(options3);
        }
        const options = {
          type: value6
        };
        const value8 = new File([input], error.name, options);
        const value9 = URL.createObjectURL(input);
        const options2 = {
          file: value8,
          previewUrl: value9
        };
        resolve(options2);
      }, value6, value7);
    };
    value.onerror = () => {
      URL.revokeObjectURL(value2);
      const options = {
        file: error,
        previewUrl: null
      };
      resolve(options);
    };
    value.src = value2;
  });
}
function decodeJwtUserId(token) {
  const jwtPayload = decodeJwtPayload(token);
  if (!jwtPayload || typeof jwtPayload !== "object") {
    return null;
  }
  return jwtPayload.sub || jwtPayload.user_id || null;
}
async function uploadFileDirect(error, token) {
  const value = crypto.randomUUID();
  const handler = error2 => {
    if (error2 && typeof error2.type === "string" && error2.type.trim()) {
      return error2.type;
    }
    const value4 = (error2 && error2.name ? error2.name : "").toLowerCase();
    const value5 = value4.includes(".") ? value4.split(".").pop() : "";
    const options = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif"
    };
    return options[value5] || "application/octet-stream";
  };
  const handler2 = (input, error2) => {
    const value4 = error2 && error2.name ? String(error2.name) : "";
    const value5 = value4.includes(".") ? value4.split(".").pop().toLowerCase() : "";
    const value6 = value5 && /^[a-z0-9]{1,10}$/.test(value5) ? value5 : "png";
    const value7 = Date.now();
    return "uploads/" + value7 + "-" + input + "." + value6;
  };
  const value2 = handler(error);
  if (!error.type) {
    try {
      const options = {
        type: value2
      };
      error = new File([error], error.name || "file", options);
    } catch (value4) {}
  }
  const value3 = await new Promise(resolve => chrome.storage.local.get(["eu_license_key", "ql_license_key"], resolve));
  return window.EUBackend.uploadMedia(error, window.EUBackend.getLicenseKey(value3));
}
function renderAttachPreview() {
  const element = document.getElementById("ql-attach-preview");
  if (!element) {
    return;
  }
  if (qlAttachedFiles.length === 0) {
    element.style.display = "none";
    element.innerHTML = "";
    return;
  }
  element.style.display = "flex";
  element.innerHTML = qlAttachedFiles.map((item, index) => {
    const value = item.previewUrl ? "<img class=\"ql-attach-thumb\" src=\"" + item.previewUrl + "\" alt=\"\">" : "<div class=\"ql-attach-icon\">📄</div>";
    const value2 = item.uploading ? " ql-attach-uploading" : "";
    return "<div class=\"ql-attach-item" + value2 + "\" data-idx=\"" + index + "\">" + value + "<div class=\"ql-attach-info\"><span class=\"ql-attach-name\" title=\"" + escapeHtml(item.file_name) + "\">" + escapeHtml(item.file_name) + "</span><span class=\"ql-attach-size\">" + escapeHtml(item.sizeLabel) + "</span></div><button class=\"ql-attach-remove\" data-idx=\"" + index + "\">✕</button></div>";
  }).join("");
  element.querySelectorAll(".ql-attach-remove").forEach(item => {
    item.addEventListener("click", event => {
      event.stopPropagation();
      const value = parseInt(item.getAttribute("data-idx"));
      if (qlAttachedFiles[value] && qlAttachedFiles[value].previewUrl) {
        URL.revokeObjectURL(qlAttachedFiles[value].previewUrl);
      }
      qlAttachedFiles.splice(value, 1);
      renderAttachPreview();
    });
  });
}
function setupFileAttachment() {
  const element = document.getElementById("ql-attach-btn");
  const element2 = document.getElementById("ql-file-input");
  if (!element || !element2) {
    return;
  }
  element.addEventListener("click", () => {
    if (qlAttachedFiles.length >= MAX_FILES) {
      showCustomAlert("Limit", "Maximum of " + MAX_FILES + " files.");
      return;
    }
    element2.click();
  });
  element2.addEventListener("change", async () => {
    const items = Array.from(element2.files || []);
    element2.value = "";
    if (!items.length) {
      return;
    }
    const value = await new Promise(resolve => chrome.storage.local.get(["lovable_token"], resolve));
    let value2 = value.lovable_token || "";
    if (!value2) {
      showCustomAlert("Error", "Token not captured. Navigate in Lovable to sync.");
      return;
    }
    if (value2.startsWith("Bearer ")) {
      value2 = value2.slice(7);
    }
    const handler = async input => {
      const value3 = await input.slice(0, 12).arrayBuffer();
      const value4 = new Uint8Array(value3);
      const value5 = value4[0] === 137 && value4[1] === 80 && value4[2] === 78 && value4[3] === 71;
      const value6 = value4[0] === 255 && value4[1] === 216 && value4[2] === 255;
      const value7 = value4[0] === 82 && value4[1] === 73 && value4[2] === 70 && value4[3] === 70 && value4[8] === 87 && value4[9] === 69 && value4[10] === 66 && value4[11] === 80;
      return value5 || value6 || value7;
    };
    for (const value3 of items) {
      if (qlAttachedFiles.length >= MAX_FILES) {
        showCustomAlert("Limit", "Maximum of " + MAX_FILES + " files reached.");
        break;
      }
      if (!isImageType(value3.type)) {
        showCustomAlert("Invalid type", value3.name + " is not an image. Only PNG, JPEG, and WEBP are accepted.");
        continue;
      }
      if (value3.size > MAX_FILE_SIZE) {
        showCustomAlert("Large file", value3.name + " exceeds 20MB.");
        continue;
      }
      const value4 = await handler(value3);
      if (!value4) {
        showCustomAlert("Invalid file", value3.name + " is not a valid image.");
        continue;
      }
      let value5 = value3;
      let value6 = null;
      if (isImageType(value3.type)) {
        const value9 = await compressImage(value3);
        value5 = value9.file;
        value6 = value9.previewUrl;
      }
      const value7 = isImageType(value5.type);
      const value8 = qlAttachedFiles.length;
      qlAttachedFiles.push({
        file_id: null,
        file_name: value3.name,
        previewUrl: value6,
        file_type: value5.type,
        sizeLabel: formatFileSize(value5.size),
        uploading: true,
        rawFile: value5
      });
      renderAttachPreview();
      try {
        const value9 = await uploadFileDirect(value5, value2);
        qlAttachedFiles[value8].file_id = value9.file_id;
        qlAttachedFiles[value8].public_url = value9.public_url;
        qlAttachedFiles[value8].uploading = false;
        renderAttachPreview();
      } catch (value9) {
        console.warn("[QL Upload] Failed to upload to storage:", value9.message);
        qlAttachedFiles[value8].uploading = false;
        qlAttachedFiles[value8].uploadFailed = true;
        renderAttachPreview();
        showCustomAlert("Upload Error", "Could not upload the image: " + (value9.message || "unknown error"));
      }
    }
  });
}
async function sendNativeToLovable(message) {
  const element = document.querySelector("form#chat-input");
  if (!element) {
    throw new Error("Lovable chat not found. Open a project.");
  }
  const element2 = element.querySelector("[contenteditable=\"true\"]");
  if (!element2) {
    throw new Error("Chat editor not found on the page.");
  }
  const element3 = document.getElementById("chatinput-send-message-button");
  if (!element3) {
    throw new Error("please wait");
  }
  element2.focus();
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, message);
  await new Promise(resolve => setTimeout(resolve, 200));
  const value = element3.disabled;
  if (value) {
    element3.removeAttribute("disabled");
  }
  element3.click();
  if (value) {
    element3.setAttribute("disabled", "");
  }
}
function setupSend() {
  const element = document.getElementById("ql-send");
  if (!element) {
    return;
  }
  element.addEventListener("click", async () => {
    var element2 = document.getElementById("ql-msg");
    const value = element2 ? (element2.value || "").trim() : "";
    const element3 = document.getElementById("ql-log");
    if (!value) {
      if (element3) {
        element3.className = "ql-log-error";
        element3.innerText = "⚠ Empty prompt";
      }
      return;
    }
    const filteredItems = qlAttachedFiles.filter(function (item) {
      return item.public_url && !item.uploading && !item.uploadFailed;
    });
    const value2 = filteredItems.length > 0;
    var value3 = value;
    if (value2) {
      var value4 = filteredItems.map(function (item) {
        return item.public_url;
      }).join("\n");
      var value5 = filteredItems.length > 1 ? "Attached files:\n" : "Attached file: ";
      value3 = value + "\n\n" + value5 + value4;
    }
    try {
      if (element3) {
        element3.className = "ql-log-info";
        element3.innerHTML = value2 ? "📎 Sending with image..." : SVG_ICONS.clock + " Sending prompt...";
      }
      element.classList.add("ql-sending");
      element.disabled = true;
      await sendNativeToLovable(value3);
      if (element3) {
        element3.className = "ql-log-success";
        element3.innerText = value2 ? "✓ Prompt sent!" : "✓ Prompt sent!";
      }
      try {
        if (typeof QLSounds !== "undefined") {
          QLSounds.promptSent();
        }
      } catch (value6) {}
      addToChatHistory(value, "ok");
      var element4 = document.getElementById("ql-msg");
      if (element4) {
        element4.value = "";
      }
      qlAttachedFiles.forEach(item => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      qlAttachedFiles = [];
      renderAttachPreview();
    } catch (value6) {
      if (element3) {
        element3.className = "ql-log-error";
        element3.innerText = "✗ " + (value6.message || value6);
      }
      addToChatHistory(value, "error");
    } finally {
      element.classList.remove("ql-sending");
      element.disabled = false;
    }
  });
}
let _dragCleanup = null;
let _resizeCleanup = null;
/* ============================================================
 * FLOATING PANEL INTERACTION
 * ============================================================ */
function setupDrag() {
  if (_dragCleanup) {
    _dragCleanup();
    _dragCleanup = null;
  }
  const element = document.getElementById("ql-floating");
  const element2 = document.getElementById("ql-header");
  if (!element || !element2) {
    return;
  }
  let isActive = false;
  let count = 0;
  let count2 = 0;
  let count3 = 0;
  let count4 = 0;
  function value(event) {
    var value4 = event.target;
    while (value4 && value4 !== element2) {
      var value5 = value4.nodeName;
      if (value5 === "BUTTON" || value5 === "INPUT" || value5 === "SELECT" || value5 === "TEXTAREA" || value5 === "A") {
        return;
      }
      value4 = value4.parentElement;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    const bounds = element.getBoundingClientRect();
    count = event.clientX;
    count2 = event.clientY;
    count3 = bounds.left;
    count4 = bounds.top;
    isActive = true;
    try {
      element2.setPointerCapture(event.pointerId);
    } catch (value6) {}
    document.addEventListener("pointermove", value2);
    document.addEventListener("pointerup", value3);
  }
  function value2(input) {
    if (!isActive) {
      return;
    }
    document.body.style.userSelect = "none";
    let value4 = count3 + (input.clientX - count);
    let value5 = count4 + (input.clientY - count2);
    value4 = Math.max(0, Math.min(value4, window.innerWidth - element.offsetWidth));
    value5 = Math.max(0, Math.min(value5, window.innerHeight - element.offsetHeight));
    element.style.left = value4 + "px";
    element.style.top = value5 + "px";
  }
  function value3(input) {
    if (!isActive) {
      return;
    }
    isActive = false;
    document.body.style.userSelect = "";
    try {
      element2.releasePointerCapture(input.pointerId);
    } catch (value4) {}
    document.removeEventListener("pointermove", value2);
    document.removeEventListener("pointerup", value3);
    document.body.style.userSelect = "";
  }
  element2.addEventListener("pointerdown", value, {
    passive: false
  });
  _dragCleanup = function () {
    element2.removeEventListener("pointerdown", value);
    document.removeEventListener("pointermove", value2);
    document.removeEventListener("pointerup", value3);
  };
}
function setupResize() {
  if (_resizeCleanup) {
    _resizeCleanup();
    _resizeCleanup = null;
  }
  const element = document.getElementById("ql-floating");
  const element2 = document.getElementById("ql-resize-handle");
  if (!element || !element2) {
    return;
  }
  let isActive = false;
  let count = 0;
  let count2 = 0;
  function value(event) {
    event.preventDefault();
    event.stopPropagation();
    isActive = true;
    count = event.clientY;
    count2 = element.offsetHeight;
    try {
      element2.setPointerCapture(event.pointerId);
    } catch (value4) {}
    document.addEventListener("pointermove", value2);
    document.addEventListener("pointerup", value3);
    document.body.style.userSelect = "none";
  }
  function value2(input) {
    if (!isActive) {
      return;
    }
    let value4 = count2 + (input.clientY - count);
    value4 = Math.max(200, Math.min(value4, window.innerHeight * 0.8));
    element.style.height = value4 + "px";
  }
  function value3(input) {
    if (!isActive) {
      return;
    }
    isActive = false;
    qlHeight = element.offsetHeight;
    const options = {
      ql_height: qlHeight
    };
    chrome.storage.local.set(options);
    try {
      element2.releasePointerCapture(input.pointerId);
    } catch (value4) {}
    document.removeEventListener("pointermove", value2);
    document.removeEventListener("pointerup", value3);
    document.body.style.userSelect = "";
  }
  element2.addEventListener("pointerdown", value, {
    passive: false
  });
  _resizeCleanup = function () {
    element2.removeEventListener("pointerdown", value);
    document.removeEventListener("pointermove", value2);
    document.removeEventListener("pointerup", value3);
  };
}
function setupClipboardPaste() {
  var element = document.getElementById("ql-msg");
  if (!element) {
    return;
  }
  var value = document.getElementById("ql-floating") || element;
  var element2 = null;
  function value2() {
    if (element2) {
      return;
    }
    element2 = document.createElement("div");
    element2.className = "ql-drag-overlay";
    element2.innerHTML = "<div class=\"ql-drag-overlay-inner\">📂 Drop files here</div>";
    var element3 = document.getElementById("ql-floating");
    if (element3) {
      element3.appendChild(element2);
    }
  }
  function value3() {
    if (element2) {
      element2.remove();
      element2 = null;
    }
  }
  value.addEventListener("dragover", function (event) {
    event.preventDefault();
    event.stopPropagation();
    value2();
  });
  value.addEventListener("dragleave", function (event) {
    event.preventDefault();
    event.stopPropagation();
    if (!value.contains(event.relatedTarget)) {
      value3();
    }
  });
  value.addEventListener("drop", async function (event) {
    event.preventDefault();
    event.stopPropagation();
    value3();
    var items = Array.from(event.dataTransfer.files || []);
    if (!items.length) {
      return;
    }
    await handleFilesAttach(items);
  });
  element.addEventListener("paste", async function (event) {
    var value4 = event.clipboardData && event.clipboardData.items;
    if (!value4) {
      return;
    }
    var items = [];
    for (var count = 0; count < value4.length; count++) {
      var value5 = value4[count];
      if (value5.kind === "file") {
        event.preventDefault();
        var value6 = value5.getAsFile();
        if (value6) {
          items.push(value6);
        }
      }
    }
    if (items.length > 0) {
      await handleFilesAttach(items);
    }
  });
}
async function handleFilesAttach(files) {
  if (qlAttachedFiles.length >= MAX_FILES) {
    showCustomAlert("Limit", "Maximo " + MAX_FILES + " files.");
    return;
  }
  var value = await new Promise(function (resolve) {
    chrome.storage.local.get(["lovable_token"], resolve);
  });
  var value2 = value.lovable_token || "";
  if (!value2) {
    showCustomAlert("Error", "Token not captured.");
    return;
  }
  if (value2.indexOf("Bearer ") === 0) {
    value2 = value2.slice(7);
  }
  for (var count = 0; count < files.length; count++) {
    var value3 = files[count];
    if (qlAttachedFiles.length >= MAX_FILES) {
      break;
    }
    if (value3.size > MAX_FILE_SIZE) {
      showCustomAlert("Too large", value3.name + " exceeds 20MB.");
      continue;
    }
    var value4 = value3;
    var value5 = null;
    if (isImageType(value3.type)) {
      var value6 = await compressImage(value3);
      value4 = value6.file;
      value5 = value6.previewUrl;
    }
    var value7 = qlAttachedFiles.length;
    qlAttachedFiles.push({
      file_id: null,
      file_name: value3.name || "file_" + Date.now(),
      previewUrl: value5,
      file_type: value4.type,
      sizeLabel: formatFileSize(value4.size),
      uploading: true,
      rawFile: value4
    });
    renderAttachPreview();
    try {
      var value8 = await uploadFileDirect(value4, value2);
      qlAttachedFiles[value7].file_id = value8.file_id;
      qlAttachedFiles[value7].uploading = false;
      renderAttachPreview();
    } catch (value9) {
      qlAttachedFiles[value7].uploading = false;
      qlAttachedFiles[value7].file_id = "local_direct_" + crypto.randomUUID();
      qlAttachedFiles[value7].uploadFailed = true;
      renderAttachPreview();
    }
  }
  showCustomAlert("Attached 📎", files.length + " file(s) added!");
}
var CURRENT_EXT_VERSION_POPUP = "3.0";
/* ============================================================
 * PROJECT SOURCE DOWNLOAD
 * ============================================================ */
function setupDownloadProject() {
  var element = document.getElementById("ql-download-project");
  if (!element) {
    return;
  }
  element.addEventListener("click", async function () {
    var element2 = document.getElementById("ql-download-status");
    element.disabled = true;
    element.textContent = "Preparing...";
    if (element2) {
      element2.style.display = "block";
      element2.className = "ql-log-info";
      element2.textContent = "Checking token and project...";
    }
    try {
      var value = await new Promise(function (resolve) {
        chrome.storage.local.get(["lovable_token", "lovable_projectId"], resolve);
      });
      var value2 = value.lovable_token || "";
      var value3 = value.lovable_projectId || "";
      if (value2.indexOf("Bearer ") === 0) {
        value2 = value2.slice(7);
      }
      var value4 = value3;
      if (!value4) {
        throw new Error("Open a Lovable project page first.");
      }
      if (!value2) {
        var value5 = await new Promise(function (resolve) {
          chrome.runtime.sendMessage({
            action: "readCookies"
          }, function (response2) {
            resolve(response2);
          });
        });
        if (value5 && value5.success && value5.tokens && value5.tokens.length > 0) {
          value2 = value5.tokens[0].token;
        }
      }
      if (!value2) {
        throw new Error("Token not found. Open a Lovable project and wait for sync.");
      }
      element.textContent = "Downloading...";
      if (element2) {
        element2.textContent = "Downloading project files...";
      }
      var value6 = await new Promise(function (resolve) {
        const options = {
          action: "downloadProject",
          projectId: value4,
          token: value2
        };
        chrome.runtime.sendMessage(options, function (response2) {
          resolve(response2);
        });
      });
      if (!value6 || !value6.success) {
        throw new Error(value6 && value6.error ? value6.error : "Download failed");
      }
      var value7 = value6.files;
      if (!value7 || value7.length === 0) {
        throw new Error("No files found in the project.");
      }
      if (element2) {
        element2.textContent = "Creating ZIP with " + value7.length + " files...";
      }
      element.textContent = "Packaging...";
      if (typeof JSZip === "undefined") {
        throw new Error("JSZip is not loaded. Use the Side Panel.");
      }
      var zipArchive = new JSZip();
      var items = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp", ".tiff"];
      var count = 0;
      for (var count2 = 0; count2 < value7.length; count2++) {
        var value8 = value7[count2];
        if (!value8.name || value8.sizeExceeded) {
          continue;
        }
        if (value8.contents && value8.binary) {
          zipArchive.file(value8.name, value8.contents, {
            base64: true,
            binary: true
          });
          count++;
        } else if (!value8.contents && items.some(function (input) {
          return value8.name.toLowerCase().endsWith(input);
        })) {
          try {
            var response = await fetch("https://api.lovable.dev/projects/" + value4 + "/files/raw?path=" + encodeURIComponent(value8.name), {
              method: "GET",
              headers: {
                Authorization: "Bearer " + value2
              },
              credentials: "omit",
              mode: "cors"
            });
            if (response.ok) {
              zipArchive.file(value8.name, await response.arrayBuffer(), {
                binary: true
              });
              count++;
            } else if (value8.contents) {
              zipArchive.file(value8.name, value8.contents);
              count++;
            }
          } catch (value10) {
            if (value8.contents) {
              zipArchive.file(value8.name, value8.contents);
              count++;
            }
          }
        } else if (value8.contents) {
          zipArchive.file(value8.name, value8.contents);
          count++;
        }
      }
      var value9 = await zipArchive.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
          level: 9
        }
      });
      var element3 = document.createElement("a");
      element3.href = URL.createObjectURL(value9);
      element3.download = "lovable-" + value4.substring(0, 8) + "-" + new Date().toISOString().split("T")[0] + ".zip";
      document.body.appendChild(element3);
      element3.click();
      document.body.removeChild(element3);
      URL.revokeObjectURL(element3.href);
      if (element2) {
        element2.className = "ql-log-success";
        element2.textContent = count + " files downloaded!";
      }
      element.textContent = "Download Complete!";
      setTimeout(function () {
        element.textContent = "Download Source Code";
        element.disabled = false;
        if (element2) {
          element2.style.display = "none";
        }
      }, 4000);
    } catch (value10) {
      if (element2) {
        element2.className = "ql-log-error";
        element2.textContent = value10.message || value10;
        element2.style.display = "block";
      }
      element.textContent = "Failed";
      setTimeout(function () {
        element.textContent = "Download Source Code";
        element.disabled = false;
      }, 3000);
    }
  });
}
async function checkForUpdatePopup() {
  chrome.storage.local.get(["eu_operations", "ql_operations"], input => {
    euMaybeShowOptionalUpgrade(input.eu_operations || input.ql_operations);
  });
}
async function checkResellerRolePopup() {
  return;
}
let qlNativeChatActive = false;
let qlNativeChatCleanup = null;
/* ============================================================
 * NATIVE CHAT MODE
 * ============================================================ */
function activateNativeChat() {
  qlNativeChatActive = true;
  chrome.storage.local.set({
    ql_native_chat: true
  });
  const element = document.getElementById("ql-floating");
  if (element) {
    element.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    element.style.opacity = "0";
    element.style.transform = "scale(0.95) translateX(20px)";
    setTimeout(() => {
      element.style.display = "none";
    }, 350);
  }
  injectNativeChatOverlay();
}
function deactivateNativeChat() {
  qlNativeChatActive = false;
  chrome.storage.local.set({
    ql_native_chat: false
  });
  if (qlNativeChatCleanup) {
    qlNativeChatCleanup();
    qlNativeChatCleanup = null;
  }
  const element = document.getElementById("ql-native-badge");
  if (element) {
    element.remove();
  }
  const element2 = document.getElementById("ql-native-return-btn");
  if (element2) {
    element2.remove();
  }
  const element3 = document.getElementById("chatinput-send-message-button");
  if (element3) {
    element3.classList.remove("ql-native-send-active");
    element3.style.animation = "";
  }
  const element4 = document.getElementById("ql-floating");
  if (element4) {
    element4.style.display = "";
    element4.style.opacity = "0";
    element4.style.transform = "scale(0.95)";
    requestAnimationFrame(() => {
      element4.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      element4.style.opacity = "1";
      element4.style.transform = "scale(1) translateX(0)";
    });
  } else {
    _buildFloatingUI();
  }
}
function injectNativeChatOverlay() {
  const element = document.querySelector("form#chat-input");
  if (!element) {
    setTimeout(injectNativeChatOverlay, 500);
    return;
  }
  if (!document.getElementById("ql-native-badge")) {
    const value4 = getComputedStyle(element).position;
    if (value4 === "static") {
      element.style.position = "relative";
    }
    const element3 = document.createElement("div");
    element3.id = "ql-native-badge";
    element3.className = "ql-native-badge";
    element3.innerHTML = "⚡ <span>Lovable</span>";
    element.appendChild(element3);
  }
  if (!document.getElementById("ql-native-return-btn")) {
    const element3 = document.createElement("button");
    element3.id = "ql-native-return-btn";
    element3.className = "ql-native-return-btn";
    element3.innerHTML = "← Back to Extension";
    element3.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      deactivateNativeChat();
    });
    element.parentElement.insertBefore(element3, element.nextSibling);
  }
  const element2 = document.getElementById("chatinput-send-message-button");
  if (element2) {
    element2.classList.add("ql-native-send-active");
  }
  function value(input) {
    if (!qlNativeChatActive) {
      return;
    }
    const element3 = element.querySelector("[contenteditable=\"true\"]");
    const value4 = element3 ? (element3.innerText || element3.textContent || "").trim() : "";
    if (value4) {
      addToChatHistory(value4, "ok");
    }
  }
  function value2(input) {
    if (!qlNativeChatActive) {
      return;
    }
    const element3 = element.querySelector("[contenteditable=\"true\"]");
    const value4 = element3 ? (element3.innerText || element3.textContent || "").trim() : "";
    if (value4) {
      addToChatHistory(value4, "ok");
    }
  }
  function value3(input) {
    if (!qlNativeChatActive) {
      return;
    }
    if (input.key === "Enter" && !input.shiftKey) {
      const element3 = element.querySelector("[contenteditable=\"true\"]");
      const value4 = element3 ? (element3.innerText || element3.textContent || "").trim() : "";
      if (value4) {
        addToChatHistory(value4, "ok");
      }
    }
  }
  if (element2) {
    element2.addEventListener("click", value, true);
  }
  element.addEventListener("submit", value2, true);
  element.addEventListener("keydown", value3, true);
  qlNativeChatCleanup = function () {
    if (element2) {
      element2.removeEventListener("click", value, true);
    }
    element.removeEventListener("submit", value2, true);
    element.removeEventListener("keydown", value3, true);
  };
}
async function sendViaNativeChat(message, options) {
  addToChatHistory(message, "ok");
}
function showNativeSendingOverlay(message) {
  const text = "ql-native-sending-overlay";
  const element = document.getElementById(text);
  if (!message) {
    if (element) {
      element.remove();
    }
    return;
  }
  if (element) {
    return;
  }
  const element2 = document.createElement("div");
  element2.id = text;
  element2.className = "ql-native-sending-overlay";
  element2.innerHTML = "<div class=\"ql-spinner\"></div> Enviando prompt...";
  document.body.appendChild(element2);
}
function showNativeChatToast(message, kind) {
  const element = document.getElementById("ql-native-toast");
  if (element) {
    element.remove();
  }
  const element2 = document.createElement("div");
  element2.id = "ql-native-toast";
  element2.className = "ql-native-toast ql-native-toast-" + kind;
  element2.textContent = message;
  document.body.appendChild(element2);
  requestAnimationFrame(() => element2.classList.add("ql-native-toast-visible"));
  setTimeout(() => {
    element2.classList.remove("ql-native-toast-visible");
    setTimeout(() => element2.remove(), 300);
  }, 3000);
}
function setupNativeChatButton() {
  const element = document.getElementById("ql-native-chat-btn");
  if (!element) {
    return;
  }
  element.addEventListener("click", () => {
    activateNativeChat();
  });
}
chrome.storage.local.get(["ql_native_chat"], input => {
  if (input.ql_native_chat === true) {
    qlNativeChatActive = true;
    setTimeout(() => {
      const element = document.getElementById("ql-floating");
      if (element) {
        element.style.display = "none";
      }
      injectNativeChatOverlay();
    }, 500);
  }
});
window.addEventListener("message", function (event) {
  if (!event.data || event.data.type !== "qlPreviewBuilt") {
    return;
  }
  if (!event.origin.endsWith("lovable.dev")) {
    return;
  }
  setTimeout(function () {
    const items = Array.from(document.querySelectorAll("iframe"));
    const value = items.find(function (input) {
      return input.src && (input.src.includes("lovableproject.com") || input.src.includes("lovable-app") || input.src.includes(".lovable.") && !input.src.includes("lovable.dev"));
    }) || items.find(function (input) {
      return input.src && input.src.startsWith("https://") && !input.src.includes("chrome-extension://") && !input.src.includes("lovable.dev");
    });
    if (value && value.src) {
      console.log("[QL] 🔄 Auto-refresh preview iframe after bypass:", value.src.slice(0, 80));
      const value2 = value.src;
      value.src = "";
      setTimeout(function () {
        value.src = value2;
      }, 100);
    } else {
      console.log("[QL] [qlPreviewBuilt] NONE iframe preview found — reload the preview manually");
    }
  }, 2500);
});
window.addEventListener("message", event => {
  if (!event.data || event.data.type !== "lovableTokenFound") {
    return;
  }
  if (!event.origin.endsWith("lovable.dev")) {
    return;
  }
  const options = {};
  if (event.data.token && typeof event.data.token === "string") {
    options.lovable_token = event.data.token.replace(/^Bearer\s+/i, "").trim();
  }
  if (event.data.projectId && typeof event.data.projectId === "string") {
    options.lovable_projectId = event.data.projectId;
  }
  if (!Object.keys(options).length) {
    return;
  }
  chrome.storage.local.set(options, () => {
    updateSyncStatus();
    setTimeout(updateSyncStatus, 200);
    setTimeout(updateSyncStatus, 800);
  });
});
let _lastSecurityFindings = [];
/* ============================================================
 * SECURITY ANALYSIS AND DEPLOYMENT API
 * ============================================================ */
async function getStoredLovableTokenAndProject() {
  var value = await new Promise(function (resolve) {
    chrome.storage.local.get(["lovable_token", "lovable_projectId"], resolve);
  });
  var value2 = value.lovable_token || "";
  var value3 = value.lovable_projectId || "";
  if (value2.indexOf("Bearer ") === 0) {
    value2 = value2.slice(7);
  }
  if (!value2) {
    var value4 = await new Promise(function (resolve) {
      chrome.runtime.sendMessage({
        action: "readCookies"
      }, function (response) {
        resolve(response);
      });
    });
    if (value4 && value4.success && value4.tokens && value4.tokens.length > 0) {
      value2 = value4.tokens[0].token;
    }
  }
  const options = {
    token: value2,
    projectId: value3
  };
  return options;
}
function setupSecurityAnalysis() {
  const element = document.getElementById("ql-security-scan");
  if (!element) {
    return;
  }
  element.addEventListener("click", async function () {
    let element2 = document.getElementById("security-modal");
    if (!element2) {
      const element3 = document.createElement("div");
      element3.innerHTML = templateSecurityModal();
      element2 = element3.firstElementChild;
      document.body.appendChild(element2);
      element2.querySelector("#security-modal-close").addEventListener("click", () => {
        element2.setAttribute("hidden", "");
      });
      element2.querySelector("#security-backdrop").addEventListener("click", () => {
        element2.setAttribute("hidden", "");
      });
      element2.querySelector("#security-rescan").addEventListener("click", async () => {
        const element4 = element2.querySelector("#security-rescan");
        const element5 = element2.querySelector(".security-rescan-text");
        const element6 = element2.querySelector(".security-rescan-spinner");
        element4.disabled = true;
        if (element6) {
          element6.style.display = "inline-block";
        }
        if (element5) {
          element5.textContent = "Analyzing...";
        }
        renderSecurityState("loading", "Starting a new analysis...");
        try {
          const {
            token: value,
            projectId: value2
          } = await getStoredLovableTokenAndProject();
          const options = {
            projectId: value2,
            token: value,
            force: true
          };
          const response = await runSecurityScan(options);
          if (!response.ok) {
            throw new Error(response.error || "Scan failed");
          }
          renderSecurityState("loading", "Analysis started. Waiting for results...");
          await new Promise(resolve => setTimeout(resolve, 5000));
          await loadSecurityFindings(element2);
        } catch (value) {
          renderSecurityState("error", value.message);
        } finally {
          element4.disabled = false;
          if (element6) {
            element6.style.display = "none";
          }
          if (element5) {
            element5.textContent = "Scan again now";
          }
        }
      });
      element2.querySelector("#security-fix-all").addEventListener("click", async () => {
        const element4 = element2.querySelector("#security-fix-all");
        const element5 = element2.querySelector(".security-fixall-text");
        const element6 = element2.querySelector(".security-fixall-spinner");
        element4.disabled = true;
        if (element6) {
          element6.style.display = "inline-block";
        }
        if (element5) {
          element5.textContent = "Sending...";
        }
        try {
          const {
            token: value,
            projectId: value2
          } = await getStoredLovableTokenAndProject();
          const options = {
            projectId: value2,
            token: value,
            findings: _lastSecurityFindings
          };
          const response = await fixAllSecurityFindings(options);
          if (response.ok) {
            if (element5) {
              element5.textContent = "✓ Sent!";
            }
            setTimeout(() => {
              element2.setAttribute("hidden", "");
              if (element5) {
                element5.textContent = "Fix All";
              }
            }, 1800);
          } else {
            throw new Error(response.error || "Fix failed");
          }
        } catch (value) {
          renderSecurityState("error", value.message);
        } finally {
          element4.disabled = false;
          if (element6) {
            element6.style.display = "none";
          }
        }
      });
    }
    element2.removeAttribute("hidden");
    renderSecurityState("loading", "Loading analysis...");
    await loadSecurityFindings(element2);
  });
}
async function loadSecurityFindings(modal) {
  try {
    const {
      token: value,
      projectId: value2
    } = await getStoredLovableTokenAndProject();
    if (!value2) {
      throw new Error("Open a Lovable project page first.");
    }
    if (!value) {
      throw new Error("Token not found. Open a Lovable project and wait for sync.");
    }
    const options = {
      projectId: value2,
      token: value
    };
    const response = await getSecurityData(options);
    if (!response.ok) {
      throw new Error(response.error || "Failed to load security data");
    }
    renderSecurityFindings(modal, response.data);
  } catch (value) {
    renderSecurityState("error", value.message);
  }
}
function renderSecurityState(state, message) {
  const element = document.getElementById("security-body");
  const element2 = document.getElementById("security-summary");
  const element3 = document.getElementById("security-fix-all");
  if (!element) {
    return;
  }
  element.innerHTML = "";
  if (element2) {
    element2.style.display = "none";
    element2.innerHTML = "";
  }
  if (element3) {
    element3.style.display = "none";
  }
  if (state === "loading") {
    const element4 = document.createElement("div");
    element4.className = "security-loading";
    element4.innerHTML = "<div class=\"sl-spinner\"></div><div>" + (message || "Loading analysis...") + "</div>";
    element.appendChild(element4);
  } else if (state === "error") {
    const element4 = document.createElement("div");
    element4.className = "security-error";
    element4.textContent = message || "Failed to load.";
    element.appendChild(element4);
  } else if (state === "empty") {
    const element4 = document.createElement("div");
    element4.className = "security-empty";
    element4.textContent = message || "All set. No security findings found.";
    element.appendChild(element4);
  }
}
function renderSecurityFindings(modal, securityData) {
  const element = document.getElementById("security-body");
  const element2 = document.getElementById("security-summary");
  const element3 = document.getElementById("security-fix-all");
  if (!element) {
    return;
  }
  element.innerHTML = "";
  if (element2) {
    element2.innerHTML = "";
  }
  const items = [];
  const value = securityData?.results || {};
  for (const [value2, value3] of Object.entries(value)) {
    const value4 = value3?.findings || [];
    for (const value5 of value4) {
      const options3 = {
        ...value5
      };
      options3.scanner = value3?.scanner_name || value2;
      items.push(options3);
    }
  }
  _lastSecurityFindings = items;
  const options = {
    error: 0,
    warn: 0,
    info: 0
  };
  for (const value2 of items) {
    const value3 = (value2.level || "info").toLowerCase();
    if (options[value3] !== undefined) {
      options[value3]++;
    } else {
      options.info++;
    }
  }
  if (items.length === 0) {
    if (element3) {
      element3.style.display = "none";
    }
    renderSecurityState("empty", "All set. No security findings found.");
    return;
  }
  if (element3) {
    element3.style.display = "inline-flex";
  }
  if (element2) {
    element2.style.display = "flex";
    const options3 = {
      error: "errors",
      warn: "warnings",
      info: "info"
    };
    for (const value2 of ["error", "warn", "info"]) {
      if (options[value2] === 0) {
        continue;
      }
      const element5 = document.createElement("span");
      element5.className = "sev-badge";
      element5.dataset.level = value2;
      element5.innerHTML = "<span class=\"sev-dot\"></span><span>" + options[value2] + " " + options3[value2] + "</span>";
      element2.appendChild(element5);
    }
  }
  const options2 = {
    error: 0,
    warn: 1,
    info: 2
  };
  const sortedItems = [...items].sort((left, right) => {
    const value2 = options2[(left.level || "info").toLowerCase()] ?? 2;
    const value3 = options2[(right.level || "info").toLowerCase()] ?? 2;
    return value2 - value3;
  });
  const element4 = document.createElement("ul");
  element4.className = "findings-list";
  for (const value2 of sortedItems) {
    const element5 = document.createElement("li");
    element5.className = "finding-item";
    element5.dataset.level = (value2.level || "info").toLowerCase();
    const element6 = document.createElement("div");
    element6.className = "finding-header";
    const element7 = document.createElement("span");
    element7.className = "sev-badge";
    element7.dataset.level = (value2.level || "info").toLowerCase();
    element7.innerHTML = "<span class=\"sev-dot\"></span><span>" + (value2.level || "info").toUpperCase() + "</span>";
    element6.appendChild(element7);
    const element8 = document.createElement("span");
    element8.className = "finding-name";
    element8.textContent = value2.name || value2.id || "Untitled finding";
    element6.appendChild(element8);
    if (value2.scanner) {
      const element9 = document.createElement("span");
      element9.className = "finding-scanner";
      element9.textContent = value2.scanner;
      element6.appendChild(element9);
    }
    element5.appendChild(element6);
    if (value2.description) {
      const element9 = document.createElement("p");
      element9.className = "finding-desc";
      element9.textContent = String(value2.description).replace(/\s*Remediation:\s*https?:\/\/\S+/i, "").trim();
      element5.appendChild(element9);
    }
    if (value2.link) {
      const event = document.createElement("a");
      event.className = "finding-link";
      event.href = value2.link;
      event.target = "_blank";
      event.rel = "noopener noreferrer";
      event.textContent = "See how to fix →";
      element5.appendChild(event);
    }
    element4.appendChild(element5);
  }
  element.appendChild(element4);
}
async function publishProject(credentials) {
  try {
    const response = await fetch("https://api.lovable.dev/projects/" + credentials.projectId + "/deployments?async=true", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + credentials.token
      },
      body: "{}"
    });
    if (!response.ok && response.status !== 202) {
      let text = "";
      try {
        text = (await response.text()).slice(0, 120);
      } catch (value2) {}
      return {
        ok: false,
        status: response.status,
        error: "HTTP " + response.status + (text ? ": " + text : "")
      };
    }
    const value = await response.json().catch(() => ({}));
    const options = {
      ok: true,
      deployment: value
    };
    return options;
  } catch (value) {
    return {
      ok: false,
      error: value.message || String(value)
    };
  }
}
async function getSecurityData(credentials) {
  try {
    const response = await fetch("https://api.lovable.dev/projects/" + credentials.projectId + "/security/data", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + credentials.token
      }
    });
    if (!response.ok) {
      let text = "";
      try {
        text = (await response.text()).slice(0, 120);
      } catch (value2) {}
      return {
        ok: false,
        status: response.status,
        error: "HTTP " + response.status + (text ? ": " + text : "")
      };
    }
    const value = await response.json().catch(() => ({}));
    const options = {
      ok: true,
      data: value
    };
    return options;
  } catch (value) {
    return {
      ok: false,
      error: value.message || String(value)
    };
  }
}
async function runSecurityScan(credentials) {
  try {
    const response = await fetch("https://api.lovable.dev/projects/" + credentials.projectId + "/security-scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + credentials.token
      },
      body: JSON.stringify({
        scanner_configs: [{
          name: "connector_security_scan"
        }, {
          name: "agent_security"
        }],
        force: !!credentials.force
      })
    });
    if (!response.ok) {
      let text = "";
      try {
        text = (await response.text()).slice(0, 120);
      } catch (value2) {}
      return {
        ok: false,
        status: response.status,
        error: "HTTP " + response.status + (text ? ": " + text : "")
      };
    }
    const value = await response.json().catch(() => ({}));
    const options = {
      ok: true,
      data: value
    };
    return options;
  } catch (value) {
    return {
      ok: false,
      error: value.message || String(value)
    };
  }
}
async function fixAllSecurityFindings(credentials) {
  try {
    const value = Array.isArray(credentials.findings) ? credentials.findings : [];
    if (value.length === 0) {
      return {
        ok: false,
        error: "no findings to fix"
      };
    }
    const mappedItems = value.map(error => {
      const options3 = {
        id: error.id,
        internal_id: error.internal_id || error.id,
        name: error.name,
        description: error.description,
        level: error.level,
        link: error.link
      };
      const value4 = options3;
      if (error.category) {
        value4.category = error.category;
      }
      if (error.details) {
        value4.details = error.details;
      }
      if (error.remediation_difficulty) {
        value4.remediation_difficulty = error.remediation_difficulty;
      }
      if (error.metadata) {
        value4.metadata = error.metadata;
      }
      const options4 = {
        scanner_name: error.scanner || "unknown",
        finding: value4
      };
      return options4;
    });
    const value2 = "umsg_" + makeClientMessageId();
    const value3 = "aimsg_" + makeClientMessageId();
    const options = {
      id: value2,
      message: "Load the security issues from the scan results and fix them.",
      files: [],
      selected_elements: [],
      chat_only: false,
      optimisticImageUrls: [],
      intent: "security_fix_v2",
      ai_message_id: value3,
      thread_id: "main",
      view: "services",
      view_description: "The user is viewing the More panel which consolidates Analytics, Cloud, Payments, Security, and SEO & AI search views. The security scan findings are: " + JSON.stringify(mappedItems) + ".",
      current_page: "/",
      current_viewport_width: window.innerWidth || 1200,
      current_viewport_height: window.innerHeight || 800,
      current_viewport_dpr: window.devicePixelRatio || 1,
      model: null,
      session_replay: "",
      client_logs: [],
      network_requests: [],
      runtime_errors: [],
      integration_metadata: {
        browser: {}
      }
    };
    const response = await fetch("https://api.lovable.dev/projects/" + credentials.projectId + "/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + credentials.token
      },
      body: JSON.stringify(options)
    });
    if (!response.ok && response.status !== 202) {
      let text = "";
      try {
        text = (await response.text()).slice(0, 120);
      } catch (value4) {}
      return {
        ok: false,
        status: response.status,
        error: "HTTP " + response.status + (text ? ": " + text : "")
      };
    }
    const options2 = {
      ok: true,
      message_id: value2,
      count: value.length
    };
    return options2;
  } catch (value) {
    return {
      ok: false,
      error: value.message || String(value)
    };
  }
}
function makeClientMessageId() {
  const text = "0123456789abcdefghjkmnpqrstvwxyz";
  let value = Date.now();
  let text2 = "";
  for (let count = 0; count < 10; count++) {
    text2 = text[value % 32] + text2;
    value = Math.floor(value / 32);
  }
  let text3 = "";
  for (let count = 0; count < 16; count++) {
    text3 += text[Math.floor(Math.random() * 32)];
  }
  return text2 + text3;
}
