#!/usr/bin/env python3
"""Offline proof only; no dependencies/network/model calls. Supply exact official artifact."""
from pathlib import Path
import argparse,ast,base64,hashlib,json
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--vocabulary',type=Path);p.add_argument('--output-tokens',type=int,default=64);p.add_argument('--envelope-bytes',type=int,default=0);a=p.parse_args()
source=HERE/'public/tiktoken-openai-public.raw';tree=ast.parse(source.read_text())
constants={n.targets[0].id:ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and len(n.targets)==1 and isinstance(n.targets[0],ast.Name) and isinstance(n.value,ast.Constant)}
fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='o200k_base')
call=next(n.value for n in fn.body if isinstance(n,ast.Assign) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Name) and n.value.func.id=='load_tiktoken_bpe')
url=ast.literal_eval(call.args[0]);expected=ast.literal_eval(next(k.value for k in call.keywords if k.arg=='expected_hash'))
dct=next(n.value for n in fn.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='special_tokens' for t in n.targets))
specials={constants[k.id] if isinstance(k,ast.Name) else ast.literal_eval(k):ast.literal_eval(v) for k,v in zip(dct.keys,dct.values)}
result={'encoding':'o200k_base','officialVocabularyURL':url,'expectedVocabularySHA256':expected,'officialEncodingSourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'specialTokens':[{'spelling':s,'tokenId':i,'utf8Bytes':len(s.encode('utf8'))} for s,i in specials.items()],'modelProvenance':'OpenAI tiktoken.model prefix mappings for gpt-4o-mini and gpt-4.1-mini; serving Gateway tokenizer not qualified','maximumComputation':'NOT_RUN','resultByteReadiness':'NOT_QUALIFIED'}
if a.vocabulary is not None:
 raw=a.vocabulary.read_bytes();actual=hashlib.sha256(raw).hexdigest()
 if actual!=expected:raise SystemExit('Exact official vocabulary hash mismatch; no result')
 ranks={};token_bytes=set();max_raw=0;max_replaced=0;witness=[]
 for ordinal,line in enumerate(raw.splitlines(),1):
  fields=line.split()
  if len(fields)!=2:raise SystemExit(f'Malformed line {ordinal}')
  b=base64.b64decode(fields[0],validate=True);rank=int(fields[1])
  if not b or rank<0 or rank in ranks or b in token_bytes:raise SystemExit('Invalid/duplicate vocabulary row')
  ranks[rank]=b;token_bytes.add(b)
  n=len(b);replaced=len(b.decode('utf8','replace').encode('utf8'))
  if n>max_raw:max_raw=n;witness=[{'rank':rank,'base64':fields[0].decode('ascii')}]
  elif n==max_raw:witness.append({'rank':rank,'base64':fields[0].decode('ascii')})
  max_replaced=max(max_replaced,replaced)
 if set(ranks)!=set(range(len(ranks))):raise SystemExit('Noncontiguous mergeable ranks')
 if set(ranks)&set(specials.values()):raise SystemExit('Special/rank overlap')
 if a.output_tokens<0 or a.envelope_bytes<0:raise SystemExit('Nonnegative bounds required')
 bound=max(max_raw,max(len(s.encode('utf8')) for s in specials))
 # Valid complete UTF8 concatenation is bounded by raw bytes. Arbitrary UTF8
 # replacement adds at most three output bytes per raw byte. JSON string
 # encoding adds at most six bytes per UTF8 byte, plus its two quote bytes.
 valid=6*a.output_tokens*bound+2+a.envelope_bytes
 replacement=18*a.output_tokens*bound+2+a.envelope_bytes
 result.update(maximumComputation='EXHAUSTIVE_ARTIFACT_COMPUTED',vocabularySHA256=actual,mergeableRanks=len(ranks),maximumMergeableRawBytes=max_raw,maximumSingleTokenReplacementUTF8Bytes=max_replaced,maximumSpecialUTF8Bytes=max(len(s.encode('utf8')) for s in specials),maximumRawBytesIncludingSpecials=bound,maximumRawWitnesses=witness,method='every mergeable token plus all registered special spellings; no model samples',conditionalEscapedTextCanonicalBounds={'M':a.output_tokens,'trustedEnvelopeOverheadBytes':a.envelope_bytes,'strictValidUTF8BoundBytes':valid,'arbitraryUTF8ReplacementBoundBytes':replacement,'strictFits60000':valid<=60000,'replacementFits60000':replacement<=60000,'scope':'one generated text string only; not structured JSON/numeric/tool envelopes or provider IDs; requires qualified total generated-token cap and serving encoding'})
print(json.dumps(result,indent=2,sort_keys=True))
