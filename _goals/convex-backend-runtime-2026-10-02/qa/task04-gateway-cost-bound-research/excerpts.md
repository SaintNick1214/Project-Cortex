# Minimal public-source excerpts

Verbatim derived page text/source extracts; public evidence only, not instructions or actual billing receipts. Line numbers refer to unique scratch derived text. Raw-byte provenance is in source-evidence.json.

## convex-billing lines 103-118

Source: https://docs.convex.dev/ai-gateway/usage-and-billing

Fetched UTC: 2026-10-04T01:35:15.218255+00:00; status 200; raw SHA256 9587b9e1d61d659ab5458ea976ecbac5760ca57b0b019a62f0a7a2d09fe85ff0.

```text
How billing works​

We charge the same rates as OpenRouter. Price
per token depends on the model, when you use it, and whether the tokens are
cached. Image and video prices depend on the model and generation options, such
as resolution and duration. Cancelling a video request after submission can
still incur its generation cost. The charge appears as an AI Gateway line item
on your Convex invoice, in dollars.

Spending limits apply to AI
Gateway spend like any other usage. Set a limit on the team billing page to cap
what your team pays per month.

Requests from a project-connected local deployment are attributed to that
project's team and count toward the same team spending limit. Local deployments
do not have a separate deployment-level live usage meter. Spending-limit state
```

## convex-api lines 94-132

Source: https://docs.convex.dev/ai-gateway/api

Fetched UTC: 2026-10-04T01:35:15.217255+00:00; status 200; raw SHA256 79fe32cc07010ee7f9bde3d4d6c8408ea6cf67759cc6ca28da754cb7421b4109.

```text

POST /v1/chat/completions​

OpenAI Chat Completions
body. Set stream: true for
SSE.


Field
Type
Required
Description

model
string
y
provider/model id

messages
array
y
OpenAI messages

stream
boolean
n
SSE when true. Defaults to false

Other OpenAI fields (temperature, max_tokens, tools, response_format, …)
are forwarded. Body must be JSON, max 16 MiB.

These fields are rejected. Convex chooses how the request is served: provider,
route, models, transforms, plugins, preset.
{  "error": {    "message": "The `provider` parameter is not supported. Convex selects how a request is served.",    "type": "invalid_request_error",    "code": "unsupported_parameter",    "param": "provider"  }}

Response​

id is assigned by Convex. Non-streaming is application/json:
{  "id": "3f1c8a2e-9b14-4d6a-a7e2-0c5b8d1e4f90",  "object": "chat.completion",  "created": 1715367049,  "model": "openai/gpt-4o-mini",  "choices": [    {      "index": 0,      "message": { "role": "assistant", "content": "Hello!" },      "finish_reason": "stop",      "logprobs": null    }  ],  "system_fingerprint": "fp_123",  "usage": {    "prompt_tokens": 12,    "completion_tokens": 5,    "total_tokens": 17,    "prompt_tokens_details": { "cached_tokens": 0 },    "completion_tokens_details": { "reasoning_tokens": 0 }  }}
```

## convex-api lines 140-150

Source: https://docs.convex.dev/ai-gateway/api

Fetched UTC: 2026-10-04T01:35:15.217255+00:00; status 200; raw SHA256 79fe32cc07010ee7f9bde3d4d6c8408ea6cf67759cc6ca28da754cb7421b4109.

```text
POST /v1/embeddings​

OpenAI Embeddings
body. model and input are required. input may be one string, one token-ID
array, or a batch of up to 512 strings or token-ID arrays. Other OpenAI fields
are forwarded. The body must be JSON and no larger than 16 MiB.

Convex rejects the same routing controls as /v1/chat/completions, assigns the
response id, and removes fields that identify the serving provider. The
response otherwise uses the OpenAI embeddings shape.

```

## convex-api lines 310-326

Source: https://docs.convex.dev/ai-gateway/api

