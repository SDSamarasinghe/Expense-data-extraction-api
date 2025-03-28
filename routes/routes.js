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
const Invoice = require("../models/Invoice");

const router = express.Router();
const key = process.env.AZURE_KEY;
const endpoint = process.env.AZURE_ENDPOINT;

// configure multer
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

// analyze document and extract specific fields
async function analyzeDocument(filePath) {
  const client = DocumentIntelligence(endpoint, new AzureKeyCredential(key));
  const fileStream = fs.createReadStream(filePath);

  // Use prebuilt-invoice model for structured data extraction
  const initialResponse = await client
    .path("/documentModels/{modelId}:analyze", "prebuilt-invoice")
    .post({
      contentType: "application/octet-stream",
      body: fileStream,
    });

  if (isUnexpected(initialResponse)) {
    throw initialResponse.body.error;
  }

  const poller = getLongRunningPoller(client, initialResponse);
  const analyzeResult = (await poller.pollUntilDone()).body.analyzeResult;

  // extract the custom fields
  const documents = analyzeResult?.documents;
  const document = documents && documents[0];

  if (!document) {
    throw new Error("No documents found");
  }

  // map the extracted fields to the Invoice model
  return {
    docType: document.docType || "Unknown",
    vendor: document.fields.VendorName.content || "Unknown",
    date: document.fields.InvoiceDate?.valueDate || "Unknown",
    total: document.fields.InvoiceTotal?.valueCurrency?.amount || "Unknown",
    currency:
      document.fields.InvoiceTotal?.valueCurrency.currencyCode || "Unknown",
    tax: document.fields.TotalTax?.valueCurrency?.amount || "Unknown",
    category: document.fields.Category?.value || "Unknown",
    lineItems: document.fields.Items.valueArray || [],
    confidence: document.confidence || "Unknown",
    pageNumber: document.boundingRegions.pageNumber || [],
    PaymentTerms: document.fields.PaymentTerm.content || "Unknown",
  };
}

// file upload
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = path.join(__dirname, "../uploads", file.filename);
    const extractedData = await analyzeDocument(filePath);

    // save extracted data to mongodb
    const invoice = new Invoice(extractedData);
    await invoice.save();

    // clean up the uploaded file
    fs.unlinkSync(filePath);

    res.json(extractedData);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).json({ error: "Failed to analyze document" });
  }
});

// get all invoices
router.get("/invoices", async (req, res) => {
  try {
    const invoices = await Invoice.find();
    console.log("🚀 ~ router.get ~ invoices:", invoices);
    res.json(invoices);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

// get single invoice by id
router.get("/invoices/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json(invoice);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
});

router.put("/invoices/:id/category", async (req, res) => {
  console.log("🚀 ~ router.put ~ req:", req);
  try {
    const { id } = req.params;
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({ error: "Category is required" });
    }

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      { category },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json(invoice);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

module.exports = router;
