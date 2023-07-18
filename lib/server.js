import { readFile, readFileSync, stat } from "node:fs";
import { createServer } from "node:http";
import * as path from "node:path";
import { parse } from "node:url";
import mimetypes from "./mimetypes.js";
import { logWithTime } from "./print.js";
const mime = Object.entries(mimetypes).reduce((all, [type, exts]) => Object.assign(all, ...exts.map((ext) => ({ [ext]: type }))), {});
function isRouteRequest(uri) {
    return uri.split("/").pop().indexOf(".") === -1;
}
export class Server {
    config;
    buildEmitter;
    reloadPort = null;
    reloadServer;
    server;
    // used by auto generated index if no serveMode.index specified.
    title;
    constructor(config, buildEmitter) {
        this.config = config;
        this.buildEmitter = buildEmitter;
        this.serve();
        this.title = path.basename(process.cwd());
    }
    serve() {
        const sendIndexTemplate = (res) => {
            const { index } = this.config.serveMode;
            const html = createIndexTemplate(index);
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(html);
        };
        const sendError = (res, resource, status) => {
            res.writeHead(status, { "Content-Type": "text/plain" });
            res.end(`Resource ${resource} not found`);
        };
        const sendFile = (res, resource, status, data, ext) => {
            res.writeHead(status, { "Content-Type": mime[ext] || "application/octet-stream" });
            res.end(data, "binary");
        };
        const isRouteRequest = (pathname) => {
            return pathname === "/" || pathname.endsWith("/");
        };
        const createIndexTemplate = (index) => {
            const html = readFileSync(index, { encoding: "utf-8" });
            return html.replace("</body>", `${this.bundleInjection()}${this.sseInjection()}\n</body>`);
        };
        const { port: reloadPort = 0 } = this.config?.serveMode || {};
        const { port = 0, index } = this.config.serveMode;
        const reload = (res, event, data) => {
            const message = `event: ${event}\ndata: ${data}\n\n`;
            res.write(message);
        };
        const onBuildFinished = (res) => {
            this.buildEmitter.once("finished", () => reload(res, "message", "finished"));
        };
        const serveReload = () => {
            this.reloadServer = createServer((_, res) => {
                res.writeHead(200, {
                    "Connection": "keep-alive",
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Access-Control-Allow-Origin": "*",
                });
                setInterval(reload, 60_000, res, "ping", "idle");
                this.buildEmitter.removeAllListeners("finished");
                onBuildFinished(res);
            }).listen(reloadPort);
            this.reloadServer.once("listening", () => {
                const { port } = this.reloadServer.address();
                this.reloadPort = port;
            });
        };
        const serveMain = () => {
            this.server = createServer((req, res) => {
                const pathname = parse(req.url).pathname;
                const isRoute = isRouteRequest(pathname);
                const status = isRoute && pathname !== "/" ? 301 : 200;
                const resource = isRoute ? `/${index}` : decodeURI(pathname);
                const uri = path.join(process.cwd(), resource);
                const ext = uri.replace(/^.*[./\\]/, "").toLowerCase();
                stat(uri, (err, _) => {
                    if (err && isRoute)
                        sendIndexTemplate(res);
                    else if (err)
                        sendError(res, resource, 404);
                    else {
                        readFile(uri, "binary", (err, data) => {
                            if (err)
                                sendError(res, resource, 500);
                            if (isRoute)
                                data = createIndexTemplate(uri);
                            sendFile(res, resource, status, data, ext);
                        });
                    }
                });
            }).listen(port);
            this.server.once("listening", () => {
                const { port } = this.server.address();
                logWithTime(`http://localhost:${port}`);
            });
        };
        serveReload();
        serveMain();
    }
    bundleInjection() {
        return this.config.serveMode.injectArtifacts
            .map((artifactName) => {
            const artifact = this.config.artifacts[artifactName];
            if (artifact.outfile) {
                return `<script src="/${artifact.outfile}" ${artifact.format === "esm" ? 'type="module"' : ''}></script>`;
            }
            return "";
        })
            .join("\n");
    }
    sseInjection() {
        return `<script>
  const s = new EventSource("http://localhost:${this.reloadPort}");
  s.onmessage = (e) => {
    window.location.reload(true);
  };
</script>`;
    }
    sendIndexTemplate(res) {
        res.writeHead(200, {
            "Content-Type": "text/html",
            "Access-Control-Allow-Origin": "*",
        });
        let template = `<!--
  This is an auto-generated index.html because either
  no index was specified in the config (serveMode.index) or
  the specified index couldn't be found on the filesystem.
-->
<html>
<head>
  <title>${this.title}</title>
</head>
<body>
  <div id="app"></div>
</body>
</html>`;
        template = template.replace("</body>", `${this.bundleInjection()}${this.sseInjection()}\n</body>`);
        res.write(template, "binary");
        res.end();
    }
    sendFile(res, resource, status, data, ext) {
        res.writeHead(status, {
            "Content-Type": mime[ext] || "application/octet-string",
            "Access-Control-Allow-Origin": "*",
        });
        res.write(data, "binary");
        res.end();
    }
    sendError(res, resource, code) {
        res.writeHead(code);
        res.end();
    }
    reload(res, channel, message) {
        res.write(`event: ${channel}\nid: 0\ndata: ${message}\n`);
        res.write("\n\n");
    }
    quit() {
        this.reloadServer.close();
        this.server.close();
    }
}
