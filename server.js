require("dotenv").config();
const express = require("express");
const DocumentIntelligence =
  require("@azure-rest/ai-document-intelligence").default;
const { AzureKeyCredential } = require("@azure/core-auth");
const routes = require("./routes/routes");

const key = process.env.AZURE_KEY;
const endpoint = process.env.AZURE_ENDPOINT;

// Initialize Express app
const app = express();
const port = 3000;

// Verify credentials
async function verifyCredentials() {
  try {
    const client = DocumentIntelligence(endpoint, new AzureKeyCredential(key));
    await client.path("/info").get();
    console.log("Credentials are valid.");
  } catch (error) {
    console.error("Invalid credentials:", error);
    process.exit(1);
  }
}

// Use routes
app.use("/", routes);

// Start server
app.listen(port, async () => {
  await verifyCredentials();
  console.log(`Server running on port ${port}`);
});
