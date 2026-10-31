/** Real persisted private presence controls for safely unavailable transcript/assets. */
export async function seedClosureFixtures(ctx) {
 const p=ctx.run+':',now=Date.now(),rows=[];
 for(const mode of ['owned','foreign','ownerless']){
  const user=mode==='owned'?ctx.users.reader:mode==='foreign'?ctx.users.foreign:undefined;
  const common={tenantId:ctx.scopes.tenantId,memorySpaceId:ctx.scopes.memorySpaceId};
  const conversationId=p+'closure-conversation-'+mode,shareId=p+'closure-share-'+mode,snapshotId=p+'closure-snapshot-'+mode,attachmentId=p+'closure-attachment-'+mode;
  const participants=user?{userId:user}:{};const messages=[{id:p+'closure-message-'+mode,role:'user',content:p+'private-content-'+mode,timestamp:now}];
  rows.push({table:'conversations',value:{...common,conversationId,type:'user-agent',participants,messages,messageCount:1,createdAt:now,updatedAt:now,visibility:'private'}});
  rows.push({table:'conversationShares',value:{tenantId:common.tenantId,shareId,conversationId,grantedBy:user??p+'unowned',sourceMemorySpaceId:common.memorySpaceId,grantType:'link',permissions:{canView:true,canViewFacts:false,canViewMemories:false,canContinue:false,canFork:false,canExport:false},viewCount:0,redactSensitive:true,status:'active',createdAt:now}});
  rows.push({table:'conversationSnapshots',value:{...common,snapshotId,conversationId,messages,conversationType:'user-agent',participants,messageCount:1,includedContent:{messages:true,facts:false,memories:false},redaction:{piiRedacted:true},createdBy:user??p+'unowned',status:'active',createdAt:now,snapshotOf:now}});
  rows.push({table:'attachments',value:{...common,attachmentId,userId:user??p+'unowned',storageId:ctx.files[mode==='foreign'?1:0].id,type:'file',mimeType:'text/plain',filename:p+'private-name-'+mode,size:28,createdAt:now,updatedAt:now}});
 }
 return await ctx.seed(rows);
}
export function closureArguments(args,ctx,mode='owned') {
 const ids={conversationId:ctx.run+':closure-conversation-'+mode,shareId:ctx.run+':closure-share-'+mode,snapshotId:ctx.run+':closure-snapshot-'+mode,attachmentId:ctx.run+':closure-attachment-'+mode};
 function replace(value,key){if(Object.hasOwn(ids,key))return ids[key];if(key==='storageId'&&typeof value==='string')return ctx.files[mode==='foreign'?1:0].id;
 if(Array.isArray(value))return value.map(item=>replace(item,key));if(value&&typeof value==='object'&&!(value instanceof ArrayBuffer))return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,replace(item,name)]));return value;}
 return replace(args,'args');
}
