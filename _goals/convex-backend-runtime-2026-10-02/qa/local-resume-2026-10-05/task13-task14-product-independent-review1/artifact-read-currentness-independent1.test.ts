import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { mediaFixture, media, installMediaMockRoot } from '../../../../../tests/unit/runtimeMedia/fixture';
import { checkNativeMediaReferences } from '../../../../../convex-dev/runtimeTranscript';
import type { MessageDoc } from '@convex-dev/agent';

beforeEach(() => installMediaMockRoot());
afterEach(() => jest.restoreAllMocks());

it('a saved artifact_read tool result is current while readable and denied after its artifact is deleted', async () => {
  const f = await mediaFixture();
  const job = await f.submit('image', 'artifact-read-currentness');
  const result = await f.call<Record<string, unknown>>(media.readArtifactTrusted,
    { reference: f.reference, artifactId: job.artifactId });
  expect(result).toMatchObject({ version: 1, artifactId: job.artifactId, title: 'Generated image' });
  const message = { message: { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'artifact-read-call',
    toolName: 'artifact_read', output: { type: 'json', value: result } }] } } as unknown as MessageDoc;
  await expect(checkNativeMediaReferences(f.ctx, f.reference, message)).resolves.toBeDefined();
  const artifact = f.db.table('artifacts').find(row => row.artifactId === job.artifactId)!;
  await f.db.patch('artifacts', artifact._id as string, { isDeleted: true });
  // These are the same saved bytes. The shared native/transcript fence must
  // recheck their consumed resource before later model and private delivery.
  await expect(checkNativeMediaReferences(f.ctx, f.reference, message)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
});
