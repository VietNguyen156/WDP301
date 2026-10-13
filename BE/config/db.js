const mongoose = require('mongoose');
module.exports = async () => {
  if (!process.env.MONGO_URI) throw new Error('Thiếu MONGO_URI. Tạo BE/.env từ BE/.env.example.');
  const conn = await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
};
