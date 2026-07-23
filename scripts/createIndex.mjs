import { globSync } from "glob";
import fs from "fs-extra";
import p from "path";
import { decodeReporter } from "cn-font-split";
const cn = await fs.readJSON("./overrides.json");
const data = Object.fromEntries(
    Object.entries(cn).map(([en, cn]) => {
        const path = globSync(`packages/${en}/fonts/*`).map((i) => {
            const nation = i.replaceAll("\\", "/").replace("fonts", "dist");
            const extName = p.extname(nation); // 获取文件后缀名，包含点号
            const basePath =
                p.dirname(nation) +
                "/" +
                p
                    .basename(nation, extName)
                    .replaceAll(" ", "_")
                    // 更换文件夹中的 . 为 _
                    .replaceAll(".", "_");
            const reporter = decodeReporter(
                fs.readFileSync("./" + basePath + "/reporter.bin")
            );
            return {
                path: basePath + "/result.css",
                css: reporter.css.toObject(),
            };
        });
        // console.log(path);
        return [
            en,
            {
                name: cn,
                remotePath: path,
            },
        ];
    })
);

    await fs.outputJSON("./index.json", data);
    console.log("done");
    process.exit(0);
console.log(data);
fs.outputJSON("./index.json", data);

setImmediate(() => process.exit(0));
