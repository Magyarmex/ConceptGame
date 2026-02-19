import { pathToFileURL } from "node:url";
import { runAgentDevWorkflow } from "../AI coding tools/scripts/agent-dev-workflow.mjs";

export { runAgentDevWorkflow };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentDevWorkflow().catch((error) => {
    console.error("Agent workflow failed:", error);
    process.exitCode = 1;
  });
}
