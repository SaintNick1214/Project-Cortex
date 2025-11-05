/**
 * Middleware Unit Tests
 */

import {
  resolveUserId,
  resolveConversationId,
  buildMemoryContext,
  injectMemoryContext,
  getLastUserMessage,
  validateConfig,
} from '../src/middleware';
import type { CortexMemoryConfig, AIMessage } from '../src/types';
import { createLogger } from '../src/types';

describe('Middleware', () => {
  const logger = createLogger(false);

  describe('resolveUserId', () => {
    it('should return static userId', async () => {
      const config: CortexMemoryConfig = {
        convexUrl: 'test',
        memorySpaceId: 'test',
        userId: 'user-123',
      };

      const userId = await resolveUserId(config, logger);
      expect(userId).toBe('user-123');
    });

    it('should resolve userId from function', async () => {
      const config: CortexMemoryConfig = {
        convexUrl: 'test',
        memorySpaceId: 'test',
        userId: () => 'dynamic-user',
      };

      const userId = await resolveUserId(config, logger);
      expect(userId).toBe('dynamic-user');
    });

    it('should resolve userId from async function', async () => {
      const config: CortexMemoryConfig = {
        convexUrl: 'test',
        memorySpaceId: 'test',
        userId: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'async-user';
        },
      };

      const userId = await resolveUserId(config, logger);
      expect(userId).toBe('async-user');
    });
  });

  describe('buildMemoryContext', () => {
    it('should build context from memories', () => {
      const memories: any[] = [
        { content: 'User likes coffee', metadata: { importance: 80 } },
        { content: 'User works at Acme', metadata: { importance: 60 } },
      ];

      const config: CortexMemoryConfig = {
        convexUrl: 'test',
        memorySpaceId: 'test',
        userId: 'user-1',
      };

      const context = buildMemoryContext(memories, config, logger);
      
      expect(context).toContain('User likes coffee');
      expect(context).toContain('User works at Acme');
      expect(context).toContain('importance: 80/100');
    });
  });

  describe('injectMemoryContext', () => {
    const memories: any[] = [
      { content: 'Test memory', metadata: { importance: 50 } },
    ];

    const config: CortexMemoryConfig = {
      convexUrl: 'test',
      memorySpaceId: 'test',
      userId: 'user-1',
    };

    it('should inject into system message', () => {
      const messages: AIMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ];

      const result = injectMemoryContext(messages, memories, {
        ...config,
        contextInjectionStrategy: 'system',
      }, logger);

      expect(result[0].role).toBe('system');
      expect(result[0].content).toContain('You are helpful');
      expect(result[0].content).toContain('Test memory');
    });

    it('should create system message if none exists', () => {
      const messages: AIMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const result = injectMemoryContext(messages, memories, {
        ...config,
        contextInjectionStrategy: 'system',
      }, logger);

      expect(result.length).toBe(2);
      expect(result[0].role).toBe('system');
      expect(result[0].content).toContain('Test memory');
    });
  });

  describe('validateConfig', () => {
    it('should validate required fields', () => {
      expect(() =>
        validateConfig({
          convexUrl: '',
          memorySpaceId: 'test',
          userId: 'user-1',
        } as any)
      ).toThrow('convexUrl is required');

      expect(() =>
        validateConfig({
          convexUrl: 'test',
          memorySpaceId: '',
          userId: 'user-1',
        } as any)
      ).toThrow('memorySpaceId is required');
    });

    it('should validate numeric ranges', () => {
      expect(() =>
        validateConfig({
          convexUrl: 'test',
          memorySpaceId: 'test',
          userId: 'user-1',
          memorySearchLimit: -1,
        })
      ).toThrow('memorySearchLimit must be >= 0');
    });
  });
});

