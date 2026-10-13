// Isolated database for browser tests. Never loads the project's .env or seed.js.
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "browser-test-secret-at-least-32-characters";
process.env.CLIENT_URL = "http://localhost:5174";
const app = require("../app");
const fixture = require("./fixture");
async function start() {
  const db = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "7.0.14" },
  });
  await mongoose.connect(db.getUri(), {
    dbName: "property_core_browser_tests",
  });
  for (const model of Object.values(mongoose.models)) await model.init();
  await fixture();
  const server = app.listen(5001, "127.0.0.1", () =>
    console.log("Browser test API ready on 5001"),
  );
  const stop = async () => {
    server.close();
    await mongoose.disconnect();
    await db.stop();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
start().catch((error) => {
  console.error(error);
  process.exit(1);
});
