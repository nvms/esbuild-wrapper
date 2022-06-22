import chalk from "chalk";
export var LogType;
(function (LogType) {
    LogType[LogType["INFO"] = 0] = "INFO";
    LogType[LogType["WARN"] = 1] = "WARN";
    LogType[LogType["ERROR"] = 2] = "ERROR";
})(LogType || (LogType = {}));
;
export function finishedMessage(bundles, started) {
    logWithTime(`wrote ${bundles.length} artifact(s) in ${Date.now() - started}ms`);
}
export function logWithTime(message, logType = LogType.INFO) {
    const now = new Date();
    const t = `${(now.getHours() < 10 ? "0" : "") + now.getHours()}:${(now.getMinutes() < 10 ? "0" : "") + now.getMinutes()}:${(now.getSeconds() < 10 ? "0" : "") + now.getSeconds()}`;
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
export function warn(message) {
    return logWithTime(message, LogType.WARN);
}
export function error(message) {
    return logWithTime(message, LogType.ERROR);
}
export function info(message) {
    return logWithTime(message, LogType.INFO);
}