Fetched UTC: 2026-10-04T01:35:15.217255+00:00; status 200; raw SHA256 79fe32cc07010ee7f9bde3d4d6c8408ea6cf67759cc6ca28da754cb7421b4109.

```text
OpenAI Responses
body. Model IDs use the provider/model form. model and input are required.
Set stream: true for server-sent events.
{  "model": "openai/gpt-5-mini",  "input": "Hello!"}

Other OpenAI Responses fields are forwarded. The body must be JSON and no larger
than 16 MiB. These OpenRouter routing controls are rejected because Convex
chooses how the request is served: provider, route, models, transforms,
plugins, preset, and session_id.

The endpoint is stateless. OpenRouter rejects store: true and a non-null
previous_response_id. Convex replaces upstream response IDs with
Convex-generated IDs and removes fields that identify the serving provider.
Caller-supplied metadata on a response is preserved.

Errors​

```

## convex-models lines 99-125

Source: https://docs.convex.dev/ai-gateway/models

Fetched UTC: 2026-10-04T01:35:15.218840+00:00; status 200; raw SHA256 1d23c566a79cc70885a04ceac0339cf8541ce2d94e306fc2f46a047c4f75e302.

```text
openai/gpt-4.1

openai/gpt-4.1-mini

openai/gpt-4.1-mini:batch

openai/gpt-4.1-nano

openai/gpt-4.1-nano:batch

openai/gpt-4.1:batch

openai/gpt-4o

openai/gpt-4o-2024-05-13

openai/gpt-4o-2024-08-06

openai/gpt-4o-2024-11-20

openai/gpt-4o-mini

openai/gpt-4o-mini-2024-07-18

openai/gpt-4o-mini:batch

openai/gpt-4o:batch
```

## openrouter-4omini lines 40-58

Source: https://openrouter.ai/openai/gpt-4o-mini

Fetched UTC: 2026-10-04T01:35:49.714956+00:00; status 200; raw SHA256 65d651030156fa82de75a7186ec55e1c9fa2ca4536d519058796c62b952c2cc4.

```text
X
YouTubeSign UpSign Up
OpenAI: GPT-4o-mini
openai/gpt-4o-miniCompareAPITry this model
GPT-4o mini is OpenAI's newest model after GPT-4 Omni, supporting both text and image inputs with text outputs.

As their most advanced small model, it is many multiples more affordable than other recent frontier models, and more than 60% cheaper than GPT-3.5 Turbo. It maintains SOTA intelligence, while being significantly more cost-effective.

GPT-4o mini achieves an 82% score on MMLU and presently ranks higher than GPT-4 on chat preferences common leaderboardsOpens in new tab.

Check out the launch announcementOpens in new tab to learn more.

#multimodalModalitiesIn / Out Price$0.15 / $0.60per 1MContext128KReleasedJul 18, 2024Knowledge CutoffOct 2023OpenAI: GPT-4o-miniCompareAPITry this modelProvidersPricingPerformanceUptimeBenchmarksAppsActivityFAQExploreProviders
Providers
Different companies host the same model. OpenRouter routes your request to one of them based on the routing mode you pick — Balanced (price + speed), Nitro (fastest), Floor (cheapest), or Exacto (highest tool-calling accuracy).
Pricing
The average price customers actually pay for this model, next to the prices providers post. Caching and discounts mean the price actually paid is often well below the listed one.
Performance
Throughput is how fast the model writes (tokens per second — higher is better). Latency is total round-trip time (lower is better). TTFT is time-to-first-token — how long before you see anything appear (lower is better).
```

## openrouter-41mini lines 40-50

Source: https://openrouter.ai/openai/gpt-4.1-mini

Fetched UTC: 2026-10-04T01:35:49.715896+00:00; status 200; raw SHA256 ae285493df17caf5021808ec43016d93c1e4759c63cbe384e37ab891b441863f.

