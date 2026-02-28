import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { pathToFileURL } from "node:url";
import { runTestSuite } from "./test-suite.mjs";
import { generateReport } from "./report.mjs";

const root = process.cwd();
const artifactDir = path.join(root, "artifacts", "agent-runs");

const SMOKE_SCENARIO = {
  name: "smoke",
  steps: [
    { duration: 1.2, forward: 1 },
    { duration: 0.6, strafe: 1 },
    { duration: 0.1, jump: true },
    { duration: 0.8, forward: 1, lookYaw: 0.5 },
    { duration: 0.1, fire: true },
    { duration: 0.5, forward: -1 },
  ],
};

function ensureDir() {
  fs.mkdirSync(artifactDir, { recursive: true });
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) {
    return 0;
  }
  const index = Math.min(sortedValues.length - 1, Math.floor((p / 100) * sortedValues.length));
  return sortedValues[index];
}

function getContentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "application/javascript";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = path.join(root, relativePath);

    if (!filePath.startsWith(root) || !fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    const body = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": "no-store",
    });
    res.end(body);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        resolve({ server, port: address.port });
      }
    });
  });
}

async function loadBrowser() {
  try {
    const playwright = await import("playwright");
    return { type: "playwright", launcher: playwright.chromium };
  } catch {
    // ignore
  }

  try {
    const puppeteer = await import("puppeteer");
    return { type: "puppeteer", launcher: puppeteer };
  } catch {
    // ignore
  }

  return null;
}

