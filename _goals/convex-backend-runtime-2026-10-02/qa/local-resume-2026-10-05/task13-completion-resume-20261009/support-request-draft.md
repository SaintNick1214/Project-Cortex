# Convex asynchronous-video enablement request — draft

This request is prepared for review. It has not been sent.

Subject: Enable AI Gateway asynchronous video for disposable Cortex development qualification

We are implementing a Cortex backend runtime using the official Convex AI Gateway and @convex-dev/ai-sdk-provider 0.2.1 with AI SDK 7. Async video submission has returned HTTP 503: “Asynchronous video generation is not configured.” The current official documentation directs us to contact Convex support for this response.

Please enable asynchronous video for our disposable development qualification environment, or identify the exact supported setup required. We need experimental_startVideo/doStart, saved-operation getStatus/download, and signed callbacks to the deployment's own HTTPS convex.site origin. Linked-local tests will omit webhookUrl and poll the saved operation.

Our Convex team is 325340. The retained media qualification development project is 3174742, deployment formal-husky-914; read-only ownership verification on 2026-10-09 at 21:53:50Z confirmed it is the team’s sole cloud development deployment. No production environment is requested. If enablement is team-wide rather than deployment-specific, please confirm that scope.

We will submit fresh governed requests with retries disabled, keep webhook secrets private, and download output promptly into private Convex storage with a 20,000,000-byte Cortex cap. Historical uncertain operations will not be resubmitted. No deploy keys, access tokens, JWTs or webhook secrets are included in this request.

Reference: https://docs.convex.dev/ai-gateway/images-and-videos#async-videos
