import base from "../../../../../jest.config.mjs";
export default { ...base, rootDir: new URL("../../../../../", import.meta.url).pathname, setupFiles: [], setupFilesAfterEnv: [], reporters: ["default"], coverageThreshold: undefined };
