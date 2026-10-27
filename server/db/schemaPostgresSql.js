const fs = require('fs');
const path = require('path');

let sqlText;
try {
  sqlText = fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf-8');
} catch (e) {
  sqlText = '';
}

module.exports = sqlText;
