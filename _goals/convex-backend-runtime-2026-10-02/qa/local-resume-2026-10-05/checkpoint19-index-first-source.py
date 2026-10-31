from pathlib import Path
import json,hashlib,subprocess,os,re,stat,datetime
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
pins=json.loads(Path('/Users/SaintNick/.codex/tmp/cortex-runtime-checkpoint19-pins.json').read_bytes())
pathspec=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-checkpoint19-pathspec.nul')
subprocess.run(['git','add','-f','--pathspec-from-file='+str(pathspec),'--pathspec-file-nul'],cwd=R,check=True)
check=subprocess.run(['git','diff','--cached','--check'],cwd=R,capture_output=True)
for name,raw in [('checkpoint19-full-whitespace.stdout',check.stdout),('checkpoint19-full-whitespace.stderr',check.stderr)]:
 with (P/name).open('xb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
text=check.stdout.decode();bad=set(re.findall(r'^(.+?):\d+: (?:trailing whitespace\.|new blank line at EOF\.)$',text,re.M))
assert not check.stderr
if check.returncode:
 assert bad and check.returncode==2
 for name in bad:
  assert name in pins
  # Frozen raw receipts/diffs or public dummy fixture bytes retain their literal whitespace.
  assert '/raw/' in name or '/fixtures/' in name or name.endswith('.diff') or '/exports/' in name,'NON_RAW_SOURCE_WHITESPACE:'+name
else:assert not bad and not text
excluded=[':(exclude)'+n for n in sorted(bad)]
scoped=subprocess.run(['git','diff','--cached','--check','--','.',*excluded],cwd=R,capture_output=True)
assert scoped.returncode==0 and scoped.stdout==scoped.stderr==b''
classification={'scope':'EXACT_FROZEN_PUBLIC_RECEIPT_BYTE_CHECKPOINT_ONLY','wholeWhitespace':'FAIL_PRESERVED_RAW_BYTES'if bad else'PASS','badPaths':{n:{'sha256':pins[n]['sha256'],'bytes':pins[n]['bytes'],'normalized':False}for n in sorted(bad)},'allOtherSelectedWhitespace':'PASS','productFunctionalQuality':'NOT_CLAIMED'}
with (P/'checkpoint19-whitespace-classification.json').open('x') as f:json.dump(classification,f,indent=2);f.write('\n')
proc=subprocess.Popen(['git','cat-file','--batch'],cwd=R,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE);total=0
for name,row in pins.items():
 assert '\n'not in name;proc.stdin.write((':'+name+'\n').encode());proc.stdin.flush();header=proc.stdout.readline().split();assert len(header)==3 and header[1]==b'blob';size=int(header[2]);assert size==row['bytes'];h=hashlib.sha256();left=size
 while left:
  block=proc.stdout.read(min(left,1048576));assert block;left-=len(block);h.update(block)
 assert proc.stdout.read(1)==b'\n' and h.hexdigest()==row['sha256'],name
 total+=size
proc.stdin.close();assert proc.wait(timeout=30)==0 and proc.stderr.read()==b''
changed={os.fsdecode(n)for n in subprocess.run(['git','diff','--cached','--name-only','-z'],cwd=R,capture_output=True,check=True).stdout.split(b'\0')if n};assert changed and changed.issubset(pins)
receipt={'scope':'STAGED_FINITE_PUBLIC_BYTE_VERIFICATION_ONLY','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'selected':len(pins),'changed':len(changed),'stagedBytesFullEOFVerified':total,'hashSizeExact':True,'changedSubsetOfWhitelist':True,'privatePatternsVerifiedPreviously':2,'task03PrivateScratchRead':False,'historicalPhysicalCustodyRestored':False,'Task03Accepted':False,'Task04Accepted':False,'fullGoalComplete':False}
with (P/'checkpoint19-staged-byte-verification.json').open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
extras=[P/n for n in ['checkpoint19-full-whitespace.stdout','checkpoint19-full-whitespace.stderr','checkpoint19-whitespace-classification.json','checkpoint19-staged-byte-verification.json']]
subprocess.run(['git','add','-f','--',*[str(x.relative_to(R))for x in extras]],cwd=R,check=True)
allow=set(pins)|{str(x.relative_to(R))for x in extras};changed={os.fsdecode(n)for n in subprocess.run(['git','diff','--cached','--name-only','-z'],cwd=R,capture_output=True,check=True).stdout.split(b'\0')if n};assert changed.issubset(allow)
scoped=subprocess.run(['git','diff','--cached','--check','--','.',*excluded,':(exclude)'+str(extras[0].relative_to(R))],cwd=R,capture_output=True);assert scoped.returncode==0 and not scoped.stdout and not scoped.stderr
print(json.dumps({'changed':len(changed),'bytesVerified':total,'rawWhitespaceFailurePaths':len(bad),'otherWhitespace':'PASS','whitelist':'PASS'}))
