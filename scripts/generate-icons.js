/**
 * Generate PWA icons from SVG
 * Run: node scripts/generate-icons.js
 * Requires: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is installed
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    const { execSync } = require('child_process');
    execSync('npm install sharp', { stdio: 'inherit' });
    sharp = require('sharp');
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgPath = path.join(__dirname, '../public/icons/logo.svg');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {

    const svgBuffer = fs.readFileSync(svgPath);

    for (const size of sizes) {
        const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(outputPath);

    }

}

generateIcons().catch(err => {
    console.error('Error generating icons:', err);
    process.exit(1);
});
