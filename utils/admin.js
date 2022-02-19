const admin = require("firebase-admin");

const serviceAccount = require("../ServiceAcountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "bored-ape-ba1ce.appspot.com",
});
const db = admin.firestore();

module.exports = { admin, db };