async function runScenarioInPage(page, scenario) {
  return page.evaluate(async (scenarioPayload) => {
    const harness = window.__CONCEPT_AGENT_HARNESS__;
    const debugApi = window.__CONCEPT_DEBUG__;

    if (!harness || typeof harness.runScenario !== "function") {
      return {
        failed: true,
        reason: "Harness API unavailable on window.__CONCEPT_AGENT_HARNESS__",
      };
    }

    const frameDeltas = [];
    let monitorActive = true;
    let lastFrameTime = performance.now();

    function collectFrame(now) {
      if (!monitorActive) {
        return;
      }
      frameDeltas.push(now - lastFrameTime);
      lastFrameTime = now;
      requestAnimationFrame(collectFrame);
    }

    requestAnimationFrame(collectFrame);

    const accepted = harness.runScenario({ steps: scenarioPayload.steps });
    const timeoutAt = performance.now() + 10000;

    while (performance.now() < timeoutAt) {
      const status = harness.getStatus();
      if (!status.active) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    monitorActive = false;

    return {
      failed: false,
      accepted,
      status: harness.getStatus(),
      trace: harness.getTrace(),
      entities: harness.getEntitySnapshot(),
      logs: debugApi?.getLogs?.() ?? [],
      checks: debugApi?.getChecks?.() ?? [],
      frameDeltas,
    };
  }, scenario);
}

function summarizePlaytest(raw, scenarioName, runtimeMeta = {}) {
  if (raw.failed) {
    return {
      generatedAt: new Date().toISOString(),
      scenario: scenarioName,
      routeCompletion: 0,
      collisionAnomalies: [{ type: "harness-failure", message: raw.reason }],
      frameTimeEnvelopeMs: { min: 0, p50: 0, p95: 0, max: 0 },
      entitySnapshots: [],
      trace: [],
      runtime: runtimeMeta,
      nextSteps: ["Ensure ?dev loads successfully and harness API is exposed."],
    };
  }

  const sortedFrames = [...raw.frameDeltas].sort((a, b) => a - b);
  const frameEnvelope = {
    min: Number((sortedFrames[0] ?? 0).toFixed(3)),
    p50: Number(percentile(sortedFrames, 50).toFixed(3)),
    p95: Number(percentile(sortedFrames, 95).toFixed(3)),
    max: Number((sortedFrames[sortedFrames.length - 1] ?? 0).toFixed(3)),
  };

  const failedChecks = raw.checks.filter((entry) => !entry.passed);
  const highPenetrationLogs = raw.logs.filter((entry) => entry.message === "collision:high-penetration");
  const anomalies = [
    ...failedChecks.map((entry) => ({
      type: "check-failure",
      message: entry.name,
      meta: entry.meta ?? {},
    })),
    ...highPenetrationLogs.map((entry) => ({
      type: "collision-warning",
      message: entry.message,
      meta: entry.meta ?? {},
    })),
  ];

  const routeCompletion = raw.trace.length > 0 && !raw.status.active ? 1 : raw.trace.length > 0 ? 0.5 : 0;
  const nextSteps = [];
  if (routeCompletion < 1) {
    nextSteps.push("Investigate scenario completion timeout or harness status transitions.");
  }
  if (anomalies.length) {
    nextSteps.push("Review anomaly metadata and adjust collider placement or movement tuning.");
  }
  if (!nextSteps.length) {
    nextSteps.push("Promote this scenario to baseline and add a second route branch scenario.");
  }

  return {
    generatedAt: new Date().toISOString(),
    scenario: scenarioName,
    routeCompletion,
    collisionAnomalies: anomalies,
    frameTimeEnvelopeMs: frameEnvelope,
    entitySnapshots: raw.entities.slice(0, 24),
    trace: raw.trace,
    runtime: runtimeMeta,
    nextSteps,
  };
}

async function runScriptedPlaytest() {
  const loader = await loadBrowser();

  if (!loader) {
    const json = {
      generatedAt: new Date().toISOString(),
      scenario: SMOKE_SCENARIO.name,
      routeCompletion: 0,
      collisionAnomalies: [],
      frameTimeEnvelopeMs: { min: 0, p50: 0, p95: 0, max: 0 },
      entitySnapshots: [],
      trace: [],
      runtime: {
        skipped: true,
        warning: "Headless browser not available. Install Playwright or Puppeteer to enable scripted harness runs.",
      },
      nextSteps: ["Install Playwright or Puppeteer and re-run this command for real scripted traces."],
    };
    const outPath = path.join(artifactDir, `playtest-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(json, null, 2));
    return { outPath, json };
  }

  const { server, port } = await startStaticServer();
  const url = `http://127.0.0.1:${port}/?dev&debug`;

  try {
    const consoleErrors = [];
    if (loader.type === "playwright") {
      const browser = await loader.launcher.launch({ headless: true });
      const page = await browser.newPage();
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (error) => {
        consoleErrors.push(error.message);
      });
      await page.goto(url, { waitUntil: "load", timeout: 20000 });
      await page.waitForTimeout(800);
      const raw = await runScenarioInPage(page, SMOKE_SCENARIO);
      await browser.close();
      const json = summarizePlaytest(raw, SMOKE_SCENARIO.name, {
        skipped: false,
        browser: loader.type,
        consoleErrors,
      });
      const outPath = path.join(artifactDir, `playtest-${Date.now()}.json`);
      fs.writeFileSync(outPath, JSON.stringify(json, null, 2));
      return { outPath, json };
    }

    const browser = await loader.launcher.launch({ headless: "new" });
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });
    await page.goto(url, { waitUntil: "load", timeout: 20000 });
    await new Promise((resolve) => setTimeout(resolve, 800));
    const raw = await runScenarioInPage(page, SMOKE_SCENARIO);
    await browser.close();

    const json = summarizePlaytest(raw, SMOKE_SCENARIO.name, {
      skipped: false,
      browser: loader.type,
      consoleErrors,
    });
    const outPath = path.join(artifactDir, `playtest-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(json, null, 2));
    return { outPath, json };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

export async function runAgentDevWorkflow() {
  ensureDir();

  const suite = await runTestSuite({ includeRuntime: false, silent: true });
  const playtest = await runScriptedPlaytest();
  const report = await generateReport();

  console.log("Agent Dev Workflow");
  console.log("==================");
  console.log(`Test suite: ${suite.hasFail ? "FAIL" : "PASS"}`);
  console.log(`Scripted playtest artifact: ${playtest.outPath}`);
  console.log(`Route completion: ${(playtest.json.routeCompletion * 100).toFixed(0)}%`);
  if (playtest.json.runtime.skipped) {
    console.log(`Runtime warning: ${playtest.json.runtime.warning}`);
  }
  if (Array.isArray(playtest.json.nextSteps) && playtest.json.nextSteps.length) {
    console.log("Suggested next steps:");
    playtest.json.nextSteps.forEach((step) => console.log(`- ${step}`));
  }

  const summaryPath = path.join(artifactDir, `summary-${Date.now()}.txt`);
  const lines = [
    `Generated: ${new Date().toISOString()}`,
    `Suite status: ${suite.hasFail ? "FAIL" : "PASS"}`,
    `Route completion: ${(playtest.json.routeCompletion * 100).toFixed(0)}%`,
    `Anomalies: ${playtest.json.collisionAnomalies.length}`,
    `Playtest artifact: ${playtest.outPath}`,
    `Report artifact: ${report.artifactPath}`,
    `Next steps: ${playtest.json.nextSteps.join(" | ")}`,
  ];
  fs.writeFileSync(summaryPath, `${lines.join("\n")}\n`);

  return {
    suite,
    playtestPath: playtest.outPath,
    summaryPath,
    reportPath: report.artifactPath,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentDevWorkflow().catch((error) => {
    console.error("Agent workflow failed:", error);
    process.exitCode = 1;
  });
}
