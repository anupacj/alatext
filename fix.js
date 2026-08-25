const fs = require('fs');
const files = ['src/app/(tabs)/index.tsx', 'src/app/(tabs)/profile.tsx', 'src/app/chat.tsx'];

files.forEach(f => {
  let code = fs.readFileSync(f, 'utf8');
  
  code = code.split('\
').join('\n');
  code = code.split('\\n').join('\n');

  if (f === 'src/app/chat.tsx') {
    code = code.split('../../context/AuthContext').join('../context/AuthContext');
    code = code.split('../../context/ThemeContext').join('../context/ThemeContext');
  }

  fs.writeFileSync(f, code);
  console.log('Fixed', f);
});
