
const fs = require("fs");

let index = fs.readFileSync("src/app/(tabs)/index.tsx", "utf8");
index = index.replace(/import \{ useAuth \} from "..\/..\/context\/AuthContext";/g, "import { useTheme } from \"../../context/ThemeContext\";\nimport { useAuth } from \"../../context/AuthContext\";");
index = index.replace(/export default function Home\(\) \{/, "export default function Home() {\n  const { theme } = useTheme();\n  const styles = React.useMemo(() => createStyles(theme), [theme]);");
index = index.replace(/const styles = StyleSheet\.create\(\{/, "const createStyles = (theme: any) => StyleSheet.create({");
index = index.replace(/"#2b2d31"/g, "theme.surface");
index = index.replace(/"#313338"/g, "theme.background");
index = index.replace(/"#1e1f22"/g, "theme.border");
index = index.replace(/"#5865F2"/g, "theme.accent");
index = index.replace(/"#f2f3f5"/g, "theme.text");
index = index.replace(/"#dbdee1"/g, "theme.text");
index = index.replace(/"#949ba4"/g, "theme.textMuted");
index = index.replace(/"#b5bac1"/g, "theme.textMuted");
index = index.replace(/"#4f545c"/g, "theme.textMuted");
index = index.replace(/"#80848e"/g, "theme.textMuted");
index = index.replace(/color: "#ffffff"/g, "color: theme.text");
index = index.replace(/color=theme.accent/g, "color={theme.accent}");
index = index.replace(/color=theme.text/g, "color={theme.text}");
index = index.replace(/color=theme.textMuted/g, "color={theme.textMuted}");
fs.writeFileSync("src/app/(tabs)/index.tsx", index);

console.log("Fixed index.tsx");

