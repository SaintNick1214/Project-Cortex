// Source parsing only: no program, type checker, emit, transpilation or subject import.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const fields = ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'];
function identity(s) { return {schema:'FS_IDENTITY_DECIMAL_V1',fields:Object.fromEntries(fields.map(k=>[k,String(s[k==='mtime_ns'?'mtimeNs':k==='ctime_ns'?'ctimeNs':k])]))}; }
const hash = b=>crypto.createHash('sha256').update(b).digest('hex');
function same(a,b) { return JSON.stringify(a)===JSON.stringify(b); }
export function parseSource(text, name, ts) {
  if(typeof text!=='string'||typeof name!=='string'||!ts?.createSourceFile) throw Error('AST_INPUT_SCHEMA');
  const sf=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  if(sf.parseDiagnostics.length) throw Error('AST_PARSE_DIAGNOSTICS');
  const calls=[],imports=[];
  function visit(node) {
    const module=ts.isNewExpression(node)&&/(^|\.)SourceTextModule$/.test(node.expression.getText(sf));
    const run=ts.isCallExpression(node)&&/(^|\.)runInContext$/.test(node.expression.getText(sf));
    if(module||run) {
      const start=node.getStart(sf),end=node.end,p=sf.getLineAndCharacterOfPosition(start),q=sf.getLineAndCharacterOfPosition(end);
      const arg=node.arguments?.[0];
      calls.push({kind:module?'SourceTextModule':'runInContext',line:p.line+1,columnStart:p.character+1,
        columnEnd:q.line===p.line?q.character+1:text.split('\n')[p.line].replace(/\r$/,'').length+1,
        endLine:q.line+1,endColumn:q.character+1,startUTF16:start,endUTF16:end,
        argumentExpression:arg?.getText(sf)??'',callTextSHA256:hash(Buffer.from(text.slice(start,end)))});
    }
    if(ts.isImportDeclaration(node)&&ts.isStringLiteralLike(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    ts.forEachChild(node,visit);
  }
  visit(sf); return {calls,imports};
}
export function parsePinnedSource(pin, typescriptPath, check=()=>{}) {
  if(!pin||typeof pin.path!=='string'||!Number.isSafeInteger(pin.bytes)||!/^[a-f0-9]{64}$/.test(pin.sha256)) throw Error('AST_PIN_SCHEMA');
  check(); const pre=fs.lstatSync(pin.path,{bigint:true});
  if(!pre.isFile()||pre.nlink!==1n||fs.realpathSync(pin.path)!==pin.path) throw Error('AST_REGULAR_SINGLE_LINK');
  const fd=fs.openSync(pin.path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  let raw;
  try {
    if(!same(identity(pre),identity(fs.fstatSync(fd,{bigint:true})))||!same(identity(pre),pin.identity)) throw Error('AST_CURRENT_IDENTITY_DRIFT');
    const chunks=[];let total=0;const block=Buffer.alloc(65536);
    for(;;) { check();const n=fs.readSync(fd,block,0,block.length,null);if(!n)break;total+=n;if(total>pin.bytes)throw Error('AST_SOURCE_BYTE_BOUND');chunks.push(Buffer.from(block.subarray(0,n))); }
    raw=Buffer.concat(chunks);
    if(total!==pin.bytes||hash(raw)!==pin.sha256||!same(identity(pre),identity(fs.fstatSync(fd,{bigint:true})))||!same(identity(pre),identity(fs.lstatSync(pin.path,{bigint:true}))))throw Error('AST_FULL_EOF_SOURCE_DRIFT');
  } finally { fs.closeSync(fd); }
  // The parser library is a separately source-bound package dependency.
  const ts=createRequire(import.meta.url)(typescriptPath);
  const text=new TextDecoder('utf-8',{fatal:true}).decode(raw),facts=parseSource(text,pin.path,ts);
  check(); if(!same(identity(pre),identity(fs.lstatSync(pin.path,{bigint:true}))))throw Error('AST_FINAL_SOURCE_IDENTITY_DRIFT');
  return {source:pin,fullEOF:true,...facts};
}

export function deriveASTFacts(sourcePins, parserPin, typescriptPath, check=()=>{}) {
  if(!Array.isArray(sourcePins)||new Set(sourcePins.map(r=>r.path)).size!==sourcePins.length)throw Error('AST_COMPLETE_UNIQUE_SOURCE_SET');
  return {schema:'C8_CURRENT_AST_FACTS_V1',parser:parserPin,sources:sourcePins.map(pin=>parsePinnedSource(pin,typescriptPath,check))};
}
