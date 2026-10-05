from pathlib import Path
q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');s=Path('work/resume/task04-evidence-transport-c4-c1');p=q/'restore-directory-modes.py';b=p.read_text();(s/'directory-helper-before-fd-bound.py.text').write_text(b)
b=b.replace("s=safe_fd(h,f);held.append((p,f,meta(s)))","s=safe_fd(h,f);held.append((p,meta(s)));os.close(f)")
b=b.replace("for p,f,before in held:\n   s=safe_fd(h,f);h.require(meta(s)==before,'directory preflight identity drift');new=h.directory(target/p)\n   try:s2=os.fstat(new);h.require(s2.st_dev==s.st_dev and s2.st_ino==s.st_ino,'directory path identity changed')\n   finally:os.close(new)","for p,before in held:\n   f=h.directory(target/p)\n   try:s=safe_fd(h,f);h.require(meta(s)==before,'directory preflight identity drift')\n   finally:os.close(f)")
start=b.index('  for p,f,initial in held:');end=b.index('  for p in selected:',start)
old=b[start:end];new=old.replace('  for p,f,initial in held:', '  for p,initial in held:').replace('   s=safe_fd(h,f);', '   f=h.directory(target/p)\n   try:\n    s=safe_fd(h,f);')
lines=new.splitlines();tr=next(i for i,l in enumerate(lines) if l=='   try:')
# The first statement already has one extra space; indent all remaining mutation statements.
for i in range(tr+2,len(lines)):
 if lines[i]:lines[i]=' '+lines[i]
lines.append('   finally:os.close(f)');new='\n'.join(lines)+'\n';b=b[:start]+new+b[end:]
b=b.replace(' finally:\n  for p,f,before in held:os.close(f)',' finally:\n  pass')
b=b.replace('Hold exact descriptor identities.','Retain exact identities with bounded sequential descriptors; revalidate whole set before mutation.')
p.write_text(b)
