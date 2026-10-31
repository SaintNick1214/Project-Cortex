import { lstatSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { sourcePreflight, preparation, repo, fixture } from '../../task03-local-native-attempt3-2026-10-05/scripts/guard.mjs';

if (process.platform !== 'linux' || process.arch !== 'x64' || process.version !== 'v24.15.0') throw new Error('Runtime mismatch');
if (process.getuid() !== 501 || process.getgid() !== 20 || process.env.HOME !== '/tmp') throw new Error('Identity mismatch');
const home = lstatSync('/tmp');
if (home.uid !== 501 || home.gid !== 20 || (home.mode & 0o777) !== 0o700 || !home.isDirectory()) throw new Error('Home mismatch');
if (readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim() !== '536870912' || readFileSync('/sys/fs/cgroup/memory.swap.max', 'utf8').trim() !== '0') throw new Error('Resource ceiling mismatch');
for (const name of ['CONVEX_DEPLOY_KEY','CONVEX_DEPLOYMENT','CONVEX_URL','CONVEX_DEPLOYMENT_TOKEN','CONVEX_OVERRIDE_ACCESS_TOKEN','CONVEX_SELF_HOSTED_URL','CONVEX_SELF_HOSTED_ADMIN_KEY']) {
  if (process.env[name]) throw new Error('Unexpected service selector');
}
const npm = execFileSync('/usr/local/bin/npm', ['--version'], { encoding: 'utf8', timeout: 15000 }).trim();
if (npm !== '12.2.0') throw new Error('Package manager mismatch');
const result = sourcePreflight();
const versions = {};
for (const name of ['convex','ws','https-proxy-agent','typescript']) versions[name] = JSON.parse(readFileSync(`${repo}/node_modules/${name}/package.json`, 'utf8')).version;
console.log(JSON.stringify({status:'PASS',scope:'ACTUAL_LINUX_SOURCE_ONLY_PREFLIGHT',preparation,repo,fixture,node:process.version,npm,platform:process.platform,architecture:process.arch,uid:process.getuid(),gid:process.getgid(),home:{path:'/tmp',uid:home.uid,gid:home.gid,mode:'0700'},currentSourcePins:result.source.files.length,productRootPaths:result.source.productRootPaths.length,managedCopies:result.copies.files.length,candidateFiles:result.frozen.files.length,versions,privateByteReads:0,compilerExecutions:0,nativeImports:0,cliDispatches:0,serviceRequests:0,qualificationAccepted:false,fullTask03:'OPEN'}));
