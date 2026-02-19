import { pathToFileURL } from "node:url";
import { generateReport } from "../AI coding tools/scripts/report.mjs";

export { generateReport };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateReport().catch((error) => {
    console.error("Report generation failed:", error);
    process.exitCode = 1;
  });
}
