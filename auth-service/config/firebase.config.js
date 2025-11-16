// config/firebase.config.js

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Option 1: Using service account JSON (recommended for production)
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} 
// Option 2: Using service account file path
else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
// Option 3: Using default credentials (for Google Cloud environments)
else {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

const auth = admin.auth();

module.exports = { admin, auth };
