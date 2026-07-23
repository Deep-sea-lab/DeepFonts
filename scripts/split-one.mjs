// scripts/split-one.mjs
import { fontSplit } from "cn-font-split";
import fse from "fs-extra";
import path from "path";
import { setResourceLimits } from "node:process";

const [fontPath, dest, previewText] = process.argv.slice(2);

// ===== 资源限制（关键）=====
// 限制 V8 内存，逼 Rust 侧更早失败，而不是被 kernel SIGKILL
setResourceLimits({
    maxOldGenerationSizeMb: 4096,
    maxYoungGenerationSizeMb: 512,
});

// ===== 超时自杀（关键）=====
// GitHub Actions 单字体不应超过 5 分钟
const TIMEOUT_MS = 5 * 60 * 1000;
const timer = setTimeout(() => {
    console.error("❌ fontSplit timeout, killing self");
    try { fse.removeSync(dest); } catch (_) {}
    process.exit(2);
}, TIMEOUT_MS);

// ===== 进程级兜底（防止 uncaught）=====
process.on("uncaughtException", (err) => {
    console.error("❌ uncaughtException:", err.message);
    try { fse.removeSync(dest); } catch (_) {}
    process.exit(3);
});

process.on("unhandledRejection", (err) => {
    console.error("❌ unhandledRejection:", err?.message || err);
    try { fse.removeSync(dest); } catch (_) {}
    process.exit(3);
});

(async () => {
    try {
        await fontSplit({
            input: fontPath,
            outDir: dest,
            previewImage: {
                text: previewText,
                name: "preview",
            },
        });

        // ===== preview.svg viewBox 修正 =====
        const svgPath = path.join(dest, "preview.svg");
        if (await fse.pathExists(svgPath)) {
            let svg = await fse.readFile(svgPath, "utf-8");
            const vbMatch = svg.match(
                /viewBox="([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)"/
            );
            if (vbMatch) {
                const [, vx, vy, vw, vh] = vbMatch.map(Number);
                const re =
                    /transform="translate\(([\d.-]+)\s+([\d.-]+)\)"[^>]*d="([^"]+)"/g;
                let allGlobalY = [];
                let match;
                while ((match = re.exec(svg)) !== null) {
                    const ty = parseFloat(match[2]);
                    const d = match[3];
                    const nums = d.match(/[\d.-]+/g);
                    if (!nums) continue;
                    for (let i = 1; i < nums.length; i += 2) {
                        allGlobalY.push(ty + parseFloat(nums[i]));
                    }
                }

                if (allGlobalY.length > 0) {
                    const realMinY = Math.min(...allGlobalY);
                    const realMaxY = Math.max(...allGlobalY);
                    if (realMinY < vy || realMaxY > vy + vh) {
                        const newY = Math.min(vy, realMinY - 5);
                        const newH = Math.max(vy + vh, realMaxY + 5) - newY;
                        svg = svg.replace(
                            /viewBox="([\d.-]+\s+)([\d.-]+)(\s+[\d.-]+\s+)([\d.-]+)"/,
                            `viewBox="${vx} ${newY} ${vw} ${newH}"`
                        );
                        await fse.writeFile(svgPath, svg, "utf-8");
                    }
                }
            }
        }

        clearTimeout(timer);
        process.exit(0);
    } catch (e) {
        clearTimeout(timer);
        console.error("❌ fontSplit fatal error:", e?.message || e);
        try { fse.removeSync(dest); } catch (_) {}
        process.exit(1);
    }
})();
