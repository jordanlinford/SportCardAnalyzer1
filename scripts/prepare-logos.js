const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Script to prepare logo files for deployment
 * This script will:
 * 1. Copy logo files from src/assets/logos to public/images
 * 2. Ensure favicon.ico is properly linked
 */
console.log('🖼️ Preparing logo files for deployment...');

// Define paths
const LOGO_SOURCE_DIR = path.join(__dirname, '..', 'src', 'assets', 'logos');
const PUBLIC_IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');
const FAVICON_PATH = path.join(__dirname, '..', 'public', 'favicon.ico');

// Ensure the public/images directory exists
if (!fs.existsSync(PUBLIC_IMAGES_DIR)) {
  console.log('Creating public/images directory...');
  fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
}

// Find all logo files in the source directory
const logoFiles = fs.readdirSync(LOGO_SOURCE_DIR)
  .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.svg'));

console.log(`Found ${logoFiles.length} logo files in ${LOGO_SOURCE_DIR}`);

// Copy main logo to logo512.png
const mainLogoFile = logoFiles.find(file => file === 'logo-icon.png' || file.includes('logo'));
if (mainLogoFile) {
  console.log(`Using ${mainLogoFile} as the main logo`);
  fs.copyFileSync(
    path.join(LOGO_SOURCE_DIR, mainLogoFile), 
    path.join(PUBLIC_IMAGES_DIR, 'logo512.png')
  );
  
  // Also copy to favicon.ico for browsers
  fs.copyFileSync(
    path.join(LOGO_SOURCE_DIR, mainLogoFile), 
    FAVICON_PATH
  );
  
  console.log('✅ Main logo copied to public/images/logo512.png and favicon.ico');
} else {
  console.warn('⚠️ No main logo file found. Using the first logo file instead.');
  if (logoFiles.length > 0) {
    fs.copyFileSync(
      path.join(LOGO_SOURCE_DIR, logoFiles[0]), 
      path.join(PUBLIC_IMAGES_DIR, 'logo512.png')
    );
    
    // Also copy to favicon.ico
    fs.copyFileSync(
      path.join(LOGO_SOURCE_DIR, logoFiles[0]), 
      FAVICON_PATH
    );
  }
}

// Create a resized version for logo192.png
// Note: This requires ImageMagick to be installed
// If it's not available, we'll just copy the original
const logo192Path = path.join(PUBLIC_IMAGES_DIR, 'logo192.png');
try {
  // Try to generate a resized version using ImageMagick 
  console.log('Trying to resize logo with ImageMagick...');
  execSync(`convert ${path.join(PUBLIC_IMAGES_DIR, 'logo512.png')} -resize 192x192 ${logo192Path}`);
  console.log('✅ Successfully created resized logo192.png');
} catch (error) {
  // If ImageMagick is not available, just copy the original
  console.log('⚠️ ImageMagick not available, copying original logo instead');
  fs.copyFileSync(path.join(PUBLIC_IMAGES_DIR, 'logo512.png'), logo192Path);
}

// Copy all logo files to public/images for reference
logoFiles.forEach(file => {
  const targetPath = path.join(PUBLIC_IMAGES_DIR, file);
  fs.copyFileSync(path.join(LOGO_SOURCE_DIR, file), targetPath);
  console.log(`Copied ${file} to public/images/`);
});

console.log('🎉 Logo preparation complete! Your custom logos are ready for deployment.');
console.log('During deployment, these logos will be used instead of the default ones.'); 