document.addEventListener("DOMContentLoaded", () => {
  const log = document.getElementById("log");
  const deactivatedBanner = document.getElementById("deactivated-banner");
  const activateBtn = document.getElementById("activate-btn");
  const debugNotice = document.getElementById("debug-notice");
  const dismissDebugNoticeBtn = document.getElementById("dismiss-debug-notice");

  let lastSeparator = null;
  let isDeactivated = false;
  let requestsWithoutMilliCache = 0;
  let hasSeenMilliCache = false;
  let debugNoticeDismissed = false;
  let hasShownDebugNotice = false;

  // Track MISS TTFB for comparison with HITs
  const missTtfbCache = new Map(); // key: cacheKey, value: { ttfb, url, timestamp }

  // Activate button click handler
  activateBtn.addEventListener("click", () => {
    isDeactivated = false;
    requestsWithoutMilliCache = 0;
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

  function showDebugNotice() {
    if (!debugNoticeDismissed && !hasShownDebugNotice) {
      hasShownDebugNotice = true;
      debugNotice.style.display = "block";
    }
  }

  function hideDebugNotice() {
    debugNotice.style.display = "none";
  }

  browser.devtools.network.onNavigated.addListener(() => {
    // Reset detection counters on navigation
    if (!isDeactivated) {
      requestsWithoutMilliCache = 0;
      hasSeenMilliCache = false;
      hasShownDebugNotice = false;
    }
    insertReloadSeparator();
  });

  function insertReloadSeparator() {
    if (lastSeparator) lastSeparator.remove();
    const wrapper = document.createElement("div");
    wrapper.className = "separator";
    lastSeparator = wrapper;

    const hr = document.createElement("hr");
    const label = document.createElement("div");
    label.className = "separator-label";
    label.textContent = `↺ Reloaded at ${new Date().toLocaleTimeString()}`;
    wrapper.appendChild(hr);
    wrapper.appendChild(label);
    log.prepend(wrapper);
  }

  function checkRemoveSeparator() {
    const entries = log.querySelectorAll(".entry-card");
    if (entries.length === 0 && lastSeparator) {
      lastSeparator.remove();
      lastSeparator = null;
    }
  }

  // Format time as milliseconds or seconds
  function formatTime(ms) {
    if (ms < 1000) {
      return `${Math.round(ms)} ms`;
    } else {
      return `${(ms / 1000).toFixed(2)} s`;
    }
  }

  function createMilliEntry(request, milliHeaders, status, ttfb, ttfbSavings) {
    const card = document.createElement("div");
    card.className = "entry-card highlight";
    card.setAttribute('data-status', status.toLowerCase());

    // Create the header with URL
    const url = document.createElement("h3");
    url.className = "url";
    url.textContent = "🔗 " + request.request.url;
    card.appendChild(url);

    // Add HTTP status code
    const httpStatus = request.response.status;
    const statusElement = document.createElement("div");
    statusElement.className = "http-status-code";
    statusElement.setAttribute('data-code', httpStatus);
    statusElement.textContent = httpStatus;
    card.appendChild(statusElement);

    // Extract data from headers
    let flags = [];
    let key = "";
    let time = "";
    let gzip = "";
    let reason = "";
    let expires = "";

    milliHeaders.forEach(h => {
      const name = h.name.toLowerCase().replace("x-millicache-", "");
      const value = h.value;
      switch (name) {
        case "key": key = value; break;
        case "time": time = value; break;
        case "flags": flags = value.split(" ").filter(f => !f.startsWith("url:")); break;
        case "gzip": gzip = value === "true" ? "✔ Enabled" : "✖ Disabled"; break;
        case "reason": reason = value; break;
        case "expires": expires = value; break;
      }
    });

    // Create table
    const table = document.createElement("table");
    table.className = "milli-table";

    // Table body
    const tbody = document.createElement("tbody");

    // Add rows for each piece of information
    if (key) addTableRow(tbody, "🧠 Key", key);
    if (time) addTableRow(tbody, "🕑 Time", time);
    if (ttfb !== null && ttfb !== undefined) addTableRow(tbody, "⚡ TTFB", formatTime(ttfb));

    // Special handling for flags
    if (flags.length) {
      const row = document.createElement("tr");
      const labelCell = document.createElement("td");
      labelCell.className = "label";
      labelCell.textContent = "🏷 Flags";

      const valueCell = document.createElement("td");
      valueCell.className = "value";

      flags.forEach(f => {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = f;
        valueCell.appendChild(pill);
      });

      row.appendChild(labelCell);
      row.appendChild(valueCell);
      tbody.appendChild(row);
    }

    if (gzip) addTableRow(tbody, "🗜️ Gzip", gzip);

    // Special handling for status
    if (status) {
      const row = document.createElement("tr");
      const labelCell = document.createElement("td");
      labelCell.className = "label";
      labelCell.textContent = "💾 Status";

      const valueCell = document.createElement("td");
      valueCell.className = "value";

      const badge = document.createElement("span");
      badge.className = "status " + status.toLowerCase();

      const dot = document.createElement("span");
      dot.textContent = "● ";

      const statusLower = status.toLowerCase();
      if (statusLower === "hit") {
        dot.style.color = "green";
      } else if (statusLower === "miss") {
        dot.style.color = "red";
      } else if (statusLower === "stale") {
        dot.style.color = "orange";
      } else {
        dot.style.color = "gray";
      }

      badge.appendChild(dot);
      badge.appendChild(document.createTextNode(status.toUpperCase()));

      valueCell.appendChild(badge);
      row.appendChild(labelCell);
      row.appendChild(valueCell);
      tbody.appendChild(row);
    }

    if (reason) addTableRow(tbody, "💬 Reason", reason);
    if (expires) addTableRow(tbody, "⏳ Expires", expires);

    // Add TTFB savings row if available
    if (ttfbSavings) {
      addTtfbSavingsRow(tbody, ttfbSavings);
    }

    // Add table body to table
    table.appendChild(tbody);

    // Add table to card
    card.appendChild(table);

    // Add card to log
    log.prepend(card);

    // Highlight effect
    setTimeout(() => {
      card.classList.remove("highlight");
    }, 10000);

    // Auto-remove after 20 seconds
    setTimeout(() => {
      card.remove();
      checkRemoveSeparator();
    }, 20000);
  }

// Helper function to add a row to the table
  function addTableRow(tbody, label, value) {
    const row = document.createElement("tr");

    const labelCell = document.createElement("td");
    labelCell.className = "label";
    labelCell.textContent = label;

    const valueCell = document.createElement("td");
    valueCell.className = "value";
    const strong = document.createElement("strong");
    strong.textContent = value;
    valueCell.appendChild(strong);

    row.appendChild(labelCell);
    row.appendChild(valueCell);
    tbody.appendChild(row);
  }

  // Helper function to add TTFB savings row
  function addTtfbSavingsRow(tbody, savingsData) {
    const row = document.createElement("tr");
    row.className = "savings-row";

    const labelCell = document.createElement("td");
    labelCell.className = "label";
    labelCell.textContent = "📉 Savings";

    const valueCell = document.createElement("td");
    valueCell.className = "value savings-value";

    // Main savings display
    const mainLine = document.createElement("div");
    mainLine.className = "savings-main";

    const arrow = savingsData.timeSaved >= 0 ? "↓" : "↑";
    const absTimeSaved = Math.abs(savingsData.timeSaved);

    const mainText = document.createElement("strong");
    mainText.textContent = `${arrow} ${Math.round(absTimeSaved)}ms faster`;
    mainLine.appendChild(mainText);

    const percentSpan = document.createElement("span");
    percentSpan.className = "savings-percent";
    percentSpan.textContent = ` (${savingsData.percentSaved}% improvement)`;
    mainLine.appendChild(percentSpan);

    // Comparison line
    const compLine = document.createElement("div");
    compLine.className = "savings-comparison";
    compLine.textContent = `MISS: ${Math.round(savingsData.missTtfb)}ms → HIT: ${Math.round(savingsData.hitTtfb)}ms`;

    valueCell.appendChild(mainLine);
    valueCell.appendChild(compLine);

    row.appendChild(labelCell);
    row.appendChild(valueCell);
    tbody.appendChild(row);
  }

  browser.devtools.network.onRequestFinished.addListener((request) => {
    // Skip if deactivated
    if (isDeactivated) {
      return;
    }

    const url = new URL(request.request.url);
    if (/favicon\.ico([?#].*)?$/.test(url.pathname)) {
      return;
    }

    const headers = request.response.headers;
    const statusHeader = headers.find(h => h.name.toLowerCase() === "x-millicache-status");
    const mime = request.response?.content?.mimeType || '';

    // Check if this is a document request (HTML)
    const isDocumentRequest = mime.includes("text/html");

    // If no status header on document requests, track for potential deactivation
    if (!statusHeader && isDocumentRequest) {
      if (!hasSeenMilliCache) {
        requestsWithoutMilliCache++;
        // After 3 document requests without MilliCache headers, deactivate
        if (requestsWithoutMilliCache >= 3) {
          showDeactivatedState();
        }
      }
      return;
    }

    // If we have a status header, we've seen MilliCache
    if (statusHeader) {
      hasSeenMilliCache = true;
      requestsWithoutMilliCache = 0;
    }

    const statusVal = statusHeader?.value?.toLowerCase() || '';
    if (!(["hit", "miss", "stale"].includes(statusVal) || (statusVal === "bypass" && isDocumentRequest))) {
      return;
    }

    const milliHeaders = headers.filter(h =>
      h.name.toLowerCase().startsWith("x-millicache-")
    );

    // Check if only status header is present (debug mode not active)
    // Debug headers include: key, time, flags, gzip, reason, expires
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

    // Show debug notice only if:
    // - Only status header is present (no debug headers)
    // - AND it's not a MISS (MISS only outputs status header by design)
    if (milliHeaders.length === 1 && statusHeader && !hasDebugHeaders && statusVal !== "miss") {
      showDebugNotice();
    } else if (hasDebugHeaders) {
      // Debug headers present - hide notice if shown
      hideDebugNotice();
    }

    // Extract TTFB from HAR timings
    const ttfb = request.timings?.wait;

    // Use URL as cache key for consistent MISS/HIT matching
    const cacheKey = request.request.url;

    // Calculate TTFB savings
    let ttfbSavings = null;

    if (statusVal === "miss" && ttfb !== null && ttfb !== undefined) {
      // Store MISS TTFB for future comparison
      missTtfbCache.set(cacheKey, {
        ttfb: ttfb,
        url: request.request.url,
        timestamp: Date.now()
      });
    } else if ((statusVal === "hit" || statusVal === "stale") && ttfb !== null && ttfb !== undefined && missTtfbCache.has(cacheKey)) {
      // Calculate savings compared to MISS
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
