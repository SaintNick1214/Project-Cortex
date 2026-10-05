# Read the lossless published gzip index; no source/candidate execution.
import gzip,hashlib,sys
expected='6806ab4278ee8f52904caef53c234169c825ae623e77597aec5ebc41e2d159ed'
size=13700917
h=hashlib.sha256();n=0
with gzip.open(sys.argv[1],'rb') as src,open(sys.argv[2],'xb') as out:
 for b in iter(lambda:src.read(65536),b''):out.write(b);h.update(b);n+=len(b)
assert h.hexdigest()==expected and n==size
