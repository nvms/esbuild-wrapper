#!/usr/bin/env node

import { general, Mode } from "./general.js";
import { generate } from "./generate.js";
import { error } from "./print.js";

function usage() {
  return `esbuild-wrapper

Usage:
  esbuild-wrapper [command]

Commands:
  build       create artifacts
  watch       watch files and create artifacts on change
  serve       same as watch, but with a livereload dev server
  run         same as watch, but runs an artifact after build
  generate    scaffold a config`;
}

const command = process.argv[2];

async function executeCommand(command: string) {
  try {
    switch (command) {
      case "build":
        await general(Mode.BUILD);
        break;
      case "watch":
        await general(Mode.WATCH);
        break;
      case "serve":
        await general(Mode.SERVE);
        break;
      case "run":
        await general(Mode.RUN);
        break;
      case "generate":
        await generate();
        break;
      default:
        console.log(usage());
        return;
    }
  } catch (e) {
    error(e);
    process.exit(1);
  }
}

async function main() {
  await executeCommand(command);
}

main();

