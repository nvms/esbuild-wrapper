#!/usr/bin/env node
import { general, Mode } from "./general";
import { generate } from "./generate";
import { error } from "./print";
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
async function main() {
    switch (command) {
        case "init":
            break;
        case "build":
            try {
                await general(Mode.BUILD);
            }
            catch (e) {
                error(e);
                process.exit(1);
            }
            break;
        case "watch":
            try {
                await general(Mode.WATCH);
            }
            catch (e) {
                error(e);
                process.exit(1);
            }
            break;
        case "serve":
            try {
                await general(Mode.SERVE);
            }
            catch (e) {
                error(e);
                process.exit(1);
            }
            break;
        case "run":
            try {
                await general(Mode.RUN);
            }
            catch (e) {
                error(e);
                process.exit(1);
            }
            break;
        case "generate":
            try {
                await generate();
            }
            catch (e) {
                error(e);
                process.exit(1);
            }
            break;
        default:
            console.log(usage());
            break;
    }
}
main();
