# AI Gateway

> For AI agents: see [llms.txt](/llms.txt) for the complete documentation index. Markdown versions are available by adding .md to a page URL or requesting Accept: text/markdown.

The Convex AI Gateway is a managed service that lets your app call AI models from [actions](/functions/actions.md). Convex holds the provider credentials, so you don't need to obtain, store, or rotate a key. Your action authenticates with a short-lived token scoped to your deployment.

```
const { text } = await generateText({

  model: convexGateway("anthropic/claude-sonnet-4.5"),

  prompt,

});
```

See [Getting started](/ai-gateway/setup.md) for the full setup.

## Supported endpoints[​](#supported-endpoints "Direct link to Supported endpoints")

### Text generation[​](#text-generation "Direct link to Text generation")

See [Getting started](/ai-gateway/setup.md) for text generation and embedding examples.

| Endpoint                    | What it does                                    |
| --------------------------- | ----------------------------------------------- |
| `GET /v1/models`            | List available models                           |
| `POST /v1/chat/completions` | Chat completions, streaming and non-streaming   |
| `POST /v1/embeddings`       | Generate embeddings                             |
| `POST /v1/messages`         | Anthropic Messages, streaming and non-streaming |
| `POST /v1/responses`        | OpenAI Responses, streaming and non-streaming   |

### Decisions with Jev[​](#decisions-with-jev "Direct link to Decisions with Jev")

Call `/alpha/decisions` to classify or score data with Jev. See [Decisions](/ai-gateway/api.md#post-alphadecisions) for the request format.

Decisions is in alpha

The `/alpha/decisions` request and response format may change during alpha.

### Images and videos[​](#images-and-videos "Direct link to Images and videos")

| Endpoint                      | What it does                     |
| ----------------------------- | -------------------------------- |
| `POST /v1/images/generations` | Generate images                  |
| `POST /v1/videos/generations` | Wait for a video and download it |
| `POST /v1/videos`             | Start an async video job         |
| `POST /v1/videos/status`      | Check an async job               |
| `POST /v1/videos/download`    | Download a completed async video |

See [Images and videos](/ai-gateway/images-and-videos.md) for SDK examples and async availability requirements.

Image and video generation are in alpha

The request and response format may change during alpha.

See [HTTP API](/ai-gateway/api.md) for the request and response shapes.

## Who can use it[​](#who-can-use-it "Direct link to Who can use it")

The AI Gateway is available to teams on a [paid plan](https://www.convex.dev/pricing). It works on Convex Cloud production and development deployments, and on [local deployments linked to a Convex project](/ai-gateway/setup.md#local-development).

If your team or deployment can't use the gateway, getting a token fails with one of these errors:

| Situation                                   | Error                  | What to do                                                                                                     |
| ------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Free plan, or gateway disabled for the team | `AiGatewayDisabled`    | Upgrade, or email <support@convex.dev> if this looks wrong                                                     |
| Anonymous or outdated local deployment      | `AiGatewayUnavailable` | Log in, update the Convex CLI, then restart `npx convex dev` and accept the backend upgrade if prompted        |
| [Self-hosted deployment](/self-hosting.md)  | `AiGatewayUnavailable` | Call the provider with your own key, stored as an [environment variable](/production/environment-variables.md) |

## Without the gateway[​](#without-the-gateway "Direct link to Without the gateway")

If you don't want to use the AI Gateway, store your provider API key as an [environment variable](/production/environment-variables.md) and call the provider SDK from an action.
