import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
const q=dirname(new URL(import.meta.url).pathname);const old=join(q,'../task04-functional-gateway-v2-20261008');
const p=JSON.parse(await readFile(join(q,'fixture-pointer.json')));
const m=JSON.parse(await readFile(join(old,'provisional-manifest.json')));
const hash=createHash('sha256').update(await readFile(join(q,'ceiling-evidence.md'))).digest('hex');
m.manifestId='task04-confirmed-unknown-'+p.operation;m.evidenceHash=hash;m.acceptanceHash=createHash('sha256').update('UNREVIEWED DISPOSABLE ONLY '+p.operation).digest('hex');m.classification='fixture-synthetic';m.artifactRevision='disposable-fixture-current-product';
const now=Date.now();
for (const [i,qual] of m.qualifications.entries()) {qual.receiptId='provisional-'+p.operation+'-'+i;qual.costBound.provenance='Published OpenRouter rates, allowed plain text/embedding 4096 input and 512 output envelope; $0.10 conservative ceiling; qualification-only unreviewed proposal';}
for (const [i,d] of m.dispatchEvidence.entries()) {d.receiptId=m.qualifications[i].receiptId;d.evidenceHash=hash;d.checkedAt=now;d.expiresAt=now+86400000;d.terminalCost='unavailable';d.inputBound.proofHash=hash;d.inputBound.documentHash=hash;d.resultBound.proofHash=hash;if(d.nativeInterface==='embedding')d.terminalModelId='text-embedding-3-small';}
m.policies.push({policyId:'fixture-facts-resolve',version:1,scope:'deployment',operationKey:'facts.resolve',rules:{pins:{schemaVersion:'conflicts-v1'}}});
await writeFile(join(q,'provisional-manifest.json'),JSON.stringify(m,null,2)+'\n');
console.log(JSON.stringify({manifestId:m.manifestId,classification:m.classification,terminalCost:'unavailable',productionRegistryInstalled:false}));
