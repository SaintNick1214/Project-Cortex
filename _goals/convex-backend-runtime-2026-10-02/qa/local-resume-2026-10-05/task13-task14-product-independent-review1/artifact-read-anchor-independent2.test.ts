import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { mediaFixture, media, installMediaMockRoot } from '../../../../../tests/unit/runtimeMedia/fixture';
import { artifacts, transcript } from '../../../../../tests/unit/runtimeAssets/fixture';

beforeEach(() => installMediaMockRoot());
afterEach(() => jest.restoreAllMocks());

it('artifact_read retains currentness of the exact linked canonical message after supported deletion', async () => {
  const f = await mediaFixture(), run = await f.run();
  const current = f.db.table('runtimeConversations').find(row => row.conversationId === run.conversationId)!;
  await f.call(transcript.setPolicy, { conversationId: run.conversationId, expectedRevision: current.historyRevision, manualWriteLocked: false });
  const messageId = run.inputMessageIds[0];
  await f.call(artifacts.create, { artifactId: 'anchored-artifact', content: 'owned content', title: 'anchored metadata', conversationRef: { conversationId: run.conversationId, messageId } });
  await expect(f.call(artifacts.get, { artifactId: 'anchored-artifact' })).resolves.toBeDefined();
  await expect(f.call(media.readArtifactTrusted, { reference: f.reference, artifactId: 'anchored-artifact' })).resolves.toMatchObject({ artifactId: 'anchored-artifact' });
  const conversation = f.db.table('runtimeConversations').find(row => row.conversationId === run.conversationId)!;
  const bridge = f.db.table('runtimeTranscriptMessages').find(row => row.nativeMessageId === messageId)!;
  await f.call(transcript.removeMessage, { conversationId: run.conversationId, messageId, expectedRevision: conversation.historyRevision, expectedMessageRevision: bridge.revision });
  expect(f.native.messages.has(messageId)).toBe(false);
  await expect(f.call(artifacts.get, { artifactId: 'anchored-artifact' })).rejects.toThrow();
  await expect(f.call(media.readArtifactTrusted, { reference: f.reference, artifactId: 'anchored-artifact' })).rejects.toThrow();
});
