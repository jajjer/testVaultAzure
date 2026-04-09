import { createApp } from "./app.js";
import { apiPort, validateConfigForStart } from "./config.js";
import { getPool } from "./db/pool.js";

validateConfigForStart();
await getPool();

const app = createApp();
app.listen(apiPort, () => {
  console.log(`[testvault-api] listening on :${apiPort}`);
});
