require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const DocumentIntelligence =
  require("@azure-rest/ai-document-intelligence").default;
const { AzureKeyCredential } = require("@azure/core-auth");
const routes = require("./routes/routes");

const key = process.env.AZURE_KEY;
const endpoint = process.env.AZURE_ENDPOINT;
const mongoUri = process.env.MONGO_DB_URI;
const port = process.env.PORT || 3000;

const app = express();

app.use(express.json());

// connect to mongodb
mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  });

// check credentials
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

app.use("/", routes);

app.listen(port, async () => {
  await verifyCredentials();
  console.log(`Server running on port ${port}`);
});
