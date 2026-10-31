# Draft support target — not sent

Please confirm how asynchronous AI Gateway video generation can be enabled for our owned disposable development deployment, and whether the enablement applies to this deployment, project, team, or another Gateway configuration scope.

- Team: 325340. Project: 3174742 (`cortex-task10-embedding-v2-fe3a2599d6fd`).
- Cloud dev deployment: `formal-husky-914`; ownership and nonproduction identity verified at 2026-10-09T21:53:50.735Z.
- Deployment origin: https://formal-husky-914.convex.cloud
- Owned HTTPS callback origin: https://formal-husky-914.convex.site
- Installed provider contract used by the historical request: `@convex-dev/ai-sdk-provider` 0.2.1, VideoModelV4 `doStart`, `google/veo-3.1`, one video, four seconds, 720p, audio disabled, no retries.
- Historical response: HTTP 503, “Asynchronous video generation is not configured”. The request has not been repeated.

The [official async-video documentation](https://docs.convex.dev/ai-gateway/images-and-videos#async-videos) directs this error to Convex support. It does not document an enablement toggle or its configuration granularity. Please confirm the required enablement and any requirements for a signed callback to the owned HTTPS origin.

This draft contains no tokens, deployment keys, private operation handles, webhook secrets, or asset URLs. No support message was sent by this task.
