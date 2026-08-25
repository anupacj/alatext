
const fs = require("fs");
const files = ["src/app/(tabs)/index.tsx", "src/app/(tabs)/profile.tsx", "src/app/chat.tsx"];

files.forEach(f => {
  let code = fs.readFileSync(f, "utf8");

  // Fix index.tsx imports
  code = code.replace(/import \{ useTheme \} from \x27\.\.\/\.\.\/context\/ThemeContext\x27;\s+import \{ useTheme \} from \"\.\.\/\.\.\/context\/ThemeContext\";\s+import \{ useAuth \} from \"\.\.\/\.\.\/context\/AuthContext\";\s+import \{ useTheme \} from \"\.\.\/\.\.\/context\/ThemeContext\";/g, 
    `import { useTheme } from "../../context/ThemeContext";\nimport { useAuth } from "../../context/AuthContext";`);
  
  // Fix profile.tsx imports (wait, just dedup all useTheme and useAuth)
  // Let"s just do a brutal replace for any clustered ThemeContext and AuthContext imports
  code = code.replace(/(import \{ (useTheme|useAuth) \} from .*\n)+/g, `import { useTheme } from "../../context/ThemeContext";\nimport { useAuth } from "../../context/AuthContext";\n`);
  
  if (f === "src/app/chat.tsx") {
      code = code.replace(/import \{ useTheme \} from \"\.\.\/\.\.\/context/g, `import { useTheme } from \"../context`);
      code = code.replace(/import \{ useAuth \} from \"\.\.\/\.\.\/context/g, `import { useAuth } from \"../context`);
  }

  // Remove duplicate hooks
  code = code.replace(/const \{ theme \} = useTheme\(\);\s+const styles = React.useMemo\(\(\) => createStyles\(theme\), \[theme\]\);\s+const \{ theme \} = useTheme\(\);\s+const styles = React.useMemo\(\(\) => createStyles\(theme\), \[theme\]\);/g, `const { theme } = useTheme();\n  const styles = React.useMemo(() => createStyles(theme), [theme]);`);

  fs.writeFileSync(f, code);
  console.log("Fixed duplicates in", f);
});

