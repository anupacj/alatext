import re

with open('src/app/chat.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

def replace_styles(match):
    inner = match.group(1)
    inner = inner.replace('\"#313338\"', 'bg')
    inner = inner.replace('\"#2b2d31\"', 'surface')
    inner = inner.replace('\"#1e1f22\"', 'border')
    inner = inner.replace('\"#f2f3f5\"', 'text')
    inner = inner.replace('\"#dbdee1\"', 'text')
    inner = inner.replace('\"#ffffff\"', 'text')
    inner = inner.replace('\"#b5bac1\"', 'textMuted')
    inner = inner.replace('\"#949ba4\"', 'textMuted')
    inner = inner.replace('\"#80848e\"', 'textMuted')
    inner = inner.replace('\"#5865F2\"', 'accent')
    inner = inner.replace('\"#383a40\"', 'inputBg')
    inner = inner.replace('\"#4e5058\"', 'inputBg')
    
    return f'''const createStyles = (isAmoled: boolean) => {{
  const bg = isAmoled ? '#000000' : '#313338';
  const surface = isAmoled ? '#000000' : '#2b2d31';
  const border = isAmoled ? '#222222' : '#1e1f22';
  const text = isAmoled ? '#ffffff' : '#dbdee1';
  const textMuted = isAmoled ? '#888888' : '#949ba4';
  const accent = isAmoled ? '#ffffff' : '#5865F2';
  const inputBg = isAmoled ? '#111111' : '#383a40';

  return StyleSheet.create({{{inner}}});
}};'''

code = re.sub(r'const styles = StyleSheet\.create\(\{([\s\S]*?)\}\);', replace_styles, code)

code = code.replace('import { useAuth } from "../context/AuthContext";', 'import { useAuth } from "../../context/AuthContext";\nimport { useTheme } from "../../context/ThemeContext";')

code = code.replace('export default function ChatScreen() {', 'export default function ChatScreen() {\n  const { theme } = useTheme();\n  const isAmoled = theme.id === "black";\n  const styles = React.useMemo(() => createStyles(isAmoled), [isAmoled]);')

code = code.replace('setImageViewerUrl }: any) => {', 'setImageViewerUrl, isAmoled, styles }: any) => {')

code = code.replace('const sentColor = chatSettings?.bubble_color_sent || "#5865F2";', 'const sentColor = chatSettings?.bubble_color_sent || (isAmoled ? "#000000" : "#5865F2");')
code = code.replace('const receivedColor = chatSettings?.bubble_color_received || "#2b2d31";', 'const receivedColor = chatSettings?.bubble_color_received || (isAmoled ? "#000000" : "#2b2d31");')

code = re.sub(r'<MessageRow[\s\n]*item=\{item\}', '<MessageRow isAmoled={isAmoled} styles={styles} \n          item={item}', code)

with open('src/app/chat.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

