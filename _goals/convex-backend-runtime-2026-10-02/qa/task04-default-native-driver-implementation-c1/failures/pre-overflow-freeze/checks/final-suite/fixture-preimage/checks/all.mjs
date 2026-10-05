// Sequential dependent suite; import caching avoids duplicated group execution.
await import('./managed.mjs');
await import('./late-accounting.mjs');
await import('./runner.mjs');
await import('./observer.mjs');
await import('./proofs.mjs');
await import('./adapter.mjs');
