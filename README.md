A mostly unopinionated configuration wrapper for esbuild's build API, and a really fast way to get started with a new project.

The quickest way to get started:

```bash
cd my-new-project
npx esbuild-wrapper generate
```

This will ask you a few questions before scaffolding out a project in the current working directory. When it's done, take a look at the generated `package.json` and `esbw.config.js` to see how things fit together. Run it again with different prompt answers to get a feel for what it's doing.

What you get:

* Four operating modes: build, run, watch and serve.
* A simple way to define multiple output targets with an intuitive configuration inheritance hierarchy for each of these run modes.
* Async `beforeAll` and `afterAll` hooks for all operating modes (build, watch, run and serve) which are particularly useful for doing things like CSS preprocessing and copying static assets. Use `esbuild-wrapper generate` and create a browser project and select TailwindCSS when prompted for an example of exactly this.

Create an `esbw.config.js` that fulfills the `ESBWConfig` interface:

```typescript
export interface StagedBuildOptions extends BuildOptions {
  /** Called before all artifacts are built. */
  beforeAll?: () => Promise<void>;
  /** Called after all artifacts are built. */
  afterAll?: () => Promise<void>;

  /**
   * Array of `artifactName`s. If defined, only these artifacts
   * will be built. If not defined, all artifacts are built.
   *
   * For example, you may only need to build one artifact during
   * `serveMode` or `watchMode`, but during `buildMode`, build all artifacts.
   */
  build?: string[];

  /**
   * Applicable to 'run' mode.
   * What file to run after building all outfiles.
   */
  runfile?: string;

  /**
   * Applicable to all modes except 'buildMode'.
   * Accepts regular expressions.
   * Files that pattern match trigger rebuild.
   */
  watchPaths?: string[];
}

export interface ESBWConfig {
  /**
   * Least-specific BuildOptions.
   * These are spread to all defined output artifacts.
   */
  artifactsCommon?: BuildOptions;

  /**
   * Artifact-specific BuildOptions.
   * 
   * Takes priority over `artifactsCommon` BuildOptions.
   * Object key is an arbitrary "artifactName" that can be used
   * as an artifact reference by things like 'server'.
   */
  artifacts?: {
    [artifactName: string]: BuildOptions;
  };

  /**
   * BuildOptions applied to all artifacts when building
   * with `esbuild-wrapper build`,
   * 
   * Takes priority over artifacts[artifactName].
   */
  buildMode?: StagedBuildOptions;

  /**
   * BuildOptions applied to all artifacts when serving
   * with `esbuild-wrapper serve`,
   * 
   * Takes priority over artifacts[artifactName].
   */
  serveMode?: StagedBuildOptions & {
    index?: string;
    injectArtifacts?: string[];
    port?: number;
  }

  /**
   * BuildOptions applied to all artifacts when watching
   * with `esbuild-wrapper watch`,
   * 
   * Takes priority over artifacts[artifactName].
   */
  watchMode?: StagedBuildOptions;

  /**
   * BuildOptions applied to all artifacts when watching
   * with `esbuild-wrapper run`,
   *
   * Accepts a `runfile` which is a path to a file that
   * will be executed after a rebuild.
   * 
   * Takes priority over artifacts[artifactName].
   */
  runMode?: StagedBuildOptions;
}
```

## Configuration hierarchy

`artifactsCommon` -> `artifacts` -> `serve/run/build/watchMode`

1. `artifactsCommon` is of type `BuildOptions`. The configuration defined here is applied to all
defined artifacts in `artifacts`.
2. `artifacts` is an object of shape `{ [artifactName: string]: BuildOptions }`, and these configurations
are prioritized over the ones defined in `artifactsCommon`.
3. Finally, each mode accepts a `StagedBuildOptions` which is even higher priority than the configurations
defined in `artifacts`.

A basic config when creating for the browser might look like this:

