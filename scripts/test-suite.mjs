import { pathToFileURL } from "node:url";
import { runTestSuite } from "../AI coding tools/scripts/test-suite.mjs";

export { runTestSuite };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTestSuite().then(({ hasFail }) => {
    if (hasFail) {
      process.exitCode = 1;
    }
  }).catch((error) => {
    console.error("Test suite failed:", error);
    process.exitCode = 1;
  });
}
