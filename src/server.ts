import { EventEmitter } from "node:events";
import { readFile, readFileSync, stat, Stats } from "node:fs";
import {
  createServer,
  IncomingMessage,
  Server as HttpServer,
  ServerResponse
} from "node:http";
import { AddressInfo } from "node:net";
import * as path from "node:path";
import { parse } from "node:url";
import { ESBWConfig } from "./interface.js";
import mimetypes from "./mimetypes.js";
import { logWithTime } from "./print.js";

const mime = Object.entries(mimetypes).reduce(
  (all, [type, exts]) =>
    Object.assign(all, ...exts.map((ext: string) => ({ [ext]: type }))),
  {}
);

function isRouteRequest(uri: string): boolean {
  return uri.split("/").pop().indexOf(".") === -1;
}

export class Server {
  config: ESBWConfig;
  buildEmitter: EventEmitter;
  reloadPort = null;
  reloadServer: HttpServer;
  server: HttpServer;

  // used by auto generated index if no serveMode.index specified.
  title: string;

  constructor(config: ESBWConfig, buildEmitter: EventEmitter) {
    this.config = config;
    this.buildEmitter = buildEmitter;
    this.serve();
    this.title = path.basename(process.cwd());
  }

  serve() {
    const sendIndexTemplate = (res: ServerResponse) => {
      const { index } = this.config.serveMode;
      const html = createIndexTemplate(index);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    };

    const sendError = (res: ServerResponse, resource: string, status: number) => {
      res.writeHead(status, { "Content-Type": "text/plain" });
      res.end(`Resource ${resource} not found`);
    };

    const sendFile = (res: ServerResponse, resource: string, status: number, data: string, ext: string) => {
      res.writeHead(status, { "Content-Type": mime[ext] || "application/octet-stream" });
      res.end(data, "binary");
    };

    const isRouteRequest = (pathname: string) => {
      return pathname === "/" || pathname.endsWith("/");
    };

    const createIndexTemplate = (index: string) => {
      const html = readFileSync(index, { encoding: "utf-8" });
      return html.replace("</body>", `${this.bundleInjection()}${this.sseInjection()}\n</body>`);
    };

    const { port: reloadPort = 0 } = this.config?.serveMode || {};
    const { port = 0, index } = this.config.serveMode;

    const reload = (res: ServerResponse, event: string, data: string) => {
      const message = `event: ${event}\ndata: ${data}\n\n`;
      res.write(message);
    };

    const onBuildFinished = (res: ServerResponse) => {
      this.buildEmitter.once("finished", () => reload(res, "message", "finished"));
    };

    const serveReload = () => {
      this.reloadServer = createServer((_: IncomingMessage, res: ServerResponse) => {
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
        const { port } = this.reloadServer.address() as AddressInfo;
        this.reloadPort = port;
      });
    };

    const serveMain = () => {
      this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const pathname = parse(req.url).pathname;
        const isRoute = isRouteRequest(pathname);
        const status = isRoute && pathname !== "/" ? 301 : 200;
        const resource = isRoute ? `/${index}` : decodeURI(pathname);
        const uri = path.join(process.cwd(), resource);
        const ext = uri.replace(/^.*[./\\]/, "").toLowerCase();

        stat(uri, (err: NodeJS.ErrnoException, _: Stats) => {
          if (err && isRoute) sendIndexTemplate(res);
          else if (err) sendError(res, resource, 404);
          else {
            readFile(uri, "binary", (err: NodeJS.ErrnoException, data: string) => {
              if (err) sendError(res, resource, 500);
              if (isRoute) data = createIndexTemplate(uri);
              sendFile(res, resource, status, data, ext);
            });
          }
        });
      }).listen(port);

      this.server.once("listening", () => {
        const { port } = this.server.address() as AddressInfo;
        logWithTime(`http://localhost:${port}`);
      });
    };

    serveReload();
    serveMain();
  }

  bundleInjection(): string {
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

  sseInjection(): string {
    return `<script>
  const s = new EventSource("http://localhost:${this.reloadPort}");
  s.onmessage = (e) => {
    window.location.reload(true);
  };
</script>`;
  }

  sendIndexTemplate(res: ServerResponse) {
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

  sendFile(res: ServerResponse, resource: string, status: number, data: string, ext: string) {
    res.writeHead(status, {
      "Content-Type": mime[ext] || "application/octet-string",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(data, "binary");
    res.end();
  }

  sendError(res: ServerResponse, resource: string, code: number) {
    res.writeHead(code);
    res.end();
  }

  reload(res: ServerResponse, channel: string, message: string) {
    res.write(`event: ${channel}\nid: 0\ndata: ${message}\n`);
    res.write("\n\n");
  }

  quit() {
    this.reloadServer.close();
    this.server.close();
  }
}
