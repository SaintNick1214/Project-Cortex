import _cortex_component_agent from "@convex-dev/agent/convex.config";
import _cortex_component_workflow from "@convex-dev/workflow/convex.config";
import { defineApp } from "convex/server";
const app = defineApp();
app.use(_cortex_component_agent, { name: "agent" });
app.use(_cortex_component_workflow, { name: "workflow" });
export default app;
