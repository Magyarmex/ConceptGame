import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runRuntimeCheck } from "./runtime-check.mjs";

const root = process.cwd();

function record(results, entry) {
  results.push({
    status: entry.status,
    name: entry.name,
    details: entry.details ?? "",
    nextStep: entry.nextStep ?? "",
  });
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf-8");
}

function checkFileExists(results, relativePath) {
  const exists = fs.existsSync(path.join(root, relativePath));
  record(results, {
    status: exists ? "pass" : "fail",
    name: `file:${relativePath}`,
    details: exists ? "" : "File missing",
    nextStep: exists
      ? ""
      : `Restore ${relativePath} from version control or regenerate it.`,
  });
  return exists;
}

function collectJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  });
  return files;
}

function extractImports(source) {
  const imports = [];
  const importFromRegex = /import\s+([\s\S]+?)\s+from\s+["']([^"']+)["']/g;
  const importSideEffectRegex = /import\s+["']([^"']+)["']/g;

  let match = null;
  while ((match = importFromRegex.exec(source))) {
    imports.push({
      specifier: match[1].trim(),
      source: match[2].trim(),
      sideEffect: false,
    });
  }

  while ((match = importSideEffectRegex.exec(source))) {
    if (!imports.find((entry) => entry.source === match[1].trim())) {
      imports.push({
        specifier: "",
        source: match[1].trim(),
        sideEffect: true,
      });
    }
  }

  return imports;
}

