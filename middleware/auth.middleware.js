import AppError from "../utils/appError.js";
import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.middleware.js";


const isLoggedIn = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        return next(new AppError("Unauthorized access, please login", 401));
    }

    const token = authHeader.split(" ")[1];

    try {
        const userDetails = await jwt.verify(token, process.env.JWT_SECRET);
        req.user = userDetails;
        next();
    } catch (error) {
        return next(new AppError("Invalid or expired token, please login again", 401));
    }
}
 const authorizeRoles = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to view this route", 403)
      );
    }
     next();
  });

export { 
    isLoggedIn ,
    authorizeRoles,
};
