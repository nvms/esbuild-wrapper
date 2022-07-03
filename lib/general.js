import { watch as chokidarWatch } from "chokidar";
import { build as esbuildBuild } from "esbuild";
import FastGlob from "fast-glob";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { parseConfig } from "./parse.js";
import { error, finishedMessage, info, logWithTime } from "./print.js";
import { Server } from "./server.js";
import { stripHooks } from "./stripper.js";
export var Mode;
(function (Mode) {
    Mode["WATCH"] = "watchMode";
    Mode["SERVE"] = "serveMode";
    Mode["BUILD"] = "buildMode";
    Mode["RUN"] = "runMode";
})(Mode || (Mode = {}));
;
const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function general(mode) {
    const config = await parseConfig(mode);
    let builds = [];
    let artifacts = [];
    let start = null;
    const buildEmitter = new EventEmitter();
    const childPids = [];
    if (mode === Mode.SERVE) {
        new Server(config, buildEmitter);
    }
    function onBuild(started, hadError = false) {
        if (!hadError) {
            finishedMessage(artifacts, started);
        }
        if (mode === Mode.SERVE) {
            buildEmitter.emit("finished");
        }
    }
    function getEntrypoints(artifact) {
        let files = [];
        for (const entryPoint of artifact.entryPoints) {
            const f = FastGlob.sync(entryPoint);
            files = files.concat(...f);
        }
        if (files.length > 1 && artifact.outfile) {
            error(`Cannot specify "outfile" when there are multiple "entryPoints". Artifact "${artifact}"`);
            process.exit(1);
        }
        if (files.length > 1 && !artifact.outdir) {
            error(`When you have multiple entryPoints, you must specify an "outdir". Artifact "${artifact}"`);
            process.exit(1);
        }
        return files;
    }
    /**
     * Returns an array of paths that include all
     * artifact entryPoints as well as whatever is defined in
     * config[mode].watchPaths.
     *
     * {
     *   artifacts: {
     *     main: {
     *       entryPoints: ["src/main.ts"],
     *     },
     *     alt: {
     *       entryPoints: ["src/alt.ts"],
     *     }
     *   },
     *   serveMode: {
     *     watchPaths: ["src/**\/*.ts"]
     *   }
     * }
     *
     * Would return:
     * ["src/main.ts", "src/alt.ts", "src/**\/*.ts"]
     */
    function getWatchPaths() {
        let paths = [];
        // artifacts.map((b) => {
        //   (b.entryPoints as string[]).forEach((ep) => {
        //     if (!paths.includes(ep)) paths.push(ep);
        //   });
        // });
        // parse -> saneDefaults defines config[mode].build unless it's already defined.
        config?.[mode]?.build?.forEach((artifactName) => {
            paths = paths.concat(getEntrypoints(config.artifacts[artifactName]));
        });
        config?.[mode]?.watchPaths?.forEach((p) => {
            if (!paths.includes(p))
                paths.push(p);
        });
        return paths;
    }
    function useArtifacts() {
        const artifacts = {};
        if (mode === Mode.BUILD && config?.buildMode?.build) {
            config.buildMode.build.forEach((artifactName) => {
                artifacts[artifactName] = config.artifacts[artifactName];
            });
            return artifacts;
        }
        if (mode === Mode.WATCH && config?.watchMode?.build) {
            config.watchMode.build.forEach((artifactName) => {
                artifacts[artifactName] = config.artifacts[artifactName];
            });
            return artifacts;
        }
        if (mode === Mode.SERVE && config?.serveMode?.build) {
            config.serveMode.build.forEach((artifactName) => {
                artifacts[artifactName] = config.artifacts[artifactName];
            });
            return artifacts;
        }
        if (mode === Mode.RUN && config?.runMode?.build) {
            config.runMode.build.forEach((artifactName) => {
                artifacts[artifactName] = config.artifacts[artifactName];
            });
            return artifacts;
        }
        return config.artifacts;
    }
    function pidRunning(pid) {
        try {
            process.kill(pid, 0);
            return true;
        }
        catch (_) {
            return false;
        }
    }
    async function buildArtifacts() {
        builds = [];
        artifacts = [];
        start = Date.now();
        info("Building artifacts...");
        Object.keys(useArtifacts()).forEach((artifactName) => {
            const artifact = {
                ...config.artifactsCommon,
                ...config.artifacts[artifactName],
                ...stripHooks(mode === Mode.SERVE
                    ? config.serveMode
                    : mode === Mode.BUILD
                        ? config.buildMode
                        : mode === Mode.RUN
                            ? config.runMode
                            : config.watchMode),
                // required by artifactSize plugin
                metafile: true,
            };
            // Expansion of entryPoints using FastGlob so that
            // we can build many entrypoints easily.
            if (artifact?.entryPoints) {
                artifact.entryPoints = getEntrypoints(artifact);
            }
            if (mode === Mode.WATCH || mode === Mode.SERVE) {
                artifact.watch = false;
            }
            artifacts.push(artifact);
            builds.push(esbuildBuild(artifact));
            info(`Building artifact "${artifactName}".`);
        });
        try {
            await Promise.all(builds);
            onBuild(start);
        }
        catch (err) {
            error(err);
            onBuild(start, true);
        }
        start = null;
    }
    async function flow() {
        const modes = Object.values(Mode);
        modes.forEach(async (m) => {
            if (mode === m && config[m].beforeAll)
                await config[m].beforeAll();
        });
        await buildArtifacts();
        modes.forEach(async (m) => {
            if (mode === m && config[m].afterAll)
                await config[m].afterAll();
        });
        if (mode === Mode.RUN) {
            config?.runMode?.build?.forEach((artifactName) => {
                info(`Running artifact "${artifactName}".`);
                const runfile = config?.runMode?.runfile || config.artifacts[artifactName].outfile;
                const child = spawn(`node ${runfile}`, {
                    stdio: "inherit",
                    shell: true,
                });
                childPids.push(child.pid);
                logWithTime(`node ${runfile} -> pid ${child.pid}`);
                child.once("exit", (code) => {
                    logWithTime(`pid ${child.pid} exited with code ${code}`);
                    childPids.splice(childPids.indexOf(child.pid), 1);
                });
                const paths = getWatchPaths();
                const watcher = chokidarWatch(paths, {});
                watcher.once("change", async () => {
                    if (pidRunning(child.pid)) {
                        logWithTime(`sending SIGHUP to pid ${child.pid}`);
                        child.kill("SIGHUP");
                        // Give it a second to end itself.
                        for (let i = 0; i < 101; i++) {
                            if (childPids.includes(child.pid)) {
                                await sleep(10);
                            }
                            else {
                                break;
                            }
                        }
                        // If it's still alive after 1s, send SIGKILL.
                        if (childPids.includes(child.pid)) {
                            logWithTime(`pid ${child.pid} still alive for 1s after SIGHUP, sending SIGKILL..`);
                            child.kill("SIGKILL");
                        }
                    }
                });
            });
        }
    }
    await flow();
    if (mode !== Mode.BUILD) {
        const paths = getWatchPaths();
        const watcher = chokidarWatch(paths, {});
        watcher.on("change", async () => {
            if (mode === Mode.RUN) {
                while (childPids.length > 0) {
                    await sleep(10);
                }
            }
            await flow();
        });
    }
}
