/**
 * Replace all app icons from a single source image.
 *
 * Usage:
 *   npm run icon                          # uses default source
 *   npm run icon -- path/to/new-icon.png  # custom source
 *
 * What this updates:
 *   - android/app/src/main/res/mipmap-* /ic_launcher.png         (square launcher icon, all densities)
 *   - android/app/src/main/res/mipmap-* /ic_launcher_round.png   (circular launcher icon, all densities)
 *   - android/app/src/main/res/mipmap-* /ic_launcher_background.png  (adaptive icon background layer)
 *   - android/app/src/main/res/mipmap-* /ic_launcher_foreground.png  (adaptive icon foreground layer, 80% scale)
 *   - public/icon.png                                            (login screen mascot)
 *
 * After running: cd android && ./gradlew clean  (clears build cache)
 *
 * Uses sharp (installed as dep of @capacitor/assets — no extra install needed).
 */

import sharp from 'sharp';
import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const scaleArg = args.find((a) => a.startsWith('--scale='));
const FOREGROUND_SCALE = scaleArg ? parseFloat(scaleArg.split('=')[1]) : 0.7;
const sourceArg = args.find((a) => !a.startsWith('--'));
const SOURCE = path.join(ROOT, 'design-input', sourceArg ?? 'raccon1.png');
const NOTIFICATION_SOURCE = path.join(ROOT, 'design-input', 'notification icon', 'ic_notification_xxxhdpi.png');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

// Sample background color from the source image (top-left pixel = brand blue)
async function sampleBrandBlue() {
  const { data } = await sharp(SOURCE)
    .resize(1, 1)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2], alpha: 1 };
}

// mipmap density → icon px size (launcher icon)
const LAUNCHER_SIZES = {
  'mipmap-ldpi':    36,
  'mipmap-mdpi':    48,
  'mipmap-hdpi':    72,
  'mipmap-xhdpi':   96,
  'mipmap-xxhdpi':  144,
  'mipmap-xxxhdpi': 192,
};

// drawable density → notification icon px size (status bar)
const NOTIFICATION_SIZES = {
  'drawable-mdpi':    24,
  'drawable-hdpi':    36,
  'drawable-xhdpi':   48,
  'drawable-xxhdpi':  72,
  'drawable-xxxhdpi': 96,
};

// mipmap density → adaptive icon layer px size (foreground + background)
const ADAPTIVE_SIZES = {
  'mipmap-ldpi':    54,
  'mipmap-mdpi':    108,
  'mipmap-hdpi':    162,
  'mipmap-xhdpi':   216,
  'mipmap-xxhdpi':  324,
  'mipmap-xxxhdpi': 432,
};

async function generateLauncher(destDir, size) {
  const dest = path.join(RES, destDir, 'ic_launcher.png');
  await sharp(SOURCE)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(dest);
  console.log(`  ✓ ${destDir}/ic_launcher.png (${size}×${size})`);
}

async function generateRound(destDir, size) {
  // dest-in blend requires an alpha channel to exist first
  const circleMask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
  );

  const dest = path.join(RES, destDir, 'ic_launcher_round.png');
  await sharp(SOURCE)
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png()
    .toFile(dest);
  console.log(`  ✓ ${destDir}/ic_launcher_round.png (${size}×${size})`);
}

async function generateBackground(destDir, size, brandBlue) {
  const dest = path.join(RES, destDir, 'ic_launcher_background.png');
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: brandBlue,
    },
  })
    .png()
    .toFile(dest);
  console.log(`  ✓ ${destDir}/ic_launcher_background.png (${size}×${size})`);
}

async function generateForeground(destDir, size, brandBlue) {
  // Scale raccoon to 70% of canvas, centered on brand-blue background
  const innerSize = Math.round(size * FOREGROUND_SCALE);
  const offset = Math.round((size - innerSize) / 2);

  const raccoon = await sharp(SOURCE)
    .resize(innerSize, innerSize, { fit: 'cover' })
    .png()
    .toBuffer();

  const dest = path.join(RES, destDir, 'ic_launcher_foreground.png');
  await sharp({
    create: { width: size, height: size, channels: 4, background: brandBlue },
  })
    .composite([{ input: raccoon, left: offset, top: offset }])
    .png()
    .toFile(dest);
  console.log(`  ✓ ${destDir}/ic_launcher_foreground.png (${size}×${size})`);
}

async function generateNotificationIcon(destDir, size) {
  const dir = path.join(RES, destDir);
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, 'ic_stat_notification.png');
  await sharp(NOTIFICATION_SOURCE)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(dest);
  console.log(`  ✓ ${destDir}/ic_stat_notification.png (${size}×${size})`);
}

function toHex(r, g, b) {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

async function writeColorsXml(brandColor) {
  const hex = toHex(brandColor.r, brandColor.g, brandColor.b);
  const colorsPath = path.join(RES, 'values', 'colors.xml');
  await mkdir(path.join(RES, 'values'), { recursive: true });

  // Read existing colors.xml to preserve other entries (e.g. statusBarBackground)
  let existing = '';
  try {
    existing = await readFile(colorsPath, 'utf-8');
  } catch {
    // File doesn't exist yet — will create from scratch
  }

  if (existing && existing.includes('name="notification_color"')) {
    // Update existing notification_color value
    const updated = existing.replace(
      /<color name="notification_color">.*?<\/color>/,
      `<color name="notification_color">${hex}</color>`,
    );
    await writeFile(colorsPath, updated, 'utf-8');
  } else if (existing && existing.includes('</resources>')) {
    // Append notification_color before closing tag
    const updated = existing.replace(
      '</resources>',
      `    <color name="notification_color">${hex}</color>\n</resources>`,
    );
    await writeFile(colorsPath, updated, 'utf-8');
  } else {
    // Create fresh file
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="notification_color">${hex}</color>
</resources>
`;
    await writeFile(colorsPath, xml, 'utf-8');
  }

  console.log(`  ✓ values/colors.xml (notification_color: ${hex})`);
  return hex;
}

async function main() {
  console.log(`Generating Android icons from ${sourceArg ?? 'raccon1.png'} (scale: ${FOREGROUND_SCALE})...\n`);

  const brandBlue = await sampleBrandBlue();
  console.log(`  Sampled brand blue: rgb(${brandBlue.r}, ${brandBlue.g}, ${brandBlue.b})\n`);

  for (const [dir, size] of Object.entries(LAUNCHER_SIZES)) {
    await generateLauncher(dir, size);
    await generateRound(dir, size);
  }

  console.log();

  for (const [dir, size] of Object.entries(ADAPTIVE_SIZES)) {
    await generateBackground(dir, size, brandBlue);
    await generateForeground(dir, size, brandBlue);
  }

  // Notification bar icons (white silhouette)
  console.log();
  for (const [dir, size] of Object.entries(NOTIFICATION_SIZES)) {
    await generateNotificationIcon(dir, size);
  }

  // Notification accent color
  console.log();
  const brandHex = await writeColorsXml(brandBlue);
  console.log(`\n  Brand color for capacitor.config.ts: ${brandHex}`);

  // Web / login screen mascot
  const publicIcon = path.join(ROOT, 'public', 'icon.png');
  await copyFile(SOURCE, publicIcon);
  console.log('\n  ✓ public/icon.png (login screen mascot)');

  console.log('\nDone! All icons updated.');
  console.log('Next: cd android && ./gradlew clean  (clears Android build cache)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
