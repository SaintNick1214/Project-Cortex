# Cortex Memory - RAG (Retrieval-Augmented Generation) Example

Combines document retrieval with conversation memory for context-aware AI responses.

## Features

- 📄 Document upload and indexing
- 🔍 RAG pattern with semantic search
- 🧠 Conversation memory alongside documents
- ⚡ Vercel AI SDK streaming

## Quick Start

```bash
npm install
cp env.local.example .env.local
# Configure .env.local with CONVEX_URL and OPENAI_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How It Works

1. **Upload documents** - Stored in Cortex immutable layer with embeddings
2. **Ask questions** - Searches both documents AND conversation history
3. **Get answers** - RAG combines document context + conversation memory
4. **Remember conversations** - Future questions use past Q&A as context

## Key Difference from Basic Chat

- **Basic Chat**: Only searches conversation history
- **RAG**: Searches documents (immutable) + conversation history (vector)

See code in `app/api/chat/route.ts` for implementation.
