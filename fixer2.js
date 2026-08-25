
const fs = require("fs");
const files = ["src/app/(tabs)/index.tsx", "src/app/(tabs)/profile.tsx", "src/app/chat.tsx"];

files.forEach(f => {
  let code = fs.readFileSync(f, "utf8");
  code = code.replace(/\\n/g, "\n");
  fs.writeFileSync(f, code);
  console.log("Fixed newlines in", f);
});