```text
X
YouTubeSign UpSign Up
OpenAI: GPT-4.1 Mini
openai/gpt-4.1-miniCompareAPITry this model
GPT-4.1 Mini is a mid-sized model delivering performance competitive with GPT-4o at substantially lower latency and cost. It retains a 1 million token context window and scores 45.1% on hard instruction evals, 35.8% on MultiChallenge, and 84.1% on IFEval. Mini also shows strong coding ability (e.g., 31.6% on Aider’s polyglot diff benchmark) and vision understanding, making it suitable for interactive applications with tight performance constraints.ModalitiesIn / Out Price$0.40 / $1.60per 1MContext1.0MReleasedApr 14, 2025Knowledge CutoffJun 2024OpenAI: GPT-4.1 MiniCompareAPITry this modelProvidersPricingPerformanceUptimeBenchmarksAppsActivityFAQExploreProviders
Providers
Different companies host the same model. OpenRouter routes your request to one of them based on the routing mode you pick — Balanced (price + speed), Nitro (fastest), Floor (cheapest), or Exacto (highest tool-calling accuracy).
Pricing
The average price customers actually pay for this model, next to the prices providers post. Caching and discounts mean the price actually paid is often well below the listed one.
Performance
Throughput is how fast the model writes (tokens per second — higher is better). Latency is total round-trip time (lower is better). TTFT is time-to-first-token — how long before you see anything appear (lower is better).
```

## openrouter-embedding lines 42-49

Source: https://openrouter.ai/openai/text-embedding-3-small

Fetched UTC: 2026-10-04T01:35:49.716526+00:00; status 200; raw SHA256 655114f9dc10b108b166f5f6d9c346ba889a5f82f522c4d69a7b5d328a98db64.

```text
OpenAI: Text Embedding 3 Small
openai/text-embedding-3-smallAPI
text-embedding-3-small is OpenAI's improved, more performant version of the ada embedding model. Embeddings are a numerical representation of text that can be used to measure the relatedness between two pieces of text. Embeddings are useful for search, clustering, recommendations, anomaly detection, and classification tasks.ModalitiesPrice$0.02/M tokensContext8KReleasedOct 30, 2025OpenAI: Text Embedding 3 SmallAPIProvidersPricingPerformanceUptimeAppsActivityFAQExploreProviders
Providers
Different companies host the same model. OpenRouter routes your request to one of them based on the routing mode you pick — Balanced (price + speed), Nitro (fastest), Floor (cheapest), or Exacto (highest tool-calling accuracy).
Pricing
The average price customers actually pay for this model, next to the prices providers post. Caching and discounts mean the price actually paid is often well below the listed one.
Performance
```

## openrouter-pricing lines 134-153

Source: https://openrouter.ai/docs/faq

Fetched UTC: 2026-10-04T01:35:49.717150+00:00; status 200; raw SHA256 4a0f36dfa2f863d6ad711f3d0a2b23ffee3217f6b651cffaff7cdd1b3b07e14e.

```text
How do I get billed for my usage on OpenRouter?For each model we have the pricing displayed per million tokens. There is
usually a different price for prompt and completion tokens. There are also
models that charge per request, for images and for reasoning tokens. All of
these details will be visible on the models page.When you make a request to OpenRouter, we receive the total number of tokens processed
by the provider. We then calculate the corresponding cost and deduct it from your credits.
You can review your complete usage history in the Activity tab.We pass through the pricing of the underlying providers; there is no markup
on inference pricing (however we do charge a fee when purchasing credits).

​Pricing and fees

What are the fees for using OpenRouter?OpenRouter charges a  fee when you purchase credits. We pass through
the pricing of the underlying model providers without any markup, so you pay
the same rate as you would directly with the provider.Crypto payments are charged a fee of .
Is there a fee for using my own provider keys (BYOK)?Yes. BYOK has a plan-dependent free allowance measured by list-price
inference cost, not request count. Pay-as-you-go includes
$25,000 per month with no BYOK fee,
while Enterprise allowances are custom.
Usage above the allowance has a fee of 5% of what the
same model and provider would normally cost on OpenRouter. This fee is
deducted from your OpenRouter credits. This allows you to manage your rate
```

