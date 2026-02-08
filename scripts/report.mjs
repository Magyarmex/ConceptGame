import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runTestSuite } from "./test-suite.mjs";

function formatStatus(entry) {
  const statusLabel = entry.status.toUpperCase();
  const details = entry.details ? `\n    Details: ${entry.details}` : "";
  const nextStep = entry.nextStep ? `\n    Next: ${entry.nextStep}` : "";
  return `- ${statusLabel} ${entry.name}${details}${nextStep}`;
}

export async function generateReport() {
  const { results, summary, hasFail } = await runTestSuite({ silent: true });
  const failed = results.filter((entry) => entry.status === "fail");
  const warnings = results.filter((entry) => entry.status === "warn");

  console.log("ConceptGame Diagnostics Report");
  console.log("=============================");
  console.log(`Status: ${hasFail ? "FAIL" : "PASS"}`);
  console.log(
    `Checks: ${summary.passed} passed, ${summary.failed} failed, ${summary.warnings} warning(s)`
  );

  if (failed.length) {
    console.log("\nFailing checks:");
    failed.forEach((entry) => console.log(formatStatus(entry)));
  }

  if (warnings.length) {
    console.log("\nWarnings:");
    warnings.forEach((entry) => console.log(formatStatus(entry)));
  }

  if (!failed.length && !warnings.length) {
    console.log("\nAll checks are healthy.");
  }

  console.log("\nNext steps:");
  if (failed.length) {
    console.log("- Resolve the failed checks above and re-run the test suite.");
  } else if (warnings.length) {
    console.log("- Address the warnings if you want full coverage.");
  } else {
    console.log("- Share this report with the team and keep monitoring.");
  }

  const artifactDir = path.join(process.cwd(), "artifacts", "reports");
  fs.mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, `report-${Date.now()}.json`);
  const payload = {
    generatedAt: new Date().toISOString(),
    summary,
    failed,
    warnings,
    action: failed.length
      ? "Fix failed checks"
      : warnings.length
        ? "Address warnings for full coverage"
        : "Maintain current quality bar",
  };
  fs.writeFileSync(artifactPath, JSON.stringify(payload, null, 2));
  console.log(`\nJSON artifact: ${artifactPath}`);
  return { artifactPath, payload };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateReport().catch((error) => {
    console.error("Report generation failed:", error);
    process.exitCode = 1;
  });
}
