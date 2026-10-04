let parts=[],generation=null,embedding=null;const calls=[];
export function setParts(value){parts=value;}
export function setGeneration(value){generation=value;}
export function setEmbedding(value){embedding=value;}
export function getCalls(){return [...calls];}
export function convexGateway(modelId){return {doGenerate:async options=>{calls.push({method:'generate',modelId,options});return generation;},doStream:async options=>{calls.push({method:'stream',modelId,options});return {stream:new ReadableStream({start(controller){for(const part of parts)controller.enqueue(part);controller.close();}})};}}
convexGateway.embeddingModel=modelId=>({doEmbed:async options=>{calls.push({method:'embed',modelId,options});return embedding;}});