## openrouter-usage lines 78-127

Source: https://openrouter.ai/docs/cookbook/administration/usage-accounting

Fetched UTC: 2026-10-04T01:36:43.087045+00:00; status 200; raw SHA256 d8a9cc1b0f84c07b887fd57f7c6db4dd0028d2438bedf23703aafd5a51f76cc2.

```text
Usage AccountingCopy pageCopy pageCopy pageCopy pageThe OpenRouter API provides built-in Usage Accounting that allows you to track AI model usage without making additional API calls. This feature provides detailed information about token counts, costs, and caching status directly in your API responses.

​Usage Information
OpenRouter automatically returns detailed usage information with every response, including:


Prompt and completion token counts using the model’s native tokenizer

Cost in credits

Reasoning token counts (if applicable)

Cached token counts (if available)

This information is included in the last SSE message for streaming responses, or in the complete response for non-streaming requests. No additional parameters are required.
Deprecated ParametersThe usage: { include: true } and stream_options: { include_usage: true } parameters are deprecated and have no effect. Full usage details are now always included automatically in every response.

​Response Format
Every response includes a usage object with detailed token information:
{
  "object": "chat.completion.chunk",
  "usage": {
    "completion_tokens": 2,
    "completion_tokens_details": {
      "reasoning_tokens": 0
    },
    "cost": 0.95,
    "cost_details": {
      "upstream_inference_cost": 19
    },
    "prompt_tokens": 194,
    "prompt_tokens_details": {
      "cached_tokens": 0,
      "cache_write_tokens": 100,
      "audio_tokens": 0
    },
    "total_tokens": 196
  }
}

cached_tokens is the number of tokens that were read from the cache. cache_write_tokens is the number of tokens that were written to the cache (only returned for models with explicit caching and cache write pricing).

​Cost Breakdown
The usage response includes detailed cost information:


cost: The total amount charged to your account

cost_details.upstream_inference_cost: The actual cost charged by the upstream AI provider

```

## openai-chat-reference lines 892-904

Source: https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create

Fetched UTC: 2026-10-04T01:35:49.717635+00:00; status 200; raw SHA256 73e21a10cd517d076edafb389f4da98d92e1a259ff66e09c431c01f60e3c93e3.

```text
content of message.
max_completion_tokens: optional number or null
An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens.
max_tokens: optional number or null
Deprecated.

The maximum number of tokens that can be generated in the
chat completion. This value can be used to control
costs for text generated via API.

This value is now deprecated in favor of max_completion_tokens, and is
not compatible with o-series models.
metadata: optional Metadata or null
```

## openai-responses-reference lines 2630-2638

Source: https://developers.openai.com/api/reference/resources/responses/methods/create

Fetched UTC: 2026-10-04T01:35:49.718567+00:00; status 200; raw SHA256 34cea96669569c7b1311012f3171e38cb007a52b8c590cf6e18f7a2496c17643.

```text
response will not be carried over to the next response. This makes it simple
to swap out system (or developer) messages in new responses.
max_output_tokens: optional number or null
An upper bound for the number of tokens that can be generated for a response, including visible output tokens and reasoning tokens.
minimum16max_tool_calls: optional number or null
The maximum number of total calls to built-in tools that can be processed in a response. This maximum number applies across all built-in tool calls, not per individual tool. Any further attempts to call a tool by the model will be ignored.
metadata: optional Metadata or null
Set of 16 key-value pairs that can be attached to an object. This can be
useful for storing additional information about the object in a structured
```

## openai-embedding-reference lines 470-476

Source: https://developers.openai.com/api/reference/resources/embeddings/methods/create

Fetched UTC: 2026-10-04T01:36:43.087903+00:00; status 200; raw SHA256 6424bbc6979764aa0401b144e288189a67abc0bd3970f2e4949a7cc43aa76173.

