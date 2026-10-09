import { registerCortexHttpRoutesV1 } from "./_cortex/http";
import {httpRouter} from "convex/server";
import {httpAction} from "./_generated/server";
const http=httpRouter();
http.route({path:"/host-health",method:"GET",handler:httpAction(async()=>new Response("host-route-preserved",{status:200}))});
registerCortexHttpRoutesV1(http);
export default http;
