const fs = require('fs');
let lines = fs.readFileSync('server/api/automaten.ts', 'utf8').split('\n');

const newLines = [
  '  let browser;',
  '  try {',
  '    const isLocal = process.env.NODE_ENV === \"development\";',
  '',
  '    browser = await puppeteer.launch({',
  '      headless: isLocal ? true : chromium.headless,',
  '      executablePath: isLocal',
  '        ? process.env.CHROMIUM_PATH || \"C:\\\\\\\\Program Files\\\\\\\\Google\\\\\\\\Chrome\\\\\\\\Application\\\\\\\\chrome.exe\"',
  '        : await chromium.executablePath(\"https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar\"),',
  '      args: isLocal ? [\"--no-sandbox\", \"--disable-setuid-sandbox\"] : chromium.args,',
  '      defaultViewport: chromium.defaultViewport,',
  '    });',
  '',
  '    const page = await browser.newPage();',
  '',
  '    // Log in'
];

lines.splice(42, 12, ...newLines);
fs.writeFileSync('server/api/automaten.ts', lines.join('\n'));