```text
Create embeddingsPOST/embeddings
Creates an embedding vector representing the input text.
Body ParametersJSONExpand Collapse input: string or array of string or array of number or array of array of number
Input text to embed, encoded as a string or array of tokens. To embed multiple inputs in a single request, pass an array of strings or array of token arrays. The input must not exceed the max input tokens for the model (8192 tokens for all embedding models), cannot be an empty string, and any array must be 2048 dimensions or less. Example Python code for counting tokens. In addition to the per-input token limit, all embedding models enforce a maximum of 300,000 tokens summed across all inputs in a single request.
One of the following:String = string
The string that will be turned into an embedding.
Array = array of string
```

## openai-embedding-guide lines 3604-3635

Source: https://developers.openai.com/api/docs/guides/embeddings

Fetched UTC: 2026-10-04T01:35:49.719468+00:00; status 200; raw SHA256 02bc29075daaf08647fca9cdcc437c15aed26bb7cf2b8c9d759bbd28af90a790.

```text
FAQ

How can I tell how many tokens a string has before I embed it?

In Python, you can split a string into tokens with OpenAI’s tokenizer tiktoken.

Example code:
1
2
3
4
5
6
7
8
9
10
11import tiktoken


def num_tokens_from_string(string: str, encoding_name: str) -> int:
    """Returns the number of tokens in a text string."""
    encoding = tiktoken.get_encoding(encoding_name)
    num_tokens = len(encoding.encode(string))
    return num_tokens


num_tokens_from_string("tiktoken is great!", "cl100k_base")

For third-generation embedding models like text-embedding-3-small, use the cl100k_base encoding.

More details and example code are in the OpenAI Cookbook guide how to count tokens with tiktoken.
```

## openai-cookbook-tokens lines 84-135

Source: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_count_tokens_with_tiktoken.ipynb

Fetched UTC: 2026-10-04T01:35:15.233603+00:00; status 200; raw SHA256 b83aa4aebf80a432b0a93a54fe3056e09d768774f8914ea7bf8329129b6800d5.

```text
ChatGPT models like `gpt-4o-mini` and `gpt-4` use tokens in the same way as older completions models, but because of their message-based formatting, it's more difficult to count how many tokens will be used by a conversation.

Below is an example function for counting tokens for messages passed to `gpt-3.5-turbo`, `gpt-4`, `gpt-4o` and `gpt-4o-mini`.

Note that the exact way that tokens are counted from messages may change from model to model. Consider the counts from the function below an estimate, not a timeless guarantee.

In particular, requests that use the optional functions input will consume extra tokens on top of the estimates calculated below.
def num_tokens_from_messages(messages, model="gpt-4o-mini-2024-07-18"):
    """Return the number of tokens used by a list of messages."""
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        print("Warning: model not found. Using o200k_base encoding.")
        encoding = tiktoken.get_encoding("o200k_base")
    if model in {
        "gpt-3.5-turbo-0125",
        "gpt-4-0314",
        "gpt-4-32k-0314",
        "gpt-4-0613",
        "gpt-4-32k-0613",
        "gpt-4o-mini-2024-07-18",
        "gpt-4o-2024-08-06"
        }:
        tokens_per_message = 3
        tokens_per_name = 1
    elif "gpt-3.5-turbo" in model:
        print("Warning: gpt-3.5-turbo may update over time. Returning num tokens assuming gpt-3.5-turbo-0125.")
        return num_tokens_from_messages(messages, model="gpt-3.5-turbo-0125")
    elif "gpt-4o-mini" in model:
        print("Warning: gpt-4o-mini may update over time. Returning num tokens assuming gpt-4o-mini-2024-07-18.")
        return num_tokens_from_messages(messages, model="gpt-4o-mini-2024-07-18")
    elif "gpt-4o" in model:
        print("Warning: gpt-4o and gpt-4o-mini may update over time. Returning num tokens assuming gpt-4o-2024-08-06.")
        return num_tokens_from_messages(messages, model="gpt-4o-2024-08-06")
    elif "gpt-4" in model:
        print("Warning: gpt-4 may update over time. Returning num tokens assuming gpt-4-0613.")
        return num_tokens_from_messages(messages, model="gpt-4-0613")
    else:
        raise NotImplementedError(
            f"""num_tokens_from_messages() is not implemented for model {model}."""
        )
    num_tokens = 0
    for message in messages:
        num_tokens += tokens_per_message
        for key, value in message.items():
            num_tokens += len(encoding.encode(value))
            if key == "name":
                num_tokens += tokens_per_name
    num_tokens += 3  # every reply is primed with <|start|>assistant<|message|>
    return num_tokens

## 7. Counting tokens for chat completions with tool calls
```

