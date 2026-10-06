import { v2 } from 'cloudinary';
import Razorpay from 'razorpay';
import app from './app.js';
import connectToDB from './config/dbConnection.js';





if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  
  connectToDB().then(() => {
    app.listen(PORT, () => {
      console.log(`App is running locally at http://localhost:${PORT}`);
    });
  });
}

export default app;