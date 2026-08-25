const fs = require('fs');

const FILES = [
  'src/app/(tabs)/index.tsx',
  'src/app/(tabs)/profile.tsx',
  'src/app/chat.tsx'
];

FILES.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');

  if (!code.includes('useTheme')) {
    code = code.replace(/import \{ useAuth \} from \".*?\";/g, 
      'import { useAuth } from "../../context/AuthContext";\\nimport { useTheme } from "../../context/ThemeContext";');
    
    code = code.replace(/import \{ useAuth \} from \"..\/context\/AuthContext\";/g, 
      'import { useAuth } from "../context/AuthContext";\\nimport { useTheme } from "../context/ThemeContext";');

    code = code.replace(/export default function .*?\(\) \{/g, 
      match => match + '\\n  const { theme } = useTheme();\\n  const styles = React.useMemo(() => createStyles(theme), [theme]);');
  }

  if (code.includes('const styles = StyleSheet.create({')) {
    code = code.replace(/const styles = StyleSheet\.create\(\{/, 'const createStyles = (theme: any) => StyleSheet.create({');
  }

  code = code.replace(/\"#2b2d31\"/g, 'theme.surface');
  code = code.replace(/\"#313338\"/g, 'theme.background');
  code = code.replace(/\"#1e1f22\"/g, 'theme.border');
  code = code.replace(/\"#5865F2\"/g, 'theme.accent');
  code = code.replace(/\"#f2f3f5\"/g, 'theme.text');
  code = code.replace(/\"#dbdee1\"/g, 'theme.text');
  code = code.replace(/\"#949ba4\"/g, 'theme.textMuted');
  code = code.replace(/\"#b5bac1\"/g, 'theme.textMuted');
  code = code.replace(/\"#4f545c\"/g, 'theme.textMuted');
  code = code.replace(/\"#80848e\"/g, 'theme.textMuted');
  code = code.replace(/color: \"#ffffff\"/g, 'color: theme.text');
  
  fs.writeFileSync(file, code);
  console.log('Processed', file);
});
