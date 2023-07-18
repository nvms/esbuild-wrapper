import { BuildOptions } from "esbuild";
import { StagedBuildOptions } from "./interface.js";
/**
 * stripHooks removes configuration properties that
 * don't fulfill esbuild's BuildOptions interface.
 */
export declare function stripHooks({ beforeAll, afterAll, build, runfile, watchPaths, index, injectArtifacts, port, reloadPort, ...rest }: StagedBuildOptions & {
    index?: string;
    port?: number;
    reloadPort?: number;
    injectArtifacts?: string[];
}): BuildOptions;
