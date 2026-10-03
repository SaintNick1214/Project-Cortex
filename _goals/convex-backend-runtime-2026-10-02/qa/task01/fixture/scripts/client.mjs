import { sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { qualificationTarget, repo } from "./paths.mjs";

export { repo };
export const target=qualificationTarget();
export function jwt(subject="task01-owner",patch={},wrongSignature=false){
  const header=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:"task01-rs256-v1"})).toString("base64url");
  const now=Math.floor(Date.now()/1000);
  const payload=Buffer.from(JSON.stringify({iss:"https://cortex-qualification.invalid",aud:"cortex-task01",sub:subject,iat:now,exp:now+3600,...patch})).toString("base64url");
  const signingInput=header+"."+payload;
  const key=readFileSync(resolve(repo,"work/backend-runtime/qualification/jwt-private.pem"));
  const signature=sign("RSA-SHA256",Buffer.from(signingInput),key).toString("base64url");
  return signingInput+"."+(wrongSignature?signature.slice(0,-6)+"abcdef":signature);
}
export function client(token=jwt()){
  const c=new ConvexHttpClient(target.deploymentUrl);
  if(token)c.setAuth(token);
  return c;
}
