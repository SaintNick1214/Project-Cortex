const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
module.exports=(request,options)=>{
 let resolved;
 // Only unchanged PURE's literal profile.js import needs TypeScript resolution.
 if(request==='./profile.js'&&options.basedir==='/workspace/Project-Cortex/src/domain') resolved=options.defaultResolver('./profile.ts',options);
 else resolved=options.defaultResolver(request,options);
 if(path.isAbsolute(resolved)){
  const qa=__dirname,freeze=JSON.parse(fs.readFileSync(path.join(qa,'current-freeze.json'),'utf8'));
  if(resolved.includes('/catalog/')||resolved.includes('gateway-historical'))throw Error('HISTORICAL_CURRENT_IMPORT_DENIED');
  const row=freeze.files.find(r=>r.path===resolved);
  if(!row)throw Error('UNCATALOGED_CURRENT_IMPORT '+resolved);
  const sha256=crypto.createHash('sha256').update(fs.readFileSync(resolved)).digest('hex');
  if(sha256!==row.sha256)throw Error('CURRENT_IMPORT_CHANGED');
  fs.appendFileSync(path.join(freeze.work,'imports.ndjson'),JSON.stringify({request,resolved,sha256,verified:true})+'\n');
 }
 return resolved;
};
