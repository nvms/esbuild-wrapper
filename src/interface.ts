import { BuildOptions } from "esbuild";

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
