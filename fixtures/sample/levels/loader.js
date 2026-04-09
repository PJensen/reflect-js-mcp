const fs = require("fs");

function loadLevel(path) {
  const data = fs.readFileSync(path, "utf-8");
  return JSON.parse(data);
}

module.exports = { loadLevel };
