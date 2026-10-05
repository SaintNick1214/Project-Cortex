import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http=httpRouter();
http.route({path:"/fixture-effect",method:"POST",handler:httpAction(async(ctx,request)=>{
  const expected=process.env.QUALIFICATION_EFFECT_SECRET;
  if(!expected||request.headers.get("x-fixture-secret")!==expected) return new Response("Forbidden",{status:403});
  const body:unknown=await request.json();
  if(!body||typeof body!=="object"||!("operationId" in body)||typeof body.operationId!=="string") return new Response("Bad request",{status:400});
  return Response.json(await ctx.runMutation(internal.interrupted.effect,{operationId:body.operationId}));
})});
export default http;
