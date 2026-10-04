Exact historical C2 component/reviewer temporary byte backing. Read the independently accepted component report; all 122 commands remain held. Historical custody remains broken.

Parts are published through the ROOT transfer source mapping from verified owned temporary storage. Original source paths are labels only; this archive does not recreate those locations or physical inode metadata. It preserves all 301 referenced temporary payloads and the authentic fresh tmp seal as 156 distinct SHA256 objects. Existing original-eight-root transport remains a separate prerequisite.

Use a new owned destination with enough space:

```sh
python3 materialize.py --index index.json --index-sha256 cf6314cb96d9b8b74be64839ff971a0e85068dc6a67c5b8bf8433850263b6866 --destination /tmp/OWN-NEW-C2-BACKING
```

Run again to verify an unchanged existing object set. Every input/archive/object is validated before destination creation. The helper denies symlink/hardlink inputs, concatenated/trailing gzip, malformed TAR members, wrong hashes and overwrites; output files are 0600 under 0700 directories. Partial outputs after OS failure remain explicit; there is no transactional or privileged-race guarantee. The index maps every original label to its content object, which is used for historical inspection rather than executing at original paths.

C2 ancestry repair: input reads open each absolute ancestor relative to the previous directory descriptor with O_DIRECTORY|O_NOFOLLOW, retain the descriptor chain, and revalidate all path/FD identities before and after each read. The leaf must remain a singly linked regular file. Public 0644 input files remain supported. Paths containing `..` are denied. This does not add a transactional extraction or privileged attacker guarantee. `index.json` remains byte-identical to the previous pinned index; the same 13 parts must be published beside this new index through ROOT source mapping.
