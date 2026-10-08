"""Finite ordinary static probe of the declared current32; never imports them."""
from pathlib import Path
import ast
import hashlib
import json
import os
import re
import time

OWN=Path(__file__).absolute().parent;ROOT=OWN.parents[4]
P=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
APIS={'open','read','read_bytes','read_text','readFileSync','source_read','qualify','capture',
      'hold','compiled','compile','exec','pread','mmap','sourcePreflight','import_module','run','Popen'}

def nine(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def write(name,value):
    raw=(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
    with open(OWN/name,'xb')as f:f.write(raw)

def read_one(path):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);pre=nine(os.fstat(fd));body=b''
    try:
        while True:
            chunk=os.read(fd,65536)
            if not chunk:break
            body+=chunk
        assert pre==nine(os.fstat(fd))==nine(os.lstat(path)) and len(body)==int(pre['size'])
        return body,{'path':str(path.relative_to(ROOT)),'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),
                     'nine':pre,'fullEOF':True,'closeAttempts':1,'ordinaryOnly':True,'phase':'SOURCE',
                     'readCompleted_ns':time.time_ns()}
    finally:os.close(fd)


if __name__=='__main__':
    raw,header=read_one(P/'task03-source-scope-nonuse-audit1/classification2.json')
    classified=json.loads(raw);expected=classified['sourcePrograms'];held=[];rows=[header];events=[];observations=[]
    primary=None
    try:
        assert len(expected)==32
        for value in expected:
            path=ROOT/value['path'];pre=nine(os.lstat(path));fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
            held.append((value,path,pre,fd))
            assert pre==nine(os.fstat(fd))==nine(os.lstat(path))
            assert pre=={k:str(v)for k,v in value['PRE9'].items()}
        events.append({'event':'ALL32_PROGRAM_FDS_BEFORE_FIRST_PROGRAM_BODY','count':32,
                       'headerDiscoveryBeforeProgramCaptureDisclosed':True})
        for value,path,pin,fd in held:
            body=b''
            while True:
                chunk=os.read(fd,65536)
                if not chunk:break
                body+=chunk
            sha=hashlib.sha256(body).hexdigest()
            assert sha==value['sha256'] and len(body)==value['bytes']
            assert pin==nine(os.fstat(fd))==nine(os.lstat(path))
            rows.append({'path':str(path.relative_to(ROOT)),'bytes':len(body),'sha256':sha,'nine':pin,
                         'fullEOF':True,'ordinaryOnly':True,'phase':'SOURCE','readCompleted_ns':time.time_ns()})
            text=body.decode();obs={'path':value['path'],'sha256':sha,'bytes':len(body),
                  'parser':'PYTHON_AST'if path.suffix=='.py'else'FINITE_JS_LITERAL_SCAN_NOT_FULL_IMPORT_CLOSURE',
                  'imports':[],'bodyUseCalls':[],'lineageManifestLiterals':[]}
            if path.suffix=='.py':
                tree=ast.parse(text,filename=value['path'])
                for node in ast.walk(tree):
                    if isinstance(node,(ast.Import,ast.ImportFrom)):
                        obs['imports'].append({'line':node.lineno,'source':ast.get_source_segment(text,node)})
                    if isinstance(node,ast.Call):
                        name=node.func.id if isinstance(node.func,ast.Name)else node.func.attr if isinstance(node.func,ast.Attribute)else'<dynamic>'
                        if name in APIS:
                            obs['bodyUseCalls'].append({'line':node.lineno,'api':name,
                              'source':ast.get_source_segment(text,node)[:1600],
                              'unresolvedDynamicArguments':any(not isinstance(a,(ast.Constant,ast.List,ast.Dict))for a in node.args)})
            else:
                for line,source in enumerate(text.splitlines(),1):
                    if any(api in source for api in APIS)or 'import('in source or 'from 'in source:
                        obs['bodyUseCalls'].append({'line':line,'source':source[:1600],
                                                   'unresolvedDynamicArguments':True})
            for line,source in enumerate(text.splitlines(),1):
                if 'integrated-repair1'in source or 'prospective-source-manifest-final.json'in source:
                    obs['lineageManifestLiterals'].append({'line':line,'source':source[:1600]})
            observations.append(obs)
        for _,path,pin,fd in held:
            assert pin==nine(os.fstat(fd))==nine(os.lstat(path))
        write('current32-static-body-use-observations1.json',{
          'scope':'ORDINARY_FINITE_STATIC_PROGRAM_EVIDENCE_NOT_CLOSED_NONUSE_OR_SOURCE_QUALIFICATION',
          'programs':observations,'programCount':len(observations),
          'directOldF1ManifestLiteralPrograms':[o['path']for o in observations if o['lineageManifestLiterals']],
          'genericMemberLoopsStillMandatory':True,
          'absenceOfLiteralNotNonuseProof':True,'dynamicImportControlIOEdgesRemainBlocking':True,
          'sourceEligibility':False,'effects':0})
    except BaseException as e:
        primary=e
        write('static-probe-denial1.json',{'error':str(e),'type':type(e).__name__,'rowsBeforeFailure':len(rows),
                                         'sourceEligibility':False,'effects':0})
    finally:
        errors=[]
        for _,path,_,fd in held:
            try:os.close(fd);error=None
            except BaseException as e:error=type(e).__name__;errors.append(error)
            events.append({'event':'ONCE_CLOSE','path':str(path.relative_to(ROOT)),'attempt':1,'error':error})
        write('current32-ordinary-body-read-ledger7.json',{'records':rows,'events':events,
          'programBytes':sum(r['bytes']for r in rows[1:]),'ordinaryOnly':True,
          'earlierHeaderDiscoveryBeforeAll32ProgramDescriptors':True,'unresolvedCurrentSOURCELifetime':True,
          'allInputsRemainSourceChargeable':True,'closedCount':len(held),'closeErrors':errors,
          'sourceEligibility':False,'effects':0})
        if primary is not None:raise primary
        if errors:raise RuntimeError('all-close-errors:'+','.join(errors))
    print(json.dumps({'programs':len(observations),'bodyUseCalls':sum(len(o['bodyUseCalls'])for o in observations),
                     'lineageManifestLiteralPrograms':[o['path']for o in observations if o['lineageManifestLiterals']],
                     'closed':len(held),'sourceEligibility':False}))
