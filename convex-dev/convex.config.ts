import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import workflow from "@convex-dev/workflow/convex.config";

const app = defineApp();
app.use(agent, { name: "agent" });
app.use(workflow, { name: "workflow" });
export default app;
