/// <reference types="node" />
import { EventEmitter } from "node:events";
import { Server as HttpServer, ServerResponse } from "node:http";
import { ESBWConfig } from "./interface.js";
export declare class Server {
    config: ESBWConfig;
    buildEmitter: EventEmitter;
    reloadPort: any;
    reloadServer: HttpServer;
    server: HttpServer;
    title: string;
    constructor(config: ESBWConfig, buildEmitter: EventEmitter);
    serve(): void;
    bundleInjection(): string;
    sseInjection(): string;
    sendIndexTemplate(res: ServerResponse): void;
    sendFile(res: ServerResponse, resource: string, status: number, data: string, ext: string): void;
    sendError(res: ServerResponse, resource: string, code: number): void;
    reload(res: ServerResponse, channel: string, message: string): void;
    quit(): void;
}
