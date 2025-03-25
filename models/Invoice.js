const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema({
  docType: { type: String, default: "Unknown" },
  vendor: { type: String, default: "Unknown" },
  date: { type: Date, default: Date.now },
  total: { type: Number, default: 0 },
  currency: { type: String, default: "Unknown" },
  tax: { type: Number, default: 0 },
  category: { type: String, default: "Unknown" },
  lineItems: { type: Array, default: [] },
  confidence: { type: Number, default: 0 },
  pageNumber: { type: Array, default: [] },
  PaymentTerms: { type: String, default: "Unknown" },
});

const Invoice = mongoose.model("Invoice", InvoiceSchema);

module.exports = Invoice;
