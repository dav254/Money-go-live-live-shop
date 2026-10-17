
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// The service account key is loaded from a JSON file
import serviceAccountKey from './service-account.json';

// The JSON uses snake_case keys (project_id, client_email, private_key);
// cert() expects the camelCase ServiceAccount shape.
const serviceAccount = {
  projectId: serviceAccountKey.project_id,
  clientEmail: serviceAccountKey.client_email,
  privateKey: serviceAccountKey.private_key,
};

// Initialize the Firebase Admin SDK
const adminApp = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(adminApp);

async function setAdminRole() {
  const userProfileRef = db.collection('userProfiles').doc('z7x4SUxWO8RYeFxPdDjWU6JY28x1');
  try {
    await userProfileRef.set({ role: 'admin' }, { merge: true });
    console.log('Admin role set successfully for user z7x4SUxWO8RYeFxPdDjWU6JY28x1');
  } catch (error) {
    console.error('Error setting admin role:', error);
  }
}

setAdminRole();