## tiktoken-model lines 7-22

Source: https://raw.githubusercontent.com/openai/tiktoken/main/tiktoken/model.py

Fetched UTC: 2026-10-04T01:35:49.734244+00:00; status 200; raw SHA256 600f26902d1cf6a1a5f54e37be988b3e0d911f1ff17ba7060bb361f9b5295521.

```text
MODEL_PREFIX_TO_ENCODING: dict[str, str] = {
    "o1-": "o200k_base",
    "o3-": "o200k_base",
    "o4-mini-": "o200k_base",
    # chat
    "gpt-5": "o200k_base",
    "gpt-4.5-": "o200k_base",
    "gpt-4.1-": "o200k_base",
    "chatgpt-4o-": "o200k_base",
    "gpt-4o-": "o200k_base",  # e.g., gpt-4o-2024-05-13
    "gpt-4-": "cl100k_base",  # e.g., gpt-4-0314, etc., plus gpt-4-32k
    "gpt-3.5-turbo-": "cl100k_base",  # e.g, gpt-3.5-turbo-0301, -0401, etc.
    "gpt-35-turbo-": "cl100k_base",  # Azure deployment name
    "gpt-oss-": "o200k_harmony",
    # fine-tuned
    "ft:gpt-4o": "o200k_base",
```

## tiktoken-model lines 49-56

Source: https://raw.githubusercontent.com/openai/tiktoken/main/tiktoken/model.py

Fetched UTC: 2026-10-04T01:35:49.734244+00:00; status 200; raw SHA256 600f26902d1cf6a1a5f54e37be988b3e0d911f1ff17ba7060bb361f9b5295521.

```text
    # DEPRECATED MODELS
    # text (DEPRECATED)
    "text-davinci-003": "p50k_base",
    "text-davinci-002": "p50k_base",
    "text-davinci-001": "r50k_base",
    "text-curie-001": "r50k_base",
    "text-babbage-001": "r50k_base",
    "text-ada-001": "r50k_base",
```

## tiktoken-educational lines 29-39

Source: https://raw.githubusercontent.com/openai/tiktoken/main/tiktoken/_educational.py

Fetched UTC: 2026-10-04T01:36:43.088508+00:00; status 200; raw SHA256 4d414ea7c43dd568eb4ef18a842344cab86dbdaf365257a75df84fcbdcd2ed54.

```text
        # Use the regex to split the text into (approximately) words
        words = self._pat.findall(text)
        tokens = []
        for word in words:
            # Turn each word into tokens, using the byte pair encoding algorithm
            word_bytes = word.encode("utf-8")
            word_tokens = bpe_encode(self.mergeable_ranks, word_bytes, visualise=visualise)
            tokens.extend(word_tokens)
        return tokens

    def decode_bytes(self, tokens: list[int]) -> bytes:
```

## tiktoken-educational lines 83-115

Source: https://raw.githubusercontent.com/openai/tiktoken/main/tiktoken/_educational.py

Fetched UTC: 2026-10-04T01:36:43.088508+00:00; status 200; raw SHA256 4d414ea7c43dd568eb4ef18a842344cab86dbdaf365257a75df84fcbdcd2ed54.

