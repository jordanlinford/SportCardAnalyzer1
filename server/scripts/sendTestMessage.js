import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credsPath = path.resolve(__dirname, '../credentials/service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function main() {
  const recipientId = process.argv[2];
  if (!recipientId) {
    console.error('Usage: node sendTestMessage.js <recipientUid>');
    process.exit(1);
  }

  const docRef = db.collection('messages').doc();
  await docRef.set({
    senderId: 'script-tester',
    senderName: 'Script Tester',
    senderEmail: 'tester@example.com',
    recipientId,
    displayCaseId: 'testDisplayCase',
    subject: 'Automated Test Message',
    message: `Generated at ${new Date().toISOString()}`,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    read: false,
    deleted: false,
  });

  console.log('Message created with ID', docRef.id);
  process.exit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}); 