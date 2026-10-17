
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// The service account key is loaded from a JSON file
import serviceAccount from '../service-account.json';

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
