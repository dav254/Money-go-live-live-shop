
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export const setAdminRole = functions.https.onCall(async (data, context) => {
  // Check if the request is made by an authenticated user
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to call this function."
    );
  }

  // Check if the authenticated user is an admin
  const callerUid = context.auth.uid;
  const callerDoc = await admin.firestore().collection("userProfiles").doc(callerUid).get();
  const callerData = callerDoc.data();

  if (callerData?.userRole !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You do not have permission to perform this action."
    );
  }

  // Get the userId from the data object
  const { userId } = data;

  // Set the custom claim for the user
  await admin.auth().setCustomUserClaims(userId, { admin: true });

  // Update the user's role in Firestore
  await admin.firestore().collection("userProfiles").doc(userId).update({
    userRole: "admin",
  });

  return {
    message: `Successfully made ${userId} an admin.`,
  };
});
