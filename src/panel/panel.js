document.addEventListener("DOMContentLoaded", () => {
  const log = document.getElementById("log");
  const deactivatedBanner = document.getElementById("deactivated-banner");
  const activateBtn = document.getElementById("activate-btn");
  const debugNotice = document.getElementById("debug-notice");
  const dismissDebugNoticeBtn = document.getElementById("dismiss-debug-notice");

  let lastSeparator = null;
  let pendingSeparator = null;
  let isDeactivated = true;
  let hasSeenMilliCacheOnSite = false;
  let debugNoticeDismissed = false;
  let hasShownDebugNotice = false;

  // Retention settings
  const ENTRY_LIFETIME_MS = 60000;
  const MIN_ENTRIES_KEPT = 5;

  // Track last navigated URL for reload vs navigate detection
  let lastNavigatedUrl = null;

  // Track last status per URL for transition badges
  const urlStatusCache = new Map();

  // Track MISS TTFB for comparison with HITs
  const missTtfbCache = new Map();

  // Track cards by URL for reuse
  const cardsByUrl = new Map();

  function navigateToUrl(url) {
    browser.devtools.inspectedWindow.eval(`window.location.href = ${JSON.stringify(url)}`);
  }

  // Global countdown timer - all countdowns update together
  const countdownElements = new Set();
  setInterval(() => {
    countdownElements.forEach(item => {
      if (!item.element.isConnected) {
        countdownElements.delete(item);
        return;
      }
      const remaining = item.targetTime - Date.now();
      item.element.textContent = formatCountdown(remaining);
      item.badge.style.display = remaining <= 0 ? "inline" : "none";
    });
  }, 1000);

  // Activate button click handler
  activateBtn.addEventListener("click", () => {
    isDeactivated = false;
    deactivatedBanner.style.display = "none";
    log.style.display = "flex";
  });

  // Dismiss debug notice
  dismissDebugNoticeBtn.addEventListener("click", () => {
    debugNoticeDismissed = true;
    debugNotice.style.display = "none";
  });

  function showDeactivatedState() {
    isDeactivated = true;
    deactivatedBanner.style.display = "block";
    log.style.display = "none";
  }

  function showActivatedState() {
    isDeactivated = false;
    deactivatedBanner.style.display = "none";
    log.style.display = "flex";
  }

  function showDebugNotice() {
    if (!debugNoticeDismissed && !hasShownDebugNotice) {
      hasShownDebugNotice = true;
      debugNotice.style.display = "block";
    }
  }

  function hideDebugNotice() {
    debugNotice.style.display = "none";
  }

  browser.devtools.network.onNavigated.addListener((url) => {
    hasShownDebugNotice = false;
    hasSeenMilliCacheOnSite = false;

    const isReload = (url === lastNavigatedUrl);
    insertNavigationSeparator(isReload);
    lastNavigatedUrl = url;
  });

  function insertNavigationSeparator(isReload) {
    pendingSeparator = {
      isReload: isReload,
      time: new Date().toLocaleTimeString()
    };
  }

  function insertPendingSeparatorAfter(card) {
    if (!pendingSeparator) return;

    if (lastSeparator) lastSeparator.remove();

    const wrapper = document.createElement("div");
    wrapper.className = pendingSeparator.isReload ? "separator reloaded" : "separator navigated";
    lastSeparator = wrapper;

    const hr = document.createElement("hr");
    const label = document.createElement("div");
    label.className = "separator-label";

    const iconSpan = document.createElement("span");
    iconSpan.className = "separator-icon";
    iconSpan.textContent = pendingSeparator.isReload ? "↺" : "→";

    const action = pendingSeparator.isReload ? " Reloaded" : " Navigated";

    label.appendChild(iconSpan);
    label.appendChild(document.createTextNode(`${action} at ${pendingSeparator.time}`));

    wrapper.appendChild(hr);
    wrapper.appendChild(label);

    // Insert after card using nextSibling to ensure correct placement
    const nextSibling = card.nextSibling;
    if (nextSibling) {
      log.insertBefore(wrapper, nextSibling);
    } else {
      log.appendChild(wrapper);
    }

    pendingSeparator = null;
  }

  function checkRemoveSeparator() {
    const entries = log.querySelectorAll(".entry-card");
    if (entries.length === 0 && lastSeparator) {
      lastSeparator.remove();
      lastSeparator = null;
    }
  }

  function getTransitionLabel(prevStatus, newStatus) {
    const prev = prevStatus.toLowerCase();
    const next = newStatus.toLowerCase();
    if (prev === "miss" && next === "hit") return "cached";
    if (prev === "hit" && next === "stale") return "expired";
    if (prev === "hit" && next === "miss") return "cleared";
    if (prev === "stale" && next === "hit") return "regenerated";
    if (prev === "miss" && next === "stale") return "stale";
    return null;
  }

  function formatTime(ms) {
    if (ms < 1000) {
      return `${Math.round(ms)} ms`;
    } else {
      return `${(ms / 1000).toFixed(2)} s`;
    }
  }

  function parseExpiresValue(expires) {
    const regex = /(?:(-)?(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/;
    const match = expires.match(regex);

    if (match) {
      const isNegative = match[1] === "-";
      const days = parseInt(match[2] || 0, 10);
      const hours = parseInt(match[3] || 0, 10);
      const minutes = parseInt(match[4] || 0, 10);
      const seconds = parseInt(match[5] || 0, 10);

      const totalSeconds = (days * 86400) + (hours * 3600) + (minutes * 60) + seconds;
      const signedSeconds = isNegative ? -totalSeconds : totalSeconds;

      return Date.now() + (signedSeconds * 1000);
    }

    const num = parseInt(expires, 10);
    if (!isNaN(num)) {
      return Date.now() + (num * 1000);
    }

    return null;
  }

  function formatCountdown(remainingMs) {
    const isNegative = remainingMs < 0;
    const absMs = Math.abs(remainingMs);

    const totalSeconds = Math.floor(absMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => n.toString().padStart(2, '0');
    const prefix = isNegative ? "-" : "";

    return `${prefix}${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  // ============================================================================
  // Block-based UI creation helpers
  // ============================================================================

  // Icon map for labels
  const labelIcons = {
    "TTFB": "⚡",
    "Status": "💾",
    "Reason": "💬",
    "Expires": "⏳",
    "Flags": "🏷",
    "Time": "🕑",
    "Key": "🔑",
    "Gzip": "🗜️",
    "Savings": "📉"
  };

  function createInfoRow(label, value, isEssential = false) {
    const row = document.createElement("div");
    row.className = isEssential ? "info-row essential" : "info-row";

    const labelEl = document.createElement("span");
    labelEl.className = "info-label";
    const icon = labelIcons[label] || "";
    labelEl.textContent = icon ? `${icon} ${label}` : label;

    const valueEl = document.createElement("span");
    valueEl.className = "info-value";
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);

    return row;
  }

  function createStatusRow(status, transitionLabel) {
    const row = document.createElement("div");
    row.className = "info-row essential";

    const labelEl = document.createElement("span");
    labelEl.className = "info-label";
    labelEl.textContent = "💾 Status";

    const valueEl = document.createElement("span");
    valueEl.className = "info-value";

    const badge = document.createElement("span");
    badge.className = "status-badge " + status.toLowerCase();

    const dot = document.createElement("span");
    dot.className = "status-dot";
    dot.textContent = "●";

    badge.appendChild(dot);
    badge.appendChild(document.createTextNode(" " + status.toUpperCase()));
    valueEl.appendChild(badge);

    if (transitionLabel) {
      const transitionBadge = document.createElement("span");
      transitionBadge.className = "transition-badge";
      transitionBadge.textContent = transitionLabel;
      valueEl.appendChild(transitionBadge);
    }

    row.appendChild(labelEl);
    row.appendChild(valueEl);

    return row;
  }

  function createExpiresRow(expires) {
    const row = document.createElement("div");
    row.className = "info-row essential";

    const labelEl = document.createElement("span");
    labelEl.className = "info-label";
    labelEl.textContent = "⏳ Expires";

    const valueEl = document.createElement("span");
    valueEl.className = "info-value";

    const countdownSpan = document.createElement("span");
    countdownSpan.className = "expires-countdown";
    valueEl.appendChild(countdownSpan);

    const expiredBadge = document.createElement("span");
    expiredBadge.className = "expired-badge";
    expiredBadge.textContent = "expired";
    expiredBadge.style.display = "none";
    valueEl.appendChild(expiredBadge);

    row.appendChild(labelEl);
    row.appendChild(valueEl);

    const targetTime = parseExpiresValue(expires);

    if (targetTime === null) {
      countdownSpan.textContent = expires;
      return row;
    }

    // Initial display
    const remaining = targetTime - Date.now();
    countdownSpan.textContent = formatCountdown(remaining);
    expiredBadge.style.display = remaining <= 0 ? "inline" : "none";

    // Register with global countdown timer
    countdownElements.add({
      element: countdownSpan,
      badge: expiredBadge,
      targetTime: targetTime
    });

    return row;
  }

  function createFlagsRow(flags) {
    const row = document.createElement("div");
    row.className = "info-row essential";

    const labelEl = document.createElement("span");
    labelEl.className = "info-label";
    labelEl.textContent = "🏷 Flags";

    const valueEl = document.createElement("span");
    valueEl.className = "info-value";

    const pillsContainer = document.createElement("div");
    pillsContainer.className = "pills";

    flags.forEach(f => {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = f;
      pill.title = "Click to copy";
      pill.addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(f).then(() => {
          const originalText = pill.textContent;
          pill.textContent = "Copied!";
          setTimeout(() => {
            pill.textContent = originalText;
          }, 1000);
        });
      });
      pillsContainer.appendChild(pill);
    });

    valueEl.appendChild(pillsContainer);
    row.appendChild(labelEl);
    row.appendChild(valueEl);

    return row;
  }

  function createSavingsRow(savingsData) {
    const row = document.createElement("div");
    row.className = "info-row";

    const labelEl = document.createElement("span");
    labelEl.className = "info-label";
    labelEl.textContent = "📉 Savings";

    const valueEl = document.createElement("span");
    valueEl.className = "info-value savings-value";

    const mainLine = document.createElement("div");
    mainLine.className = "savings-main";

    const arrow = savingsData.timeSaved >= 0 ? "↓" : "↑";
    const absTimeSaved = Math.abs(savingsData.timeSaved);
    mainLine.textContent = `${arrow} ${Math.round(absTimeSaved)}ms faster`;

    const percentSpan = document.createElement("span");
    percentSpan.className = "savings-percent";
    percentSpan.textContent = ` (${savingsData.percentSaved}%)`;
    mainLine.appendChild(percentSpan);

    const compLine = document.createElement("div");
    compLine.className = "savings-comparison";
    compLine.textContent = `MISS: ${Math.round(savingsData.missTtfb)}ms → HIT: ${Math.round(savingsData.hitTtfb)}ms`;

    valueEl.appendChild(mainLine);
    valueEl.appendChild(compLine);
    row.appendChild(labelEl);
    row.appendChild(valueEl);

    return row;
  }

  function buildCardContent(data) {
    const content = document.createElement("div");
    content.className = "card-content";

    // TTFB
    if (data.ttfb !== null && data.ttfb !== undefined) {
      content.appendChild(createInfoRow("TTFB", formatTime(data.ttfb), false));
    }

    // Status (essential)
    if (data.status) {
      content.appendChild(createStatusRow(data.status, data.transitionLabel));
    }

    // Reason
    if (data.reason) {
      content.appendChild(createInfoRow("Reason", data.reason));
    }

    // Expires (essential)
    if (data.expires) {
      content.appendChild(createExpiresRow(data.expires));
    }

    // Flags (essential)
    if (data.flags && data.flags.length) {
      content.appendChild(createFlagsRow(data.flags));
    }

    // Time
    if (data.time) {
      content.appendChild(createInfoRow("Time", data.time));
    }

    // Key
    if (data.key) {
      content.appendChild(createInfoRow("Key", data.key));
    }

    // Gzip
    if (data.gzip) {
      content.appendChild(createInfoRow("Gzip", data.gzip));
    }

    // Savings
    if (data.ttfbSavings) {
      content.appendChild(createSavingsRow(data.ttfbSavings));
    }

    return content;
  }

  function extractHeaderData(milliHeaders) {
    const data = {
      flags: [],
      key: "",
      time: "",
      gzip: "",
      reason: "",
      expires: ""
    };

    milliHeaders.forEach(h => {
      const name = h.name.toLowerCase().replace("x-millicache-", "");
      const value = h.value;
      switch (name) {
        case "key": data.key = value; break;
        case "time": data.time = value; break;
        case "flags": data.flags = value.split(" ").filter(f => !f.startsWith("url:")); break;
        case "gzip": data.gzip = value === "true" ? "Enabled" : "Disabled"; break;
        case "reason": data.reason = value; break;
        case "expires": data.expires = value; break;
      }
    });

    return data;
  }

  // ============================================================================
  // Card creation and update
  // ============================================================================

  function updateExistingCard(card, request, milliHeaders, status, ttfb, ttfbSavings) {
    const requestUrl = request.request.url;

    // Keep compact for now, will expand after moving
    card.classList.add("compact");
    card.classList.remove("highlight");
    card.setAttribute("data-status", status.toLowerCase());

    // Update HTTP status
    const httpStatusEl = card.querySelector(".http-status");
    if (httpStatusEl) {
      const httpStatus = request.response.status;
      httpStatusEl.setAttribute("data-code", httpStatus);
      httpStatusEl.textContent = httpStatus;
    }

    // Get transition label
    const prevStatus = urlStatusCache.get(requestUrl);
    const transitionLabel = prevStatus ? getTransitionLabel(prevStatus, status) : null;
    urlStatusCache.set(requestUrl, status.toLowerCase());

    // Extract header data
    const headerData = extractHeaderData(milliHeaders);

    // Replace card content
    const oldContent = card.querySelector(".card-content");
    if (oldContent) oldContent.remove();

    const newContent = buildCardContent({
      ...headerData,
      status,
      ttfb,
      ttfbSavings,
      transitionLabel
    });
    card.appendChild(newContent);

    // Compact all other cards instantly (no transition)
    const existingCards = log.querySelectorAll(".entry-card");
    existingCards.forEach(existingCard => {
      if (existingCard !== card) {
        existingCard.style.transition = "none";
        existingCard.classList.remove("highlight");
        existingCard.classList.add("compact");
        existingCard.offsetHeight; // Force reflow
        existingCard.style.transition = "";
      }
    });

    // Move to top (disable default slide-in, use flash instead)
    card.style.animation = "none";
    log.prepend(card);
    insertPendingSeparatorAfter(card);

    // Force reflow then apply flash animation
    card.offsetHeight;
    card.classList.add("flash");

    // Then expand the card
    requestAnimationFrame(() => {
      card.classList.remove("compact");
      card.classList.add("highlight");
    });

    // Clean up flash class after animation completes
    card.addEventListener("animationend", () => {
      card.classList.remove("flash");
      card.style.animation = "";
    }, { once: true });
  }

  function createMilliEntry(request, milliHeaders, status, ttfb, ttfbSavings) {
    const requestUrl = request.request.url;

    // Reuse existing card if one exists for this URL
    const existingCard = cardsByUrl.get(requestUrl);
    if (existingCard && existingCard.isConnected) {
      updateExistingCard(existingCard, request, milliHeaders, status, ttfb, ttfbSavings);
      return;
    }

    // Get transition label
    const prevStatus = urlStatusCache.get(requestUrl);
    const transitionLabel = prevStatus ? getTransitionLabel(prevStatus, status) : null;
    urlStatusCache.set(requestUrl, status.toLowerCase());

    // Create card (starts compact, will be expanded after prepending)
    const card = document.createElement("div");
    card.className = "entry-card compact";
    card.setAttribute("data-status", status.toLowerCase());

    // Card header
    const header = document.createElement("div");
    header.className = "card-header";

    const urlEl = document.createElement("h3");
    urlEl.className = "card-url";
    urlEl.textContent = requestUrl;

    const httpStatusEl = document.createElement("span");
    httpStatusEl.className = "http-status";
    httpStatusEl.setAttribute("data-code", request.response.status);
    httpStatusEl.textContent = request.response.status;

    header.appendChild(urlEl);
    header.appendChild(httpStatusEl);
    card.appendChild(header);

    // Extract header data
    const headerData = extractHeaderData(milliHeaders);

    // Build card content
    const content = buildCardContent({
      ...headerData,
      status,
      ttfb,
      ttfbSavings,
      transitionLabel
    });
    card.appendChild(content);

    // Click handler
    card.addEventListener("click", () => {
      navigateToUrl(requestUrl);
    });

    // Track card
    cardsByUrl.set(requestUrl, card);

    // Compact all existing cards instantly (no transition)
    const existingCards = log.querySelectorAll(".entry-card");
    existingCards.forEach(existingCard => {
      existingCard.style.transition = "none";
      existingCard.classList.remove("highlight");
      existingCard.classList.add("compact");
      existingCard.offsetHeight; // Force reflow
      existingCard.style.transition = "";
    });

    // Add to log (compact)
    log.prepend(card);
    insertPendingSeparatorAfter(card);

    // Then expand the new card (grows into view)
    requestAnimationFrame(() => {
      card.classList.remove("compact");
      card.classList.add("highlight");
    });

    // Auto-remove after lifetime
    setTimeout(() => {
      const entries = log.querySelectorAll(".entry-card");
      if (entries.length > MIN_ENTRIES_KEPT) {
        card.classList.add("removing");
        card.addEventListener("animationend", () => {
          card.remove();
          cardsByUrl.delete(requestUrl);
          checkRemoveSeparator();
        }, { once: true });
      }
    }, ENTRY_LIFETIME_MS);
  }

  // ============================================================================
  // Network request listener
  // ============================================================================

  browser.devtools.network.onRequestFinished.addListener((request) => {
    const url = new URL(request.request.url);
    if (/favicon\.ico([?#].*)?$/.test(url.pathname)) {
      return;
    }

    const headers = request.response.headers;
    const statusHeader = headers.find(h => h.name.toLowerCase() === "x-millicache-status");
    const mime = request.response?.content?.mimeType || '';

    const isMainDocument = mime === "text/html" && request.request.method === "GET" &&
      !request.request.url.includes("/wp-json/") && !request.request.url.includes("/api/");

    if (!statusHeader) {
      if (isMainDocument && !hasSeenMilliCacheOnSite && !isDeactivated) {
        showDeactivatedState();
      }
      return;
    }

    hasSeenMilliCacheOnSite = true;

    if (isDeactivated) {
      showActivatedState();
    }

    const statusVal = statusHeader?.value?.toLowerCase() || '';
    if (!(["hit", "miss", "stale"].includes(statusVal) || (statusVal === "bypass" && isMainDocument))) {
      return;
    }

    const milliHeaders = headers.filter(h =>
      h.name.toLowerCase().startsWith("x-millicache-")
    );

    const hasDebugHeaders = milliHeaders.some(h => {
      const name = h.name.toLowerCase();
      return name !== "x-millicache-status" &&
             (name === "x-millicache-key" ||
              name === "x-millicache-time" ||
              name === "x-millicache-flags" ||
              name === "x-millicache-gzip" ||
              name === "x-millicache-reason" ||
              name === "x-millicache-expires");
    });

    if (milliHeaders.length === 1 && statusHeader && !hasDebugHeaders && statusVal !== "miss") {
      showDebugNotice();
    } else if (hasDebugHeaders) {
      hideDebugNotice();
    }

    const ttfb = request.timings?.wait;
    const cacheKey = request.request.url;

    let ttfbSavings = null;

    if (statusVal === "miss" && ttfb !== null && ttfb !== undefined) {
      missTtfbCache.set(cacheKey, {
        ttfb: ttfb,
        url: request.request.url,
        timestamp: Date.now()
      });
    } else if ((statusVal === "hit" || statusVal === "stale") && ttfb !== null && ttfb !== undefined && missTtfbCache.has(cacheKey)) {
      const missData = missTtfbCache.get(cacheKey);
      const timeSaved = missData.ttfb - ttfb;
      const percentSaved = missData.ttfb > 0 ? Math.round((timeSaved / missData.ttfb) * 100) : 0;

      ttfbSavings = {
        timeSaved: timeSaved,
        percentSaved: percentSaved,
        missTtfb: missData.ttfb,
        hitTtfb: ttfb
      };
    }

    if (milliHeaders.length) {
      createMilliEntry(request, milliHeaders, statusHeader.value, ttfb, ttfbSavings);
    }
  });
});