```javascript
// esbw.config.js
export default {
  artifacts: {
    main: {
      platform: "browser",
      bundle: true,
      format: "esm",
      entryPoints: ["./src/index.ts"],
      outfile: "./dist/index.js",
     },
  },
  serveMode: {
    index: "public/index.html",
    injectArtifacts: ["main"],
    build: ["main"],
  },
  buildMode: {
    minify: true,
    minifyWhitespace: true,
    sourcemap: false,
  },
}
```

Because this is a fairly simple project with only one defined output artifact, there's no need
to define an `artifactsCommon`.

The `serveMode` object optionally defines an html entrypoint where built artifacts
defined by `injectArtifacts` will be injected. `serveMode.build` is an array of artifacts
that should be built whenever changes are made.

Here's a slightly more involved configuration for a browser project that uses a custom JSX pragma, where esbuild shims the import for the
pragma into each outfile file automatically.

```javascript
// esbw.config.js
import { readFileSync } from "fs";
import path from "path";

const pkg = JSON.parse(readFileSync(path.resolve("./package.json")));

export default {
  artifactsCommon: {
    platform: "browser",
    bundle: true,
    loader: { ".ts": "tsx" },
    inject: ["./pragma-shim.js"],
    jsxFactory: "h",
    jsxFragment: "Fragment",
    entryPoints: ["./src/index.ts"],
  },
  artifacts: {
    esm: {
      format: "esm",
      outfile: "./dist/index.esm.js",
    },
    cjs: {
      format: "cjs",
      outfile: "./dist/index.cjs.js",
    },
    iife: {
      format: "iife",
      outfile: "./dist/index.iife.js",
    },
  },
  serveMode: {
    index: "public/index.html",
    minify: false,
    minifyWhitespace: false,
    injectArtifacts: ["esm"],
    watchPaths: ["./src/**/*.ts"],
    build: ["esm"]
  },
  watchMode: {
    external: ["mir"],
    minify: true,
    minifyWhitespace: true,
    watchPaths: ["./src/**/*.ts"],
    build: ["esm"]
  },
  buildMode: {
    external: ["mir"],
    build: ["esm", "cjs", "iife"],
    banner: {
      js: `// ${pkg.name} ${pkg.version}`,
    },
  },
};

// pragma-shim.js
import { h, Fragment } from "mir";
export { h, Fragment };
```

An example node project:

```javascript
export default {
  artifactsCommon: {
    platform: "node",
    bundle: true,
  },
  artifacts: {
    esm: {
      format: "esm",
      entryPoints: ["./src/index.ts"],
      outfile: "./dist/index.esm.js",
    },
  },
  runMode: {
    build: ["esm"],
    watchPaths: ["./src/**/*.ts"],
    runfile: "./test.js",
  },
  buildMode: {
    minify: true,
    minifyWhitespace: true,
  }
}
```

In the above config, `runMode` defines a `runfile` that will be called with `node <runfile>` after
the "esm" artifact is built.

# `beforeAll` and `afterAll`

`beforeAll` is handy if you need to do something before all artifacts
are generated by esbuild, like processing styles with PostCSS as in the example below.

```javascript
async function style() {
  const from = "src/style/style.css";
  const to = "public/css/style.css";
  const css = readFileSync(from);
  const result = await postcss([tailwindcss, autoprefixer]).process(css, { from, to });
  writeFileSync(to, result.css);
}

export default {
  serveMode: {
    index: "public/index.html",
    build: ["esm"],
    watchPaths: ["./src/**/*.ts"],
    beforeAll: async () => await style(),
  },
  artifacts: {
    esm: {
      bundle: true,
      entryPoints: ["./src/index.tsx"],
      outfile: "./dist/index.esm.js",
    }
  },
}
```

# Serving

The `index.html` pointed to by `serveMode.index` doesn't need to explicitly include a path to any outfile, that's the point of the `serveMode.injectArtifacts` option. The `outfile` of the referenced artifact is automatically injected during `esbuild-wrapper serve`.

In other words, if `serveMode.injectArtifacts` is `["esm"]`, `artifacts.esm.outfile` gets
injected onto the page.

