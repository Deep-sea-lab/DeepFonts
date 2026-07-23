import fse from "fs-extra";
import md5 from "md5";
import path from "path";
import semver from "semver";
import mri from "mri";
import { openSync } from "fontkit";
import { spawn } from "child_process";

const argv = process.argv.slice(2);
const input = mri(argv);

console.log("mode", input.mode);
console.log("version", input.version);
console.log("time", input.time);

const packages = fse.readdirSync("./packages");

function hasChar(font, cp) {
    return font.characterSet.includes(cp);
}

function filterTextByFont(font, text) {
    const set = font.characterSet;
    let out = "";
    for (const ch of text) {
        if (set.includes(ch.codePointAt(0))) {
            out += ch;
        }
    }
    return out;
}

function buildPreviewText(fontPath) {
    const font = openSync(fontPath);

    const samples = [
        "深海字体服务&中文网字计划",
        "DeepSea Fonts",
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "abcdefghijklmnopqrstuvwxyz",
        "0123456789",
        "!@#$%^&*()_+-=~`[]{}|;:'\",.<>/?",
    ];

    const lines = [];
    for (const s of samples) {
        const kept = filterTextByFont(font, s);
        if (kept.length > 0) {
            lines.push(kept);
        }
    }

    return lines.length > 0 ? lines.join("\n") : "AaBbCc";
}

for (const iterator of packages) {
    if (input.single && input.single !== iterator) {
        continue;
    }

    const fontsName = fse
        .readdirSync(`./packages/${iterator}/fonts`)
        .filter((i) =>
            [".ttf", ".eot", "woff", "woff2", "otf"].some((w) =>
                i.endsWith(w)
            )
        );

    const fontsPath = fontsName.map(
        (i) => `./packages/${iterator}/fonts/${i}`
    );
    const fonts = await Promise.all(fontsPath.map((i) => fse.readFile(i)));

    let cacheData = {};
    const hash = md5(fonts);

    if (input.mode != "rebuild") {
        try {
            cacheData = fse.readJSONSync(
                `./packages/${iterator}/cache.json`
            );
        } catch (_) {}

        if (hash === cacheData.version_tag) {
            console.log(` 跳过 ${iterator}`);
            continue;
        }
        console.log("新旧hash", hash, cacheData.version_tag);
    }

    console.log(`${iterator} 开始打包`);
    fse.emptyDirSync(`./packages/${iterator}/dist/`);

    for (const name of fontsName) {
        const fontPath = `./packages/${iterator}/fonts/${name}`;
        const dest = `./packages/${iterator}/dist/${path
            .basename(name)
            .replaceAll(" ", "_")
            .replace(/\.\w+$/, "")
            .replaceAll(".", "_")}`;

        await fse.emptydir(dest);

        const previewText = buildPreviewText(fontPath);

        // ✅ 唯一核心改动：用子进程隔离 fontSplit
        await new Promise((resolve) => {
            const child = spawn(
                process.execPath,
                [
                    "./scripts/split-one.mjs",
                    fontPath,
                    dest,
                    previewText,
                ],
                { stdio: "inherit" }
            );

            child.on("exit", (code) => {
                if (code !== 0) {
                    console.error(`❌ 字体打包失败，跳过: ${iterator} (${name})`);
                    fse.appendFileSync(
                        "./failed-fonts.log",
                        `${iterator}: ${name}\n`
                    );
                    try {
                        fse.removeSync(dest);
                    } catch (_) {}
                }
                resolve();
            });

            child.on("error", () => {
                console.error(`❌ 字体进程启动失败，跳过: ${iterator} (${name})`);
                fse.appendFileSync(
                    "./failed-fonts.log",
                    `${iterator}: ${name}\n`
                );
                try {
                    fse.removeSync(dest);
                } catch (_) {}
                resolve();
            });
        });
    }

    console.log(`${iterator} 打包完成`);

    if (input.mode !== "rebuild" || (input.mode === "rebuild" && input.version)) {
        const packageData = fse.readJSONSync(
            `./packages/${iterator}/package.json`
        );
        cacheData = {
            version: semver.inc(
                (cacheData && cacheData.version) || packageData.version,
                input.version ?? "patch"
            ),
            version_tag: hash,
        };

        if (input.time) {
            const time = parseInt(input.time);
            if (time > 0) {
                cacheData.version = semver.inc(
                    packageData.version,
                    input.version ?? "patch"
                );
            }
        }

        console.log(cacheData.version);
        fse.writeJSONSync(`./packages/${iterator}/package.json`, {
            ...packageData,
            version: cacheData.version,
        });
        fse.writeJSONSync(`./packages/${iterator}/cache.json`, cacheData);
        console.log(`${iterator} 完成`, cacheData.version);
    }

    fse.writeJSONSync(
        `./packages/${iterator}/dist/index.json`,
        fontsName.map((i) => path.basename(i).replace(/\.\w+$/, ""))
    );
}

setImmediate(() => process.exit(0));