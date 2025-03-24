const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const DocumentIntelligence =
  require("@azure-rest/ai-document-intelligence").default;
const {
  getLongRunningPoller,
  isUnexpected,
} = require("@azure-rest/ai-document-intelligence");
const { AzureKeyCredential } = require("@azure/core-auth");

const router = express.Router();

const key = process.env.AZURE_KEY;
const endpoint = process.env.AZURE_ENDPOINT;

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|jpg|jpeg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only PDF, JPG, and PNG files are allowed!"));
  },
});

// Analyze document
async function analyzeDocument(filePath) {
  const client = DocumentIntelligence(endpoint, new AzureKeyCredential(key));
  const fileStream = fs.createReadStream(filePath);
  const initialResponse = await client
    .path("/documentModels/{modelId}:analyze", "prebuilt-read")
    .post({
      contentType: "application/octet-stream",
      body: fileStream,
    });

  if (isUnexpected(initialResponse)) {
    throw initialResponse.body.error;
  }

  const poller = getLongRunningPoller(client, initialResponse);
  const analyzeResult = (await poller.pollUntilDone()).body.analyzeResult;

  return analyzeResult;
}

// Upload endpoint
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = path.join(__dirname, "../uploads", file.filename);
    const analyzeResult = await analyzeDocument(filePath);

    // Clean up the uploaded file
    fs.unlinkSync(filePath);

    res.json(analyzeResult);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).json({ error: "Failed to analyze document" });
  }
});

module.exports = router;
