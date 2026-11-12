const fs = require('fs');
const content = fs.readFileSync('/Users/aanyasarna/E-D-I-T-H/mcp-ide/frontend/src/pages/IDEPage.tsx', 'utf8');
const exportMatches = content.match(/export default/g);
console.log("export default count:", exportMatches ? exportMatches.length : 0);
