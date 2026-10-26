const dns = require("dns");
const mongoose = require("mongoose");
module.exports = async () => {
  if (!process.env.MONGO_URI)
    throw new Error("Thiếu MONGO_URI. Tạo BE/.env từ BE/.env.example.");
  const dnsServers = (process.env.MONGO_DNS_SERVERS || "1.1.1.1,8.8.8.8")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);
  if (dnsServers.length) dns.setServers(dnsServers);
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log(
    `MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`,
  );
  return conn;
};
