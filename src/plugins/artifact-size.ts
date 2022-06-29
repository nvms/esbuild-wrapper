import { Plugin, PluginBuild } from "esbuild";
import { logWithTime } from "../print";


function human(size: number) {
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return (
    (size / 1024 ** i).toFixed(2) + ["B", "KB", "MB", "GB", "TB"][i]
  );
}

export function artifactSize(): Plugin {
  return {
    name: "artifact-size",
    setup({ onEnd }: PluginBuild) {
      onEnd(async ({ metafile }) => {
        let totalBytes = 0;
        for (const outfile of Object.keys(metafile.outputs)) {
          if (outfile) {
            logWithTime(`${outfile}: ${human(metafile.outputs[outfile].bytes)}`);
            totalBytes += metafile.outputs[outfile].bytes;
          }
        }
        if (totalBytes) {
          logWithTime(`total ${human(totalBytes)}`);
        }
      });
    },
  };
}
