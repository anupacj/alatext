const puppeteer = require("puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({ 
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new" 
  });
  const page = await browser.newPage();
  page.on("console", msg => console.log("PAGE LOG:", msg.type(), msg.text()));
  page.on("pageerror", error => console.log("PAGE ERROR:", error.message));
  page.on("requestfailed", request => console.log("REQUEST FAILED:", request.url(), request.failure().errorText));
  
  console.log("Navigating to http://localhost:8081/chat...");
  await page.goto("http://localhost:8081/chat", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();
