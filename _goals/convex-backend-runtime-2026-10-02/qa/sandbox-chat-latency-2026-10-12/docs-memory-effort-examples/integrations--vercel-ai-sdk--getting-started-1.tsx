'use client';
import { useChat } from '@ai-sdk/react';
import type { CortexRemoteTransport } from '@cortexmemory/vercel-ai-provider/remote';

export function ChatView({ transport }: { transport: CortexRemoteTransport }) {
  const { messages, sendMessage, status } = useChat({ transport });
  return <section aria-label="Chat">
    <p aria-live="polite">{status}</p>
    {messages.map(message => <p key={message.id}>
      {message.parts.map((part, index) => part.type === 'text'
        ? <span key={index}>{part.text}</span> : null)}
    </p>)}
    <button onClick={() => void sendMessage({ text: 'Hello' })}>Send hello</button>
  </section>;
}
