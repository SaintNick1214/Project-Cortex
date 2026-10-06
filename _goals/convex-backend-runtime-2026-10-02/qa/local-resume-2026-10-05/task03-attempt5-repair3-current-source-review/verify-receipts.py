"""Read-only finite current-source and evidence observation; writes only judge namespace."""
from pathlib import Path
import datetime, hashlib, json, os, stat, sys
R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
G = R/'_goals/convex-backend-runtime-2026-10-02/qa'
P = G/'local-resume-2026-10-05'
Q = G/'task03-local-native-attempt5-2026-10-06'
I = P/'task03-attempt5-mount-translation-repair3'
J = P/'task03-attempt5-repair3-current-source-review'
B = P/'task03-attempt5-repair3-prospective-current'
FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')

def identity(s):
    return {k: str(getattr(s,'st_'+k)) for k in FIELDS}

def read(path):
    path = Path(path)
    relative = path.relative_to(R)
    assert '..' not in relative.parts
    assert '.codex' not in relative.parts
    parent = R
    for part in relative.parts[:-1]:
        parent /= part
        assert stat.S_ISDIR(os.lstat(parent).st_mode), str(parent)
    before = identity(os.lstat(path))
    assert stat.S_ISREG(int(before['mode'])) and before['nlink']=='1'
    fd = os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        opened = identity(os.fstat(fd)); assert opened == before
        parts=[]
        while True:
            chunk=os.read(fd,1024*1024)
            if not chunk: break
            parts.append(chunk)
        raw=b''.join(parts)
        after = identity(os.fstat(fd)); final = identity(os.lstat(path))
        assert before == opened == after == final
        assert len(raw)==int(before['size'])
    finally: os.close(fd)
    return raw, {'path':str(relative),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),
                 'identityDecimal':before,'fullEOF':True,'allNineThroughRead':True,'finalPathIdentityMatches':True}

def load(path):
    raw,row=read(path); return json.loads(raw),row

def exact(rows):
    assert len({x['path'] for x in rows})==len(rows)
    return {x['path']:x for x in rows}

def compare(expected,actual):
    return [{'path':p,'differences':[k for k in ('sha256','bytes','identityDecimal','fullEOF','allNineThroughRead') if expected[p][k]!=actual[p][k]]}
            for p in sorted(expected) if any(expected[p][k]!=actual[p][k] for k in ('sha256','bytes','identityDecimal','fullEOF','allNineThroughRead'))]

