import { glob } from "glob";
import fs from "fs-extra";

console.log("moveFile 开始执行...");

fs.emptyDirSync("./dist");
const files = await glob(
    `./packages/*/dist/**/*.{woff,woff2,ttf,bin,svg,css,html,proto}`,
    {
        ignore: "node_modules/**",
    }
);

console.log(`找到 ${files.length} 个文件待复制`);

for (const i of files) {
    const newPath =
        "./dist/" +
        i
            .replaceAll("\\", "/")
            .replaceAll(" ", "_")
            // 更换文件夹中的 . 为 _
            .replace(/(?<=\/.*)\.(?=.*\/)/g, "_");

    await fs.copy(i, newPath);
}

await fs.copy("./_headers", "./dist/_headers");
await fs.copy("./_redirects", "./dist/_redirects");
await fs.copy("./index.html", "./dist/index.html");
await fs.copy("./index.json", "./dist/index.json");

console.log("moveFile 执行完毕");

setImmediate(() => process.exit(0));