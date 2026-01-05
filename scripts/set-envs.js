const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Check if critical variables are loaded
const requiredKeys = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID'
];

const missingKeys = requiredKeys.filter(key => !process.env[key]);
if (missingKeys.length > 0) {
  console.warn('Warning: The following environment variables are missing in .env:', missingKeys.join(', '));
}

const envFileContent = `export const environment = {
  production: false,
  firebase: {
    apiKey: '${process.env.FIREBASE_API_KEY || ''}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN || ''}',
    projectId: '${process.env.FIREBASE_PROJECT_ID || ''}',
    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET || ''}',
    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}',
    appId: '${process.env.FIREBASE_APP_ID || ''}',
    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID || ''}'
  }
};
`;

const targetPath = path.join(__dirname, '../src/environments/environment.ts');
const targetDir = path.dirname(targetPath);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.writeFile(targetPath, envFileContent, (err) => {
  if (err) {
    console.error(err);
    throw err;
  }
  console.log(`Environment file generated correctly at ${targetPath}`);
});
