import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const noFollow=fs.constants.O_NOFOLLOW;
assert.ok(noFollow,'Platform O_NOFOLLOW required');
const inside=(parent,child)=>child!==parent&&path.relative(parent,child)!=='..'&&!path.relative(parent,child).startsWith('..'+path.sep)&&!path.isAbsolute(path.relative(parent,child));
export function inspectAncestors(file,{leafMayBeMissing=false}={}){
 const absolute=path.resolve(file);const items=[];let current=path.parse(absolute).root;
 for(const part of absolute.slice(current.length).split(path.sep).filter(Boolean)){
  current=path.join(current,part);let stat;try{stat=fs.lstatSync(current)}catch(error){if(error.code==='ENOENT'&&leafMayBeMissing&&current===absolute)return items;throw error}
  assert.ok(!stat.isSymbolicLink(),`SYMLINK_ANCESTOR_DENIED:${current}`);if(current!==absolute)assert.ok(stat.isDirectory(),'ANCESTOR_NOT_DIRECTORY');items.push({path:current,dev:stat.dev,ino:stat.ino});
 }
 return items;
}
export function recheckAncestors(items){for(const item of items){const stat=fs.lstatSync(item.path);assert.ok(!stat.isSymbolicLink()&&stat.dev===item.dev&&stat.ino===item.ino,'ANCESTOR_CHANGED')}}
export function readExact(file,expected){
 const ancestors=inspectAncestors(file);const fd=fs.openSync(file,fs.constants.O_RDONLY|noFollow);
 try{const before=fs.fstatSync(fd);assert.ok(before.isFile()&&before.nlink===1,'REGULAR_SINGLE_LINK_SOURCE_REQUIRED');const bytes=fs.readFileSync(fd);const after=fs.fstatSync(fd);assert.ok(before.dev===after.dev&&before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs&&before.ctimeMs===after.ctimeMs,'SOURCE_CHANGED_DURING_READ');assert.equal(hash(bytes),expected,'SOURCE_BYTES_DRIFT');recheckAncestors(ancestors);return bytes}finally{fs.closeSync(fd)}
}
export function verifyOutput(destination,roots){
 const dest=path.resolve(destination);assert.ok(roots.some(root=>inside(path.resolve(root),dest)),'OUTPUT_SCOPE_DENIED');
 const ancestors=inspectAncestors(dest,{leafMayBeMissing:true});const exists=fs.existsSync(dest);
 if(exists){const stat=fs.lstatSync(dest);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink(),'OUTPUT_NOT_EMPTY_DIRECTORY');assert.deepEqual(fs.readdirSync(dest),[],'OUTPUT_PREEXISTING_ENTRIES_DENIED')}
 assert.equal(fs.realpathSync(path.dirname(dest)),path.dirname(dest),'REAL_PARENT_MISMATCH');return {dest,exists,ancestors};
}
export function exclusiveFile(file,bytes,records){
 inspectAncestors(path.dirname(file));const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|noFollow,0o600);
 try{const stat=fs.fstatSync(fd);records?.push({path:file,dev:stat.dev,ino:stat.ino,kind:'file'});fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
}
export function ownedDirectories(root,relative,records){
 assert.ok(relative&&!path.isAbsolute(relative)&&!relative.split(path.sep).includes('..'),'RELATIVE_PATH_ONLY');let current=root;
 for(const part of relative.split(path.sep)){current=path.join(current,part);try{const stat=fs.lstatSync(current);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink(),'OWNED_DIRECTORY_CORRUPT')}catch(error){if(error.code!=='ENOENT')throw error;fs.mkdirSync(current,{mode:0o700});const stat=fs.lstatSync(current);records?.push({path:current,dev:stat.dev,ino:stat.ino,kind:'directory'})}}
 return current;
}
export function verifyTree(root,expected,{dependencyTarget}={}){
 const seen=new Set();const dirs=new Set();for(const name of expected.keys()){let parent=path.dirname(name);while(parent!=='.'){dirs.add(parent);parent=path.dirname(parent)}}
 if(dependencyTarget)dirs.add('node_modules');
 function walk(dir){for(const name of fs.readdirSync(dir)){const file=path.join(dir,name),relative=path.relative(root,file),stat=fs.lstatSync(file);if(stat.isSymbolicLink()){assert.equal(relative,'node_modules','UNEXPECTED_TREE_SYMLINK');assert.equal(fs.readlinkSync(file),dependencyTarget,'DEPENDENCY_LINK_CHANGED');seen.add(relative);continue}
  if(stat.isDirectory()){assert.ok(dirs.has(relative),'UNEXPECTED_TREE_DIRECTORY');walk(file)}else{assert.ok(stat.isFile()&&stat.nlink===1&&expected.has(relative),'UNEXPECTED_TREE_FILE');assert.equal(hash(readExact(file,expected.get(relative))),expected.get(relative));seen.add(relative)}}}
 inspectAncestors(root);walk(root);assert.deepEqual([...seen].sort(),[...expected.keys(),...(dependencyTarget?['node_modules']:[])].sort(),'EXACT_DYNAMIC_TREE_REQUIRED');
}
export function rollbackOutput(records){
 const failures=[];
 for(const row of [...records].reverse())try{const stat=fs.lstatSync(row.path);if(stat.dev!==row.dev||stat.ino!==row.ino||stat.isSymbolicLink()){failures.push('OWNERSHIP_CHANGED');continue}if(row.kind==='file')fs.unlinkSync(row.path);else fs.rmdirSync(row.path)}catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTEMPTY')failures.push(error.code??'CLEANUP_FAILED')}
 assert.equal(failures.length,0,'OUTPUT_CLEANUP_OWNERSHIP_FAILURE');
}
export function removePrivate(workspace,identity){
 const stat=fs.lstatSync(workspace);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.dev===identity.dev&&stat.ino===identity.ino,'PRIVATE_WORKSPACE_OWNER_CHANGED');
 // rm does not traverse symlinks; workspace was exclusively allocated with0700.
 fs.rmSync(workspace,{recursive:true,force:false});assert.ok(!fs.existsSync(workspace),'PRIVATE_WORKSPACE_RESIDUE');
}