def main():
    phase=sys.argv[1]
    source,smeta=load(B/'current-source-baseline.json'); private,pmeta=load(B/'current-private-operative-baseline.json')
    assert smeta['sha256']=='1c17fb942936adc3188aa7c4c9fdfd290c6cec6d39b1347dbd823b4a1436a08b'
    assert pmeta['sha256']=='952ea19287306741e5030e1c8ca50f44c07a72b8bcb426757ae9acb6acf833a1'
    expected=exact(source['files']); private_expected=exact(private['files'])
    assert len(expected)==2083 and len(private_expected)==12 and set(private_expected)<=set(expected)
    observed={p:read(R/p)[1] for p in sorted(expected)}
    diffs=compare(expected,observed)
    mf,mmeta=load(I/'final-evidence-manifest.json'); assert mf['pathBase']==str(R)
    assert mmeta['sha256']=='4919294c4b2441dbbd5d1313f18a8366699c652add8a4a73f1232bb13dfcbb07'
    finite=exact(mf['files']); assert len(finite)==260 and mf['selfExcluded'] is True
    finite_observed={p:read(R/p)[1] for p in sorted(finite)}; finite_diffs=compare(finite,finite_observed)
    pub,pubmeta=load(Q/'coordinate-source/repair3/source-receipt-manifest.json')
    assert pub['pathBase']==str(R) and len(pub['files'])==8 and pub['selfExcluded'] is True
    pub_members=exact(pub['files']); pub_diffs=compare(pub_members,{p:observed[p] for p in pub_members})
    freeze,_=load(Q/'candidate-freeze-attempt5.json')
    frozen={str(Q.relative_to(R)/x['path']) for x in freeze['files']}; assert len(frozen)==1905
    # The unchanged helper defines these seven additions, including generated codegen paths.
    extra={'candidate-freeze-attempt5.json','independent-preparation-review.json','managed-fixture/fixture/convex/_generated/api.d.ts',
           'managed-fixture/fixture/convex/_generated/api.js','managed-fixture/fixture/convex/_generated/dataModel.d.ts',
           'managed-fixture/fixture/convex/_generated/server.d.ts','managed-fixture/fixture/convex/_generated/server.js'}
    public=frozen|{str(Q.relative_to(R)/p) for p in extra}; assert len(public)==1912
    old,_=load(P/'task03-attempt5-public-repair2-prospective3/current-source-baseline.json')
    oldnames=set(exact(old['files']))
    # Product-source names in the accepted earlier observation are paths outside qa, not source-bundle archives.
    products={p for p in oldnames if not p.startswith('_goals/')}; assert len(products)==161
    operative=set(pub_members)|{pubmeta['path']}; assert len(operative)==9
    derived=public|products|operative|set(private_expected)
    missing=sorted(derived-set(expected)); unexpected=sorted(set(expected)-derived)
    assert not missing and not unexpected and len(derived)==2083
    packet,packetmeta=load(I/'current-operative-source-packet.json')
    packet_diffs=[]
    for name,row in packet['sources'].items():
        current=observed[row['path']]
        if row['sha256']!=current['sha256'] or row['bytes']!=current['bytes']: packet_diffs.append(name)
    report_raw,reportmeta=read(I/'report.md')
    assert reportmeta['sha256']=='288ff78c542d05f537bd6ae465474a5c40ad2ca14dc272577c429f60c7db6e66'
    assert packetmeta['sha256']=='49753cf46b75d83ea8e00f70f27ad16ff4cbf43a190f2ed18527eda95793a75b'
    producer,producermeta=load(I/'producer-finalization-state.json')
    mf_delta=[k for k in ('sha256','bytes','identityDecimal','fullEOF','allNineThroughRead') if producer['ownEvidenceManifest'][k]!=mmeta[k]]
    state,statemeta=load(B/'writer-stopped-current-assessment.json')
    phases=state['observations']; assert len(phases)==3
    phase_diffs=[compare(expected,exact(x['files'])) for x in phases]
    times=[datetime.datetime.fromisoformat(x['observedAtUtc']) for x in phases]
    assert (times[1]-times[0]).total_seconds()>=5 and (times[2]-times[1]).total_seconds()>=5
    result={'scope':'FRESH_INDEPENDENT_READONLY_CURRENT_SOURCE_AND_FINITE_EVIDENCE_OBSERVATION', 'phase':phase,
            'observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'PASS' if not any([diffs,finite_diffs,pub_diffs,packet_diffs,mf_delta,*phase_diffs]) else 'FAIL',
            'sourceBaseline':smeta,'privateBaseline':pmeta,'sourceFiles':list(observed.values()),
            'sourceDifferences':diffs,'privateDifferences':compare(private_expected,{p:observed[p] for p in private_expected}),
            'finiteEvidenceManifest':mmeta,'finiteEvidenceFiles':list(finite_observed.values()),'finiteEvidenceDifferences':finite_diffs,
            'publicSourceManifest':pubmeta,'publicManifestDifferences':pub_diffs,'packet':packetmeta,'packetDifferences':packet_diffs,
            'implementerReport':reportmeta,'producerFinalizationState':producermeta,'producerManifestDifferences':mf_delta,
            'parentThreeObservationAssessment':statemeta,'parentObservationDifferences':phase_diffs,
            'membership':{'frozen':len(frozen),'public':len(public),'products':len(products),'publicOperative':len(operative),
                          'privateOperative':len(private_expected),'union':len(derived),'missing':missing,'unexpected':unexpected,
                          'publicNames':sorted(public),'productNames':sorted(products),'publicOperativeNames':sorted(operative),'privateNames':sorted(private_expected)},
            'historicalFailureRepaired':False,'privateScratchReads':0,'privateScratchStats':0,'externalEffects':0}
    out=J/('identity-'+phase+'.json'); assert not out.exists(); out.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k in ('status','phase','sourceDifferences','privateDifferences','finiteEvidenceDifferences','publicManifestDifferences','packetDifferences','producerManifestDifferences','parentObservationDifferences')}))
    print(json.dumps({'sourceBindings':len(observed),'finiteEvidence':len(finite),'setUnion':len(derived),'output':str(out)}))
    assert result['status']=='PASS'

if __name__=='__main__': main()
