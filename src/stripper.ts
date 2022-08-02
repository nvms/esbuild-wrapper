import { BuildOptions } from "esbuild";
import { StagedBuildOptions } from "./interface.js";

/**
 * stripHooks removes configuration properties that
 * don't fulfill esbuild's BuildOptions interface.
 */
export function stripHooks(
  opts: StagedBuildOptions & {
    index?: string;
    port?: number;
    injectArtifacts?: string[];
  }
): BuildOptions {
  const n = { ...opts };
  delete n.beforeAll;
  delete n.afterAll;
  delete n.build;
  delete n.runfile;
  delete n.watchPaths;
  delete n.index;
  delete n.injectArtifacts;
  delete n.port;
  return n;
}
