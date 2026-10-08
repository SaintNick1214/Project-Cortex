from pathlib import Path
q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');s=Path('work/resume/task04-evidence-transport-c4-c1');p=q/'restore-git-modes.py';b=p.read_bytes();(s/'normalizer-before-source-ancestry.py.text').write_bytes(b)
old=b"p=packet/'materialize.py';f=os.open(p,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)";new=b"p=packet/'materialize.py';anchor=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)\n try:\n  for component in Path(os.path.abspath(packet)).parts[1:]:\n   child=os.open(component,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=anchor);os.close(anchor);anchor=child\n  f=os.open('materialize.py',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=anchor)\n finally:os.close(anchor)"
assert old in b;b=b.replace(old,new);b=b.replace(b'0<a.st_size<=65536',('a.st_size=='+str((q/'materialize.py').stat().st_size)+' and a.st_nlink==1').encode());p.write_bytes(b)
# Preserve prospective previously authored finalize script before adding the newly authorized mode step.
(s/'finalize-before-git-mode.py.text').write_bytes((s/'finalize.py').read_bytes())
