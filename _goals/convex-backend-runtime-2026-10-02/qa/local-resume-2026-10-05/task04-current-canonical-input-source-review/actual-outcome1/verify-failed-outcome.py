"""Verify failed-attempt evidence only. Never run Docker, producers or subjects."""
import ast
import datetime
import hashlib
import json
import os
from pathlib import Path
import stat

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
G=R/'_goals/convex-backend-runtime-2026-10-02'
B=G/'qa/local-resume-2026-10-05'
P=B/'task04-current-producer-linux-public-run-r3'
W=R/'work/resume/task04-c8-current-canonical-input-producers'
D=Path(__file__).resolve().parent;OLD=D.parent
ID='1044af770dbcb88c25b73d2821440075f5024db16f975b07ed3e8b7f64abf56f'
OP='9655f70c-0ac7-4d89-9135-3da95e3c6662'
ROOT='/var/tmp/task04-c8-current-canonical-input-producers/'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
ident=lambda s:{k:str(getattr(s,'st_'+k))for k in FIELDS}
canonical=lambda x:json.dumps(x,sort_keys=True,separators=(',',':'))
observations=[];held=[];checks=[];errors=[];facts={}
def require(value,reason):
    if not value:raise ValueError(reason)
def verify(name,value,evidence):checks.append({'name':name,'status':'PASS'if value else'FAIL','evidence':evidence})
def read(path,maximum=262144):
    pre=os.lstat(path);require(stat.S_ISREG(pre.st_mode)and pre.st_nlink==1 and path.resolve()==path and pre.st_size<=maximum,'bounded literal regular file')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);held.append((path,fd,ident(pre)));opened=os.fstat(fd);raw=bytearray()
    while part:=os.read(fd,65536):raw.extend(part);require(len(raw)<=maximum,'during-read finite bound')
    post=os.fstat(fd);final=os.lstat(path);require(ident(pre)==ident(opened)==ident(post)==ident(final)and len(raw)==pre.st_size,'current full-EOF/all-nine drift')
    observations.append({'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'PRE':ident(pre),'OPEN':ident(opened),'POST':ident(post),'pathPOST':ident(final),'EOF':True})
    return bytes(raw)
def pairs(items):
    out={}
    for key,value in items:require(key not in out,'duplicate JSON key');out[key]=value
    return out
def parse(raw):return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda x:(_ for _ in()).throw(ValueError('nonfinite JSON')))
def data(path,maximum=262144):return parse(read(path,maximum))
def capture(label,argv=None,root=P/'raw'):
    receipt=data(root/(label+'.receipt.json'),65536);out=read(root/(label+'.stdout'),262144);err=read(root/(label+'.stderr'),262144)
    require(receipt['label']==label and (argv is None or receipt['argv']==argv)and receipt['terminal']is True and receipt['failureClass']is None and receipt['closeErrors']==[]and receipt['ownedGroup']['absenceObserved']is True and receipt['stdinBytes']==0 and receipt['elapsedSeconds']<=30,'exact bounded terminal CLI')
    require(receipt['stdoutSha256']==hashlib.sha256(out).hexdigest()and receipt['stderrSha256']==hashlib.sha256(err).hexdigest()and receipt['streamByteCounts']=={'stdout':len(out),'stderr':len(err)},'captured hashes/counts')
    return receipt,out,err
try:
    handoff=data(P/'actual-failed-public-handoff.json');require(handoff['containerId']==ID and handoff['operationUUID']==OP and handoff['status']=='FAIL'and handoff['allParentRunWriters']=='STOPPED_AFTER_THIS_HANDOFF'and handoff['noRerun']is True,'explicit closed failed handoff')
    monitor=data(P/'terminal-run-result.json');require(monitor['status']=='FAIL'and monitor['terminalState']is None and len(monitor['errors'])==2,'failed monitor conserved')
    baseline=data(P/'raw/created-container-inspect1.stdout')[0]
    labels=baseline['Config']['Labels'];require(labels['com.cortex.operation']==OP,'exact operation')
    recipe=data(W/'linux-public-control-proposal/recipe-r3.json');required=recipe['ownershipBeforeEffects']['containerInspectBeforeStart']
    inspect_records=[];state_bytes=0
    for label in ['before-start-inspect2','owned-poll-0001','failure-owned-inspect1','reconciliation-owned-inspect1','final-owned-terminal-inspect1']:
        rc,out,err=capture(label,['docker','container','inspect',ID]);require(rc['exitCode']==0 and err==b''and len(out)<=65536,'bounded one-container inspect')
        c=parse(out)[0];require(c['Id']==ID and c['Name']==baseline['Name']and c['Config']['Labels']==labels,'exact owned ID/labels')
        for key in ['Image','Config','Mounts','Path','Args','ImageManifestDescriptor']:require(canonical(c[key])==canonical(baseline[key]),'reviewed required immutable metadata')
        differences={k:{'created':baseline['HostConfig'].get(k),'actual':c['HostConfig'].get(k)}for k in set(baseline['HostConfig'])|set(c['HostConfig'])if baseline['HostConfig'].get(k)!=c['HostConfig'].get(k)}
        require(differences==({}if label=='before-start-inspect2'else{'OomKillDisable':{'created':False,'actual':None}}),'sole extra monitor metadata transition')
        for key,value in required.items():
            if key.startswith('HostConfig.')and key!='HostConfig.Tmpfs./tmp':require(c['HostConfig'][key.split('.',1)[1]]==value,'original recipe required HostConfig')
        require(c['HostConfig']['Tmpfs']==baseline['HostConfig']['Tmpfs'],'exact tmpfs')
        inspect_records.append({'label':label,'state':c['State'],'soleExtraMonitorDelta':differences});state_bytes+=len(out)
    final=inspect_records[-1]['state'];require(final==handoff['state'],'handoff terminal state matches raw')
    require(final['Status']=='exited'and final['Running']is False and final['Pid']==0 and final['ExitCode']==1 and final['OOMKilled']is False and final['Error']=='','actual failed terminal not positive')
    elapsed=(datetime.datetime.fromisoformat(final['FinishedAt'].replace('Z','+00:00'))-datetime.datetime.fromisoformat(final['StartedAt'].replace('Z','+00:00'))).total_seconds()
    require(0<elapsed<480,'actual container elapsed within overall bound')
    verify('failed-parent-monitor-and-independent-owned-terminal-evidence',True,{'monitorStatus':'FAIL','monitorErrors':monitor['errors'],'reportedCombinedPollBytes':monitor['combinedRawPollBytes'],'independentlyCountedNamedInspectBytes':state_bytes,'containerElapsedSeconds':elapsed,'actualExitCode':1,'noStopNeeded':handoff['noStopNeeded']})
    reconcile=data(P/'reconciliation-before-action.json');facts['reconciliationProof']=reconcile
    rc,out,err=capture('container-start1',['docker','start',ID]);require(rc['exitCode']==0 and out==(ID+'\n').encode()and err==b'','exact detached start outcome')
    rc,logs,logerr=capture('reconciliation-terminal-logs1',['docker','logs',ID]);require(rc['exitCode']==0,'terminal own logs outcome')
    rc,out,err=capture('export-manifest-copy1');require(rc['exitCode']==0 and rc['argv']==['docker','cp',ID+':'+ROOT+'public-export-manifest.json',str(P/'exports/public-export-manifest.json')]and out==err==b'','exact manifest-copy CLI')
    manifest_raw=read(P/'exports/public-export-manifest.json',65536);manifest_proof=observations[-1];manifest=parse(manifest_raw)
    allow=data(OLD/'operational-supplement1/metadata-review-results.json')['exactLiteralProjectionTable']
    bootstrap_tree=ast.parse(read(W/'linux-public-control-proposal/bootstrap-public-controls-r3.py').decode())
    export_allow=next(ast.literal_eval(n.value)for n in bootstrap_tree.body if isinstance(n,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='EXPORT_ALLOWLIST'for t in n.targets))
    require([r['relativePath']for r in manifest['files']]==list(export_allow)and manifest['fileCount']==22 and manifest['combinedExportBytesMaxIncludingThisManifest']==1048576 and manifest['allDescendantsTerminal']is True and manifest['ROOT']=='ABSENT'and manifest['original122']=='HELD'and manifest['nativeClaims']is False,'exact finite failed export manifest')
    require(manifest['primaryFailure']=="ValueError('PUBLIC_CONTROL_NONZERO:1')",'failed primary export outcome')
    failed_seal=data(P/'export-validation-result.json');fresh=data(P/'post-failure-public-export-current-observation1.json')
    require(failed_seal['status']=='FAIL'and failed_seal['errors']==["RuntimeError('final held-FD/path nine fields')"]and fresh['status']=='PASS'and fresh['previousSeal']=='PRESERVED_FAILED_NOT_REPAIRED','separate failed and fresh export observations')
    old_index={r['relativePath']:r for r in failed_seal['copied']};fresh_index={r['relativePath']:r for r in fresh['rows']}
    require(manifest_proof['PRE']==fresh_index['public-export-manifest.json']['PRE'],'current manifest matches separately recorded fresh host pin')
    require(len(fresh['previousFailedSealDeltas'])==16 and all(set(d['changedFields'])=={'ctime_ns'} and d['attribution']=='UNKNOWN'for d in fresh['previousFailedSealDeltas']),'parent separately conserves16 unknown ctime deltas')
    export_rows=[];deltas=[];total=len(manifest_raw)
    require(set(fresh_index)=={'public-export-manifest.json'}|{r['relativePath']for r in manifest['files']if r['status']=='EXISTS'},'exact17 fresh existing members')
    for index,row in enumerate(manifest['files']):
        relative=row['relativePath'];path=P/'exports'/relative
        if row['status']=='ABSENT':require(not os.path.lexists(path),'no hidden copied absent member');continue
        pin=row['current'];require(old_index[relative]['bytes']==pin['bytes']and old_index[relative]['sha256']==pin['sha256'],'old failed copied byte observations preserved')
        require(pin['path']==ROOT+relative and pin['EOF']is True and pin['PRE']==pin['OPEN']==pin['POST']==pin['pathPOST'],'current Linux source pin shape')
        raw=read(path,1048576);observed=observations[-1];require(len(raw)==pin['bytes']and observed['sha256']==pin['sha256'],'copied bytes match exact Linux MF')
        require(observed['PRE']==fresh_index[relative]['PRE'],'parent fresh current host pin unchanged; no failed-pin refresh')
        changed={k:{'initialFailed':old_index[relative]['hostNine'][k],'current':observed['PRE'][k]}for k in FIELDS if old_index[relative]['hostNine'][k]!=observed['PRE'][k]}
        require(set(changed)=={'ctime_ns'},'conserved ctime-only delta')
        deltas.append({'relativePath':relative,'changedFields':changed,'actorAndCause':'UNKNOWN','failedSeal':'PRESERVED_FAILED'})
        label='export-file-copy-'+str(index+1).zfill(2);rc,out,err=capture(label,['docker','cp',ID+':'+ROOT+relative,str(path)]);require(rc['exitCode']==0 and out==err==b'','exact bounded selected-copy CLI')
        total+=len(raw);export_rows.append({'relativePath':relative,'bytes':len(raw),'sha256':observed['sha256']})
    require(len(export_rows)==16 and total==48379 and total<=1048576 and manifest['existingBytes']==29949 and len(deltas)==16,'actual export totals')
    verify('failed-export-seal-conserved-and-current17-byte-observation',True,{'initialAggregateSeal':'FAIL','freshCurrentObservation':'PASS_CURRENT_BYTES_ONLY','existingAllowlistFiles':16,'manifestAndFilesBytes':total,'ctimeOnlyDeltas':deltas,'historicalCustody':'NOT_ADOPTED'})
    inputs=data(P/'exports/input-observations.json');input_mf=data(W/'linux-public-control-proposal/input-manifest-r3.json')
    require(len(inputs['files'])==14 and sum(r['bytes']for r in inputs['files'])==input_mf['inputBytes']==10822332,'exact14 copied source bytes')
    expected={r['source']:r for r in input_mf['files']}
    for row in inputs['files']:
        pin=expected[row['source']];require(row['destination']==ROOT+pin['destination']and row['bytes']==pin['bytes']and row['sha256']==pin['sha256']and row['EOF']is True and row['PRE']==row['OPEN']==row['POST']==row['pathPOST'],'fresh Linux input content and current source identity')
    runtime=data(P/'exports/runtime-observations.json');require(len(runtime['regulars'])==3 and all(r['EOF']is True and r['PRE']==r['OPEN']==r['POST']==r['pathPOST']for r in runtime['regulars'])and runtime['npmLiteralAlias']['PRE']==runtime['npmLiteralAlias']['pathPOST'],'public runtime observations')
    for label,version in [('node-version','v24.15.0'),('npm-version','12.2.0'),('python-version','Python 3.12.15')]:
        stdout=read(P/'exports'/(label+'.stdout'));stderr=read(P/'exports'/(label+'.stderr'));terminal=data(P/'exports'/(label+'.terminal.json'))
        require(stdout.decode().strip()==version and stderr==b''and terminal['actualExitCode']==0 and terminal['failure']is None and terminal['cleanupErrors']==[]and terminal['allDescendantsTerminal']is True and terminal['streamBytes']==[len(stdout),0],'actual fresh public version and child terminal')
    terminal=data(P/'exports/control-run.terminal.json');partial=data(P/'exports/controls/linux-public-run3/partial-results.json');stderr=read(P/'exports/control-run.stderr').decode();failure=data(P/'exports/bootstrap-failure.json')
    require(terminal['actualExitCode']==1 and terminal['allDescendantsTerminal']is True and terminal['cleanupErrors']==[]and terminal['streamBytes']==[0,1366]and terminal['failure']=="ValueError('PUBLIC_CONTROL_NONZERO:1')",'actual failed child terminal')
    require(partial['controls']==[]and partial['failure']['type']=='Hold'and partial['failure']['message']=='FINITE_SELECTOR_RECIPE_EMPTY_OR_JSON'and 'producers.py", line 430' in stderr and failure['failure']==terminal['failure'],'exact pre-first-control producer error')
    verify('actual-public-inputs-versions-child-terminal-and-zero48-results',True,{'inputs':14,'bytes':10822332,'actualPublicVersions':['v24.15.0','12.2.0','Python 3.12.15'],'pipelineExpected':48,'pipelineCompleted':0,'childExitCode':1,'cleanupErrors':[],'allDescendantsTerminal':True,'resourceNumericPREPOSTReceipt':'ABSENT_SUCCESS_ONLY_RECEIPT_NOT_WRITTEN'})
    contract=data(W/'source/reference-contract.json',2097152);json_own=[r for r in contract['recipes']['OWN_VM_CONSUMER_CONTROL']['calls']if r['json']];require(len(json_own)==1,'one exact JSON own template');own=json_own[0]
    require(own['json']is True and own['argumentExpression']=='source'and own['sourceLogicalPaths']==[],'exact preserved own identifier JSON selector')
    producer_source=read(W/'source/producers.py').decode();require('require(call[\'argumentExpression\'] == "\'JSON\'" if template[\'json\'] else bool(selected), \'FINITE_SELECTOR_RECIPE_EMPTY_OR_JSON\')'in producer_source,'exact closed rejecting predicate')
    verify('independent-static-contract-predicate-contradiction',True,{'id':'OWN_VM_CONSUMER_CONTROL','referenceArgumentExpression':'source','json':True,'selectedSources':0,'closedPredicateRequiredArgumentExpression':"'JSON'",'deterministicContradiction':True,'subjectEvaluation':False})
    source_mf_raw=read(B/'task04-current-canonical-input-producers/closed-source-manifest.json');require(hashlib.sha256(source_mf_raw).hexdigest()=='afc703999f7779d0621f6a3aedd8ac0792abe633e0b0f0690929c6e069a327ae','original sourceMF unchanged')
    for pin in parse(source_mf_raw)['files']:
        raw=read(R/pin['path'],16777216);r=observations[-1];require(r['bytes']==pin['bytes']and r['sha256']==pin['sha256']and r['PRE']==pin['PRE']['fields'],'closed original source current pin unchanged')
    for relative,sha in [('source-eligibility-verdict.json','82d2fc3dd2b4d6075ca6e30a36cf6622e560aa91e085e6173a9c2b82d0407264'),('source-eligibility-report.md','c4389a7d67ec1bd50aa1a9f60b6765b590843fb690886f81f296f6799aa9e0e8'),('finite-evidence-manifest.json','2fef9910b60003628667e07b38d14a37742b3e438359321792d28723a5b760d0'),('operational-supplement1/verdict.json','7ef4b5d9b640d5571a842a349fb47089e385cdd1565da735829c1a16f4f81c67')]:require(hashlib.sha256(read(OLD/relative)).hexdigest()==sha,'earlier eligibility seal unchanged')
    for pin in data(D/'preparation-snapshot.json')['files']:
        raw=read(Path(pin['path']));r=observations[-1];require(r['bytes']==pin['bytes']and r['sha256']==pin['sha256']and r['PRE']==pin['PRE'],'initial failed monitor/preparation pins conserved')
    for path in [Path('/Users/SaintNick/.codex/tmp/cortex-task04-public-parent-run-20261006.py'),Path('/Users/SaintNick/.codex/tmp/cortex-task04-public-cli-20261006.py'),Path('/Users/SaintNick/.codex/tmp/cortex-task04-public-export-20261006.py')]:ast.parse(read(path).decode(),filename=str(path))
    verify('all23-source-and-earlier-verdict-and-failed-monitor-pins-preserved',True,{'closedSourceFiles':23,'earlierSourceVerdict':'UNCHANGED','operationalSupplement':'UNCHANGED','failedMonitorPins':'UNCHANGED','operationalSources':'PYTHON_AST_ONLY'})
    foreign_root=B/'task03-current-daemon-inventory-20261006T1443';rc,out,err=capture('running-inventory1',root=foreign_root);inventory=[parse(line)for line in out.splitlines()];require(rc['exitCode']==0 and err==b''and len(inventory)==1 and inventory[0]['ID']=='b551bbf5025aba25568eb1bb6fb42009edf15d31e39771fea617d2fbccea034c'and inventory[0]['State']=='running','foreign snapshot remains present and outside own ID')
    facts.update(containerState=final,containerElapsedSeconds=elapsed,actualPipelineCompleted=0,plannedPipelineControls=48,exportCombinedBytes=total,exportCtimeDeltas=deltas,resourceValues='NOT_EXPORTED_SUCCESS_RECEIPT_ABSENT',foreignSnapshot='SAME_FOREIGN_RUNNING_ID_OUTSIDE_OWNERSHIP',staticDefect=own,monitorStatus='FAIL',firstExportSeal='FAIL',freshCurrentExportObservation='PASS_BYTES_ONLY')
    for path,fd,pre in held:require(pre==ident(os.fstat(fd))==ident(os.lstat(path)),'final reviewer held-FD/path all-nine drift')
except BaseException as error:errors.append(repr(error))
finally:
    for _,fd,_ in held:os.close(fd)
result={'scope':'INDEPENDENT_FAILED_ACTUAL_PUBLIC_OUTCOME_EVIDENCE_REVIEW_ONLY','evidenceVerification':'PASS'if not errors and all(c['status']=='PASS'for c in checks)else'FAIL','actualAttemptOutcome':'FAIL_NOT_ACCEPTED','actualOutcomeRubricVerdict':'REJECT','checks':checks,'facts':facts,'errors':errors,'observations':observations,'DockerActionsByJudge':False,'subjectEvaluation':False,'pipelineRerun':False,'reviewerSetupFailure':'INITIAL_WRONG_CALL_INDEX_PRESERVED_AS_failed-outcome-evidence-results.json_CORRECTED_BY_EXACT_SINGLE_JSON_TEMPLATE_FILTER','previousEligibilityVerdicts':'PRESERVED_IMMUTABLE','historicalCustody':'NOT_ADOPTED','nativeQualification':False,'ROOT':'ABSENT','original122':'HELD','Task03':'OPEN','Task04':'OPEN','wholeGoal':'OPEN'}
with(D/'failed-outcome-evidence-results-r2.json').open('x')as f:f.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'evidenceVerification':result['evidenceVerification'],'actualAttemptOutcome':result['actualAttemptOutcome'],'rubricVerdict':'REJECT','checks':len(checks),'finiteReads':len(observations),'errors':errors}))
raise SystemExit(result['evidenceVerification']!='PASS')