function resolveImportPath(importerPath, importPath) {
  const basePath = path.resolve(path.dirname(importerPath), importPath);
  const candidates = [
    basePath,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.js"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function parseExports(source) {
  const named = new Set();
  let hasDefault = false;

  const namedExportRegex =
    /export\s+(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g;
  const exportListRegex = /export\s*\{([\s\S]*?)\}/g;
  const defaultRegex = /export\s+default/g;

  let match = null;
  while ((match = namedExportRegex.exec(source))) {
    named.add(match[1]);
  }

  while ((match = exportListRegex.exec(source))) {
    const entries = match[1]
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    entries.forEach((entry) => {
      const [original, alias] = entry.split(/\s+as\s+/i);
      named.add((alias ?? original).trim());
    });
  }

  if (defaultRegex.test(source)) {
    hasDefault = true;
  }

  return { named, hasDefault };
}

function parseImportSpecifiers(specifier) {
  const result = { defaultImport: null, namedImports: [], namespaceImport: null };
  if (!specifier) {
    return result;
  }

  const [defaultPart, namedPart] = specifier.split(/,(.+)/).map((part) => part?.trim());
  if (defaultPart && !defaultPart.startsWith("{") && !defaultPart.startsWith("*")) {
    result.defaultImport = defaultPart;
  }

  const namedSource = namedPart ?? (specifier.startsWith("{") ? specifier : "");
  if (namedSource && namedSource.startsWith("{")) {
    const content = namedSource.replace(/[{}]/g, "");
    result.namedImports = content
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => entry.split(/\s+as\s+/i)[0].trim());
  }

  if (specifier.includes("* as")) {
    const match = specifier.match(/\*\s+as\s+([A-Za-z0-9_$]+)/);
    result.namespaceImport = match ? match[1] : null;
  }

  return result;
}

async function runImportChecks(results) {
  const srcDir = path.join(root, "src");
  const files = collectJsFiles(srcDir);

  files.forEach((filePath) => {
    const source = fs.readFileSync(filePath, "utf-8");
    const imports = extractImports(source);

    imports.forEach((entry) => {
      if (!entry.source.startsWith(".")) {
        return;
      }

      const resolved = resolveImportPath(filePath, entry.source);
      const relativeImporter = path.relative(root, filePath);
      record(results, {
        status: resolved ? "pass" : "fail",
        name: `import:${relativeImporter}->${entry.source}`,
        details: resolved ? "" : "Import target missing",
        nextStep: resolved
          ? ""
          : `Ensure ${entry.source} exists relative to ${relativeImporter}.`,
      });

      if (!resolved || entry.sideEffect) {
        return;
      }

      const targetSource = fs.readFileSync(resolved, "utf-8");
      const exports = parseExports(targetSource);
      const specifiers = parseImportSpecifiers(entry.specifier);

      if (specifiers.defaultImport && !exports.hasDefault) {
        record(results, {
          status: "fail",
          name: `export:${relativeImporter}->${entry.source}:default`,
          details: "Default export missing",
          nextStep: `Add a default export in ${path.relative(
            root,
            resolved
          )} or change the import.`,
        });
      }

      specifiers.namedImports.forEach((name) => {
        if (!exports.named.has(name)) {
          record(results, {
            status: "fail",
            name: `export:${relativeImporter}->${entry.source}:${name}`,
            details: "Named export missing",
            nextStep: `Export ${name} from ${path.relative(
              root,
              resolved
            )} or update the import.`,
          });
        }
      });
    });
  });
}

export async function runTestSuite({ includeRuntime = true, silent = false } = {}) {
  const results = [];

  checkFileExists(results, "index.html");
  checkFileExists(results, "src/main.js");
  checkFileExists(results, "src/debug.js");
  checkFileExists(results, "docs/Debugging.md");

  if (fs.existsSync(path.join(root, "index.html"))) {
    const indexHtml = readFile("index.html");
    record(results, {
      status: indexHtml.includes('id="app"') ? "pass" : "fail",
      name: "index.html:#app",
      details: indexHtml.includes('id="app"') ? "" : "Missing #app root",
      nextStep: "Ensure index.html contains an element with id=\"app\".",
    });
    record(results, {
      status:
        indexHtml.includes('type="module"') &&
        indexHtml.includes("src/main.js")
          ? "pass"
          : "fail",
      name: "index.html:module-script",
      details:
        indexHtml.includes('type="module"') &&
        indexHtml.includes("src/main.js")
          ? ""
          : "Missing module script for src/main.js",
      nextStep:
        "Add a <script type=\"module\" src=\"src/main.js\"></script> tag.",
    });
  }

  if (fs.existsSync(path.join(root, "src/main.js"))) {
    const mainJs = readFile("src/main.js");
    record(results, {
      status: mainJs.includes("createDebugBus") ? "pass" : "fail",
      name: "main.js:debug-import",
      details: mainJs.includes("createDebugBus")
        ? ""
        : "Missing createDebugBus import",
      nextStep: "Ensure src/main.js imports createDebugBus.",
    });
    record(results, {
      status: mainJs.includes('querySelector("#app")') ? "pass" : "fail",
      name: "main.js:app-mount",
      details: mainJs.includes('querySelector("#app")')
        ? ""
        : "Missing #app querySelector",
      nextStep: "Ensure src/main.js mounts to #app element.",
    });
    record(results, {
      status:
        /radius:\s*\d*\.?\d+/.test(mainJs) &&
        mainJs.includes("radius: playerConfig.radius")
          ? "pass"
          : "fail",
      name: "main.js:player-radius-config",
      details:
        /radius:\s*\d*\.?\d+/.test(mainJs) &&
        mainJs.includes("radius: playerConfig.radius")
          ? ""
          : "Player capsule radius config missing or not wired",
      nextStep:
        "Set playerConfig.radius and ensure createCapsuleCollider uses playerConfig.radius.",
    });
    record(results, {
      status: mainJs.includes("halfHeight: (playerConfig.height - playerConfig.radius * 2) / 2")
        ? "pass"
        : "fail",
      name: "main.js:player-halfheight-uses-radius",
      details: mainJs.includes("halfHeight: (playerConfig.height - playerConfig.radius * 2) / 2")
        ? ""
        : "Capsule halfHeight no longer derived from configured radius",
      nextStep:
        "Compute capsule halfHeight from playerConfig.height and playerConfig.radius.",
    });
    record(results, {
      status: (mainJs.match(/registerCollisionMesh\(/g) ?? []).length > 1 ? "pass" : "fail",
      name: "main.js:collision-registration-nonempty",
      details:
        (mainJs.match(/registerCollisionMesh\(/g) ?? []).length > 1
          ? ""
          : "No static meshes are registered for collision",
      nextStep:
        "Register static blockers via registerCollisionMesh during world setup.",
    });
    record(results, {
      status: mainJs.includes("const collisionVolumes = collisionMeshes.map((mesh) => ({")
        ? "pass"
        : "fail",
      name: "main.js:collision-volumes-from-registered-meshes",
      details: mainJs.includes("const collisionVolumes = collisionMeshes.map((mesh) => ({")
        ? ""
        : "collisionVolumes is not built from registered collisionMeshes",
      nextStep:
        "Build collisionVolumes from collisionMeshes so registered static geometry blocks movement.",
    });
    record(results, {
      status: mainJs.includes("applyLookDelta(deltaX, deltaY, cameraState.dragSensitivity)")
        ? "pass"
        : "fail",
      name: "main.js:look-delta-unified",
      details: mainJs.includes("applyLookDelta(deltaX, deltaY, cameraState.dragSensitivity)")
        ? ""
        : "Drag path does not use shared applyLookDelta",
      nextStep:
        "Route drag pointer deltas through applyLookDelta to keep sign/clamp behavior aligned.",
    });
    record(results, {
      status:
        mainJs.includes("cameraState.yaw += deltaX * sensitivity") &&
        mainJs.includes("cameraState.pitch -= deltaY * sensitivity")
          ? "pass"
          : "fail",
      name: "main.js:look-sign-convention",
      details:
        mainJs.includes("cameraState.yaw += deltaX * sensitivity") &&
        mainJs.includes("cameraState.pitch -= deltaY * sensitivity")
          ? ""
          : "Look sign convention is not explicit/consistent in applyLookDelta",
      nextStep:
        "Use yaw += deltaX and pitch -= deltaY in applyLookDelta for consistent pan mapping.",
    });
    record(results, {
      status:
        mainJs.includes("minPitch: -Math.PI / 2 + 0.01") &&
        mainJs.includes("maxPitch: Math.PI / 2 - 0.01")
          ? "pass"
          : "fail",
      name: "main.js:first-person-free-look-bounds",
      details:
        mainJs.includes("minPitch: -Math.PI / 2 + 0.01") &&
        mainJs.includes("maxPitch: Math.PI / 2 - 0.01")
          ? ""
          : "First-person pitch bounds are not near-vertical free-look",
      nextStep:
        "Set first-person pitch bounds close to +/- PI/2 with a small epsilon.",
    });
    record(results, {
      status: mainJs.includes('const lookTarget = cameraState.mode === "first" ? cameraLookTarget : cameraFocus;')
        ? "pass"
        : "fail",
      name: "main.js:first-person-look-target",
      details: mainJs.includes('const lookTarget = cameraState.mode === "first" ? cameraLookTarget : cameraFocus;')
        ? ""
        : "Camera lookAt target does not use forward-derived first-person target",
      nextStep:
        "Use first-person forward look target when camera mode is first.",
    });
  }

  await runImportChecks(results);

  if (includeRuntime) {
    const runtimeResult = await runRuntimeCheck();
    if (runtimeResult.skipped) {
      record(results, {
        status: "warn",
        name: "runtime-check:skipped",
        details: runtimeResult.warning,
        nextStep: "Install Playwright or Puppeteer to enable runtime checks.",
      });
    } else {
      record(results, {
        status: runtimeResult.passed ? "pass" : "fail",
        name: "runtime-check:boot",
        details: runtimeResult.passed
          ? ""
          : `Console errors: ${runtimeResult.consoleErrors.length}`,
        nextStep: runtimeResult.passed
          ? ""
          : "Open the runtime-check output for console error details.",
      });
      record(results, {
        status: runtimeResult.debugPresent ? "pass" : "fail",
        name: "runtime-check:debug-api",
        details: runtimeResult.debugPresent
          ? ""
          : "window.__CONCEPT_DEBUG__ missing",
        nextStep: "Ensure createDebugBus initializes window.__CONCEPT_DEBUG__.",
      });
      record(results, {
        status: runtimeResult.canvasPresent ? "pass" : "fail",
        name: "runtime-check:canvas",
        details: runtimeResult.canvasPresent ? "" : "Canvas not found",
        nextStep: "Ensure renderer canvas is appended to #app.",
      });
      if (runtimeResult.consoleErrors.length) {
        runtimeResult.consoleErrors.forEach((error, index) => {
          record(results, {
            status: "fail",
            name: `runtime-console-error:${index + 1}`,
            details: error,
            nextStep: "Fix the console error logged during boot.",
          });
        });
      }
    }
  }

  const hasFail = results.some((entry) => entry.status === "fail");
  const summary = {
    total: results.length,
    passed: results.filter((entry) => entry.status === "pass").length,
    failed: results.filter((entry) => entry.status === "fail").length,
    warnings: results.filter((entry) => entry.status === "warn").length,
  };

  if (!silent) {
    console.log("Test suite summary:");
    results.forEach((entry) => {
      const prefix = entry.status.toUpperCase();
      const details = entry.details ? ` (${entry.details})` : "";
      console.log(`- ${prefix} ${entry.name}${details}`);
      if (entry.status !== "pass" && entry.nextStep) {
        console.log(`  Next step: ${entry.nextStep}`);
      }
    });
    console.log(
      `Totals: ${summary.passed} passed, ${summary.failed} failed, ${summary.warnings} warning(s)`
    );
  }

  return { results, summary, hasFail };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTestSuite()
    .then(({ hasFail }) => {
      if (hasFail) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error("Test suite crashed:", error);
      process.exitCode = 1;
    });
}
