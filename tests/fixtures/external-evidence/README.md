# Isolated external evidence fixture

`archive.json` contains four messages (689 UTF-8 body bytes) selected from the user-supplied `archive-recheck-2026-11-13/frozen-corpus.json`: a church/time proposal, its later clock qualification, an apparent solve claim, and the later joke retraction. It preserves the selected external IDs, authors, exact text, source times, reply IDs and snapshot provenance. It copies no attachments, signed URLs or bulk archive.

The corpus SHA-256 and each original body's SHA-256 are recorded. The qualification and retraction are distinct archived messages, not observed edits to their parents. Any test that changes a body or assigns another revision is a **synthetic SDK revision test**. These fixtures do not establish a puzzle solution or an authority classification; all assertions remain `unverified_external` with extraction disabled.

Offline fixture checks do not certify backend persistence, Convex transaction isolation, provider behavior or ANN quality. The private native fixture lives outside `convex-dev/` and must enter only a temporary qualification stage, never the published backend distribution.
