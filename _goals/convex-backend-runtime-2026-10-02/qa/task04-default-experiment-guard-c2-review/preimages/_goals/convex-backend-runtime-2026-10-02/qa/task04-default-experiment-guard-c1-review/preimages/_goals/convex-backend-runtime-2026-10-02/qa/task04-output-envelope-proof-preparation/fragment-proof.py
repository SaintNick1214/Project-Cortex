#!/usr/bin/env python3
"""Offline artifact scan and finite grammar certificate; no network/model/dependency calls."""
from pathlib import Path
import base64,hashlib,json
root=Path(__file__).resolve().parents[4];here=Path(__file__).resolve().parent;artifact=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-output-vocabulary-acquisition/o200k_base.tiktoken'
expected='446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d'
raw=artifact.read_bytes();assert hashlib.sha256(raw).hexdigest()==expected
# Matches ECMAScript QuoteJSONString for scalar strings. No lone surrogate can
# arise under the specified Unicode-scalar UTF8 maximal-subpart replacement.
def escaped_content(text):
 out=[]
 for cp in map(ord,text):
  if cp in (8,9,10,12,13):out.append(2)
  elif cp in (34,92):out.append(2)
  elif cp<32 or 0xd800<=cp<=0xdfff:out.append(6)
  else:out.append(len(chr(cp).encode('utf8')))
 return sum(out)
def F(b):return escaped_content(b.decode('utf8','replace'))
maximum=0;w=[];rows=0
for line in raw.splitlines():
 b64,rank=line.split();b=base64.b64decode(b64,validate=True);n=F(b);rows+=1
 if n>maximum:maximum=n;w=[]
 if n==maximum:w.append({'rank':int(rank),'rawBase64':b64.decode('ascii'),'rawBytes':len(b),'escapedReplacementContentBytes':n,'rawSHA256':hashlib.sha256(b).hexdigest()})
specials=[{'spelling':s,'escapedContentBytes':escaped_content(s)} for s in ['<|endoftext|>','<|endofprompt|>']]
maximum=max(maximum,max(s['escapedContentBytes'] for s in specials))
# Exhaust all Unicode scalars, not samples: every nonASCII valid scalar is
# <=4 UTF8 bytes and receives no JSON escape in the specified ECMAScript rule.
nonascii_count=0;nonascii_max=0
for cp in range(128,0x110000):
 if 0xd800<=cp<=0xdfff:continue
 nonascii_count+=1;nonascii_max=max(nonascii_max,escaped_content(chr(cp)))
assert nonascii_max==4
# The only left boundary state that can change is a proper pending valid UTF8
# prefix of a 2/3/4-byte scalar (length r). All k absorbed right bytes were
# standalone leading continuations, cost3 each under replacement. Boundaries
# that violate lead/range constraints consume fewer bytes and enter the same
# interrupted/eof class; the violating byte is reprocessed identically.
certificate=[]
for total in (2,3,4):
 for r in range(1,total):
  remaining=total-r
  for k in range(remaining+1):
   if k==remaining:
    outcome='complete_valid_nonASCII';joint=total
   else:
    outcome='still_pending_at_eof_or_interrupted';joint=3
   separate=3+3*k;delta=joint-separate
   assert delta<=0
   certificate.append({'scalarTotalBytes':total,'pendingPrefixBytes':r,'absorbedRightLeadingContinuations':k,'outcome':outcome,'jointEscapedBytes':joint,'separateEscapedBytes':separate,'delta':delta})
# For k=0, a hypothetical completed state cannot occur because remaining>=1.
# ASCII, invalid lead, fully decoded endings, and rejected next bytes either
# preserve output or belong to the interrupted case; their unchanged suffix
# costs cancel. The report gives the proof of exhaustive grammar coverage.
counter=[]
for a,b in [(bytes.fromhex('e2'),bytes.fromhex('82ac')),(bytes.fromhex('f09f98'),bytes.fromhex('80')),(bytes.fromhex('ed'),bytes.fromhex('a080'))]:
 counter.append({'leftHex':a.hex(),'rightHex':b.hex(),'Fleft':F(a),'Fright':F(b),'Fjoint':F(a+b),'separateDecoded':(a.decode('utf8','replace')+b.decode('utf8','replace')),'jointDecoded':(a+b).decode('utf8','replace'),'equality':F(a+b)==F(a)+F(b),'subadditive':F(a+b)<=F(a)+F(b)})
result={'artifactSHA256':expected,'mergeableRowsExhausted':rows,'maximumEscapedReplacementFragmentBytes':maximum,'witnesses':w,'specials':specials,'UnicodeScalarsExhaustedForNonASCIIEscapeCost':nonascii_count,'maximumNonASCIICompletedScalarEscapedBytes':nonascii_max,'composition':{'claim':'F(A+B)<=F(A)+F(B)','decoderAssumption':'Unicode-scalar UTF8 maximal-subpart replacement; valid-prefix buffering, invalid-next-byte reprocessing; actual provider semantics NOT_RUN','grammarCertificate':certificate,'allCertifiedDeltasNonpositive':True,'proofIsSamplesOnly':False,'finiteCertificateRole':'verifies all symbolic boundary length/outcome inequalities; exhaustive grammar coverage supplied in report, not inferred from model samples'},'counterexamplesToEqualityNotToSubadditivity':counter,'conditionalTextEnvelope':{'grammar':'strict canonical own text string only','maximumTextBytes':'128*M+11','M64':128*64+11,'M256':128*256+11,'largestMUnder60000':(60000-11)//128,'atLargestM':128*((60000-11)//128)+11,'nextM':128*(((60000-11)//128)+1)+11,'readiness':'NOT_QUALIFIED'},'universalFallback':{'validUTF8':'6*128*M+11','generalReplacement':'18*128*M+11'},'actualModels':'NOT_RUN'}
(here/'fragment-proof-result.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
for n,entry in enumerate(w):
 (here/f'maximum-escaped-witness-{n}.bin').write_bytes(base64.b64decode(entry['rawBase64']))
print(json.dumps({'maximumEscapedFragment':maximum,'symbolicCases':len(certificate),'scalarCoverage':nonascii_count,'textM64':result['conditionalTextEnvelope']['M64'],'textM256':result['conditionalTextEnvelope']['M256'],'maxM':result['conditionalTextEnvelope']['largestMUnder60000']}))
