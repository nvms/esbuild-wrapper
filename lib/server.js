import { readFile, stat } from "node:fs";
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
        this.reloadServer = createServer((_, res) => {
            res.writeHead(200, {
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*",
            });
            setInterval(this.reload, 60_000, res, "ping", "idle");
            this.buildEmitter.removeAllListeners("finished");
            this.buildEmitter.once("finished", () => this.reload(res, "message", "finished"));
        }).listen(this.config?.serveMode?.reloadPort ?? 0);
        this.reloadServer.once("listening", async () => {
            const { port } = this.reloadServer.address();
            this.reloadPort = port;
            this.server = createServer((req, res) => {
                const pathname = parse(req.url).pathname;
                const isRoute = isRouteRequest(pathname);
                const status = isRoute && pathname !== "/" ? 301 : 200;
                const resource = isRoute ? `/${this.config.serveMode.index}` : decodeURI(pathname);
                const uri = path.join(process.cwd(), resource);
                const ext = uri.replace(/^.*[./\\]/, "").toLowerCase();
                stat(uri, (err, _) => {
                    if (err && isRoute) {
                        this.sendIndexTemplate(res);
                    }
                    else if (err) {
                        this.sendError(res, resource, 404);
                    }
                    else {
                        readFile(uri, "binary", (err, data) => {
                            if (err)
                                this.sendError(res, resource, 500);
                            if (isRoute) {
                                data = data.replace("</body>", `${this.bundleInjection()}${this.sseInjection()}\n</body>`);
                            }
                            this.sendFile(res, resource, status, data, ext);
                        });
                    }
                });
            }).listen(this.config.serveMode?.port || 0);
            this.server.once("listening", () => {
                const { port } = this.server.address();
                logWithTime(`http://localhost:${port}`);
            });
        });
    }
    bundleInjection() {
        let s = "";
        for (const artifactName of this.config.serveMode.injectArtifacts) {
            const artifact = this.config.artifacts[artifactName];
            if (artifact.outfile) {
                s += `<script src="/${artifact.outfile}" ${artifact.format === "esm" ? 'type="module"' : ''}></script>\n`;
            }
        }
        return s;
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
