const functions = require("firebase-functions");
const express = require("express");
const cookieParser = require("cookie-parser");
const firebase = require("firebase/app");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase_service_account.json");
const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
} = require("firebase/auth");

require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cookieParser());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER,
  appId: process.env.APP_ID,
};
firebase.initializeApp(firebaseConfig);

const auth = getAuth();

class FirebaseAuthController {
  async registerUser(req, res) {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(422).json({
        error: true,
        message: "Name, email, and password are required",
      });
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      await admin.auth().updateUser(user.uid, {
        displayName: name,
        emailVerified: false,
      });
      await sendEmailVerification(user);
      res.status(201).json({
        error: false,
        message: "User Created! Check email for verification",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: true,
        message: error.message || "An error occurred while registering user",
      });
    }
  }

  async loginUser(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(422).json({
        error: true,
        message: "Email and password are required",
      });
    }
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const idToken = userCredential._tokenResponse.idToken;
      const { uid, displayName } = userCredential.user;
      if (idToken) {
        res.cookie("access_token", idToken, {
          httpOnly: true,
        });
        res.status(200).json({
          error: false,
          message: "success",
          loginResult: {
            userId: uid,
            name: displayName,
            token: idToken,
          },
        });
      } else {
        res.status(500).json({
          error: true,
          message: "Internal Server Error",
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: true,
        message: error.message || "An error occurred while logging in",
      });
    }
  }

  async logoutUser(req, res) {
    try {
      await signOut(auth);
      res.clearCookie("access_token");
      res.status(200).json({
        error: false,
        message: "User logged out successfully",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: true,
        message: "Internal Server Error",
      });
    }
  }

  async resetPassword(req, res) {
    const { email } = req.body;
    if (!email) {
      return res.status(422).json({
        error: true,
        message: "Email is required",
      });
    }
    try {
      await sendPasswordResetEmail(auth, email);
      res.status(200).json({
        error: false,
        message: "Password reset email sent successfully!",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: true,
        message: "Internal Server Error",
      });
    }
  }
}

const verifyToken = async (req, res, next) => {
  const idToken = req.cookies.access_token;
  if (!idToken) {
    return res.status(403).json({ error: "No token provided" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(403).json({ error: "Unauthorized" });
  }
};

const router = express.Router();
const firebaseAuthController = new FirebaseAuthController();

router.post("/api/register", firebaseAuthController.registerUser);
router.post("/api/login", firebaseAuthController.loginUser);
router.post("/api/logout", firebaseAuthController.logoutUser);
router.post("/api/reset-password", firebaseAuthController.resetPassword);

app.use(router);

app.get("/", (req, res) => {
  res.send("API is running");
});

exports.app = functions.region("asia-southeast2").https.onRequest(app);
