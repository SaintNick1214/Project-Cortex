import { httpRouter } from "convex/server";
import { effect } from "./qualificationPeer";
const router=httpRouter();router.route({path:"/qa/task04-peer/effect",method:"POST",handler:effect});
export default router;
