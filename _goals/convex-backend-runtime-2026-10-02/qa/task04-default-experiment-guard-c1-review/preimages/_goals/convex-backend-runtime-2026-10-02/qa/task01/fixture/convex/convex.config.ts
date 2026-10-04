import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import workpool from "@convex-dev/workpool/convex.config";

const app = defineApp();
app.use(agent);
app.use(workflow);
app.use(workpool);
export default app;