```text
def bpe_encode(
    mergeable_ranks: dict[bytes, int], input: bytes, visualise: str | None = "colour"
) -> list[int]:
    parts = [bytes([b]) for b in input]
    while True:
        # See the intermediate merges play out!
        if visualise:
            if visualise in ["colour", "color"]:
                visualise_tokens(parts)
            elif visualise == "simple":
                print(parts)

        # Iterate over all pairs and find the pair we want to merge the most
        min_idx = None
        min_rank = None
        for i, pair in enumerate(zip(parts[:-1], parts[1:])):
            rank = mergeable_ranks.get(pair[0] + pair[1])
            if rank is not None and (min_rank is None or rank < min_rank):
                min_idx = i
                min_rank = rank

        # If there were no pairs we could merge, we're done!
        if min_rank is None:
            break
        assert min_idx is not None

        # Otherwise, merge that pair and leave the rest unchanged. Then repeat.
        parts = parts[:min_idx] + [parts[min_idx] + parts[min_idx + 1]] + parts[min_idx + 2 :]

    if visualise:
        print()

    tokens = [mergeable_ranks[part] for part in parts]
```

## openai-4omini model/pricing section

Source: https://developers.openai.com/api/docs/models/gpt-4o-mini

Fetched UTC: 2026-10-04T01:35:15.219479+00:00; raw SHA256 fc02121f05f3cf143bfb6ff0a0218dd27aea7163696a172ee87d2ce68775a6f3.

```text
ModelsGPT-4o MiniDefaultFast, affordable small model for focused tasksFast, affordable small model for focused tasksCompareTry in PlaygroundIntelligenceAverageSpeedFastPrice$0.15•$0.6Input•OutputInputText, ImageOutputTextPrompt exampleIntent ClassificationPrompt exampleExtract search keywordsPrompt exampleTranslate textPrompt exampleGenerate tags
GPT-4o Mini (“o” for “omni”) is a fast, affordable small model for focused tasks.
It accepts both text and image inputs, and produces text outputs (including Structured Outputs).
It is ideal for fine-tuning, and model outputs from a larger model like GPT-4o can be distilled to GPT-4o-Mini to produce similar results at lower cost and latency.128,000 context window16,384 max output tokensOct 01, 2023 knowledge cutoffPricingPricing is based on the number of tokens used, or other metrics based on the model type. For tool-specific models, like search and computer use, there’s a fee per tool call. See details in the pricing page.Text tokensPer 1M tokens∙Batch API priceInput$0.15Cached input$0.075Output$0.60Quick comparisonInputCached inputOutputGPT-4o$2.50o3-mini$1.10GPT-4o Mini$0.15ModalitiesTextInput and outputImageInput onlyAudioNot supportedVideoNot supportedEndpointsLivev1/live/sessionsChat Completionsv1/chat/completionsResponsesv1/responsesRealtimev1/realtimeRealtime translationv1/realtime/translationsRealtime transcriptionv1/realtime/transcription_sessionsAssistantsv1/assistantsBatchv1/batchFine-tuningv1/fine-tuningEmbeddingsv1/embeddingsImage generationv1/images/generationsVideosv1/videosImage editv1/images/editsSpeech generationv1/audio/speechTranscriptionv1/audio/transcriptionsTranslationv1/audio/translationsModerationv1/moderationsCompletions (legacy)v1/completionsFeaturesStreamingSupportedFunction callingSupportedStructured outputsSupportedFine-tuningSupportedPredicted outputsSupportedSnapshotsSnapshots let you lock in a specific version of the model so that performance and behavior remain consistent. Below is a list of all available snapshots and aliases for GPT-4o Mini.gpt-4o-minigpt-4o-mini-2024-07-18gpt-4o-mini-2024-07-18
```

## openai-41mini model/pricing section

Source: https://developers.openai.com/api/docs/models/gpt-4.1-mini

Fetched UTC: 2026-10-04T01:35:15.220626+00:00; raw SHA256 e61b8381180f9226e35f2c8afea723e06124c9d7dad45eecdb2d67f912172776.

