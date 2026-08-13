/**
 * DevTools panel rendering. Owns the DOM, animations and UI state; header
 * interpretation lives in analyze.js.
 *
 * A card answers two questions: is this page cached, and where. When the edge
 * served the response its status is the whole answer, since the MilliCache
 * headers alongside are a replay of the fill request. Origin values are shown
 * only when the origin produced the response.
 */

import { analyze, createState } from "./analyze.js";

/**
 * Mirror the DevTools theme onto the document. `prefers-color-scheme` reports
 * the OS theme, not the DevTools theme, so only themeName is reliable here.
 */
function trackDevToolsTheme() {
  const panels = browser.devtools.panels;

  const apply = theme => {
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  };

  if (panels && typeof panels.themeName === "string") {
    apply(panels.themeName);
  }

  // Missing in older supported Firefox versions; the CSS then falls back.
  if (panels && panels.onThemeChanged) {
    panels.onThemeChanged.addListener(apply);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  trackDevToolsTheme();

  const log = document.getElementById("log");
  const deactivatedBanner = document.getElementById("deactivated-banner");
  const deactivatedText = document.getElementById("deactivated-text");
  const activateBtn = document.getElementById("activate-btn");
  const debugNotice = document.getElementById("debug-notice");
  const dismissDebugNoticeBtn = document.getElementById("dismiss-debug-notice");

  let lastSeparator = null;
  let pendingSeparator = null;
  let isDeactivated = true;
  let hasSeenMilliCacheOnSite = false;
  let debugNoticeDismissed = false;
  let hasShownDebugNotice = false;

  const ENTRY_LIFETIME_MS = 60000;
  const MIN_ENTRIES_KEPT = 5;

  // For reload vs navigate detection.
  let lastNavigatedUrl = null;

  const analyzerState = createState();

  const cardsByUrl = new Map();

  function navigateToUrl(url) {
    browser.devtools.inspectedWindow.eval(`window.location.href = ${JSON.stringify(url)}`);
  }

  // One clock for every live figure, so they stay in step.
  const tickers = new Set();
  setInterval(() => {
    tickers.forEach(ticker => {
      if (!ticker.element.isConnected) {
        tickers.delete(ticker);
        return;
      }
      ticker.update();
    });
  }, 1000);

  /**
   * @param {HTMLElement} element Element to update, and to watch for removal.
   * @param {Function} update Called once per second.
   */
  function addTicker(element, update) {
    update();
    tickers.add({ element, update });
  }

  activateBtn.addEventListener("click", () => {
    isDeactivated = false;
    deactivatedBanner.style.display = "none";
    log.style.display = "flex";
  });

  dismissDebugNoticeBtn.addEventListener("click", () => {
    debugNoticeDismissed = true;
    debugNotice.style.display = "none";
  });

  /**
   * @param {string} lead Bolded opening sentence.
   * @param {string} detail Supporting sentence.
   * @param {boolean} isEdge Whether an edge is standing in for the origin.
   */
  function showDeactivatedState(lead, detail, isEdge) {
    isDeactivated = true;

    const strong = document.createElement("strong");
    strong.textContent = lead;
    deactivatedText.replaceChildren(strong, document.createTextNode(" " + detail));

    deactivatedBanner.classList.toggle("is-edge", Boolean(isEdge));
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
    wrapper.className = "separator";
    lastSeparator = wrapper;

    const label = document.createElement("span");
    label.className = "separator-label";
    label.textContent = pendingSeparator.isReload
      ? `↺ Reloaded at ${pendingSeparator.time}`
      : `→ Navigated at ${pendingSeparator.time}`;

    wrapper.appendChild(label);

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

  // ============================================================================
  // Formatting
  // ============================================================================

  function formatCountdown(remainingMs) {
    const isNegative = remainingMs < 0;
    const totalSeconds = Math.floor(Math.abs(remainingMs) / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = n => n.toString().padStart(2, "0");

    return `${isNegative ? "-" : ""}${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  /** Short human duration for inline meta ("4m 12s", "3d 6h"). */
  function formatShortDuration(seconds) {
    const abs = Math.abs(seconds);
    if (abs < 60) return `${abs}s`;
    if (abs < 3600) return `${Math.floor(abs / 60)}m ${abs % 60}s`;
    if (abs < 86400) return `${Math.floor(abs / 3600)}h ${Math.floor((abs % 3600) / 60)}m`;
    return `${Math.floor(abs / 86400)}d ${Math.floor((abs % 86400) / 3600)}h`;
  }

  // ============================================================================
  // Building blocks
  // ============================================================================

  /**
   * Write a measurement as a large number with the unit set back.
   *
   * @param {HTMLElement} valueEl Target element.
   * @param {number} ms Duration in milliseconds.
   */
  function fillDuration(valueEl, ms) {
    const unit = document.createElement("small");
    const figure = ms < 1000 ? String(Math.round(ms)) : (ms / 1000).toFixed(2);
    unit.textContent = ms < 1000 ? "ms" : "s";

    // Appended, not assigned: callers may have placed a prefix.
    valueEl.appendChild(document.createTextNode(figure));
    valueEl.appendChild(unit);
  }

  /**
   * A status pill; unknown statuses fall back to the neutral colour.
   *
   * @param {string} status Cache status.
   * @returns {HTMLElement}
   */
  function createStatusPill(status) {
    const known = ["hit", "miss", "stale", "bypass", "dynamic", "expired"];
    const value = status.toLowerCase();

    const pill = document.createElement("span");
    pill.className = `pill pill--status s-${known.includes(value) ? value : "none"}`;
    pill.textContent = status.toUpperCase();

    return pill;
  }

  /**
   * Flip the headline pill to EXPIRED once the cached copy lapses. The delivery
   * box still records what was served at request time.
   *
   * @param {HTMLElement} card The card element.
   * @param {string} detail What expired, for the tooltip.
   */
  function markCardExpired(card, detail) {
    const pill = card.querySelector(".card-header .pill--status");
    if (!pill || pill.dataset.expired === "true") return;

    const served = pill.textContent;
    pill.dataset.expired = "true";
    pill.className = "pill pill--status s-expired";
    pill.textContent = "EXPIRED";
    pill.title = `Served as ${served}; ${detail}`;
  }

  /**
   * One hop in the delivery chain.
   *
   * @param {string} layer Layer name ("Edge" / "Origin").
   * @param {string} status Cache status for that layer.
   * @param {string} meta Supporting detail.
   * @param {string} transitionLabel Optional change badge.
   * @returns {HTMLElement}
   */
  function createHop(layer, status, meta, transitionLabel) {
    const hop = document.createElement("div");
    hop.className = "hop";

    const layerEl = document.createElement("span");
    layerEl.className = "hop__layer";
    layerEl.textContent = layer;
    hop.appendChild(layerEl);

    hop.appendChild(createStatusPill(status));

    if (transitionLabel) {
      const badge = document.createElement("span");
      badge.className = "pill pill--transition";
      badge.textContent = transitionLabel;
      hop.appendChild(badge);
    }

    if (meta instanceof HTMLElement) {
      hop.appendChild(meta);
    } else if (meta) {
      const metaEl = document.createElement("span");
      metaEl.className = "hop__meta";
      metaEl.textContent = meta;
      hop.appendChild(metaEl);
    }

    return hop;
  }

  /**
   * When the edge took delivery. bunny.net reports it directly and is the only
   * trustworthy source there, replaying the origin's Age verbatim rather than
   * adding its own resident time; elsewhere Age is all there is.
   *
   * @param {object} edge Edge observation.
   * @returns {number|null} Epoch ms, or null when undeterminable.
   */
  function edgeStoredAt(edge) {
    if (edge.cachedAt !== null) return edge.cachedAt;
    return edge.age !== null ? Date.now() - (edge.age * 1000) : null;
  }

  /**
   * How long the edge copy stays fresh. The expiry that matters once the edge
   * answered, since the origin's entry may have been regenerated since the fill
   * without the edge knowing.
   *
   * @param {object} edge Edge observation.
   * @param {HTMLElement} card Card to mark expired when the copy lapses.
   * @returns {HTMLElement|null}
   */
  function createEdgeExpiresMetric(edge, card) {
    const storedAt = edgeStoredAt(edge);
    if (storedAt === null || edge.sMaxAge === null) return null;

    const { cell, valueEl } = createMetric("Edge expires", "is-mono");
    const expiresAt = storedAt + (edge.sMaxAge * 1000);

    addTicker(valueEl, () => {
      const remaining = Math.round((expiresAt - Date.now()) / 1000);
      valueEl.textContent = remaining > 0
        ? formatShortDuration(remaining)
        : `${formatShortDuration(remaining)} overdue`;
      valueEl.classList.toggle("is-slow", remaining <= 0);

      // Past s-maxage the next request refetches, so the headline says expired.
      if (remaining <= 0 && card) {
        markCardExpired(card, "the edge copy has passed its freshness lifetime since.");
      }
    });

    return cell;
  }

  /**
   * How old the page the visitor received is, counting up. The full RFC 7231
   * date stays in the tooltip.
   *
   * @param {string} value X-MilliCache-Time value.
   * @returns {HTMLElement}
   */
  function createWrittenMetric(value) {
    const { cell, valueEl } = createMetric("Written", "is-mono");
    const writtenAt = Date.parse(value);

    if (Number.isNaN(writtenAt)) {
      valueEl.textContent = value;
      return cell;
    }

    valueEl.title = value;
    addTicker(valueEl, () => {
      const age = Math.round((Date.now() - writtenAt) / 1000);
      valueEl.textContent = age > 0 ? `${formatShortDuration(age)} ago` : "just now";
    });

    return cell;
  }

  /**
   * How long the edge has held this copy, when no s-maxage sizes it.
   *
   * @param {object} edge Edge observation.
   * @returns {HTMLElement|null}
   */
  function createEdgeAgeMetric(edge) {
    const storedAt = edgeStoredAt(edge);
    if (storedAt === null || edge.sMaxAge !== null) return null;

    const { cell, valueEl } = createMetric("At edge", "is-mono");

    addTicker(valueEl, () => {
      valueEl.textContent = formatShortDuration(Math.round((Date.now() - storedAt) / 1000));
    });

    return cell;
  }

  /**
   * Who answered this request, and from where.
   *
   * @param {object} observation Analyzed request.
   * @returns {HTMLElement}
   */
  function createDeliveryBox(observation, card) {
    const { edge, origin, servedBy } = observation;

    const box = document.createElement("div");
    box.className = "delivery";

    const header = document.createElement("div");
    header.className = "delivery__header";

    // A miss and a bypass are distinct states with distinct fixes, so each is
    // named rather than lumped together as "not cached".
    const passedThrough = `the ${edge.providerName} edge passed this through`;
    let keyword;
    let summary;

    if (servedBy === "edge") {
      keyword = edge.status === "hit" ? "Cached" : edge.status;
      summary = `at the ${edge.providerName} edge`;
    } else if (origin.statusValue === "bypass") {
      keyword = "Bypass";
      summary = `not cacheable (${passedThrough})`;
    } else if (origin.statusValue === "miss") {
      keyword = "Miss";
      summary = `generated at the origin (${passedThrough})`;
    } else if (origin.statusValue === "stale") {
      keyword = "Stale";
      summary = `served stale while it regenerates (${passedThrough})`;
    } else {
      keyword = "Cached";
      summary = `at the origin (${passedThrough})`;
    }

    const kw = document.createElement("span");
    kw.className = "delivery__kw";
    kw.textContent = keyword.toUpperCase();
    header.appendChild(kw);

    const summaryEl = document.createElement("span");
    summaryEl.textContent = summary;
    header.appendChild(summaryEl);
    box.appendChild(header);

    const body = document.createElement("div");
    body.className = "delivery__body";

    const chain = document.createElement("div");
    chain.className = "chain";

    if (edge.detected) {
      // Where, only; how long it stays fresh is a KPI tile.
      chain.appendChild(createHop(
        "Edge",
        edge.status || "unknown",
        [edge.providerName, edge.pop].filter(Boolean).join(" · "),
        null
      ));
    }

    if (servedBy === "origin") {
      chain.appendChild(createHop(
        "Origin",
        origin.status,
        edge.detected ? "MilliCache" : "",
        observation.transitionLabel
      ));
    }

    body.appendChild(chain);
    box.appendChild(body);

    return box;
  }

  // Must match .metrics in panel.css.
  const TILE_MIN_WIDTH = 150;
  const TILE_GAP = 8;

  /**
   * Column count that never leaves one tile alone on the last row: four tiles
   * in a three-wide space lay out 2/2, not 3/1. CSS cannot express this, since
   * `auto-fill` fixes the track count from the width alone.
   *
   * @param {HTMLElement} grid The metrics grid.
   */
  function layoutMetrics(grid) {
    const count = Array.from(grid.children).filter(c => !c.classList.contains("metric--wide")).length;
    const width = grid.clientWidth;

    // Zero while collapsed; the observer re-runs on open.
    if (!count || !width) return;

    const fits = Math.floor((width + TILE_GAP) / (TILE_MIN_WIDTH + TILE_GAP));
    let columns = Math.max(1, fits);

    // Only when the tiles wrap, and never below two, which would stretch each
    // tile across the full width.
    while (columns > 2 && count > columns && count % columns === 1) {
      columns--;
    }

    grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  }

  const metricsObserver = new ResizeObserver(entries => {
    entries.forEach(entry => layoutMetrics(entry.target));
  });

  /**
   * @param {string} label Cell label.
   * @param {string} modifier Extra class for the value element.
   * @returns {{cell: HTMLElement, valueEl: HTMLElement}}
   */
  // What each tile means, shown behind the info marker on its label.
  const METRIC_HELP = {
    "TTFB": "Time to first byte: how long the server took to start sending this response.",
    "Savings": "How much faster this response was than the last MISS for the same URL.",
    "Edge saved": "How much faster the edge answered than the origin did for this URL.",
    "Expires": "When the cached entry expires and MilliCache regenerates it.",
    "Edge expires": "When the edge copy stops being fresh, so the next request makes the edge refetch it.",
    "Origin expires": "When MilliCache's own entry expires. The edge stores its copy when it first requests the page, so an edge copy outlives this by however long the entry had already been sitting at the origin.",
    "At edge": "How long the edge has held this copy. The response set no lifetime, so the zone governs when it expires.",
    "Written": "When the page you received was generated at the origin.",
    "Key": "The key MilliCache stored this entry under.",
    "Gzip": "Whether the stored entry is compressed.",
    "Reason": "Why MilliCache made this cache decision."
  };

  function createMetric(label, modifier = "") {
    const cell = document.createElement("div");
    cell.className = "metric";

    const labelEl = document.createElement("span");
    labelEl.className = "metric__label";
    labelEl.appendChild(document.createTextNode(label));

    const help = METRIC_HELP[label];
    if (help) {
      const info = document.createElement("span");
      info.className = "metric__info";
      info.textContent = "ⓘ";
      info.title = help;
      labelEl.appendChild(info);
    }

    const valueEl = document.createElement("span");
    valueEl.className = `metric__value ${modifier}`.trim();

    cell.appendChild(labelEl);
    cell.appendChild(valueEl);

    return { cell, valueEl };
  }

  /**
   * A metric cell holding a live countdown.
   *
   * @param {object} expiry Resolved expiry from the analyzer.
   * @param {HTMLElement|null} card Card to mark expired when it lapses.
   * @param {string} label Tile label.
   * @returns {HTMLElement}
   */
  function createExpiresMetric(expiry, card, label = "Expires") {
    const { cell, valueEl } = createMetric(label, "is-mono");

    if (expiry.targetTime === undefined || expiry.targetTime === null) {
      valueEl.textContent = expiry.text;
      return cell;
    }

    // Age bundles origin age with edge residence, so this is a lower bound.
    const prefix = expiry.approximate ? "≈ " : "";
    if (expiry.approximate) {
      valueEl.title = "Approximate: derived from the Age header, so the real remaining lifetime is a little longer.";
    }

    addTicker(valueEl, () => {
      const remaining = expiry.targetTime - Date.now();
      valueEl.textContent = prefix + formatCountdown(remaining);

      if (remaining <= 0 && card) {
        markCardExpired(card, "the cached entry has expired since.");
      }
    });

    return cell;
  }

  /**
   * Timings first, then entry facts when they are live.
   *
   * @param {object} observation Analyzed request.
   * @param {HTMLElement} card Owning card.
   * @returns {HTMLElement|null}
   */
  /**
   * @param {HTMLElement} element Click target.
   * @param {string} value Value to copy.
   */
  function makeCopyable(element, value) {
    element.classList.add("is-copyable");
    element.title = `${value}\nClick to copy`;

    element.addEventListener("click", event => {
      event.stopPropagation();
      navigator.clipboard.writeText(value).then(() => {
        const original = element.textContent;
        element.textContent = "Copied!";
        setTimeout(() => { element.textContent = original; }, 1000);
      });
    });
  }

  function createMetrics(observation, card) {
    const { origin, servedBy, savings } = observation;
    const cells = [];

    // Coloured only at the ends of the range.
    if (observation.ttfb !== null && observation.ttfb !== undefined) {
      let modifier = "is-hero";
      if (observation.ttfb < 100) modifier += " is-good";
      else if (observation.ttfb >= 800) modifier += " is-slow";

      const { cell, valueEl } = createMetric("TTFB", modifier);
      fillDuration(valueEl, observation.ttfb);
      cells.push(cell);
    }

    [
      { data: savings.edge, label: "Edge saved", from: "origin", to: "edge" },
      { data: savings.origin, label: "Savings", from: "MISS", to: "HIT" }
    ].forEach(({ data, label, from, to }) => {
      if (!data) return;

      const { cell, valueEl } = createMetric(label, "is-hero is-good");

      const arrow = document.createElement("span");
      arrow.className = "metric__arrow";
      arrow.textContent = data.timeSaved >= 0 ? "↓" : "↑";
      valueEl.appendChild(arrow);

      fillDuration(valueEl, Math.abs(data.timeSaved));

      const sub = document.createElement("span");
      sub.className = "metric__sub";
      sub.textContent = `${from} ${Math.round(data.missTtfb)} → ${to} ${Math.round(data.hitTtfb)}`;
      valueEl.appendChild(sub);

      cells.push(cell);
    });

    // "Written" still holds on an edge hit: it dates the bytes the visitor
    // received. The origin's expiry does not, so it is not claimed here.
    if (servedBy === "edge") {
      [
        createEdgeExpiresMetric(observation.edge, card),
        createEdgeAgeMetric(observation.edge)
      ].forEach(cell => cell && cells.push(cell));

      // When debug mode is on, the entry's own lifetime can be anchored to an
      // absolute instant even from a replayed copy, which answers how stale the
      // served page is when the response sets no edge lifetime of its own. It
      // describes the copy the edge holds; the origin may have regenerated
      // since, so it does not drive the headline.
      const expiry = observation.expiry;
      if (expiry && expiry.targetTime && !expiry.approximate) {
        cells.push(createExpiresMetric(expiry, null, "Origin expires"));
      }

      if (origin.time) {
        cells.push(createWrittenMetric(origin.time));
      }
    }

    // Entry facts are live only when the origin answered.
    if (servedBy === "origin") {
      if (observation.expiry) {
        // Named for its layer wherever there are two of them to tell apart.
        cells.push(createExpiresMetric(
          observation.expiry,
          card,
          observation.edge.detected ? "Origin expires" : "Expires"
        ));
      }

      if (origin.time) {
        cells.push(createWrittenMetric(origin.time));
      }

      [
        { label: "Reason", value: origin.reason, modifier: "is-plain", wide: true },
        // Long hashes: truncated, with the full value copied on click.
        { label: "Key", value: origin.key, modifier: "is-mono", copyable: true },
        { label: "Gzip", value: origin.gzip === null ? "" : (origin.gzip ? "Enabled" : "Disabled"), modifier: "is-plain" }
      ].forEach(({ label, value, title, modifier, copyable, wide }) => {
        if (!value) return;

        const { cell, valueEl } = createMetric(label, modifier);
        valueEl.textContent = value;
        valueEl.title = title || value;

        // Prose, not a figure: it spans the row and wraps rather than clipping.
        if (wide) cell.classList.add("metric--wide");
        if (copyable) makeCopyable(valueEl, value);

        cells.push(cell);
      });
    }

    if (!cells.length) return null;

    const grid = document.createElement("div");
    grid.className = "metrics";
    cells.forEach(cell => grid.appendChild(cell));
    metricsObserver.observe(grid);

    return grid;
  }

  /**
   * A row of copyable tag pills.
   *
   * @param {string} label Row label.
   * @param {Array<string>} tags Tags to render.
   * @param {Array<string>|null} presentAt Tags known to be at the edge; any
   *   missing tag is marked, since it cannot be purged there.
   * @returns {HTMLElement}
   */
  function createTagsRow(label, tags, presentAt) {
    const row = document.createElement("div");
    row.className = "tags";

    const labelEl = document.createElement("span");
    labelEl.className = "tags__label";
    labelEl.textContent = label;

    const list = document.createElement("span");
    list.className = "tags__list";

    tags.forEach(tag => {
      const pill = document.createElement("span");
      pill.className = "pill pill--code pill--tag";
      pill.textContent = tag;

      if (presentAt && !presentAt.includes(tag)) {
        pill.classList.add("is-missing");
        pill.title = "Not present in the edge tag, so a flag purge will not clear this page at the edge.";
      } else {
        pill.title = "Click to copy";
      }

      pill.addEventListener("click", event => {
        event.stopPropagation();
        navigator.clipboard.writeText(tag).then(() => {
          const original = pill.textContent;
          pill.textContent = "Copied!";
          setTimeout(() => { pill.textContent = original; }, 1000);
        });
      });

      list.appendChild(pill);
    });

    row.appendChild(labelEl);
    row.appendChild(list);

    return row;
  }

  /**
   * @param {Array<{level: string, text: string}>} diagnostics Analyzer notes.
   * @returns {HTMLElement}
   */
  function createNotes(diagnostics) {
    const wrapper = document.createElement("div");
    wrapper.className = "notes";

    // No icon: the coloured left edge already separates a warning from a note.
    diagnostics.forEach(note => {
      const line = document.createElement("div");
      line.className = `note note--${note.level}`;
      line.textContent = note.text;
      wrapper.appendChild(line);
    });

    return wrapper;
  }

  function buildCardContent(observation, card) {
    const { origin, edge, servedBy } = observation;

    const content = document.createElement("div");
    content.className = "card-content";

    // Without a CDN there is one layer, already named by the header pill.
    if (edge.detected) {
      content.appendChild(createDeliveryBox(observation, card));
    }

    const metrics = createMetrics(observation, card);
    if (metrics) content.appendChild(metrics);

    // Origin flags are live only when the origin answered; edge tags are stored
    // with the object, so they are accurate either way.
    if (servedBy === "origin" && origin.flags.length) {
      content.appendChild(createTagsRow("Flags", origin.flags, edge.tags.length ? edge.tags : null));
    }

    if (edge.tags.length) {
      content.appendChild(createTagsRow("Edge tags", edge.tags, null));
    }

    if (observation.diagnostics.length) {
      content.appendChild(createNotes(observation.diagnostics));
    }

    return content;
  }

  // ============================================================================
  // Card creation and update
  // ============================================================================

  /** Collapse every card except the one passed in. */
  function collapseOthers(current) {
    log.querySelectorAll(".entry-card").forEach(card => {
      if (card === current) return;
      card.classList.remove("is-current", "is-open");
    });
  }

  function buildCardHeader(observation) {
    const header = document.createElement("div");
    header.className = "card-header";

    header.appendChild(createStatusPill(observation.effectiveStatus));

    // The heading stretches so the text can truncate, but only the text
    // navigates; the space beside it falls through to the header's toggle.
    const urlEl = document.createElement("h3");
    urlEl.className = "card-url";

    const link = document.createElement("bdi");
    link.className = "card-url__link";
    link.textContent = observation.url;
    link.title = "Open this URL in the inspected tab";
    link.addEventListener("click", event => {
      event.stopPropagation();
      navigateToUrl(observation.url);
    });

    urlEl.appendChild(link);
    header.appendChild(urlEl);

    if (observation.diagnostics.some(note => note.level === "warn")) {
      const warn = document.createElement("span");
      warn.className = "card-warning";
      warn.textContent = "⚠";
      warn.title = "This request has configuration warnings";
      header.appendChild(warn);
    }


    const httpStatus = document.createElement("span");
    httpStatus.className = "pill pill--http";
    httpStatus.textContent = observation.httpStatus;
    header.appendChild(httpStatus);

    const time = document.createElement("span");
    time.className = "card-time";
    time.textContent = new Date().toLocaleTimeString();
    header.appendChild(time);

    return header;
  }

  /**
   * @param {HTMLElement} element Target.
   * @param {string} className One-shot animation class, restarted if applied.
   */
  function playOnce(element, className) {
    element.classList.remove(className);
    element.offsetHeight; // Reflow, so re-adding restarts the animation.
    element.classList.add(className);
    element.addEventListener("animationend", () => element.classList.remove(className), { once: true });
  }

  function updateExistingCard(card, observation) {
    card.replaceChildren(buildCardHeader(observation), buildCardContent(observation, card));

    collapseOthers(card);
    card.classList.add("is-current", "is-open");

    log.prepend(card);
    insertPendingSeparatorAfter(card);
    playOnce(card, "flash");
  }

  function createMilliEntry(observation) {
    const requestUrl = observation.url;

    const existingCard = cardsByUrl.get(requestUrl);
    if (existingCard && existingCard.isConnected) {
      updateExistingCard(existingCard, observation);
      return;
    }

    const card = document.createElement("div");
    card.className = "entry-card is-current is-open is-new";
    card.addEventListener("animationend", () => card.classList.remove("is-new"), { once: true });
    card.appendChild(buildCardHeader(observation));
    card.appendChild(buildCardContent(observation, card));

    // The header toggles detail; the URL inside it navigates instead.
    card.querySelector(".card-header").addEventListener("click", () => {
      card.classList.toggle("is-open");
    });

    cardsByUrl.set(requestUrl, card);

    collapseOthers(card);
    log.prepend(card);
    insertPendingSeparatorAfter(card);

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
    const observation = analyze(request, analyzerState, { lastNavigatedUrl });
    if (!observation) return;

    if (observation.verdict === "no-millicache") {
      if (observation.isMainDocument && !hasSeenMilliCacheOnSite && !isDeactivated) {
        // Behind a CDN this means the edge is replaying a copy stored without
        // them, not that MilliCache is absent.
        const edge = observation.edge;
        const servedByEdge = edge.detected && edge.originFresh === false;

        if (servedByEdge) {
          showDeactivatedState(
            `Served from the ${edge.providerName} edge.`,
            "This stored copy carries no MilliCache headers. Purge the zone to re-fill it.",
            true
          );
        } else {
          showDeactivatedState(
            "MilliCache not detected on this site.",
            "No X-MilliCache headers on the document.",
            false
          );
        }
      }
      return;
    }

    hasSeenMilliCacheOnSite = true;

    if (isDeactivated) {
      showActivatedState();
    }

    if (observation.verdict !== "render") return;

    if (observation.debugNotice === "show") {
      showDebugNotice();
    } else if (observation.debugNotice === "hide") {
      hideDebugNotice();
    }

    createMilliEntry(observation);
  });
});
