/** Refuse missing/invalid dedicated targets before importing any live test module. */
import { configureCliTestEnvironment } from "./test-environment.js";
configureCliTestEnvironment(process.env, true);
