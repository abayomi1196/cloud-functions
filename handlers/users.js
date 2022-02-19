const axios = require("axios");
const BusBoy = require("busboy");
const path = require("path");
const os = require("os");
const fs = require("fs");

const { isEmpty, isEmail, reduceUserDetails } = require("../utils/utils");
const { db, admin } = require("../utils/admin");

const API_KEY = "AIzaSyAvANygUB5N-80DEFvQKPP4RtI0bRPhfOs";
const STORAGE_BUCKET = "bored-ape-ba1ce.appspot.com";

// signup user - get user dets from req body, (1)check if user with that handle already exists before creating new user, (2) then generate custom token to authenticate their requests (3) create new doc in users collection with user's creds & send token to frontend.
exports.signUpUser = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle,
  };

  // ******** validation ********
  let errors = {};

  if (isEmpty(newUser.email)) {
    errors.email = "Must not be empty.";
  } else if (!isEmail(newUser.email)) {
    errors.email = "Must be a valid email address";
  }

  if (isEmpty(newUser.password)) {
    errors.password = "Must not be empty";
  }
  if (newUser.password !== newUser.confirmPassword) {
    errors.confirmPassword = "Passwords must match";
  }
  if (isEmpty(newUser.handle)) {
    errors.handle = "Must not be empty";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }
  // ******** end of validation ********

  const noImg = "no-img.webp";

  let token, userId;
  db.doc(`/users/${newUser.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        return res.status(400).json({ handle: "this handle is already taken" });
      } else {
        return admin
          .auth()
          .createUser({ email: newUser.email, password: newUser.password });
      }
    })
    .then(async (data) => {
      userId = data.uid;
      const userToken = await admin.auth().createCustomToken(data.uid);
      return userToken;
    })
    .then((idToken) => {
      token = idToken;
      const userCredentials = {
        handle: newUser.handle,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${noImg}?alt=media`,
        userId,
      };

      db.doc(`/users/${userCredentials.handle}`)
        .set(userCredentials)
        .then(() => {
          return res.status(201).json({ token });
        });
    })
    .catch((err) => {
      console.error(err);
      if ((err.code = "auth/email-already-exists")) {
        return res.status(400).json({ email: "Email is already in use" });
      } else {
        return res.status(500).json({ error: err });
      }
    });
};

// login user - (1)validate input, (2) make post request to firebase rest API signInWithPassword route, authenticated with API_KEY, (3) return token if successful or appropriate error message
exports.loginUser = (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password,
  };

  // ********** validation **********
  let errors = {};

  if (isEmpty(user.email)) {
    errors.email = "Must not be empty.";
  }
  if (isEmpty(user.password)) {
    errors.password = "Must not be empty.";
  }

  if (Object.keys(errors).length > 0) {
    res.status(400).json({ errors });
  }
  // ********** end of validation **********

  axios
    .post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      { email: user.email, password: user.password, returnSecureToken: true }
    )
    .then((result) => {
      return res.json({ userToken: result.data.idToken });
    })
    .catch((err) => {
      if (err.response?.status === 400) {
        console.log(err.response);
        return res
          .status(403)
          .json({ general: err.response.data.error.message });
      } else {
        res.status(500).json({ error: err.response.data.error.message });
      }
    });
};

// add user details
exports.addUserDetails = (req, res) => {
  let userDetails = reduceUserDetails(req.body);

  db.doc(`/users/${req.user.handle}`)
    .update(userDetails)
    .then(() => {
      res.json({ message: "Details added successfully" });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// get user details
exports.getUserDetails = (req, res) => {
  let userData = {};

  db.doc(`/users/${req.user.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        userData.credentials = doc.data();
        return db
          .collection("likes")
          .where("userHandle", "==", req.user.handle)
          .get();
      }
    })
    .then((data) => {
      userData.likes = [];
      data.forEach((doc) => {
        userData.likes.push(doc.data());
      });

      return db
        .collection("notifications")
        .where("recipient", "==", req.user.handle)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();
    })
    .then((data) => {
      userData.notifications = [];
      data.forEach((doc) =>
        userData.notifications.push({ notificationId: doc.id, ...doc.data() })
      );

      return res.json(userData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

// get handle details
exports.getHandleDetails = (req, res) => {
  let userData = {};

  db.doc(`/users/${req.params.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        userData.user = doc.data();
        return db
          .collection(`screams`)
          .where("userHandle", "==", req.params.handle)
          .orderBy("createdAt", "desc")
          .get();
      } else {
        res.status(404).json({ error: "User not found!" });
      }
    })
    .then((data) => {
      userData.screams = [];

      data.forEach((doc) => {
        userData.screams.push({ ...doc.data(), screamId: doc.id });
      });

      return res.json(userData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

// image upload using busboy
exports.uploadImage = (req, res) => {
  const busboy = BusBoy({ headers: req.headers });

  let imageFileName;
  let imageToBeUploaded = {};

  busboy.on("file", (fieldName, file, filename) => {
    if (
      filename.mimeType !== "image/jpeg" &&
      filename.mimeType !== "image/jpg" &&
      filename.mimeType !== "image/png" &&
      filename.mimeType !== "image/webp"
    ) {
      res.status(400).json({ error: "Wrong file selected" });
    }

    const imageExtension =
      filename.filename.split(".")[filename.filename.split(".").length - 1];

    imageFileName = `${Math.round(
      Math.random() * 100000000
    )}.${imageExtension}`;

    const filePath = path.join(os.tmpdir(), imageFileName);

    imageToBeUploaded = { filePath, mimetype: filename.mimeType };

    file.pipe(fs.createWriteStream(filePath));
  });

  busboy.on("finish", () => {
    admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filePath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetype,
          },
        },
      })
      .then(() => {
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${imageFileName}?alt=media`;

        console.log(imageUrl);

        return db
          .doc(`/users/${req.user.handle}`)
          .update({ imageUrl })
          .then(() => {
            return res.json({ message: "Image uploaded successfully" });
          })
          .catch((err) => {
            console.error(err);
            res.status(500).json({ error: err.code });
          });
      });
  });

  busboy.end(req.rawBody);
};
