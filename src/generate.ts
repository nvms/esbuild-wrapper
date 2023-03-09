import { existsSync, mkdirSync, renameSync, writeFileSync } from "fs";
import { execSync } from "node:child_process";
import prompts from "prompts";
import sortPackageJson from "sort-package-json";
import { info } from "./print.js";

function fVal(val: string | boolean): string {
  if (typeof val === "string") return `"${val}"`;
  return String(val);
}

function modes(platform: "browser"|"node", lang: "JavaScript"|"TypeScript", usetailwindcss: undefined | true): string {
  let out = `
  serveMode: {
    index: "public/index.html",
    build: ["main"],
    watchPaths: ["src/**/*.{${(lang === "JavaScript" ? "js,jsx" : "ts,tsx")}}", "public/index.html"],
    injectArtifacts: ["main"],${[usetailwindcss && `
    beforeAll: async () => await style(),`].filter(Boolean)}
  },
  runMode: {
    build: ["main"],
    watchPaths: ["src/**/*.{${(lang === "JavaScript" ? "js,jsx" : "ts,tsx")}}"],
    runfile: "dist/index.js",
  },
  watchMode: {
    build: ["main"],
    watchPaths: ["src/**/*.{${(lang === "JavaScript" ? "js,jsx" : "ts,tsx")}}"],
  },
  buildMode: {
    build: ["main", "mainCJS", "mainIIFE"],
    minify: true,
    minifyWhitespace: true,${[usetailwindcss && `
    beforeAll: async () => await style(),`].filter(Boolean)}
  }`;

  return out;
}

const configTemplate = ({
  platform = "browser",
  sourcemap = undefined,
  entrypoint = undefined,
  lang = "JavaScript",
  loader = undefined,
  usetailwindcss = undefined,
}) => {
    let out = "";
    if (usetailwindcss) {
      out += `
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import glob from "glob";
import cssminify from "postcss-minify";

async function style() {
  const old = glob.sync("public/css/**/*.css");
  for (const file of old) {
    try {
      unlinkSync(file);
    } catch (e) {}
  }

  const files = glob.sync("src/**/*.css");

  for (const file of files) {
    const filename = file.split("/").pop();
    const to = \`public/css/\${filename}\`;
    const css = readFileSync(file, "utf8");
    const result = await postcss([tailwindcss, autoprefixer, cssminify]).process(
      css,
      { from: file, to },
    );
    writeFileSync(to, result.css);
  }

  const cssFiles = glob.sync("public/css/**/*.css");
  const css = cssFiles.map((file) => readFileSync(file, "utf8")).join("\\n");
  writeFileSync("public/css/main.css", css);
}

`;
    }

    out += `export default {
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
  },${modes(platform as "browser"|"node", lang as "JavaScript"|"TypeScript", usetailwindcss)}
}
`;
  return out;
  };

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
      initial: (prev: "JavaScript" | "TypeScript") => {
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
      type: (prev: boolean) => prev === true ? "text" : null,
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
    },
    {
      type: (prev, values, prompt) => {
        if (values.platform === "browser") return "select";
        return null;
      },
      name: "usetailwindcss",
      message: "Do you want to use Tailwind CSS?",
      choices: [
        { title: "Yes", value: true },
        { title: "No", value: false },
      ],
    }
  ];

  // get the name of the current folder.
  const folder = process.cwd().split("/").pop();

  let pkg: any = {
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
  const response = await prompts(questions as any);

  // write the config file.
  writeFileSync("esbw.config.js", configTemplate(response));
  info("wrote esbw.config.js");

  // if package.json exists, move it to package.backup.json.
  if (existsSync("package.json")) {
    renameSync("package.json", "package.backup.json");
    info("package.json moved to package.backup.json");
  }

  // create folder "src".
  mkdirSync("src");

  if (response.usetailwindcss) {
    mkdirSync("src/style");
    writeFileSync("src/style/style.css", `@tailwind base;
@tailwind components;
@tailwind utilities;
`);
    writeFileSync("tailwind.config.cjs", `module.exports = {
  content: ["./src/**/*.{html,ts}", "./public/index.html"],
  theme: {
    extend: {

    },
  },
  plugins: [],
};`);

    writeFileSync("postcss.config.js", `module.exports = {
  plugins: {
    tailwindcss: {
      config: "./tailwind.config.cjs",
    },
    autoprefixer: {

    },
  },
};`);

    pkg.devDependencies = {
      ...pkg.devDependencies,
      "glob": "^8.1.0",
      "autoprefixer": "^10.4.13",
      "postcss": "^8.4.21",
      "postcss-minify": "^1.1.0",
      "tailwindcss": "^3.2.7"
    };

    mkdirSync("public");
    mkdirSync("public/css");
    writeFileSync("public/index.html", `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <link rel="stylesheet" href="public/css/main.css" />
</head>
<body>
  <div id="app"></div>
</body>
</html>
`);
  }


  // write pkg to package.json.
  writeFileSync("package.json", JSON.stringify(pkg, null, 2));
  info("wrote package.json");

  if (response.lang === "TypeScript") {
    const config = {
      compilerOptions: {
        rootDir: "./src",
        outDir: "./dist",
        module: "ESNext",
        target: "ESNext",
        lib: response.platform === "browser" ? ["DOM", "ESNext"] : ["ESNext"],
        declaration: true,
        declarationDir: "./types",
        resolveJsonModule: true,
        moduleResolution: "Node",
        allowSyntheticDefaultImports: true,
      },
      exclude: ["./types", response.platform === "browser" && "./public"].filter(Boolean),
      include: ["./src"],
    };

    writeFileSync("tsconfig.json", JSON.stringify(config, null, 2));
  }

  // prefer dependency installation with pnpm, but fallback to npm.
  if (which("pnpm")) {
    info("running 'pnpm install'");
    execSync("pnpm install");
  } else if (which("npm")) {
    info("running 'npm install'");
    execSync("npm install");
  }

  // create the file specified by response.entrypoint.
  writeFileSync(response.entrypoint, "");
}

function which(cmd: string): string | null {
  try {
    execSync(`${cmd} --help`);
    return cmd;
  } catch (e) {
    return null;
  }
}
