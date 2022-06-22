import { BuildOptions } from "esbuild";
export declare enum LogType {
    INFO = 0,
    WARN = 1,
    ERROR = 2
}
export declare function finishedMessage(bundles: BuildOptions[], started?: number): void;
export declare function logWithTime(message: string, logType?: LogType): void;
export declare function warn(message: string): void;
export declare function error(message: string): void;
export declare function info(message: string): void;