```text
ModelsGPT-4.1 MiniDefaultSmaller, faster version of GPT-4.1Smaller, faster version of GPT-4.1CompareTry in PlaygroundIntelligenceHighSpeedFastPrice$0.4•$1.6Input•OutputInputText, ImageOutputText
GPT-4.1 Mini excels at instruction following and tool calling. It features a
1M token context window, and low latency without a reasoning step.

Note that we recommend starting with GPT-5 Mini for
more complex tasks.1,047,576 context window32,768 max output tokensJun 01, 2024 knowledge cutoffPricingPricing is based on the number of tokens used, or other metrics based on the model type. For tool-specific models, like search and computer use, there’s a fee per tool call. See details in the pricing page.Text tokensPer 1M tokens∙Batch API priceInput$0.40Cached input$0.10Output$1.60Quick comparisonInputCached inputOutputGPT-4.1 Mini$0.40GPT-5 Mini$0.25GPT-4o Mini$0.15ModalitiesTextInput and outputImageInput onlyAudioNot supportedVideoNot supportedEndpointsLivev1/live/sessionsChat Completionsv1/chat/completionsResponsesv1/responsesRealtimev1/realtimeRealtime translationv1/realtime/translationsRealtime transcriptionv1/realtime/transcription_sessionsAssistantsv1/assistantsBatchv1/batchFine-tuningv1/fine-tuningEmbeddingsv1/embeddingsImage generationv1/images/generationsVideosv1/videosImage editv1/images/editsSpeech generationv1/audio/speechTranscriptionv1/audio/transcriptionsTranslationv1/audio/translationsModerationv1/moderationsCompletions (legacy)v1/completionsFeaturesStreamingSupportedFunction callingSupportedStructured outputsSupportedFine-tuningSupportedPredicted outputsSupportedSnapshotsSnapshots let you lock in a specific version of the model so that performance and behavior remain consistent. Below is a list of all available snapshots and aliases for GPT-4.1 Mini.gpt-4.1-minigpt-4.1-mini-2025-04-14gpt-4.1-mini-2025-04-14
```

## openai-embedding model/pricing section

Source: https://developers.openai.com/api/docs/models/text-embedding-3-small

Fetched UTC: 2026-10-04T01:35:15.221156+00:00; raw SHA256 430081acdd5bdc6ccceebc7fe2243e22a1c3d7d8b000bac27063b9c8b90a65ce.

```text
Modelstext-embedding-3-smallDefaultSmall embedding modelSmall embedding modelComparePerformanceAverageSpeedMediumPrice$0.02CostInputTextOutputText
text-embedding-3-small is our improved, more performant version of our ada embedding model.
Embeddings are a numerical representation of text that can be used to measure the relatedness between two pieces of text.
Embeddings are useful for search, clustering, recommendations, anomaly detection, and classification tasks.PricingPricing is based on the number of tokens used, or other metrics based on the model type. For tool-specific models, like search and computer use, there’s a fee per tool call. See details in the pricing page.EmbeddingsPer 1M tokens∙Batch API priceCost$0.02Quick comparisonCosttext-embedding-3-large$0.13text-embedding-3-small$0.02ModalitiesTextInput and outputImageNot supportedAudioNot supportedVideoNot supportedEndpointsLivev1/live/sessionsChat Completionsv1/chat/completionsResponsesv1/responsesRealtimev1/realtimeRealtime translationv1/realtime/translationsRealtime transcriptionv1/realtime/transcription_sessionsAssistantsv1/assistantsBatchv1/batchFine-tuningv1/fine-tuningEmbeddingsv1/embeddingsImage generationv1/images/generationsVideosv1/videosImage editv1/images/editsSpeech generationv1/audio/speechTranscriptionv1/audio/transcriptionsTranslationv1/audio/translationsModerationv1/moderationsCompletions (legacy)v1/completionsSnapshotsSnapshots let you lock in a specific version of the model so that performance and behavior remain consistent. Below is a list of all available snapshots and aliases for text-embedding-3-small.text-embedding-3-smalltext-embedding-3-smalltext-embedding-3-small
```
