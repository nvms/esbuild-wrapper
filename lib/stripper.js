/**
 * stripHooks removes configuration properties that
 * don't fulfill esbuild's BuildOptions interface.
 */
export function stripHooks({ beforeAll, afterAll, build, runfile, watchPaths, index, injectArtifacts, port, reloadPort, ...rest }) {
    return rest;
}
