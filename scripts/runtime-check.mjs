import { pathToFileURL } from "node:url";
import { runRuntimeCheck } from "../AI coding tools/scripts/runtime-check.mjs";

export { runRuntimeCheck };

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
