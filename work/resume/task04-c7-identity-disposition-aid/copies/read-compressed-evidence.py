from fs_identity import loads as authority_loads
from pathlib import Path
import json,gzip,hashlib,sys
T=Path('/dev/shm/cortex-native-c7-exact-identity-repair');H=lambda b:hashlib.sha256(b).hexdigest()
def read_content(path):
 p=Path(path);assert p.is_relative_to(T),'OWN_C6_ONLY'
 if p.exists():return p.read_bytes()
 catalog=authority_loads((T/'cumulative-evidence-compression.json').read_bytes());matches=[]
 for ref in catalog['indexes']:
  summary=Path(ref['summary']).read_bytes();assert H(summary)==ref['summarySHA256'];index=Path(ref['index']).read_bytes();assert H(index)==ref['indexSHA256'];matches.extend(authority_loads(line)for line in index.splitlines()if authority_loads(line)['path']==str(p))
 assert len(matches)==1,'MAPPING_MUST_EXIST_EXACTLY_ONCE';row=matches[0];encoded=Path(row['backing']).read_bytes();assert len(encoded)==row['encodedBytes']and H(encoded)==row['encodedSHA256'];b=gzip.decompress(encoded);assert len(b)==row['decodedBytes']and H(b)==row['decodedSHA256'];return b
if __name__=='__main__':assert len(sys.argv)==2;sys.stdout.buffer.write(read_content(sys.argv[1]))
