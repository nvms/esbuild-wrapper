import { existsSync } from "node:fs";
import { join } from "node:path";
import { Mode } from "./general.js";
import { error, warn } from "./print.js";
function validateConfig(config, mode) {
    Object.keys(config?.artifacts)?.forEach((artifactName) => {
        if (!config?.artifactsCommon.format && !["esm", "cjs", "iife"].includes(config.artifacts[artifactName].format))
            throw new Error(`invalid 'format' for bundle '${artifactName}'. got "${config.artifacts[artifactName].format}", expected one of 'esm', 'cjs', 'iife'`);
    });
    if (mode === Mode.SERVE) {
        if (config.serveMode?.index && !existsSync(config.serveMode.index)) {
            warn(`config: serveMode.index was defined as "${config.serveMode.index}" but was not found on the filesystem`);
        }
        if (!config?.serveMode?.injectArtifacts?.length) {
            warn(`config: serveMode.injectArtifacts empty. defaulting to injecting all artifacts.`);
        }
        if (config?.serveMode?.injectArtifacts?.length) {
            for (const artifactName of config.serveMode.injectArtifacts) {
                if (!config.artifacts?.[artifactName]) {
                    throw new Error(`unknown artifact in serveMode.injectArtifacts: "${artifactName}"`);
                }
                if (!config.artifacts[artifactName]?.outfile) {
                    throw new Error(`injected artifact "${artifactName}" must specify an outfile`);
                }
            }
        }
    }
    ["buildMode", "watchMode", "serveMode", "runMode"].forEach((mode) => {
        config?.[mode]?.artifacts?.forEach((artifactName) => {
            if (!config?.artifacts?.[artifactName])
                throw new Error(`unknown artifact in ${mode}.artifacts: "${artifactName}"`);
        });
    });
}
function saneDefaults(c) {
    function def(fn, v) {
        let out = v;
        try {
            out = fn();
            if (typeof out === "undefined")
                return v;
        }
        catch (e) { }
        return out;
    }
    c.artifacts = c.artifacts ?? {};
    c.artifactsCommon = c.artifactsCommon ?? {};
    c.buildMode = c.buildMode ?? {};
    c.serveMode = c.serveMode ?? {};
    c.watchMode = c.watchMode ?? {};
    c.runMode = c.runMode ?? {};
    c.serveMode = c.serveMode || {};
    c.serveMode.index = def(() => c.serveMode.index, "public/index.html");
    c.serveMode.injectArtifacts = def(() => c.serveMode.injectArtifacts, Object.keys(c.artifacts));
    ["serveMode", "runMode", "watchMode", "buildMode"].forEach((mode) => {
        c[mode].build = def(() => c[mode].build, Object.keys(c.artifacts));
    });
    return c;
}
export async function parseConfig(mode) {
    const p = join(process.cwd(), "esbw.config.js");
    if (!existsSync(p)) {
        error(`Couldn't find esbw.config.js in ${process.cwd()}`);
        process.exit(1);
    }
    const module = await import(p);
    const config = module.default;
    validateConfig(config, mode);
    return saneDefaults(config);
}
