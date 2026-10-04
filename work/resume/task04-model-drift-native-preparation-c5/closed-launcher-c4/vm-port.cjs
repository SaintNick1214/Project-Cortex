'use strict';
const vm=require('node:vm'),{syncBuiltinESMExports}=require('node:module');
const Native=vm.SourceTextModule;
/** Constructors are available only at pinned fixed-source producer callsites; generated templates have no caller argument ingress. */
function install({sourceFence,producerPaths}){
 const producers=new Set(producerPaths),contexts=new WeakSet();
 function producer(){const stack=new Error().stack??'';const caller=[...producers].find(p=>stack.split('\n').some(line=>!line.includes(__filename)&&line.includes(p+':')));if(!caller)throw Error('QA_BRIDGE_VM_PRODUCER');return caller;}
 vm.SourceTextModule=class SourceTextModule extends Native{constructor(source,options){sourceFence();producer();if(typeof source!=='string'||!options?.context||typeof options.identifier!=='string')throw Error('QA_BRIDGE_VM_SOURCE');contexts.add(options.context);super(source,options);}};
 syncBuiltinESMExports();return {restore(){vm.SourceTextModule=Native;syncBuiltinESMExports();},admission:'PINNED_FIXED_PRODUCER_ONLY; exact source/helper preimages and closed command args govern the finite generated DUMMY recipes; not arbitrary-code isolation',contexts};
}
module.exports={install};
