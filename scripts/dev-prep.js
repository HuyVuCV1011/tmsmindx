/**
 * Frees PORT (default 3000) and removes .next before `npm run dev`.
 */
const fs = require("fs");
const path = require("path");

const killPort = require("kill-port");

const port = Number(process.env.DEV_PREP_PORT || process.env.PORT || 3000, 10);

(async () => {
  try {
    await killPort(port);
  } catch {
    // Port already free or nothing to kill
  }
})();
