const sharp = require("sharp");
const toIco = require("to-ico");
const { mkdir, writeFile } = require("fs/promises");
const { join } = require("path");

const BG = { r: 15, g: 15, b: 16, alpha: 1 };
const LOGO_SCALE = 0.7;
const THRESHOLD = 120;
const MASTER_SIZE = 512;

async function extractWhiteFlame(sourcePath) {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * info.channels;
    const brightness = (data[o] + data[o + 1] + data[o + 2]) / 3;
    const j = i * 4;

    if (brightness >= THRESHOLD) {
      out[j] = 255;
      out[j + 1] = 255;
      out[j + 2] = 255;
      out[j + 3] = 255;
    }
  }

  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim()
    .png()
    .toBuffer();
}

async function createMasterIcon(flamePng) {
  const size = MASTER_SIZE;
  const logoSize = Math.round(size * LOGO_SCALE);
  const circleMask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
  );

  const background = await sharp({
    create: { width: size, height: size, channels: 4, background: BG }
  })
    .png()
    .toBuffer();

  const flameMeta = await sharp(flamePng).metadata();
  const scale = logoSize / Math.max(flameMeta.width, flameMeta.height);
  const w = Math.round(flameMeta.width * scale);
  const h = Math.round(flameMeta.height * scale);
  const left = Math.round((size - w) / 2);
  const top = Math.round((size - h) / 2);

  const logo = await sharp(flamePng).resize(w, h, { fit: "fill" }).png().toBuffer();

  const composed = await sharp(background)
    .composite([{ input: logo, left, top }])
    .png()
    .toBuffer();

  return sharp(composed)
    .composite([{ input: circleMask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function resizeIcon(master, size) {
  return sharp(master).resize(size, size, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
}

async function writeIcons(sourcePath, appDir, publicDir) {
  await mkdir(appDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });

  const flame = await extractWhiteFlame(sourcePath);
  const master = await createMasterIcon(flame);

  const icon16 = await resizeIcon(master, 16);
  const icon32 = await resizeIcon(master, 32);
  const icon48 = await resizeIcon(master, 48);
  const icon180 = await resizeIcon(master, 180);
  const icon192 = await resizeIcon(master, 192);

  const icoBuffer = await toIco([
    Buffer.from(icon16),
    Buffer.from(icon32),
    Buffer.from(icon48)
  ]);

  const targets = [
    [join(appDir, "favicon.ico"), icoBuffer],
    [join(appDir, "icon.png"), icon32],
    [join(appDir, "apple-icon.png"), icon180],
    [join(publicDir, "favicon.ico"), icoBuffer],
    [join(publicDir, "icon.png"), icon192],
    [join(publicDir, "apple-icon.png"), icon180],
    [join(publicDir, "apple-touch-icon.png"), icon180]
  ];

  for (const [path, data] of targets) {
    await writeFile(path, data);
  }

  const stats = await sharp(icon32).stats();
  console.log("icon32 rgb max:", stats.channels.slice(0, 3).map((c) => c.max).join(","));
  console.log("Generated:\n  " + targets.map(([p]) => p).join("\n  "));
}

const [source, appDir, publicDir] = process.argv.slice(2);

if (!source || !appDir || !publicDir) {
  console.error("Usage: node generate-ordee-favicon.cjs <source> <app-dir> <public-dir>");
  process.exit(1);
}

writeIcons(source, appDir, publicDir).catch((err) => {
  console.error(err);
  process.exit(1);
});
