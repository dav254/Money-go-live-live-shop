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
const userId = 'DusChTn2jmSzBAStnIPDElj39qF2';
const userProfileRef = doc(db, 'userProfiles', userId);

// The main function to set the admin role
async function setAdminRole() {
  console.log(`Attempting to set role for user: ${userId}`);
  try {
    // Use setDoc with { merge: true } to create or update the document
    await setDoc(userProfileRef, { userRole: 'admin' }, { merge: true });
    
    // Also ensure the user is in the 'admins' collection
    const adminRef = doc(db, 'admins', userId);
    await setDoc(adminRef, {
        uid: userId,
        email: 'admin@moneygod.com', // You can fill this out as needed
        role: 'SuperAdmin',
        displayName: 'david Kamiano chege', // You can fill this out as needed
        lastLogin: new Date().toISOString()
    }, { merge: true });

    console.log(`Successfully set/updated role to 'admin' for user: ${userId}`);
    console.log('User has also been added/updated in the admins collection.');

  } catch (error) {
    console.error('Error setting admin role:', error);
  }
}

// Execute the function
setAdminRole().then(() => {
    console.log("Script finished.");
    // Force exit after a delay to ensure the script terminates in all environments.
    setTimeout(() => process.exit(0), 2000); 
});
