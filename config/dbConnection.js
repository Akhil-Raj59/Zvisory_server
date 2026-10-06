import mongoose from "mongoose";

mongoose.set('strictQuery', false);

const connectDB = async () => {
  // state == 1 matlab connected, state == 2 matlab connecting
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Serverless environments ke liye connection options optimize karein
      serverSelectionTimeoutMS: 5000, // 5 seconds me fail ho jaye agar DB down ho, taaki 10s ka Vercel timeout na aaye
      socketTimeoutMS: 45000,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    throw error; 
  }
};

export default connectDB;