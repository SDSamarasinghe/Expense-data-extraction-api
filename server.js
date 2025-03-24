/*
  This code sample shows Prebuilt Read operations with the Azure AI Document Intelligence client library. 

  To learn more, please visit the documentation - Quickstart: Document Intelligence (formerly Form Recognizer) SDKs
  https://learn.microsoft.com/azure/ai-services/document-intelligence/quickstarts/get-started-sdks-rest-api?pivots=programming-language-javascript
*/

require("dotenv").config();
const DocumentIntelligence =
  require("@azure-rest/ai-document-intelligence").default;
const {
  getLongRunningPoller,
  isUnexpected,
} = require("@azure-rest/ai-document-intelligence");
const { AzureKeyCredential } = require("@azure/core-auth");

function* getTextOfSpans(content, spans) {
  for (const span of spans) {
    yield content.slice(span.offset, span.offset + span.length);
  }
}

const key = process.env.AZURE_KEY;
const endpoint = process.env.AZURE_ENDPOINT;

// sample document
const formUrl =
  "https://www.billdu.com/wp-content/uploads/2022/10/downloadable-invoice-sample-in-excel.png";

async function main() {
  const client = DocumentIntelligence(endpoint, new AzureKeyCredential(key));
  const initialResponse = await client
    .path("/documentModels/{modelId}:analyze", "prebuilt-read")
    .post({
      contentType: "application/json",
      body: {
        urlSource: formUrl,
      },
    });

  if (isUnexpected(initialResponse)) {
    throw initialResponse.body.error;
  }

  const poller = getLongRunningPoller(client, initialResponse);
  const analyzeResult = (await poller.pollUntilDone()).body.analyzeResult;

  const content = analyzeResult?.content;
  const pages = analyzeResult?.pages;
  const languages = analyzeResult?.languages;
  const styles = analyzeResult?.styles;

  if (pages.length <= 0) {
    console.log("No pages were extracted from the document.");
  } else {
    console.log("Pages:");
    for (const page of pages) {
      console.log("- Page", page.pageNumber, `(unit: ${page.unit})`);
      console.log(`  ${page.width}x${page.height}, angle: ${page.angle}`);
      console.log(`  ${page.lines.length} lines, ${page.words.length} words`);
      if (page.lines.length > 0) {
        console.log("  Lines:");

        for (const line of page.lines) {
          console.log(`  - "${line.content}"`);
        }
      }
      if (page.words.length > 0) {
        for (const word of page.words) {
          console.log(`  - "${word.content}"`);
        }
      }
    }
  }

  if (!languages) {
    console.log("No language spans were extracted from the document.");
  } else {
    console.log("Languages:");
    for (const languageEntry of languages) {
      console.log(
        `- Found language: ${languageEntry.locale} (confidence: ${languageEntry.confidence})`
      );
      for (const text of getTextOfSpans(content, languageEntry.spans)) {
        const escapedText = text.replace(/\r?\n/g, "\\n").replace(/"/g, '\\"');
        console.log(`  - "${escapedText}"`);
      }
    }
  }

  if (styles.length <= 0) {
    console.log("No text styles were extracted from the document.");
  } else {
    console.log("Styles:");
    for (const style of styles) {
      console.log(
        `- Handwritten: ${style.isHandwritten ? "yes" : "no"} (confidence=${
          style.confidence
        })`
      );

      for (const word of getTextOfSpans(content, style.spans)) {
        console.log(`  - "${word}"`);
      }
    }
  }
}

main().catch((error) => {
  console.error("An error occurred:", error);
  process.exit(1);
});
