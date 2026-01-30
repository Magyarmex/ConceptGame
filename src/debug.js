const DEBUG_QUERY_KEY = "debug";
const DEBUG_STORAGE_KEY = "conceptgame:debug";
const LOG_LIMIT = 200;
const CHECK_LIMIT = 50;

const logBuffer = [];
const checkBuffer = [];

function pushBuffer(buffer, entry, limit) {
  buffer.push(entry);
  if (buffer.length > limit) {
    buffer.shift();
  }
}

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

    pushBuffer(logBuffer, payload, LOG_LIMIT);

    if (enabled && panel) {
      panel.append(payload);
    }

    const shouldConsole = enabled || level !== "info";
    if (shouldConsole) {
      const method =
        level === "error" ? "error" : level === "warn" ? "warn" : "log";
      console[method]("[Debug]", message, meta);
    }
  }

  function emitCheck(name, passed, meta = {}) {
    const entry = {
      name,
      passed,
      meta,
      timestamp: new Date().toISOString(),
    };
    pushBuffer(checkBuffer, entry, CHECK_LIMIT);
    if (enabled && panel) {
      panel.append({
        level: passed ? "info" : "error",
        message: `Check: ${name}`,
        meta: { passed, ...meta },
        timestamp: entry.timestamp,
      });
    }
    if (!passed) {
      console.warn("[Debug]", `Check failed: ${name}`, meta);
    }
  }

  window.addEventListener("error", (event) => {
    emit("error", event.message || "Unhandled error", {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    emit("error", "Unhandled promise rejection", {
      reason: event.reason?.toString?.() ?? event.reason,
    });
  });

  const api = {
    enabled,
    log: (message, meta) => emit("info", message, meta),
    warn: (message, meta) => emit("warn", message, meta),
    error: (message, meta) => emit("error", message, meta),
    check: (name, passed, meta) => emitCheck(name, passed, meta),
    getLogs: () => [...logBuffer],
    getChecks: () => [...checkBuffer],
    getStatus: () => ({
      enabled,
      logCount: logBuffer.length,
      checkCount: checkBuffer.length,
    }),
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

  window.__CONCEPT_DEBUG__ = {
    getLogs: api.getLogs,
    getChecks: api.getChecks,
    getStatus: api.getStatus,
  };

  return api;
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
