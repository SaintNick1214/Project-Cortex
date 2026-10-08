import { httpRouter } from "convex/server";
import { uploadAsset, downloadAsset, assetOptions } from "./runtimeAssetsHttp";
const http = httpRouter();
http.route({ path: "/cortex/assets/upload", method: "POST", handler: uploadAsset });
http.route({ path: "/cortex/assets/download", method: "GET", handler: downloadAsset });
http.route({ path: "/cortex/assets/upload", method: "OPTIONS", handler: assetOptions });
http.route({ path: "/cortex/assets/download", method: "OPTIONS", handler: assetOptions });
export default http;
