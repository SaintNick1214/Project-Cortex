/** Refuse missing/invalid explicit target before importing any live test module. */
import { configureCliTestEnvironment, configureCliRuntimeTestEnvironment } from "./test-environment.js";
if (process.env.CORTEX_TEST_ENV_MODE === "explicit" && process.env.CORTEX_TEST_FIXTURE) configureCliRuntimeTestEnvironment(process.env);
else configureCliTestEnvironment(process.env, true);
