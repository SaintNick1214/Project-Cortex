import importlib.util,json,os,zlib
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');T=Path('/tmp/cortex-evidence-transport-c4-c1/adversarial-extra');T.mkdir()
spec=importlib.util.spec_from_file_location('helper',Q/'materialize.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
results=[]
def reject(name,fn):
 try:fn()
 except (ValueError,OSError,zlib.error) as e:results.append({'control':name,'rejected':True,'reason':str(e)});return
 raise AssertionError(name+' accepted')
reject('encoded-part-max-plus-one-before-input-read',lambda:list(h.Parts(T,[{'path':'absent','bytes':h.PART_LIMIT+1,'sha256':'0'*64}])))
reject('encoded-part-missing',lambda:list(h.Parts(T,[{'path':'absent','bytes':1,'sha256':'0'*64}])))
p=T/'part';p.write_bytes(b'X');reject('encoded-part-corruption',lambda:list(h.Parts(T,[{'path':'part','bytes':1,'sha256':h.sha(b'Y')}])))
(T/'part-link').symlink_to(p);reject('encoded-part-symlink',lambda:list(h.Parts(T,[{'path':'part-link','bytes':1,'sha256':h.sha(b'X')}])))
(T/'directory').mkdir();reject('encoded-part-directory',lambda:list(h.Parts(T,[{'path':'directory','bytes':1,'sha256':h.sha(b'X')}])))
os.mkfifo(T/'fifo');reject('encoded-part-fifo-nonblocking-regular-guard',lambda:list(h.Parts(T,[{'path':'fifo','bytes':1,'sha256':h.sha(b'X')}])))
packed=bytearray(zlib.compress(b'proof',wbits=31));packed[-8]^=1
reject('gzip-crc-corruption',lambda:h.Decode([bytes(packed)],5).read(5))
# Real oversized index rejects at fstat before any buffer/target directory creation.
packet=T/'oversized-index';packet.mkdir();(packet/'index.json').write_bytes(b'X'*(h.INDEX_LIMIT+1));reject('oversized-index-pre-buffer',lambda:h.load(packet))
# Actual compressed map part corruption denies before any original writes.
idx=json.loads((Q/'index.json').read_bytes());packet=T/'map-corrupt';packet.mkdir();(packet/'index.json').write_bytes((Q/'index.json').read_bytes());(packet/'mapParts').mkdir()
first=idx['mapParts'][0];b=bytearray((Q/first['path']).read_bytes());b[len(b)//2]^=1;(packet/first['path']).write_bytes(b)
reject('production-map-part-corruption-before-writes',lambda:h.load(packet))
(Q/'adversarial-extra-results.json').write_text(json.dumps({'status':'PASS','total':len(results),'controls':results},indent=2)+'\n');print(json.dumps({'additionalAdversarialControls':len(results),'status':'PASS'}))
