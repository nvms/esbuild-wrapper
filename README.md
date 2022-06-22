A mostly unopinionated configuration wrapper for esbuild's build API.

What you get:

* A simple way to define multiple output targets with an intuitive configuration inheritance hierarchy. From least specific to most specific: `artifactsCommon` -> `artifacts[artifactName]` -> `watch`/`serve`/`build`/`run`. This will make more sense if you continue reading.
* Build hooks (`beforeAll` and `afterAll`) that are particularly useful for doing something like CSS preprocessing or copying static assets. Example of this below.

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
    minifyWhitespace:true,
    sourcemap: false,
  },
}
```

Above, an artifact named "main" is defined. The `main` object itself is just
an esbuild config (the `BuildOptions` interface -- [link to the interface](https://github.com/evanw/esbuild/blob/master/lib/shared/types.ts#L74-L137)).

The `serveMode` object optionally defines an html entrypoint where built artifacts
defined by `injectArtifacts` will be injected. `serveMode.build` is an array of artifacts
that should be built whenever changes are made.

Here's a slightly more involved configuration for a browser project that uses JSX.

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
  },
  artifacts: {
    esm: {
      format: "esm",
      entryPoints: ["./src/index.ts"],
      outfile: "./dist/index.esm.js",
    },
    cjs: {
      format: "cjs",
      entryPoints: ["./src/index.ts"],
      outfile: "./dist/index.cjs.js",
    },
    iife: {
      format: "iife",
      entryPoints: ["./src/index.ts"],
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

## artifactsCommon -> artifacts -> [mode]

In the above config, `artifactsCommon` is defined. This is expected to also be a `BuildOptions` object.
Options defined in `artifactsCommon` are spread to all defined artifacts.

The order in which these options are spread to
the final build output is, from least specific to most specific:

`artifactsCommon` -> `artifacts[<artifact>]` -> `[serve/run/build]Mode`.

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

