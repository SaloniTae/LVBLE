/**
 * Trivis Floating UI v1.2 — Lovable in-page panel
 * UI only. Freeze / credit logic untouched.
 */
(function () {
  "use strict";
  if (window.__trivisFloatingUI__) return;
  window.__trivisFloatingUI__ = true;

  const ACCENT = "#DD0D10";
  const STORAGE_POS = "trivis_fab_pos";
  const INSTAGRAM_URL = "https://www.instagram.com/mnthnnnn";

  // ---------- utils ----------
  function el(tag, props, kids) {
    const n = document.createElement(tag);
    if (props) {
      Object.entries(props).forEach(([k, v]) => {
        if (k === "style" && typeof v === "object") Object.assign(n.style, v);
        else if (k === "className") n.className = v;
        else if (k.startsWith("on") && typeof v === "function")
          n.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "html") n.innerHTML = v;
        else if (k === "text") n.textContent = v;
        else n.setAttribute(k, v);
      });
    }
    (kids || []).forEach((c) => {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(res || null);
        });
      } catch (_) {
        resolve(null);
      }
    });
  }

  function formatRemaining(expiresAt) {
    if (!expiresAt) return "—";
    const end = Date.parse(expiresAt);
    if (!end || isNaN(end)) return "—";
    let ms = end - Date.now();
    if (ms <= 0) return "EXPIRED";
    const d = Math.floor(ms / 86400000);
    ms %= 86400000;
    const h = Math.floor(ms / 3600000);
    ms %= 3600000;
    const m = Math.floor(ms / 60000);
    ms %= 60000;
    const s = Math.floor(ms / 1000);
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function maskKey(key) {
    if (!key || key.length < 12) return key || "—";
    return key.slice(0, 9) + "••••" + key.slice(-4);
  }

  function detectProject() {
    try {
      const path = location.pathname || "";
      const title = (document.title || "").trim();

      // common lovable patterns
      const m =
        path.match(/\/projects?\/([a-zA-Z0-9_-]+)/i) ||
        path.match(/\/p\/([a-zA-Z0-9_-]+)/i) ||
        path.match(/\/app\/([a-zA-Z0-9_-]+)/i);

      if (m && m[1] && m[1].length > 2) {
        return m[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }

      // title based
      if (title && !/lovable/i.test(title) && title.length > 2 && title.length < 80) {
        const clean = title.replace(/\s*[|\-–—]\s*Lovable.*$/i, "").trim();
        if (clean && clean.length > 1) return clean;
      }

      // hash / search
      const h = location.hash || "";
      const hm = h.match(/project[=/]([a-zA-Z0-9_-]+)/i);
      if (hm) return hm[1];

      return null;
    } catch (_) {
      return null;
    }
  }

  // ---------- styles ----------
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    #trivis-fab-root {
      all: initial;
      position: fixed;
      z-index: 2147483645;
      pointer-events: none;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    #trivis-fab-root * { box-sizing: border-box; }

    /* FAB */
    #trivis-fab {
      pointer-events: auto;
      width: 54px;
      height: 54px;
      border-radius: 16px;
      background: linear-gradient(145deg, #1c1214 0%, #0a0809 100%);
      border: 1px solid rgba(221,13,16,0.5);
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.4),
        0 8px 28px rgba(0,0,0,0.55),
        0 0 20px rgba(221,13,16,0.18),
        inset 0 1px 0 rgba(255,255,255,0.07);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      user-select: none;
      touch-action: none;
      transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
      position: relative;
      will-change: transform;
    }
    #trivis-fab:hover {
      border-color: ${ACCENT};
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.4),
        0 10px 32px rgba(0,0,0,0.6),
        0 0 28px rgba(221,13,16,0.35),
        inset 0 1px 0 rgba(255,255,255,0.09);
    }
    #trivis-fab:active { cursor: grabbing; }
    #trivis-fab.dragging {
      cursor: grabbing;
      transition: none;
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.5),
        0 16px 40px rgba(0,0,0,0.7),
        0 0 32px rgba(221,13,16,0.4);
    }
    #trivis-fab img {
      width: 30px;
      height: 30px;
      border-radius: 9px;
      pointer-events: none;
      filter: drop-shadow(0 0 6px rgba(221,13,16,0.35));
    }
    #trivis-fab .trivis-dot {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #5a5a5a;
      box-shadow: 0 0 0 2px #0a0809;
      transition: background 0.3s, box-shadow 0.3s;
    }
    #trivis-fab.licensed .trivis-dot {
      background: #3fb950;
      box-shadow: 0 0 0 2px #0a0809, 0 0 10px rgba(63,185,80,0.7);
      animation: trivis-pulse 2s ease infinite;
    }
    @keyframes trivis-pulse {
      0%, 100% { box-shadow: 0 0 0 2px #0a0809, 0 0 8px rgba(63,185,80,0.55); }
      50% { box-shadow: 0 0 0 2px #0a0809, 0 0 14px rgba(63,185,80,0.9); }
    }

    /* PANEL */
    #trivis-panel {
      pointer-events: auto;
      position: absolute;
      width: 312px;
      max-height: min(82vh, 560px);
      overflow: hidden;
      display: none;
      flex-direction: column;
      background: linear-gradient(180deg, #120e10 0%, #0a0809 100%);
      border: 1px solid rgba(221,13,16,0.28);
      border-radius: 18px;
      box-shadow:
        0 24px 64px rgba(0,0,0,0.7),
        0 0 0 1px rgba(221,13,16,0.12),
        0 0 40px rgba(221,13,16,0.08);
      color: #f0f0f0;
      transform-origin: bottom right;
    }
    #trivis-panel.open {
      display: flex;
      animation: trivis-panel-in 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes trivis-panel-in {
      from { opacity: 0; transform: translateY(12px) scale(0.94); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* HEADER */
    .tv-hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 12px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      background: linear-gradient(180deg, rgba(221,13,16,0.08) 0%, transparent 100%);
    }
    .tv-hd-left {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .tv-hd-left img {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      box-shadow: 0 0 12px rgba(221,13,16,0.3);
    }
    .tv-hd-title {
      font-family: Orbitron, Inter, sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #fff;
      text-shadow: 0 0 20px rgba(221,13,16,0.4);
    }
    .tv-hd-sub {
      font-size: 10px;
      color: #9a9a9a;
      margin-top: 1px;
      font-weight: 500;
    }
    .tv-hd-actions {
      display: flex;
      gap: 6px;
    }
    .tv-icon-btn {
      width: 30px;
      height: 30px;
      border-radius: 9px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.04);
      color: #aaa;
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.18s ease;
    }
    .tv-icon-btn:hover {
      background: rgba(221,13,16,0.15);
      border-color: rgba(221,13,16,0.4);
      color: #fff;
    }
    .tv-icon-btn.close:hover {
      background: rgba(248,81,73,0.18);
      border-color: rgba(248,81,73,0.45);
      color: #f85149;
    }

    /* TIMER BAR */
    .tv-timer {
      text-align: center;
      padding: 10px 12px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .tv-timer-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #6e6e6e;
      font-weight: 600;
      margin-bottom: 3px;
    }
    .tv-timer-value {
      font-family: Orbitron, JetBrains Mono, monospace;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: ${ACCENT};
      text-shadow: 0 0 18px rgba(221,13,16,0.55);
      font-variant-numeric: tabular-nums;
      animation: tv-timer-glow 2.4s ease-in-out infinite;
    }
    @keyframes tv-timer-glow {
      0%, 100% { text-shadow: 0 0 14px rgba(221,13,16,0.4); }
      50% { text-shadow: 0 0 24px rgba(221,13,16,0.7); }
    }

    /* BODY */
    .tv-body {
      padding: 12px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 11px;
      scrollbar-width: thin;
      scrollbar-color: rgba(221,13,16,0.35) transparent;
    }

    /* FORM */
    .tv-form label {
      display: block;
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #8a8a8a;
      margin-bottom: 5px;
      font-weight: 600;
    }
    .tv-form input {
      width: 100%;
      padding: 11px 12px;
      border-radius: 11px;
      border: 1px solid rgba(255,255,255,0.1);
      background: #161012;
      color: #f0f0f0;
      font-size: 13px;
      outline: none;
      margin-bottom: 11px;
      transition: border-color 0.18s, box-shadow 0.18s;
      font-family: Inter, system-ui, sans-serif;
    }
    .tv-form input:focus {
      border-color: ${ACCENT};
      box-shadow: 0 0 0 3px rgba(221,13,16,0.18);
    }
    .tv-form .key-input {
      letter-spacing: 0.07em;
      text-transform: uppercase;
      font-family: JetBrains Mono, ui-monospace, monospace;
      font-size: 12px;
    }
    .tv-btn {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 11px;
      background: linear-gradient(135deg, #e81115 0%, #b50b0e 100%);
      color: #fff;
      font-weight: 700;
      font-size: 13.5px;
      letter-spacing: 0.04em;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: transform 0.12s, box-shadow 0.2s, opacity 0.15s;
      box-shadow: 0 4px 16px rgba(221,13,16,0.35);
      font-family: Inter, system-ui, sans-serif;
    }
    .tv-btn:hover {
      box-shadow: 0 6px 22px rgba(221,13,16,0.5);
      transform: translateY(-1px);
    }
    .tv-btn:active { transform: translateY(0) scale(0.98); }
    .tv-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

    /* ACTIVATION SEQUENCE */
    .tv-seq {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 28px 16px 24px;
      min-height: 180px;
    }
    .tv-seq.show { display: flex; }
    .tv-seq-ring {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: 2px solid rgba(221,13,16,0.25);
      border-top-color: ${ACCENT};
      animation: tv-spin 0.85s linear infinite;
    }
    @keyframes tv-spin { to { transform: rotate(360deg); } }
    .tv-seq-text {
      font-family: Orbitron, Inter, sans-serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #e8e8e8;
      text-align: center;
      min-height: 18px;
      animation: tv-text-in 0.35s ease;
    }
    @keyframes tv-text-in {
      from { opacity: 0; transform: translateY(6px); letter-spacing: 0.2em; }
      to   { opacity: 1; transform: translateY(0); letter-spacing: 0.12em; }
    }
    .tv-seq-text.success {
      color: #3fb950;
      text-shadow: 0 0 16px rgba(63,185,80,0.55);
    }

    /* CARDS */
    .tv-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 13px;
      padding: 12px;
      transition: border-color 0.2s;
    }
    .tv-card:hover { border-color: rgba(221,13,16,0.22); }
    .tv-card-hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .tv-card-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #7a7a7a;
      font-weight: 700;
    }
    .tv-refresh {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.04);
      color: #bbb;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .tv-refresh:hover {
      background: rgba(221,13,16,0.15);
      border-color: rgba(221,13,16,0.4);
      color: #fff;
    }
    .tv-refresh.spin svg { animation: tv-spin 0.7s linear; }

    .tv-sync-status {
      font-size: 13px;
      font-weight: 650;
      line-height: 1.35;
      min-height: 20px;
    }
    .tv-sync-status.notfound {
      color: #ff3b3b;
      text-shadow: 0 0 12px rgba(255,59,59,0.55), 0 0 24px rgba(255,59,59,0.25);
      font-family: Orbitron, Inter, sans-serif;
      font-size: 12px;
      letter-spacing: 0.04em;
      animation: tv-glow-red 1.8s ease-in-out infinite;
    }
    @keyframes tv-glow-red {
      0%, 100% { text-shadow: 0 0 10px rgba(255,59,59,0.45); }
      50% { text-shadow: 0 0 18px rgba(255,59,59,0.8), 0 0 28px rgba(255,59,59,0.3); }
    }
    .tv-sync-status.ok {
      color: #3fb950;
      text-shadow: 0 0 12px rgba(63,185,80,0.4);
      animation: tv-fade-up 0.4s ease;
    }
    @keyframes tv-fade-up {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .tv-sync-hint {
      font-size: 11px;
      color: #6e6e6e;
      margin-top: 5px;
      line-height: 1.4;
    }

    /* KV rows */
    .tv-kv {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      font-size: 12.5px;
    }
    .tv-kv:last-of-type { border-bottom: none; }
    .tv-kv .k { color: #8a8a8a; font-weight: 500; }
    .tv-kv .v {
      color: #eee;
      font-weight: 600;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .tv-kv .v.mono {
      font-family: JetBrains Mono, ui-monospace, monospace;
      font-size: 11px;
      letter-spacing: 0.03em;
    }

    .tv-logout {
      width: 100%;
      margin-top: 8px;
      padding: 10px;
      border-radius: 10px;
      border: 1px solid rgba(248,81,73,0.4);
      background: rgba(248,81,73,0.08);
      color: #f85149;
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.03em;
      cursor: pointer;
      transition: background 0.18s, transform 0.1s;
    }
    .tv-logout:hover {
      background: rgba(248,81,73,0.18);
      transform: translateY(-1px);
    }

    /* FOOTER SOCIAL */
    .tv-social {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 4px 0 2px;
    }
    .tv-social a {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #b0b0b0;
      text-decoration: none;
      transition: all 0.18s;
    }
    .tv-social a:hover {
      background: rgba(221,13,16,0.14);
      border-color: rgba(221,13,16,0.4);
      color: #fff;
      transform: translateY(-2px);
    }
    .tv-social svg { width: 15px; height: 15px; fill: currentColor; }
    .tv-foot {
      text-align: center;
      font-size: 9.5px;
      color: #4a4a4a;
      letter-spacing: 0.06em;
      padding-bottom: 2px;
      font-family: Orbitron, sans-serif;
    }

    /* PAUSED CARD STYLES */
    .tv-paused-card {
      text-align: center;
      padding: 24px 16px;
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 12px;
      margin-bottom: 12px;
    }
    .tv-paused-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }
    .tv-paused-title {
      font-size: 14px;
      font-weight: 800;
      color: #f59e0b;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .tv-paused-msg {
      font-size: 12px;
      color: #e2e8f0;
      line-height: 1.55;
      margin-bottom: 12px;
      background: rgba(0, 0, 0, 0.35);
      padding: 10px 12px;
      border-radius: 8px;
      border-left: 3px solid #f59e0b;
      text-align: left;
    }

    /* SEPARATE PROFESSIONAL TOOL CARDS */
    .tv-tool-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 13px 15px;
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: all 0.2s ease;
    }
    .tv-tool-card:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.15);
    }
    .tv-tool-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .tv-tool-icon {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      background: rgba(139, 92, 246, 0.12);
      border: 1px solid rgba(139, 92, 246, 0.25);
      color: #a78bfa;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .tv-tool-icon.secondary {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.12);
      color: #cbd5e1;
    }
    .tv-tool-info { flex: 1; }
    .tv-tool-name {
      font-size: 13px;
      font-weight: 700;
      color: #f1f5f9;
      line-height: 1.2;
    }
    .tv-tool-desc {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .tv-tool-btn {
      width: 100%;
      padding: 9px 14px;
      border-radius: 9px;
      border: 1px solid rgba(139, 92, 246, 0.35);
      background: rgba(139, 92, 246, 0.15);
      color: #c4b5fd;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.18s ease;
      font-family: inherit;
    }
    .tv-tool-btn:hover {
      background: rgba(139, 92, 246, 0.3);
      color: #ffffff;
      border-color: rgba(139, 92, 246, 0.5);
    }
    .tv-tool-btn.secondary {
      border-color: rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.05);
      color: #e2e8f0;
    }
    .tv-tool-btn.secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.22);
      color: #ffffff;
    }
    .tv-paused-hint {
      font-size: 11px;
      color: #94a3b8;
      margin-bottom: 14px;
    }
  `;

  function createLogoIcon(size = 22) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 24 24");
    
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `<linearGradient id="mnth-grad-${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>`;
    
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M13 2L3 14h9l-1 8 10-12h-9l1-8z");
    path.setAttribute("fill", `url(#mnth-grad-${size})`);

    svg.appendChild(defs);
    svg.appendChild(path);
    return svg;
  }

  // ---------- DOM ----------
  const style = el("style", { html: css });
  document.documentElement.appendChild(style);

  const root = el("div", { id: "trivis-fab-root" });
  const fab = el("div", { id: "trivis-fab", title: "mnthnnnn's Extension" });
  fab.appendChild(createLogoIcon(20));
  fab.appendChild(el("div", { className: "trivis-dot" }));

  const panel = el("div", { id: "trivis-panel" });

  // Header
  const hd = el("div", { className: "tv-hd" }, [
    el("div", { className: "tv-hd-left" }, [
      createLogoIcon(20),
      el("div", null, [
        el("div", { className: "tv-hd-title", text: "mnthnnnn" }),
        el("div", { className: "tv-hd-sub", id: "tv-hd-sub", text: "License required" })
      ])
    ]),
    el("div", { className: "tv-hd-actions" }, [
      el("button", {
        className: "tv-icon-btn",
        type: "button",
        title: "Hide panel",
        onClick: closePanel,
        html: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14"/></svg>`
      }),
      el("button", {
        className: "tv-icon-btn close",
        type: "button",
        title: "Close",
        onClick: closePanel,
        html: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>`
      })
    ])
  ]);
  panel.appendChild(hd);

  // Timer (only visible when licensed)
  const timerWrap = el("div", { className: "tv-timer", id: "tv-timer", style: { display: "none" } }, [
    el("div", { className: "tv-timer-label", text: "License expires in" }),
    el("div", { className: "tv-timer-value", id: "tv-timer-val", text: "—" })
  ]);
  panel.appendChild(timerWrap);

  const body = el("div", { className: "tv-body", id: "tv-body" });
  panel.appendChild(body);

  root.appendChild(fab);
  root.appendChild(panel);
  document.documentElement.appendChild(root);

  // ---------- state ----------
  let licensed = false;
  let statusData = null;
  let panelOpen = false;
  let countdownTimer = null;
  let projectName = null;
  let syncOk = false;

  // Smooth drag with rAF
  let drag = {
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    origLeft: 0,
    origTop: 0,
    ptrId: null
  };
  let rafId = 0;
  let pendingX = 0;
  let pendingY = 0;

  // ---------- position ----------
  function loadPos() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_POS], (r) => {
        const p = r[STORAGE_POS];
        if (p && typeof p.x === "number" && typeof p.y === "number") resolve(p);
        else resolve({ x: Math.max(8, window.innerWidth - 74), y: Math.max(8, window.innerHeight - 96) });
      });
    });
  }

  function savePos(x, y) {
    chrome.storage.local.set({ [STORAGE_POS]: { x, y } });
  }

  function place(x, y) {
    const maxX = window.innerWidth - 58;
    const maxY = window.innerHeight - 58;
    x = Math.max(6, Math.min(x, maxX));
    y = Math.max(6, Math.min(y, maxY));
    root.style.left = x + "px";
    root.style.top = y + "px";
    positionPanel();
  }

  function positionPanel() {
    const fr = fab.getBoundingClientRect();
    const panelW = 312;
    const spaceLeft = fr.left;
    const spaceRight = window.innerWidth - fr.right;
    let left = 0;
    if (spaceLeft >= panelW + 14) left = -(panelW + 12);
    else if (spaceRight >= panelW + 14) left = 64;
    else left = Math.max(-(fr.left - 8), -(panelW - 54));

    let top = 0;
    const estH = 480;
    if (fr.bottom + estH > window.innerHeight - 10) {
      top = Math.min(0, window.innerHeight - fr.top - estH - 10);
    }
    panel.style.left = left + "px";
    panel.style.top = top + "px";
  }

  // ---------- smooth drag ----------
  function onPtrDown(e) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    drag.active = true;
    drag.moved = false;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.origLeft = root.offsetLeft;
    drag.origTop = root.offsetTop;
    drag.ptrId = e.pointerId;
    fab.classList.add("dragging");
    try { fab.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }

  function onPtrMove(e) {
    if (!drag.active) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) drag.moved = true;
    if (!drag.moved) return;

    pendingX = drag.origLeft + dx;
    pendingY = drag.origTop + dy;

    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        place(pendingX, pendingY);
      });
    }
  }

  function onPtrUp(e) {
    if (!drag.active) return;
    drag.active = false;
    fab.classList.remove("dragging");
    try { fab.releasePointerCapture(drag.ptrId); } catch (_) {}
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      place(pendingX, pendingY);
    }
    if (drag.moved) {
      savePos(root.offsetLeft, root.offsetTop);
    } else {
      togglePanel();
    }
  }

  fab.addEventListener("pointerdown", onPtrDown);
  fab.addEventListener("pointermove", onPtrMove);
  fab.addEventListener("pointerup", onPtrUp);
  fab.addEventListener("pointercancel", onPtrUp);

  window.addEventListener("resize", () => place(root.offsetLeft, root.offsetTop));

  // ---------- panel ----------
  function openPanel() {
    panelOpen = true;
    panel.classList.add("open");
    positionPanel();
    renderBody();
    updateProjectStatus();
  }

  function closePanel() {
    panelOpen = false;
    panel.classList.remove("open");
  }

  function togglePanel() {
    if (panelOpen) closePanel();
    else openPanel();
  }

  // ---------- project status ----------
  function updateProjectStatus() {
    projectName = detectProject();
    const node = document.getElementById("tv-sync-status");
    if (!node) return;
    if (!projectName) {
      syncOk = false;
      node.className = "tv-sync-status notfound";
      node.textContent = "PROJECT NOT FOUND";
    } else {
      syncOk = true;
      node.className = "tv-sync-status ok";
      node.textContent = `${projectName.toUpperCase()}  ·  SYNC SUCCESSFUL`;
    }
  }

  // ---------- render ----------
  function renderBody() {
    body.innerHTML = "";
    const seq = el("div", { className: "tv-seq", id: "tv-seq" }, [
      el("div", { className: "tv-seq-ring" }),
      el("div", { className: "tv-seq-text", id: "tv-seq-text", text: "" })
    ]);
    body.appendChild(seq);

    if (statusData && (statusData.status === "paused" || statusData.status === "expired" || statusData.status === "revoked")) {
      timerWrap.style.display = "none";
      renderPausedScreen();
    } else if (!licensed) {
      timerWrap.style.display = "none";
      renderLicenseForm();
    } else {
      timerWrap.style.display = "";
      renderLicensed();
      updateProjectStatus();
    }
  }

  function renderPausedScreen() {
    const isPaused = !statusData || statusData.status === "paused";
    const sub = document.getElementById("tv-hd-sub");
    if (sub) sub.textContent = isPaused ? "Key is Paused" : "Access Blocked";

    const card = el("div", { className: "tv-card tv-paused-card" });
    const icon = isPaused ? "⏸️" : "⛔";
    const title = isPaused ? "KEY IS PAUSED" : "KEY INVALID / EXPIRED";
    
    card.appendChild(el("div", { className: "tv-paused-icon", text: icon }));
    card.appendChild(el("div", { className: "tv-paused-title", text: title }));
    
    const msgText = (statusData && (statusData.message || statusData.error)) || 
      "Key is paused. Contact mnthnnnn";
    
    card.appendChild(el("div", { className: "tv-paused-msg", text: msgText }));
    if (isPaused) {
      card.appendChild(el("div", { className: "tv-paused-hint", text: "Please contact mnthnnnn to unpause your subscription." }));
    }

    card.appendChild(
      el("button", {
        className: "tv-logout",
        type: "button",
        text: "LOGOUT / CHANGE KEY",
        onClick: async () => {
          await send({ type: "MNTH_LOGOUT" });
          licensed = false;
          statusData = null;
          fab.classList.remove("licensed");
          stopCountdown();
          renderBody();
        }
      })
    );

    body.appendChild(card);
  }

  function renderLicenseForm() {
    const sub = document.getElementById("tv-hd-sub");
    if (sub) sub.textContent = "Activate to unlock";

    const form = el("div", { className: "tv-form", id: "tv-form" });
    form.appendChild(el("label", { text: "Your Name" }));
    const nameIn = el("input", {
      id: "tv-name",
      placeholder: "Enter your name",
      autocomplete: "off"
    });
    form.appendChild(nameIn);

    form.appendChild(el("label", { text: "Licence Key" }));
    const keyIn = el("input", {
      id: "tv-key",
      className: "key-input",
      placeholder: "MNTHNNNN-XXXX-XXXX-XXXX",
      spellcheck: "false",
      autocomplete: "off"
    });
    form.appendChild(keyIn);

    const btn = el("button", { className: "tv-btn", type: "button", id: "tv-activate", text: "ACTIVATE" });
    form.appendChild(btn);
    body.appendChild(form);

    const runSequence = (steps, onDone) => {
      const formEl = document.getElementById("tv-form");
      const seqEl = document.getElementById("tv-seq");
      const textEl = document.getElementById("tv-seq-text");
      if (formEl) formEl.style.display = "none";
      if (seqEl) seqEl.classList.add("show");

      let i = 0;
      const next = () => {
        if (i >= steps.length) {
          if (onDone) onDone();
          return;
        }
        const step = steps[i++];
        if (textEl) {
          textEl.className = "tv-seq-text" + (step.ok ? " success" : "");
          textEl.style.animation = "none";
          void textEl.offsetWidth;
          textEl.style.animation = "";
          textEl.textContent = step.t;
        }
        setTimeout(next, step.ms || 700);
      };
      next();
    };

    const activate = async () => {
      const name = (nameIn.value || "").trim();
      const key = (keyIn.value || "").trim().toUpperCase();
      if (!name) {
        nameIn.focus();
        nameIn.style.borderColor = "#f85149";
        setTimeout(() => (nameIn.style.borderColor = ""), 1200);
        return;
      }
      if (!/^MNTHNNNN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key)) {
        keyIn.focus();
        keyIn.style.borderColor = "#f85149";
        setTimeout(() => (keyIn.style.borderColor = ""), 1200);
        return;
      }

      btn.disabled = true;

      // Visual sequence first (feels premium), then real validate
      runSequence(
        [
          { t: "CHECKING USER NAME", ms: 650 },
          { t: "VERIFY USERNAME", ms: 700 },
          { t: "CHECKING VALID LICENCE KEY", ms: 750 },
          { t: "VERIFY LICENCE KEY", ms: 800 }
        ],
        async () => {
          const res = await send({ type: "TRIVIS_VALIDATE", key, name });
          const textEl = document.getElementById("tv-seq-text");
          const seqEl = document.getElementById("tv-seq");

          if (res && res.ok) {
            if (textEl) {
              textEl.className = "tv-seq-text success";
              textEl.textContent = "ACTIVATE SUCCESSFULLY";
            }
            licensed = true;
            statusData = res;
            fab.classList.add("licensed");
            setTimeout(() => {
              if (seqEl) seqEl.classList.remove("show");
              renderBody();
              startCountdown();
            }, 900);
          } else {
            if (textEl) {
              textEl.className = "tv-seq-text";
              textEl.style.color = "#f85149";
              textEl.textContent = (res && res.error) || "INVALID LICENCE KEY";
            }
            setTimeout(() => {
              if (seqEl) seqEl.classList.remove("show");
              const formEl = document.getElementById("tv-form");
              if (formEl) formEl.style.display = "";
              btn.disabled = false;
              if (textEl) textEl.style.color = "";
            }, 1400);
          }
        }
      );
    };

    btn.addEventListener("click", activate);
    keyIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") activate();
    });
    nameIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") keyIn.focus();
    });
  }

  function renderLicensed() {
    const name = (statusData && (statusData.userName || statusData.name || statusData.user_name)) || "User";
    const expires = (statusData && (statusData.expiresAt || statusData.expires_at)) || null;
    const key = (statusData && statusData.key) || "—";

    const sub = document.getElementById("tv-hd-sub");
    if (sub) sub.textContent = `Welcome, ${name}! 👋`;

    // Auto Project Sync card
    const syncCard = el("div", { className: "tv-card" });
    const syncHd = el("div", { className: "tv-card-hd" }, [
      el("div", { className: "tv-card-title", text: "Auto Project Sync" }),
      el("button", {
        className: "tv-refresh",
        type: "button",
        title: "Refresh sync",
        id: "tv-refresh-btn",
        html: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 1 1-3.2-6.9"/><path d="M21 3v6h-6"/></svg>`,
        onClick: () => {
          const btn = document.getElementById("tv-refresh-btn");
          if (btn) btn.classList.add("spin");
          updateProjectStatus();
          // soft re-check license / keep freeze alive
          send({ type: "TRIVIS_STATUS" }).then((r) => {
            if (r) {
              licensed = !!r.ok;
              statusData = r;
              if (!licensed) {
                fab.classList.remove("licensed");
                renderBody();
              }
            }
            setTimeout(() => {
              if (btn) btn.classList.remove("spin");
            }, 700);
          });
        }
      })
    ]);
    syncCard.appendChild(syncHd);
    syncCard.appendChild(el("div", { className: "tv-sync-status notfound", id: "tv-sync-status", text: "PROJECT NOT FOUND" }));
    syncCard.appendChild(
      el("div", {
        className: "tv-sync-hint",
        text: "Create or open a project, then hit refresh if needed."
      })
    );
    body.appendChild(syncCard);

    // Remove Watermark Tool Card
    const wmCard = el("div", { className: "tv-tool-card" }, [
      el("div", { className: "tv-tool-header" }, [
        el("div", {
          className: "tv-tool-icon",
          html: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`
        }),
        el("div", { className: "tv-tool-info" }, [
          el("div", { className: "tv-tool-name", text: "Remove Watermark" }),
          el("div", { className: "tv-tool-desc", text: "Strip Lovable branding & footer badge" })
        ])
      ]),
      el("button", {
        className: "tv-tool-btn",
        type: "button",
        text: "Remove Watermark",
        onClick: () => triggerRemoveWatermark()
      })
    ]);
    body.appendChild(wmCard);

    // Licence Key Setting
    const licCard = el("div", { className: "tv-card" });
    licCard.appendChild(el("div", { className: "tv-card-title", text: "Licence Key Setting", style: { marginBottom: "8px" } }));

    const displayKey = (statusData && (statusData.key || statusData.key_string)) || key || "—";
    const devCount = (statusData && (statusData.deviceCount || statusData.device_count)) || 1;
    const maxDev = (statusData && (statusData.maxDevices || statusData.max_devices)) || 1;
    const deviceStr = `${devCount} / ${maxDev} Active`;

    const chatStorageKey = `mnth_chats_${displayKey}`;
    let chatsUsed = parseInt(localStorage.getItem(chatStorageKey) || "0") || 0;

    const kv = el("div");
    kv.appendChild(
      el("div", { className: "tv-kv" }, [
        el("span", { className: "k", text: "Key" }),
        el("span", { className: "v mono", text: displayKey, style: { fontSize: "11px", wordBreak: "break-all" } })
      ])
    );
    kv.appendChild(
      el("div", { className: "tv-kv" }, [
        el("span", { className: "k", text: "Devices" }),
        el("span", { className: "v", text: deviceStr })
      ])
    );
    kv.appendChild(
      el("div", { className: "tv-kv" }, [
        el("span", { className: "k", text: "Chats used" }),
        el("span", { className: "v", id: "tv-chats-used-val", text: `${chatsUsed} Prompts (Unlimited)` })
      ])
    );
    licCard.appendChild(kv);

    licCard.appendChild(
      el("button", {
        className: "tv-logout",
        type: "button",
        text: "LOGOUT",
        onClick: async () => {
          await send({ type: "TRIVIS_LOGOUT" });
          licensed = false;
          statusData = null;
          fab.classList.remove("licensed");
          stopCountdown();
          renderBody();
        }
      })
    );
    body.appendChild(licCard);

    // Social
    body.appendChild(
      el("div", { className: "tv-social" }, [
        el("a", { href: INSTAGRAM_URL, target: "_blank", rel: "noopener noreferrer", title: "Instagram @mnthnnnn" }, [
          (() => {
            const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            s.setAttribute("viewBox", "0 0 24 24");
            const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
            p.setAttribute(
              "d",
              "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"
            );
            s.appendChild(p);
            return s;
          })(),
          el("span", { text: "Instagram: @mnthnnnn" })
        ])
      ])
    );
    body.appendChild(el("div", { className: "tv-foot", text: "mnthnnnn's Extension · Terms & Fair Use Policy" }));
  }

  function startCountdown() {
    stopCountdown();
    const tick = () => {
      const node = document.getElementById("tv-timer-val");
      const exp = statusData && (statusData.expiresAt || statusData.expires_at);
      if (node && exp) {
        node.textContent = formatRemaining(exp);
      }
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  // ---------- Real-time Chats / Prompts Tracker ----------
  function incrementChatsUsed() {
    const displayKey = (statusData && (statusData.key || statusData.key_string)) || "default";
    const chatStorageKey = `mnth_chats_${displayKey}`;
    let current = parseInt(localStorage.getItem(chatStorageKey) || "0") || 0;
    current++;
    localStorage.setItem(chatStorageKey, String(current));

    const chatNode = document.getElementById("tv-chats-used-val");
    if (chatNode) {
      chatNode.textContent = `${current} Prompts (Unlimited)`;
    }
  }

  // Intercept prompt submissions
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable || (activeEl.placeholder && activeEl.placeholder.toLowerCase().includes("ask")))) {
        incrementChatsUsed();
      }
    }
  }, true);

  document.addEventListener("click", (e) => {
    const btn = e.target.closest('button[type="submit"], button[aria-label*="Send"], button[title*="Send"]');
    if (btn) {
      incrementChatsUsed();
    }
  }, true);

  // ---------- CSS Watermark Removal & Auto Prompt ----------
  function injectWatermarkCSS() {
    let styleEl = document.getElementById("mnth-no-watermark-css");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "mnth-no-watermark-css";
      styleEl.textContent = `
        a[href*="lovable.dev"],
        a[href*="lovable.app"],
        [class*="made-with-lovable"],
        [class*="lovable-badge"],
        [class*="watermark"],
        [aria-label*="Made with Lovable"],
        [aria-label*="Lovable badge"],
        div[class*="badge"][class*="lovable"],
        #lovable-badge,
        .lovable-badge {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `;
      (document.head || document.documentElement).appendChild(styleEl);
    }
  }

  function triggerRemoveWatermark() {
    injectWatermarkCSS();

    const promptText = "Remove the 'Made with Lovable' watermark/badge and all attribution elements from the application footer and layout.";
    const inputEl = document.querySelector('textarea[placeholder*="Ask"], textarea[placeholder*="prompt"], textarea[placeholder*="Lovable"], textarea, [contenteditable="true"]');
    
    if (inputEl) {
      if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
        inputEl.value = promptText;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        inputEl.focus();
      } else {
        inputEl.textContent = promptText;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.focus();
      }

      setTimeout(() => {
        const sendBtn = document.querySelector('button[type="submit"], button[aria-label*="Send"], button[title*="Send"], form button');
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
        } else {
          const enterEvt = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
          inputEl.dispatchEvent(enterEvt);
        }
      }, 250);
    }
  }

  // ---------- MinimalZip (Pure JS PKZIP Exporter) ----------
  function crc32(r) {
    let c, o = [];
    for (let t = 0; t < 256; t++) {
      c = t;
      for (let e = 0; e < 8; e++) c = 1 & c ? 3988292384 ^ c >>> 1 : c >>> 1;
      o[t] = c;
    }
    let n = -1;
    for (let a = 0; a < r.length; a++) n = n >>> 8 ^ o[255 & (n ^ r[a])];
    return (-1 ^ n) >>> 0;
  }

  class MinimalZip {
    constructor() { this.files = []; }
    addFile(name, content) {
      const enc = new TextEncoder();
      const data = typeof content === "string" ? enc.encode(content) : new Uint8Array(content);
      this.files.push({ name, data });
    }
    generateBlob() {
      const parts = [];
      const cdEntries = [];
      let offset = 0;
      for (const f of this.files) {
        const nameBytes = new TextEncoder().encode(f.name);
        const dataBytes = f.data;
        const crc = crc32(dataBytes);
        const size = dataBytes.length;
        const header = new Uint8Array(30 + nameBytes.length);
        const v = new DataView(header.buffer);
        v.setUint32(0, 0x04034b50, true);
        v.setUint16(4, 20, true);
        v.setUint16(6, 0, true);
        v.setUint16(8, 0, true);
        v.setUint16(10, 0, true);
        v.setUint16(12, 0, true);
        v.setUint32(14, crc, true);
        v.setUint32(18, size, true);
        v.setUint32(22, size, true);
        v.setUint16(26, nameBytes.length, true);
        v.setUint16(28, 0, true);
        header.set(nameBytes, 30);
        parts.push(header, dataBytes);

        const cd = new Uint8Array(46 + nameBytes.length);
        const cdv = new DataView(cd.buffer);
        cdv.setUint32(0, 0x02014b50, true);
        cdv.setUint16(4, 20, true);
        cdv.setUint16(6, 20, true);
        cdv.setUint16(8, 0, true);
        cdv.setUint16(10, 0, true);
        cdv.setUint16(12, 0, true);
        cdv.setUint16(14, 0, true);
        cdv.setUint32(16, crc, true);
        cdv.setUint32(20, size, true);
        cdv.setUint32(24, size, true);
        cdv.setUint16(28, nameBytes.length, true);
        cdv.setUint16(30, 0, true);
        cdv.setUint16(32, 0, true);
        cdv.setUint16(34, 0, true);
        cdv.setUint16(36, 0, true);
        cdv.setUint32(38, 0, true);
        cdv.setUint32(42, offset, true);
        cd.set(nameBytes, 46);
        cdEntries.push(cd);
        offset += header.length + dataBytes.length;
      }
      const cdStart = offset;
      let cdSize = 0;
      for (const cd of cdEntries) { parts.push(cd); cdSize += cd.length; }
      const eocd = new Uint8Array(22);
      const ev = new DataView(eocd.buffer);
      ev.setUint32(0, 0x06054b50, true);
      ev.setUint16(4, 0, true);
      ev.setUint16(6, 0, true);
      ev.setUint16(8, cdEntries.length, true);
      ev.setUint16(10, cdEntries.length, true);
      ev.setUint32(12, cdSize, true);
      ev.setUint32(16, cdStart, true);
      ev.setUint16(20, 0, true);
      parts.push(eocd);
      return new Blob(parts, { type: "application/zip" });
    }
  }

  async function triggerDownloadSourceCode() {
    const btn = document.getElementById("tv-dl-code-btn");
    const origText = btn ? btn.innerHTML : "";
    if (btn) btn.innerHTML = "<span>Packing Source Code…</span>";

    try {
      const match = location.pathname.match(/\/projects\/([a-zA-Z0-9-]+)/);
      const projectId = match ? match[1] : null;

      const zip = new MinimalZip();
      let fileCount = 0;

      if (projectId) {
        try {
          const res = await fetch(`https://api.lovable.dev/projects/${projectId}/files`, { credentials: "include" });
          if (res.ok) {
            const filesData = await res.json();
            if (Array.isArray(filesData)) {
              filesData.forEach((f) => {
                if (f.path && f.content != null) {
                  zip.addFile(f.path.replace(/^\//, ""), f.content);
                  fileCount++;
                }
              });
            }
          }
        } catch (_) {}
      }

      if (fileCount === 0) {
        const codeBlocks = document.querySelectorAll("pre, code, [data-language]");
        if (codeBlocks.length) {
          codeBlocks.forEach((block, idx) => {
            const fileName = block.getAttribute("data-filename") || `src/file_${idx + 1}.txt`;
            zip.addFile(fileName, block.textContent || "");
            fileCount++;
          });
        }
      }

      if (fileCount === 0) {
        zip.addFile("README.md", "# Exported Project Source Code\nExported via mnthnnnn's Extension");
        zip.addFile("package.json", JSON.stringify({ name: "lovable-project", version: "1.0.0" }, null, 2));
      }

      const blob = zip.generateBlob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `lovable-project-${Date.now()}.zip`;
      a.click();
    } catch (e) {
      console.error("[Source Code Export Error]", e);
    } finally {
      if (btn) btn.innerHTML = origText;
    }
  }

  // Listen for popup messages
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "TRIGGER_REMOVE_WATERMARK") triggerRemoveWatermark();
    if (msg?.type === "TRIGGER_DOWNLOAD_CODE") triggerDownloadSourceCode();
  });

  // ---------- init ----------
  async function init() {
    const pos = await loadPos();
    place(pos.x, pos.y);

    const res = await send({ type: "TRIVIS_STATUS" });
    if (res && res.ok) {
      licensed = true;
      statusData = res;
      fab.classList.add("licensed");
      startCountdown();
      injectWatermarkCSS();
    }

    // SPA navigation / project switch detection
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        if (panelOpen && licensed) updateProjectStatus();
      }
      // also re-check project periodically while open
      if (panelOpen && licensed) updateProjectStatus();
    }, 2000);

    setInterval(async () => {
      const r = await send({ type: "TRIVIS_STATUS" });
      if (r) {
        const was = licensed;
        licensed = !!r.ok;
        statusData = r;
        if (licensed) fab.classList.add("licensed");
        else fab.classList.remove("licensed");
        if (panelOpen && was !== licensed) renderBody();
        if (licensed && !was) {
          startCountdown();
          injectWatermarkCSS();
        }
        if (!licensed) stopCountdown();
      }
    }, 10000);
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init, { once: true });
})();
