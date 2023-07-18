import { Mode } from "./general.js";
import { ESBWConfig } from "./interface.js";
/**
 * Parses the ESBWConfig file and returns the configuration object.
 * @param mode The mode to validate the config against.
 * @returns The parsed ESBWConfig object.
 * @throws An error if the ESBWConfig file is not found or if the config fails validation.
 */
export declare function parseConfig(mode: Mode): Promise<ESBWConfig>;
