import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { pathToFileURL } from "node:url";

const root = process.cwd();

function getContentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".mjs")) return "application/javascript";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
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

async function runWithPlaywright({ launcher, url }) {
  const browser = await launcher.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto(url, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(1000);

  const debugPresent = await page.evaluate(
    () => Boolean(window.__CONCEPT_DEBUG__)
  );
  const canvasPresent = await page.evaluate(
    () => Boolean(document.querySelector("canvas"))
  );

  await browser.close();

  return { consoleErrors, debugPresent, canvasPresent };
}

async function runWithPuppeteer({ launcher, url }) {
  const browser = await launcher.launch({ headless: "new" });
  const page = await browser.newPage();
  const consoleErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto(url, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(1000);

  const debugPresent = await page.evaluate(
    () => Boolean(window.__CONCEPT_DEBUG__)
  );
  const canvasPresent = await page.evaluate(
    () => Boolean(document.querySelector("canvas"))
  );

  await browser.close();

  return { consoleErrors, debugPresent, canvasPresent };
}

export async function runRuntimeCheck() {
  const loader = await loadBrowser();
  if (!loader) {
    return {
      skipped: true,
      warning:
        "Headless browser not available. Install Playwright or Puppeteer to enable runtime checks.",
    };
  }

  const { server, port } = await startStaticServer();
  const url = `http://127.0.0.1:${port}/`;

  try {
    const result =
      loader.type === "playwright"
        ? await runWithPlaywright({ launcher: loader.launcher, url })
        : await runWithPuppeteer({ launcher: loader.launcher, url });

    const hasConsoleErrors = result.consoleErrors.length > 0;
    const passed = !hasConsoleErrors && result.debugPresent && result.canvasPresent;

    return {
      skipped: false,
      passed,
      consoleErrors: result.consoleErrors,
      debugPresent: result.debugPresent,
      canvasPresent: result.canvasPresent,
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRuntimeCheck()
    .then((result) => {
      if (result.skipped) {
        console.warn("Runtime check skipped:", result.warning);
        process.exitCode = 0;
        return;
      }

      console.log("Runtime check results:");
      console.log(`- Console errors: ${result.consoleErrors.length}`);
      console.log(`- Debug API present: ${result.debugPresent}`);
      console.log(`- Canvas present: ${result.canvasPresent}`);

      if (!result.passed) {
        console.error("Runtime check failed.");
        if (result.consoleErrors.length) {
          result.consoleErrors.forEach((error) =>
            console.error(`  console.error: ${error}`)
          );
        }
        process.exitCode = 1;
      } else {
        console.log("Runtime check passed.");
      }
    })
    .catch((error) => {
      console.error("Runtime check crashed:", error);
      process.exitCode = 1;
    });
}
