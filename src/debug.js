const DEBUG_QUERY_KEY = "debug";
const DEBUG_STORAGE_KEY = "conceptgame:debug";

function isDebugEnabled() {
  const queryEnabled = new URLSearchParams(window.location.search).has(
    DEBUG_QUERY_KEY
  );
  const storedEnabled = window.localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
  return queryEnabled || storedEnabled;
}

export function createDebugBus() {
  const enabled = isDebugEnabled();
  const panel = enabled ? createDebugPanel() : null;

  function emit(level, message, meta = {}) {
    const payload = {
      level,
      message,
      meta,
      timestamp: new Date().toISOString(),
    };

    if (enabled && panel) {
      panel.append(payload);
    }

    if (level === "error") {
      console.error("[Debug]", message, meta);
    } else {
      console.log("[Debug]", message, meta);
    }
  }

  if (enabled) {
    window.addEventListener("error", (event) => {
      emit("error", event.message || "Unhandled error", {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      emit("error", "Unhandled promise rejection", {
        reason: event.reason?.toString?.() ?? event.reason,
      });
    });
  }

  return {
    enabled,
    log: (message, meta) => emit("info", message, meta),
    warn: (message, meta) => emit("warn", message, meta),
    error: (message, meta) => emit("error", message, meta),
    updateStats(stats) {
      if (!enabled || !panel) {
        return;
      }

      panel.setMetrics(stats);
    },
    attachRenderer(renderer) {
      if (!enabled || !panel) {
        return;
      }

      panel.append({
        level: "info",
        message: "Renderer initialized",
        meta: {
          maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
          maxTextures: renderer.capabilities.maxTextures,
        },
        timestamp: new Date().toISOString(),
      });
    },
  };
}

function createDebugPanel() {
  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.right = "12px";
  panel.style.bottom = "12px";
  panel.style.width = "320px";
  panel.style.maxHeight = "45vh";
  panel.style.overflow = "auto";
  panel.style.background = "rgba(15, 23, 42, 0.92)";
  panel.style.color = "#e2e8f0";
  panel.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
  panel.style.fontSize = "12px";
  panel.style.padding = "10px";
  panel.style.border = "1px solid rgba(148, 163, 184, 0.4)";
  panel.style.borderRadius = "8px";
  panel.style.zIndex = "9999";
  panel.style.pointerEvents = "none";

  const header = document.createElement("div");
  header.textContent = "Debug Console (append ?debug to URL)";
  header.style.fontWeight = "600";
  header.style.marginBottom = "8px";
  panel.appendChild(header);

  const metrics = document.createElement("div");
  metrics.style.marginBottom = "8px";
  metrics.style.whiteSpace = "pre-wrap";
  panel.appendChild(metrics);

  const logContainer = document.createElement("div");
  panel.appendChild(logContainer);
  document.body.appendChild(panel);

  function append(payload) {
    const row = document.createElement("div");
    row.style.marginBottom = "6px";
    row.style.whiteSpace = "pre-wrap";
    row.textContent = formatPayload(payload);
    logContainer.appendChild(row);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function setMetrics({ fps, frameTimeMs, drawCalls, triangles }) {
    const lines = [
      `FPS: ${fps.toFixed(1)}`,
      `Frame: ${frameTimeMs.toFixed(2)} ms`,
    ];

    if (typeof drawCalls === "number") {
      lines.push(`Draw Calls: ${drawCalls}`);
    }

    if (typeof triangles === "number") {
      lines.push(`Triangles: ${triangles}`);
    }

    metrics.textContent = lines.join("\n");
  }

  return { append, setMetrics };
}

function formatPayload({ level, message, meta, timestamp }) {
  const metaText =
    meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaText}`;
}
