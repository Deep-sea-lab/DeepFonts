// scripts/split-one.mjs
import { fontSplit } from "cn-font-split";
import fse from "fs-extra";
import path from "path";

const [fontPath, dest, previewText] = process.argv.slice(2);

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

        // ===== 你原有的 preview.svg viewBox 修正逻辑 =====
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

        process.exit(0);
    } catch (e) {
        console.error("fontSplit fatal error:", e?.message || e);
        process.exit(1);
    }
})();
