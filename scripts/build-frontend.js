// Builds the React frontend and copies it into ./public, where app.yaml serves it from.
// Usage: npm run build:frontend   (run before `gcloud app deploy`)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '../../../frontend');
const distDir = path.join(frontendDir, 'dist');
const publicDir = path.resolve(__dirname, '../public');

// Empty VITE_API_URL = the frontend calls /api on its own origin, i.e. this same App Engine app.
execSync('npm run build', {
    cwd: frontendDir,
    stdio: 'inherit',
    env: { ...process.env, VITE_API_URL: '' },
});

fs.rmSync(publicDir, { recursive: true, force: true });
fs.cpSync(distDir, publicDir, { recursive: true });
console.log(`Copied ${distDir} -> ${publicDir}`);
