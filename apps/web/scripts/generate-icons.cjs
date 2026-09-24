// Genera los PNG del manifiesto a partir de los SVG. Uso: node scripts/generate-icons.cjs
const path = require('node:path');
const sharp = require(require.resolve('sharp', { paths: [path.join(__dirname, '../../api')] }));
const dir = path.join(__dirname, '../public/icons');
(async () => {
  await sharp(path.join(dir, 'icon.svg')).resize(192, 192).png().toFile(path.join(dir, 'icon-192.png'));
  await sharp(path.join(dir, 'icon.svg')).resize(512, 512).png().toFile(path.join(dir, 'icon-512.png'));
  await sharp(path.join(dir, 'icon-maskable.svg')).resize(512, 512).png().toFile(path.join(dir, 'icon-maskable-512.png'));
  await sharp(path.join(dir, 'icon.svg')).resize(180, 180).png().toFile(path.join(dir, 'apple-touch-icon.png'));
  await sharp(path.join(dir, 'icon.svg')).resize(64, 64).png().toFile(path.join(dir, 'favicon-64.png'));
})();
