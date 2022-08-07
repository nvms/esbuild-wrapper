import { BuildOptions } from "esbuild";
import { StagedBuildOptions } from "./interface.js";
/**
 * stripHooks removes configuration properties that
 * don't fulfill esbuild's BuildOptions interface.
 */
export declare function stripHooks(opts: StagedBuildOptions & {
    index?: string;
    port?: number;
    reloadPort?: number;
    injectArtifacts?: string[];
}): BuildOptions;
