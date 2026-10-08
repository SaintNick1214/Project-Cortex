import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible, } from "@ai-sdk/openai-compatible";
import { defaultSettingsMiddleware, wrapEmbeddingModel, wrapLanguageModel, } from "ai";
import { getServiceToken } from "convex/server";
import { createEvaluationModel } from "./evaluation-model.js";
import { createVideoModel } from "./video-model.js";
const maxEmbeddingsPerCall = 512;
// Official providers require a credential before gatewayFetch replaces it with a deployment JWT.
const placeholderCredential = "convex-gateway";
/**
 * A deployment can set `CONVEX_INTERNAL_AI_GATEWAY_HOST` to reach a different
 * gateway, which is how internal apps use staging.
 */
const productionGatewayHost = "https://ai-gateway.convex.dev";
function gatewayBaseURL(version = "v1") {
    return `${process.env.CONVEX_INTERNAL_AI_GATEWAY_HOST || productionGatewayHost}/${version}`;
}
async function gatewayFetch(input, init) {
    const token = await getServiceToken("ai-gateway");
    const headers = new Headers(init?.headers);
    // Deployment JWT is the only accepted credential for the hosted gateway.
    headers.set("Authorization", `Bearer ${token}`);
    return globalThis.fetch(input, { ...init, headers });
}
// The SDK's standard usage mapping omits the gateway's dollar costs.
function convexGatewayUsageMetadata(usage) {
    if (!usage || typeof usage !== "object")
        return undefined;
    const { cost, cost_details } = usage;
    const metadata = {};
    if (typeof cost === "number")
        metadata.cost = cost;
    if (cost_details && typeof cost_details === "object") {
        metadata.costDetails = cost_details;
    }
    return Object.keys(metadata).length > 0
        ? { convexGateway: metadata }
        : undefined;
}
const costMetadataExtractor = {
    extractMetadata: async ({ parsedBody }) => convexGatewayUsageMetadata(parsedBody?.usage),
    createStreamExtractor: () => {
        // Streamed responses deliver usage (incl. cost) on the final chunk.
        let usage;
        return {
            processChunk(parsedChunk) {
                const chunk = parsedChunk;
                if (chunk?.usage)
                    usage = chunk.usage;
            },
            buildMetadata: () => convexGatewayUsageMetadata(usage),
        };
    },
};
function createGatewayProvider() {
    return createOpenAICompatible({
        name: "convexGateway",
        baseURL: gatewayBaseURL(),
        fetch: gatewayFetch,
        metadataExtractor: costMetadataExtractor,
        supportsStructuredOutputs: true,
        supportedUrls: () => ({ "image/*": [/^https?:\/\/.*$/] }),
    });
}
function sdkModelId(gatewayModelId, provider) {
    const prefix = `${provider}/`;
    const modelId = gatewayModelId.startsWith(prefix)
        ? gatewayModelId.slice(prefix.length)
        : gatewayModelId;
    // OpenRouter uses dots in Anthropic versions; the Anthropic SDK's capability lookup uses hyphens.
    return provider === "anthropic" ? modelId.replaceAll(".", "-") : modelId;
}
function gatewayModelFetch(gatewayModelId, input, init) {
    const body = JSON.parse(init?.body);
    body.model = gatewayModelId;
    return gatewayFetch(input, { ...init, body: JSON.stringify(body) });
}
function gatewayLanguageModel(modelId, model, middleware) {
    return wrapLanguageModel({
        model,
        modelId,
        // The gateway does not expose the providers' batch APIs.
        middleware: middleware ?? { specificationVersion: "v4" },
    });
}
/**
 * The recommended model interface for text generation through the Convex AI gateway.
 * Use `messages` or `responses` only for endpoint-specific features.
 *
 * `getServiceToken` caches and refreshes credentials within the current action,
 * so calling this more than once in the same action is fine.
 */
export function convexGateway(modelId) {
    return createGatewayProvider()(modelId);
}
convexGateway.messages = function (modelId) {
    const provider = createAnthropic({
        name: "convexGateway.messages",
        baseURL: gatewayBaseURL(),
        authToken: placeholderCredential,
        fetch: (input, init) => gatewayModelFetch(modelId, input, init),
    });
    return gatewayLanguageModel(modelId, provider.messages(sdkModelId(modelId, "anthropic")));
};
convexGateway.responses = function (modelId) {
    const provider = createOpenAI({
        name: "convexGateway.responses",
        baseURL: gatewayBaseURL(),
        apiKey: placeholderCredential,
        fetch: (input, init) => gatewayModelFetch(modelId, input, init),
    });
    return gatewayLanguageModel(modelId, provider.responses(sdkModelId(modelId, "openai")), defaultSettingsMiddleware({
        settings: { providerOptions: { openai: { store: false } } },
    }));
};
/** Evaluate typed questions through the alpha Decisions API. */
convexGateway.evaluationModel = function (modelId) {
    return createEvaluationModel(modelId, gatewayBaseURL("alpha"), gatewayFetch, convexGatewayUsageMetadata);
};
convexGateway.embeddingModel = function (modelId) {
    return wrapEmbeddingModel({
        model: createGatewayProvider().embeddingModel(modelId),
        middleware: {
            specificationVersion: "v4",
            overrideMaxEmbeddingsPerCall: () => maxEmbeddingsPerCall,
        },
    });
};
/** Image model for the AI SDK's `generateImage`. */
convexGateway.imageModel = function (modelId) {
    return createGatewayProvider().imageModel(modelId);
};
/** Video generation for the AI SDK's `experimental_generateVideo`. */
convexGateway.videoModel = function (modelId) {
    return createVideoModel(modelId, gatewayBaseURL(), gatewayFetch, convexGatewayUsageMetadata);
};
export { verifyVideoWebhook } from "./video-webhook.js";
//# sourceMappingURL=index.js.map