import { defineApp } from "convex/server";
import { registerCortexComponentsV1 } from "./_cortex/components";
const app = defineApp();
registerCortexComponentsV1(app);
export default app;
