export default {
  artifactsCommon: {
    bundle: true,
    platform: "browser",
    sourcemap: true,
  },
  artifacts: {
    main: {
      format: "esm",
      entryPoints: ["src/index.ts"],
      outfile: "dist/index.js",
    },
    mainCJS: {
      format: "cjs",
      entryPoints: ["src/index.ts"],
      outfile: "dist/index.cjs.js",
    },
    mainIIFE: {
      format: "iife",
      entryPoints: ["src/index.ts"],
      outfile: "dist/index.iife.js",
    },
  },
  serveMode: {
    watchPaths: ["src/**/*.{ts,tsx}"],
    injectArtifacts: ["main"],
  },
}
