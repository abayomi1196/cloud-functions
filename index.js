const functions = require("firebase-functions");
const express = require("express");

const { FBAuth } = require("./utils/firebaseAuth");
const { db } = require("./utils/admin");
const {
  getAllScreams,
  addScream,
  getSingleScream,
  createScreamComment,
  likeScream,
  unLikeScream,
  deleteScream,
} = require("./handlers/screams");
const {
  signUpUser,
  loginUser,
  uploadImage,
  addUserDetails,
  getUserDetails,
  getHandleDetails,
  markNotificationsRead,
} = require("./handlers/users");

const app = express();

// scream routes
app.get("/screams", getAllScreams);
app.post("/screams", FBAuth, addScream);
app.get("/scream/:screamId", getSingleScream);
app.delete("/scream/:screamId", FBAuth, deleteScream);
app.post("/scream/:screamId/comment", FBAuth, createScreamComment);
app.get("/scream/:screamId/like", FBAuth, likeScream);
app.get("/scream/:screamId/unlike", FBAuth, unLikeScream);

// user routes
app.post("/signup", signUpUser);
app.post("/login", loginUser);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getUserDetails);
app.get("/user/:handle", getHandleDetails);
app.post("/notifications", FBAuth, markNotificationsRead);

exports.api = functions.https.onRequest(app);

// notifications
exports.createNotificationOnLike = functions.firestore
  .document("likes/{id}")
  .onCreate((snapshot) => {
    db.doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (doc.exists) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "like",
            read: false,
            screamId: doc.id,
          });
        }
      })
      .then(() => {
        return;
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.deleteNotificationOnUnLike = functions.firestore
  .document("likes/{id}")
  .onDelete((snapshot) => {
    db.doc(`/notifications/${snapshot.id}`)
      .delete()
      .then(() => {
        return;
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.createNotificationOnComment = functions.firestore
  .document("comments/{id}")
  .onCreate((snapshot) => {
    db.doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (doc.exists) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "comment",
            read: false,
            screamId: doc.id,
          });
        }
      })
      .then(() => {
        return;
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });
