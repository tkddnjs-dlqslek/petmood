import { createCanvas, loadImage } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "test_output", "KakaoTalk_20260330_111047467_02_birefnet_lite.png");
const OUT = path.join(__dirname, "public");

mkdirSync(OUT, { recursive: true });

const SIZES = [16, 32, 48, 128];

const src = await loadImage(SRC);

// Read pixel data to find tight bounding box of non-transparent pixels
const tmpC = createCanvas(src.width, src.height);
const tmpCtx = tmpC.getContext("2d");
tmpCtx.drawImage(src, 0, 0);
const { data, width, height } = tmpCtx.getImageData(0, 0, src.width, src.height);

let minX = width, maxX = 0, minY = height, maxY = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const alpha = data[(y * width + x) * 4 + 3];
    if (alpha > 10) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
const cropW = maxX - minX + 1;
const cropH = maxY - minY + 1;
console.log(`Crop: (${minX},${minY}) → ${cropW}×${cropH}  (original: ${width}×${height})`);

for (const size of SIZES) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // 6% padding on each side
  const pad = Math.round(size * 0.06);
  const draw = size - pad * 2;

  // Scale cropped region to fill draw area
  const ratio = Math.min(draw / cropW, draw / cropH);
  const dw = cropW * ratio;
  const dh = cropH * ratio;
  const dx = pad + (draw - dw) / 2;
  const dy = pad + (draw - dh) / 2;

  ctx.drawImage(src, minX, minY, cropW, cropH, dx, dy, dw, dh);

  const outPath = path.join(OUT, `icon-${size}.png`);
  writeFileSync(outPath, canvas.toBuffer("image/png"));
  console.log(`✓ icon-${size}.png`);
}

console.log("Done → public/");
