/** Offline CLI suites have no implicit deployment or dotenv source. */
import { configureCliTestEnvironment } from "./helpers/test-environment.js";
configureCliTestEnvironment(process.env);
