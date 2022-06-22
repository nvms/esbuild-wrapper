import { existsSync, mkdirSync, renameSync, writeFileSync } from "fs";
import { execSync } from "node:child_process";
import prompts from "prompts";
import sortPackageJson from "sort-package-json";
import { info } from "./print";
function fVal(val) {
    if (typeof val === "string")
        return `"${val}"`;
    return String(val);
}
function modes(platform, lang) {
    // if platform is "browser", return a serveMode object.
    let out = "browser" ? `
  serveMode: {
    watchPaths: ["src/**/*.{${(lang === "JavaScript" ? "js,jsx" : "ts,tsx")}}"],
    injectArtifacts: ["main"],
  },` : `
  runMode: {
    watchPaths: ["src/**/*.{${(lang === "JavaScript" ? "js,jsx" : "ts,tsx")}}"],
    runfile: "dist/index.js",
  },`;
    out += `
  buildMode: {
    build: ["main", "mainCJS", "mainIIFE"],
  },`;
    return out;
}
const configTemplate = ({ platform = "browser", sourcemap = undefined, entrypoint = undefined, lang = "JavaScript", loader = undefined, }) => `export default {
  artifactsCommon: {
    bundle: true,
    platform: "${platform === "browser" ? "browser" : "node"}",${[loader && (lang === "JavaScript" ? "\n    loader: { \".js\": \"jsx\" }," : "\n    loader: { \".ts\": \"tsx\" },")].filter(Boolean)}
    ${(sourcemap && `sourcemap: ${fVal(sourcemap)},`)}
  },
  artifacts: {
    main: {
      format: "esm",
      entryPoints: [${(entrypoint && fVal(entrypoint))}],
      outfile: "dist/index.js",
    },
    mainCJS: {
      format: "cjs",
      entryPoints: [${(entrypoint && fVal(entrypoint))}],
      outfile: "dist/index.cjs.js",
    },
    mainIIFE: {
      format: "iife",
      entryPoints: [${(entrypoint && fVal(entrypoint))}],
      outfile: "dist/index.iife.js",
    },
  },${modes(platform, lang)}
}
`;
export async function generate() {
    const questions = [
        {
            type: "select",
            name: "lang",
            message: "Is this a TypeScript or JavaScript project?",
            choices: [
                { title: "TypeScript", value: "TypeScript" },
                { title: "JavaScript", value: "JavaScript" },
            ],
        },
        {
            type: "text",
            name: "entrypoint",
            message: "What's the entrypoint?",
            initial: (prev) => {
                return prev === "JavaScript" ? "src/index.js" : "src/index.ts";
            }
        },
        {
            type: "select",
            name: "platform",
            message: "Will this run in the browser, or in node?",
            choices: [
                { title: "browser", value: "browser" },
                { title: "node", value: "node" },
            ],
        },
        {
            type: "confirm",
            name: "customPragma",
            message: "Do you need to define a custom JSX factory (default is React.createElement)?",
            initial: false,
        },
        {
            type: (prev) => prev === true ? "text" : null,
            name: "jsxFactory",
            message: "What's the JSX factory?",
            initial: "h"
        },
        {
            type: "confirm",
            name: "loader",
            message: "Do you want to use the JSX/TSX loader for JS/TS files?",
            initial: false,
        },
        {
            type: "select",
            name: "sourcemap",
            message: "Sourcemaps?",
            choices: [
                { title: "linked", value: true },
                { title: "inline", value: "inline" },
                { title: "external", value: "external" },
                { title: "inline and external", value: "both" },
                { title: "none", value: false },
            ],
        }
    ];
    // get the name of the current folder.
    const folder = process.cwd().split("/").pop();
    let pkg = {
        name: `${folder}`,
        version: "0.0.1",
        description: "",
        type: "module",
        main: "dist/index.js",
        scripts: {
            "serve": "esbuild-wrapper serve",
            "run": "esbuild-wrapper run",
            "build": "esbuild-wrapper build",
        },
        devDependencies: {
            "esbuild-wrapper": "github:nvms/esbuild-wrapper",
        }
    };
    const email = execSync("git config --global user.email").toString().trim();
    const name = execSync("git config --global user.name").toString().trim();
    // if we have an email and name, build an author string.
    if (email && name) {
        pkg.author = `${name} <${email}>`;
    }
    // using sort-package-json, sort pkg.
    pkg = sortPackageJson(pkg);
    // get the answers.
    const response = await prompts(questions);
    // write the config file.
    writeFileSync("esbw.config.js", configTemplate(response));
    info("wrote esbw.config.js");
    // if package.json exists, move it to package.backup.json.
    if (existsSync("package.json")) {
        renameSync("package.json", "package.backup.json");
        info("package.json moved to package.backup.json");
    }
    // write pkg to package.json.
    writeFileSync("package.json", JSON.stringify(pkg, null, 2));
    info("wrote package.json");
    // prefer dependency installation with pnpm, but fallback to npm.
    if (which("pnpm")) {
        info("running 'pnpm install'");
        execSync("pnpm install");
    }
    else if (which("npm")) {
        info("running 'npm install'");
        execSync("npm install");
    }
    // create folder "src".
    mkdirSync("src");
    // create the file specified by response.entrypoint.
    writeFileSync(response.entrypoint, "");
}
function which(cmd) {
    try {
        execSync(`${cmd} --help`);
        return cmd;
    }
    catch (e) {
        return null;
    }
}
