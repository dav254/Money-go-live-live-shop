
// Import necessary functions from the Firebase SDK
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Your Firebase project configuration
const firebaseConfig = {
  "projectId": "studio-1725493862-5cb95",
  "appId": "1:301611491606:web:d1c3ac4a0468ab032a3037",
  "apiKey": "AIzaSyAiVFB7a0FqDu4ivPgL19yQ-aeGnXeRMAo",
  "authDomain": "studio-1725493862-5cb95.firebaseapp.com",
};

// Initialize the Firebase app
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// The user ID to target
const userId = 'z7x4SUxWO8RYeFxPdDjWU6JY28x1';
const userProfileRef = doc(db, 'userProfiles', userId);

// The main function to set the admin role
async function setAdminRole() {
  console.log(`Attempting to set role for user: ${userId}`);
  try {
    // Use setDoc with { merge: true } to create or update the document
    await setDoc(userProfileRef, { role: 'admin' }, { merge: true });
    console.log(`Successfully set/updated role to 'admin' for user: ${userId}`);
  } catch (error) {
    console.error('Error setting admin role:', error);
  }
}

// Execute the function
setAdminRole().then(() => {
    // We can add a process.exit here if the script hangs,
    // but let's see if it completes gracefully first.
    console.log("Script finished.");
    // In some environments, the script might hang due to open Firebase connections.
    // If it does, we'll force an exit in the next attempt.
    setTimeout(() => process.exit(0), 2000); 
});
