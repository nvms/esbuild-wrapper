export declare enum Mode {
    WATCH = "watchMode",
    SERVE = "serveMode",
    BUILD = "buildMode",
    RUN = "runMode"
}
export declare function general(mode: Mode): Promise<void>;
