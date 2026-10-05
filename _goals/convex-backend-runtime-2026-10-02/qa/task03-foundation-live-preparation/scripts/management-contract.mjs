import { sha256 } from './guard.mjs';
const reject=()=>{throw new Error('Exact owned disposable management identity rejected');};
export function validateCreatedOwnership(request,ownership){
 if(request.purpose!=='task03-foundation-currentguard'||request.kind!=='cloud'||request.deploymentType!=='dev'||request.productionDeployment!==false||request.sharedCiTarget!==false||!/^cortex-foundation-disposable-[a-f0-9]{12}$/.test(request.projectSlug)||request.projectName.toLowerCase().replaceAll(' ','-')!==request.projectSlug
 ||ownership.operation!==request.operation||ownership.requestSha256!==sha256(JSON.stringify(request))||!Number.isSafeInteger(ownership.id)||ownership.id<=0||ownership.slug!==request.projectSlug||ownership.requestedName!==request.projectName||!Number.isFinite(Date.parse(ownership.startedAt)))reject();
}
export function validateRetirement(request,ownership,project,deployments,deployment,target){
 validateCreatedOwnership(request,ownership);
 if(project.id!==ownership.id||project.slug!==request.projectSlug||project.name!==request.projectName||!Array.isArray(deployments)||deployments.length!==1)reject();
 const sole=deployments[0];if(sole.name!==deployment.name||sole.projectId!==ownership.id||sole.deploymentType!=='dev'||deployment.projectId!==ownership.id||deployment.deploymentType!=='dev'||deployment.kind!=='cloud'||!/^\w+(?:-[a-z0-9]+)+$/.test(deployment.name)||deployment.deploymentUrl!==`https://${deployment.name}.convex.cloud`)reject();
 if(ownership.deploymentName&&ownership.deploymentName!==deployment.name)reject();
 if(target&&(target.operation!==request.operation||target.requestSha256!==ownership.requestSha256||target.projectId!==ownership.id||target.projectName!==request.projectName||target.projectSlug!==request.projectSlug||target.deploymentName!==deployment.name||target.deploymentUrl!==deployment.deploymentUrl||target.kind!=='cloud'||target.deploymentType!=='dev'||target.active!==true||target.retired!==false||target.deleted!==false||target.productionDeployment!==false||target.sharedCiTarget!==false||target.isolationVerified!==true))reject();
 return {projectId:ownership.id,deploymentName:deployment.name,deploymentUrl:deployment.deploymentUrl,provisionState:target?'FULLY_VERIFIED':'REQUEST_OWNED_PARTIAL_RECOVERY'};
}
