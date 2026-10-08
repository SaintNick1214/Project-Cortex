import config from '/workspace/Project-Cortex/jest.config.mjs';
const base='/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-composition-c1-review/subject-copy';
export default {...config,rootDir:'/workspace/Project-Cortex',roots:[base+'/copies'],setupFiles:[base+'/setup.mjs'],setupFilesAfterEnv:[],reporters:['default'],cacheDirectory:base+'/cache',testPathIgnorePatterns:['/node_modules/']};
