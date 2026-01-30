import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function record(name, passed, details = "") {
  results.push({ name, passed, details });
}

function checkFileExists(relativePath) {
  const fullPath = path.join(root, relativePath);
  const exists = fs.existsSync(fullPath);
  record(`exists:${relativePath}`, exists, exists ? "" : "File missing");
  return exists;
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf-8");
}

checkFileExists("index.html");
checkFileExists("src/main.js");
checkFileExists("src/debug.js");
checkFileExists("docs/Debugging.md");

if (fs.existsSync(path.join(root, "index.html"))) {
  const indexHtml = readFile("index.html");
  record("index.html:#app", indexHtml.includes('id="app"'));
  record(
    "index.html:module-script",
    indexHtml.includes('type="module"') && indexHtml.includes("src/main.js")
  );
}

if (fs.existsSync(path.join(root, "src/main.js"))) {
  const mainJs = readFile("src/main.js");
  record("main.js:debug-import", mainJs.includes("createDebugBus"));
  record("main.js:app-mount", mainJs.includes('querySelector("#app")'));
}

if (fs.existsSync(path.join(root, "src/debug.js"))) {
  const debugJs = readFile("src/debug.js");
  record("debug.js:createDebugBus", debugJs.includes("createDebugBus"));
  record("debug.js:error-handlers", debugJs.includes("unhandledrejection"));
}

const failed = results.filter((entry) => !entry.passed);

console.log("Diagnostics summary:");
results.forEach((entry) => {
  const status = entry.passed ? "PASS" : "FAIL";
  const details = entry.details ? ` (${entry.details})` : "";
  console.log(`- ${status} ${entry.name}${details}`);
});

if (failed.length > 0) {
  console.error(`Diagnostics failed: ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("Diagnostics passed.");
}
