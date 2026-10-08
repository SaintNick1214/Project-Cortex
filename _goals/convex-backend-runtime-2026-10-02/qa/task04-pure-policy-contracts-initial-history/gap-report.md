# Initial pure-policy evidence: partial conversation archive

No candidate, old QA, test/config, Git or service mutation occurred for this archive.
No tests were rerun. Each new artifact was created exclusively with a new filename.

`af7799.tool-output-verbatim.txt` preserves the exact visible nested exec_command
response from the first observed 22-test passing invocation. Its embedded output is
verbatim; surrounding functions presentation wrappers are omitted. This is conversation
provenance, not an original on-disk receipt.

`e02110.visible-output-fragments.json` preserves exact visible response metadata and
three output fragments from the initial failing invocation: fixture collision warning,
first assertion failure and final 14-failed/8-passed/22-total summary. The displayed tool
output was truncated. This archive does NOT contain complete original stdout/stderr,
missing failure sections or separate stream attribution. Nothing was guessed to fill
those gaps.

`observed-check-command-fragment.txt` preserves the exact TypeScript/Jest command
suffix from the relevant tool inputs. The original combined shell argument also applied
source/test/config edits before those commands; its full argument is not archived here.
The suffix alone therefore cannot reproduce either original candidate preimage.

`initial-jest.config.preimage.txt` and `initial-tsconfig.preimage.txt` are inert exact
heredoc config contents from the initial complete creation input. The initial Jest
configuration had broad roots; the initial TypeScript config lacked explicit rootDir.
These are provenance-derived preimages, not recovered original filesystem files. No
original file hash or timestamp is claimed.

`provenance.json` labels the first four artifacts CONVERSATION_TOOL_INPUT_VERBATIM or
CONVERSATION_TOOL_OUTPUT_VERBATIM and hashes only their NEW archived bytes. This does not
provide cryptographic proof of original filesystem bytes. The failing-run full product
and test preimages and earlier receipt-backed 22-test files remain unarchived. The latter
were overwritten by final 24-test checks; their original bytes cannot be recovered from
available files. Current QA files certify only the final 24-test candidate.

The implementer's existing explanation that Node structuredClone crossed the Jest VM
realm and that broad roots caused naming collisions is a diagnosis/recollection, not
additional recovered raw evidence. The preserved failing output does establish exact
plain-object/array validation failures and naming collisions, and the preserved passing
output establishes the subsequent observed 22-test pass. The full failure evidence gap
remains explicit. No new run can retroactively certify the original invocation.
