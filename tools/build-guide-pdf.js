/* Regenerates assets/tbg-dmv-financing-guide.pdf from guide-financing.html.
   Re-run after editing the guide (program amounts and loan limits change often):

     python3 -m http.server 8765 &          # serve the site root
     npx playwright@1 install chromium      # first time only
     node tools/build-guide-pdf.js          # or pass a base URL as the first arg

   Unlike the browser's "Print" button, this reserves a real bottom margin on
   every page and draws the navy footer band there, so it never overlaps text. */
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const base = process.argv[2] || "http://localhost:8765";
  const out = path.join(__dirname, "..", "assets", "tbg-dmv-financing-guide.pdf");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(base + "/guide-financing.html", { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "@page { margin: 0 0 0.5in 0; } .doc-footer { display: none !important; } .doc { padding-bottom: 0 !important; }" });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: "print" });
  const footer =
    '<style>#footer{padding:0 !important;margin:0 !important;}</style>' +
    '<div style="width:100%;height:0.5in;background:#062e44;-webkit-print-color-adjust:exact;print-color-adjust:exact;display:flex;align-items:center;justify-content:space-between;padding:0 0.85in;box-sizing:border-box;font-family:sans-serif;font-weight:300;font-size:8px;letter-spacing:.16em;color:rgba(242,237,225,.78);">' +
    '<span>THE BANKS GROUP · THE DMV FINANCING GUIDE</span><span>202.669.9634 · BANKSGROUPDMV.COM · <span class="pageNumber"></span></span></div>';
  await page.pdf({
    path: out, format: "Letter", printBackground: true,
    displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: footer,
    margin: { top: "0", bottom: "0.5in", left: "0", right: "0" }
  });
  await browser.close();
  console.log("Wrote " + out);
})();
