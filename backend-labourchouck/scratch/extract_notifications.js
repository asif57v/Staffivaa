const fs = require('fs');
const path = require('path');

function findFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(file));
    } else if (file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = findFiles('backend-labourchouck/src');
const triggers = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Match triggerNotification({ ... })
  const regex = /triggerNotification\(\s*\{([\s\S]*?)\}\s*\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const block = match[1];
    const typeMatch = block.match(/type:\s*['"]([^'"]+)['"]/);
    const roleMatch = block.match(/recipientRole:\s*(['"][^'"]+['"]|USER_ROLES\.[A-Z]+)/);
    const titleMatch = block.match(/title:\s*(.+)/);
    
    triggers.push({
      file: path.basename(file),
      type: typeMatch ? typeMatch[1] : 'Unknown',
      role: roleMatch ? roleMatch[1] : 'Unknown',
      title: titleMatch ? titleMatch[1].trim().replace(/,$/, '') : 'Unknown'
    });
  }
});

console.log(JSON.stringify(triggers.filter(t => t.role.includes('LABOUR') || t.file === 'workforceController.js' || t.file === 'triggerBookingNotif.js' || t.file === 'allocationController.js'), null, 2));
