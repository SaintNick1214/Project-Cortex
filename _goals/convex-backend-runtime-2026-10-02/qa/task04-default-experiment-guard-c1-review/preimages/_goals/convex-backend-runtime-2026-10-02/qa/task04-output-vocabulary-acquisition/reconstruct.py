#!/usr/bin/env python3
"""Reconstruct exact original artifact from public packaged rank sequence; no code execution."""
from pathlib import Path
import base64,hashlib,json
here=Path(__file__).resolve().parent;src=here/'public/package-o200k-json.raw';data=json.loads(src.read_text());parts=data['bpe_ranks'].split()
if parts[:2]!=['!','0'] or parts.count('!')!=1:raise SystemExit('Unknown compressed rank grammar; no artifact')
encoded=parts[2:];seen=set()
for token in encoded:
 b=base64.b64decode(token,validate=True)
 if not b or b in seen or base64.b64encode(b).decode('ascii')!=token:raise SystemExit('Noncanonical/duplicate token')
 seen.add(b)
raw=(''.join(f'{token} {rank}\n' for rank,token in enumerate(encoded))).encode('ascii')
expected='446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d';actual=hashlib.sha256(raw).hexdigest()
receipt={'packagePayloadSHA256':hashlib.sha256(src.read_bytes()).hexdigest(),'packagedOrigin':'public unpkg tiktoken@1.0.22 encoders/o200k_base.json; alternate origin, not OpenAI publication','rankCount':len(encoded),'rawBytes':len(raw),'grammar':'single ! 0 marker followed by base64 tokens in ascending rank; reconstruct base64 SPACE decimal rank LF per row','expectedOfficialSHA256':expected,'actualReconstructedSHA256':actual,'matchesExactOfficialHash':actual==expected,'specialTokensMatchOfficial':data['special_tokens']=={'<|endoftext|>':199999,'<|endofprompt|>':200018}}
(here/'reconstruction-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
if actual!=expected or not receipt['specialTokensMatchOfficial']:raise SystemExit('Integrity mismatch: artifact not accepted or written')
(here/'o200k_base.tiktoken').write_bytes(raw)
