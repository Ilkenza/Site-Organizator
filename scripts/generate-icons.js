/**
 * @fileoverview PWA Icon Generator - Creates PNG icons from SVG source
 * @requires sharp - Image processing library
 * @usage node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ICON_CONFIG = {
    SIZES: [72, 96, 128, 144, 152, 192, 384, 512],
    SVG_FILENAME: 'logo.svg',
    OUTPUT_TEMPLATE: 'icon-{size}x{size}.png',
    IMAGE_FORMAT: 'png'
};

const PATHS = {
    SCRIPT_DIR: __dirname,
    PUBLIC_DIR: path.join(__dirname, '../public'),
    ICONS_DIR: path.join(__dirname, '../public/icons'),
    SVG_SOURCE: path.join(__dirname, '../public/icons/logo.svg')
};

const EXIT_CODES = {
    SUCCESS: 0,
    ERROR: 1
};

const MESSAGES = {
    INSTALLING_SHARP: 'Installing sharp package...',
    GENERATING_ICON: (size) => `Generating ${size}x${size} icon...`,
    SUCCESS: (count) => `✓ Successfully generated ${count} icons`,
    ERROR: 'Error generating icons:',
    SVG_NOT_FOUND: (path) => `SVG source not found: ${path}`
};

/**
 * Lazy-load sharp package, install if missing
 * @returns {Object} Sharp module
 */
function loadSharp() {
    try {
        return require('sharp');
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(MESSAGES.INSTALLING_SHARP);
        const { execSync } = require('child_process');
        execSync('npm install sharp', { stdio: 'inherit' });
        return require('sharp');
    }
}

/**
 * Check if SVG source file exists
 * @param {string} svgPath - Path to SVG file
 * @returns {boolean} True if file exists
 */
function validateSvgExists(svgPath) {
    if (!fs.existsSync(svgPath)) {
        console.error(MESSAGES.SVG_NOT_FOUND(svgPath));
        return false;
    }
    return true;
}

/**
 * Ensure output directory exists
 * @param {string} dirPath - Directory path to create
 */
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Generate output filename for icon
 * @param {number} size - Icon size in pixels
 * @returns {string} Filename
 */
function getIconFilename(size) {
    return ICON_CONFIG.OUTPUT_TEMPLATE.replace('{size}', size);
}

/**
 * Generate single PNG icon from SVG
 * @param {Object} sharp - Sharp instance
 * @param {Buffer} svgBuffer - SVG file buffer
 * @param {number} size - Icon size in pixels
 * @param {string} outputDir - Output directory path
 * @returns {Promise<void>}
 */
async function generateIcon(sharp, svgBuffer, size, outputDir) {
    const filename = getIconFilename(size);
    const outputPath = path.join(outputDir, filename);

    // eslint-disable-next-line no-console
    console.log(MESSAGES.GENERATING_ICON(size));

    await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
}

/**
 * Generate all PWA icons from SVG source
 * @returns {Promise<void>}
 */
async function generateIcons() {
    // Validate SVG source exists
    if (!validateSvgExists(PATHS.SVG_SOURCE)) {
        process.exit(EXIT_CODES.ERROR);
    }

    // Ensure output directory exists
    ensureDirectoryExists(PATHS.ICONS_DIR);

    // Load sharp package
    const sharp = loadSharp();

    // Read SVG buffer
    const svgBuffer = fs.readFileSync(PATHS.SVG_SOURCE);

    // Generate all icon sizes
    for (const size of ICON_CONFIG.SIZES) {
        await generateIcon(sharp, svgBuffer, size, PATHS.ICONS_DIR);
    }

    // eslint-disable-next-line no-console
    console.log(MESSAGES.SUCCESS(ICON_CONFIG.SIZES.length));
}

// Execute icon generation
generateIcons().catch((err) => {
    console.error(MESSAGES.ERROR, err);
    process.exit(EXIT_CODES.ERROR);
});
