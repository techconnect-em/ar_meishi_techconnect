// Generate an 8th Wall image target from a source image, mirroring the
// official @8thwall/image-target-cli default-crop pipeline (crop.js + apply.js).
//
// 公式仕様の要点:
//   - 横長画像は90°回転して縦長として処理し isRotated: true を付ける
//     （回転を省くとトラッキング座標系が90°ズレる・サイズも合わない）
//   - 追跡領域は中央の3:4クロップ（トラッカーは3:4の縦長領域を前提とする）
//
// Prerequisite: install sharp once  →  npm install --no-save sharp
//
// Usage:
//   node scripts/generate-marker.mjs <input.png> <out_dir> <name>
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const CONSTANTS = { thumbnailHeight: 350, luminanceHeight: 640 };

const [, , inputPath, outDir, name] = process.argv;
if (!inputPath || !outDir || !name) {
  console.error('Usage: node generate-marker.mjs <input> <outDir> <name>');
  process.exit(1);
}

const rawImage = sharp(inputPath);
const baseMetadata = await rawImage.metadata();
console.log(`Source: ${baseMetadata.width}x${baseMetadata.height}, format=${baseMetadata.format}`);

// 横長（幅 >= 高さ）なら90°回転して縦長として扱う（公式CLIのデフォルト動作）
const isRotated = baseMetadata.width >= baseMetadata.height;
const originalImage = isRotated ? rawImage.clone().rotate(90) : rawImage.clone();
const [width, height] = isRotated
  ? [baseMetadata.height, baseMetadata.width]
  : [baseMetadata.width, baseMetadata.height];
if (isRotated) console.log(`Landscape source -> rotated 90°, processing as ${width}x${height}`);

// 中央3:4クロップ（公式 crop.js の getDefaultCrop と同一ロジック）
let cropGeom;
if (width / 3 > height / 4) {
  const croppedWidth = Math.round((height * 3) / 4);
  cropGeom = {
    left: Math.round((width - croppedWidth) / 2),
    top: 0,
    width: croppedWidth,
    height,
    isRotated,
    originalWidth: width,
    originalHeight: height,
  };
} else {
  const croppedHeight = Math.round((width * 4) / 3);
  cropGeom = {
    left: 0,
    top: Math.round((height - croppedHeight) / 2),
    width,
    height: croppedHeight,
    isRotated,
    originalWidth: width,
    originalHeight: height,
  };
}
console.log(`Crop (3:4): ${cropGeom.width}x${cropGeom.height} at (${cropGeom.left}, ${cropGeom.top})`);

// Always emit JPG (matches the typical 8th Wall dashboard output and avoids PNG alpha issues)
const extension = 'jpg';

const resources = {
  originalImage: `${name}_original.${extension}`,
  croppedImage: `${name}_cropped.${extension}`,
  thumbnailImage: `${name}_thumbnail.${extension}`,
  luminanceImage: `${name}_luminance.${extension}`,
};

const data = {
  imagePath: `image-targets/${resources.luminanceImage}`,
  metadata: null,
  name,
  type: 'PLANAR',
  properties: cropGeom,
  resources,
  created: Date.now(),
  updated: Date.now(),
};

await fs.mkdir(outDir, { recursive: true });

const { left, top, width: cw, height: ch } = cropGeom;
const croppedImage = originalImage.clone().extract({ left, top, width: cw, height: ch });
const thumbnailImage = croppedImage.clone().resize({ height: CONSTANTS.thumbnailHeight });
const luminanceImage = croppedImage.clone().resize({ height: CONSTANTS.luminanceHeight }).grayscale();

// Convert PNG (or anything else) to JPG, flatten any alpha against white
const toJpg = (s) => s.flatten({ background: '#ffffff' }).jpeg({ quality: 90 });
await Promise.all([
  toJpg(originalImage.clone()).toFile(path.join(outDir, resources.originalImage)),
  toJpg(croppedImage.clone()).toFile(path.join(outDir, resources.croppedImage)),
  toJpg(thumbnailImage).toFile(path.join(outDir, resources.thumbnailImage)),
  toJpg(luminanceImage).toFile(path.join(outDir, resources.luminanceImage)),
  fs.writeFile(path.join(outDir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`),
]);

console.log(`Marker written: ${path.join(outDir, `${name}.json`)}`);
