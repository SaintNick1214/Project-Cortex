/** Node-only graph service boundary. Browser runtime exports remain in ../client-runtime. */
export { CypherProjectionConnector, GraphConnectorError } from "./CypherProjectionConnector.js";
export type { CypherProjectionConnectorConfig, GraphFenceDiagnostics } from "./CypherProjectionConnector.js";
export { ConvexGraphWorkerTransport, CortexGraphWorker } from "./worker.js";
export type { ConvexGraphWorkerTransportOptions, CortexGraphWorkerOptions, GraphWorkerConnector, GraphWorkerIdentity,
  GraphWorkerStepResult, GraphWorkerTransport } from "./worker.js";
export type { GraphProjectionScope, GraphProjectionLeaseV1, GraphProjectionPayloadV1, GraphProjectionReceiptV1,
  GraphProjectionWorkV1, GraphExpansionWorkV1, GraphExpansionResultV1 } from "../../domain/graph-projection.js";
