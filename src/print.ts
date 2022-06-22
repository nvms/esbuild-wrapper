import chalk from "chalk";
import { BuildOptions } from "esbuild";

export enum LogType {
  INFO,
  WARN,
  ERROR
};

export function finishedMessage(bundles: BuildOptions[], started?: number) {
  logWithTime(`wrote ${bundles.length} artifact(s) in ${Date.now() - started}ms`)
}

export function logWithTime(message: string, logType: LogType = LogType.INFO) {
  const now = new Date();
  const t = `${(now.getHours()<10?"0":"")+now.getHours()}:${(now.getMinutes()<10?"0":"")+now.getMinutes()}:${(now.getSeconds()<10?"0":"")+now.getSeconds()}`;

  switch (logType) {
    case LogType.INFO:
      console.log(`${chalk.dim(t)}: ${message}`);
      break;
    case LogType.WARN:
      console.log(`${chalk.dim(t)}: ${chalk.yellow(message)}`);
      break;
    case LogType.ERROR:
      console.log(`${chalk.dim(t)}: ${chalk.red(message)}`);
      break;
  }
}

export function warn(message: string) {
  return logWithTime(message, LogType.WARN);
}

export function error(message: string) {
  return logWithTime(message, LogType.ERROR);
}

export function info(message: string) {
  return logWithTime(message, LogType.INFO);
}
