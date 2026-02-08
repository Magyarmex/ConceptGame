const DEBUG_QUERY_KEY = "debug";
const DEBUG_STORAGE_KEY = "conceptgame:debug";
const LOG_LIMIT = 200;
const CHECK_LIMIT = 50;
const ERROR_CODES = {
  UNHANDLED_ERROR: "CG-E001",
  UNHANDLED_REJECTION: "CG-E002",
  CHECK_FAILURE: "CG-E003",
  LOGGED_ERROR: "CG-E004",
};
const DEFAULT_SEVERITY = {
  info: "low",
  warn: "medium",
  error: "high",
};

const logBuffer = [];
const checkBuffer = [];
const errorDedup = new Map();
let lastError = null;

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

function formatReport(record) {
  if (!record) {
    return "No errors recorded.";
  }

  const metaText =
    record.meta && Object.keys(record.meta).length
      ? ` meta=${JSON.stringify(record.meta)}`
      : "";
  return `[${record.code}] ${record.severity.toUpperCase()} ${record.message} (x${
    record.occurrences
  } @ ${record.timestamp})${metaText}`;
}

export function createDebugBus() {
  const enabled = isDebugEnabled();
  const panel = enabled ? createDebugPanel() : null;

  function emit(level, message, meta = {}) {
    const { code: metaCode, severity: metaSeverity, dedupeKey, ...metaRest } =
      meta ?? {};
    const severity =
      metaSeverity ?? DEFAULT_SEVERITY[level] ?? DEFAULT_SEVERITY.info;
    const code =
      metaCode ??
      (level === "error" ? ERROR_CODES.LOGGED_ERROR : undefined);
    const payload = {
      code,
      level,
      severity,
      message,
      meta: metaRest,
      occurrences: 1,
      timestamp: new Date().toISOString(),
    };

    if (level === "error") {
      const key = dedupeKey ?? `${code}:${message}`;
      const existing = errorDedup.get(key);
      if (existing) {
        existing.occurrences += 1;
        existing.timestamp = payload.timestamp;
        if (metaRest && Object.keys(metaRest).length) {
          existing.meta = { ...existing.meta, ...metaRest };
        }
        lastError = {
          code: existing.code,
          severity: existing.severity,
          message: existing.message,
          meta: existing.meta,
          timestamp: existing.timestamp,
          occurrences: existing.occurrences,
        };
        if (enabled && panel) {
          panel.append({
            ...existing,
            message: `${existing.message} (x${existing.occurrences})`,
          });
        }
        return;
      }
      errorDedup.set(key, payload);
      lastError = {
        code: payload.code,
        severity: payload.severity,
        message: payload.message,
        meta: payload.meta,
        timestamp: payload.timestamp,
        occurrences: payload.occurrences,
      };
    }

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
      emit("error", `Check failed: ${name}`, {
        code: ERROR_CODES.CHECK_FAILURE,
        severity: "medium",
        check: name,
        ...meta,
      });
    }
  }

  window.addEventListener("error", (event) => {
    emit("error", event.message || "Unhandled error", {
      code: ERROR_CODES.UNHANDLED_ERROR,
      severity: "high",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    emit("error", "Unhandled promise rejection", {
      code: ERROR_CODES.UNHANDLED_REJECTION,
      severity: "high",
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
    getLastError: () => (lastError ? { ...lastError } : null),
    report: (record) => formatReport(record ?? lastError),
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
    getLastError: api.getLastError,
    report: api.report,
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

  function setMetrics({ fps, frameTimeMs, drawCalls, triangles, grounded, moveSpeed }) {
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

    if (typeof grounded === "boolean") {
      lines.push(`Grounded: ${grounded ? "yes" : "no"}`);
    }

    if (typeof moveSpeed === "number") {
      lines.push(`Move Speed: ${moveSpeed.toFixed(2)}`);
    }

    metrics.textContent = lines.join("\n");
  }

  return { append, setMetrics };
}

function formatPayload({ level, message, meta, timestamp, code, severity, occurrences }) {
  const metaText =
    meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  const codeText = code ? ` ${code}` : "";
  const severityText = severity ? ` ${severity.toUpperCase()}` : "";
  const occurrenceText =
    occurrences && occurrences > 1 ? ` (x${occurrences})` : "";
  return `[${timestamp}] ${level.toUpperCase()}${severityText}${codeText}: ${message}${occurrenceText}${metaText}`;
}
