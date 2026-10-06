import connectDB from '../config/dbConnection.js';

export const ensureDbConnected = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database connection failed in serverless execution",
      error: error.message
    });
  }
};