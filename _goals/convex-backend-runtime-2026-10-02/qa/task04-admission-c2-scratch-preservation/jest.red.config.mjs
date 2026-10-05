import base from "./jest.config.mjs";
export default {...base,moduleNameMapper:{...{"^(?:\\.\\./){3}convex-dev/runtimeModelPolicy$": "<rootDir>/work/resume/task04-admission-implementation-c2/c1-mirror/runtimeModelPolicy.ts", "^\\./(_generated/.*|runtime.*)$": "<rootDir>/convex-dev/$1", "^\\.\\./src/(.*)$": "<rootDir>/src/$1"},...base.moduleNameMapper}};
