/**
 * stripHooks removes configuration properties that
 * don't fulfill esbuild's BuildOptions interface.
 */
export function stripHooks(opts) {
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
