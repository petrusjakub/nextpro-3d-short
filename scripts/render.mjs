// usage: node scripts/render.mjs <output.mp4> [scale]
import fs from "node:fs";
process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP = "/home/hatch/workspace/remotion-tmp";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
const browserExecutable = "/home/hatch/workspace/remotion-tmp/chrome-headless-shell/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: "swangle" };
const [out, scale = "1"] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "NextProShort", browserExecutable, chromiumOptions });
const onBrowserLog = (l) => { if (l.type === "error") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: out, browserExecutable, chromiumOptions, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale), timeoutInMilliseconds: 1800000, onBrowserLog, frameRange: process.env.FRAMES ? process.env.FRAMES.split("-").map(Number) : undefined, concurrency: process.env.CONCURRENCY ? Number(process.env.CONCURRENCY) : undefined, muted: process.env.MUTED === "1", onProgress: ({ renderedFrames, totalFrames }) => { if (renderedFrames % 150 === 0) console.log(`progress ${renderedFrames}/${totalFrames}`); } });
console.log("render done", out);
