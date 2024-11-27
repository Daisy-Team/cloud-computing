const { createCanvas } = require("canvas");
const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

const serviceAccount = require("./firebase_service_account.json");

const app = express();
app.use(bodyParser.json()); // Parse JSON bodies

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "gs://inbound-decker-441613-s6.firebasestorage.app", // Replace with your storage bucket URL
});

const bucket = admin.storage().bucket();

/**
 * Uploading Image to firebase bucket
 */

// Generate image with initials
function generateInitialsImage(
  initials,
  bgColor = "#007BFF",
  textColor = "#FFFFFF"
) {
  const canvas = createCanvas(128, 128); // 128x128 image
  const ctx = canvas.getContext("2d");

  // Draw background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw initials
  ctx.fillStyle = textColor;
  ctx.font = "bold 64px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials, canvas.width / 2, canvas.height / 2);

  return canvas.toBuffer("image/png");
}

// Assuming `buffer` contains the image data (e.g., generated from Canvas)
// const fileName = `profile-pictures/${Date.now()}_${initials}.png`;
// const file = bucket.file(fileName);

// const stream = file.createWriteStream({
//   metadata: { contentType: "image/png" },
// });

// stream.end(buffer);

// stream.on("finish", async () => {
//   // Make the file publicly accessible
//   await file.makePublic();
//   const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

//   // Send the URL back to the client or save it to the user profile
//   res.status(201).json({
//     message: "Profile picture generated successfully",
//     imageUrl: publicUrl,
//   });
// });

/**
 * APIs
 */
// Health check route
app.get("/", (req, res) => {
  res.send("API is running!");
});

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await admin.auth().createUser({ email, password });
    res.status(201).json({ message: "User registered successfully", user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // You can use Firebase Client SDK on the frontend to generate the token.
    const user = await admin.auth().getUserByEmail(email);
    res.status(200).json({ message: "Login successful", user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/logout", async (req, res) => {
  const { uid } = req.body;

  try {
    await admin.auth().revokeRefreshTokens(uid);
    res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const link = await admin.auth().generatePasswordResetLink(email);
    res.status(200).json({ message: "Password reset link sent", link });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * SECURING API
 *
 * This methode used for securing the api
 */

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split("Bearer ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid token" });
  }
};

/**
 * Verifying Token
 */
app.get("/protected", verifyToken, (req, res) => {
  res.status(200).json({ message: "Access granted", user: req.user });
});

// API to generate and upload the initial image
app.post("/generate-profile-picture", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  // Extract initials
  const initials = name
    .split(" ")
    .map((word) => word[0].toUpperCase())
    .join("")
    .slice(0, 2); // Max 2 initials

  try {
    // Generate image buffer
    const buffer = generateInitialsImage(initials);

    // Define file name and path
    const fileName = `profile-pictures/${Date.now()}_${initials}.png`;
    const file = bucket.file(fileName);

    // Upload to Firebase Storage
    const stream = file.createWriteStream({
      metadata: { contentType: "image/png" },
    });

    stream.end(buffer);

    stream.on("finish", async () => {
      // Make the file publicly accessible
      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      res.status(201).json({
        message: "Profile picture generated successfully",
        imageUrl: publicUrl,
      });
    });

    stream.on("error", (error) => {
      console.error(error);
      res.status(500).json({ error: "Failed to upload profile picture" });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  // await admin.auth().updateUser(uid, {
  //   photoURL: publicUrl,
  // });
});

/**
 * Running the Server
 */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
