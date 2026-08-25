const fs = require('fs');
let code = fs.readFileSync('src/app/chat_original.tsx', 'utf8');

code = code.replace(/const styles = StyleSheet\.create\(\{([\s\S]*?)\}\);/, function(match, inner) {
  let newInner = inner;
  newInner = newInner.replace(/\"#313338\"/g, 'bg');
  newInner = newInner.replace(/\"#2b2d31\"/g, 'surface');
  newInner = newInner.replace(/\"#1e1f22\"/g, 'border');
  newInner = newInner.replace(/\"#f2f3f5\"/g, 'text');
  newInner = newInner.replace(/\"#dbdee1\"/g, 'text');
  newInner = newInner.replace(/\"#ffffff\"/g, 'text');
  newInner = newInner.replace(/\"#b5bac1\"/g, 'textMuted');
  newInner = newInner.replace(/\"#949ba4\"/g, 'textMuted');
  newInner = newInner.replace(/\"#80848e\"/g, 'textMuted');
  newInner = newInner.replace(/\"#5865F2\"/g, 'accent');
  newInner = newInner.replace(/\"#383a40\"/g, 'inputBg');
  newInner = newInner.replace(/\"#4e5058\"/g, 'inputBg');

  return \const createStyles = (isAmoled: boolean) => {
  const bg = isAmoled ? '#000000' : '#313338';
  const surface = isAmoled ? '#000000' : '#2b2d31';
  const border = isAmoled ? '#222222' : '#1e1f22';
  const text = isAmoled ? '#ffffff' : '#dbdee1';
  const textMuted = isAmoled ? '#888888' : '#949ba4';
  const accent = isAmoled ? '#ffffff' : '#5865F2';
  const inputBg = isAmoled ? '#111111' : '#383a40';

  return StyleSheet.create({\});
};\;
});

// Update imports
code = code.replace(/import \{ useAuth \} from "..\/context\/AuthContext";/, "import { useAuth } from \"../../context/AuthContext\";\nimport { useTheme } from \"../../context/ThemeContext\";");

// Update ChatScreen component
code = code.replace(/export default function ChatScreen\(\) \{/, "export default function ChatScreen() {\n  const { theme } = useTheme();\n  const isAmoled = theme.id === 'black';\n  const styles = React.useMemo(() => createStyles(isAmoled), [isAmoled]);");

// Update MessageRow props
code = code.replace(/setImageViewerUrl \}: any\) => \{/, "setImageViewerUrl, isAmoled, styles }: any) => {");
code = code.replace(/const sentColor = chatSettings\?\.bubble_color_sent \|\| \"#5865F2\";/, "const sentColor = chatSettings?.bubble_color_sent || (isAmoled ? '#000000' : '#5865F2');");
code = code.replace(/const receivedColor = chatSettings\?\.bubble_color_received \|\| \"#2b2d31\";/, "const receivedColor = chatSettings?.bubble_color_received || (isAmoled ? '#000000' : '#2b2d31');");

// Render MessageRow
code = code.replace(/<MessageRow \r?\n          item=\{item\}/, "<MessageRow isAmoled={isAmoled} styles={styles} \n          item={item}");

fs.writeFileSync('src/app/chat_modified.tsx', code);
