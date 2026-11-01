/** Explicit live runtime selection; offline suites have no ambient deployment or dotenv source. */
import { configureCliTestEnvironment, configureCliRuntimeTestEnvironment } from "./helpers/test-environment.js";
if (process.env.CORTEX_TEST_ENV_MODE === "explicit" && process.env.CORTEX_TEST_FIXTURE) configureCliRuntimeTestEnvironment(process.env);
else configureCliTestEnvironment(process.env);
