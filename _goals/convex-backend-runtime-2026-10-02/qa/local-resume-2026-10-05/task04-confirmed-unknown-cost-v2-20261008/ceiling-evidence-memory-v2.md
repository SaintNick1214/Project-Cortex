# Plain text/embedding ceiling — memory schema prompt v2

Qualification-only proposal; no production trust granted by this document.

Current official Gateway catalog receipt `r2-catalog-current.stdout` and Convex Gateway billing documentation support the OpenRouter USD published rates: gpt-4o-mini input $0.15/output $0.60 per million tokens, gpt-4o input $2.50/output $10 per million, text-embedding-3-small input $0.02 per million.

The only allowed native interfaces are plain chat and embedding, with maximum 8192 derived input units and 512 output tokens; embedding one text/vector1536. No tools, search, audio/images, provider options, plugins, routing options or reasoning model/options are reachable. Fixed domain JSON schemas are transmitted as measured text; native responseFormat remains absent. The full-cap amounts are mini1536, gpt-4o25600, embedding164 micro-USD (rounded upward). The retained100000 micro-USD per-call ceiling exceeds the largest by3.9x. No documented additional unbounded charge component is enabled.

Use published-price currency evidence with currentness/expiry, conservative margin and overrun fences. This is a practical allowed-envelope bound, not a universal warranty about undiscovered charges or proof of known invoice cost. Intentionally unavailable terminal cost retains the ENTIRE ceiling for operation/run/tenant with no discount/refund; exact qualified complete result may attach/replay without new paid inference. Wrong model, missing terminal/token/result evidence, lost expected-known cost, revocation and overrun still deny.

Sources: https://docs.convex.dev/ai-gateway/usage-and-billing and https://docs.convex.dev/ai-gateway/api plus the actual catalog above.
