import { logWithTime } from "../print.js";
function human(size) {
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return ((size / 1024 ** i).toFixed(2) + ["B", "KB", "MB", "GB", "TB"][i]);
}
export function artifactSize() {
    return {
        name: "artifact-size",
        setup({ onEnd }) {
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
