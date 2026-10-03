# Main integration test-only adjustment

The ordinary three-suite worker run now passes185/185tests,0skips, with scoped types and lint passing.
The single initial integration failure and its five raw command/stdout/stderr receipts are preserved
unchanged in the parent main-integration directory.

The old ordinary test compared every current unrelated schema table to fixed6939678. That correctly
qualified the bounded isolated D patch at its original freeze, but incorrectly rejected later approved
MF additive schema work. Historical source/hash/native qualification receipts remain intact. The test
now exercises controlled native Convex composition: two host tables with concrete validators/indexes
and all five trusted auth tables plus canonical sources are exported before and after adding the
three actual D definitions. Complete exported table records, including validators and indexes, must
remain equal for every existing fixture table; all three added definitions must exactly match their
complete production native exports. This does not pin future unrelated production tables.

The AST test uses an owned OS temporary directory with finally cleanup, retains exact25/7public/
18internal and0unresolved assertions, and asserts its temporary directory was removed. Its ordinary
execution no longer writes canonical QA/catalog files. Before/after hashes verified all78frozen QA
files, the original source-freeze, all initial integration receipts, every D production source and
current root schema unchanged. Both canonical catalog files also match the parent's restored staged
reviewed bytes. No staging/index/product/schema/generated changes occurred.

Raw argv/cwd/UTC start-end/elapsed/exit/source hashes are in commands.json. The sole changed test hash
and a separate integration-only freeze are in test-adjustment-freeze.json. Parent obtains fresh
independent review of this test-only adjustment; original D product FINALPASS is not reinterpreted
as approval of this new test change. Full Task03/live/root service qualifications remain pending.
