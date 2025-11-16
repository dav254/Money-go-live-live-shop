
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "studio-1725493862-5cb95",
  "appId": "1:301611491606:web:d1c3ac4a0468ab032a3037",
  "apiKey": "AIzaSyAiVFB7a0FqDu4ivPgL19yQ-aeGnXeRMAo",
  "authDomain": "studio-1725493862-5cb95.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "301611491606"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setAdminRole() {
  const userProfileRef = doc(db, 'userProfiles', 'z7x4SUxWO8RYeFxPdDjWU6JY28x1');
  try {
    await setDoc(userProfileRef, { role: 'admin' }, { merge: true });
    console.log('Admin role set successfully for user z7x4SUxWO8RYeFxPdDjWU6JY28x1');
  } catch (error) {
    console.error('Error setting admin role:', error);
  }
}

setAdminRole();
