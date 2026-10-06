import { Router } from "express";
import { getProfile, login, logout,verifyEmail,resendVerificationOTP, register,forgotPassword,resetPassword,changePassword ,updateUser} from "../controllers/user.controllers.js";
import { isLoggedIn } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = Router();


router.post(
    "/register",
    upload.single("avatar"),
    register
);

router.post(
    "/verify-email",
    verifyEmail
);

router.post(
    "/resend-verification-otp",
    resendVerificationOTP
);

router.post("/login", login);

router.get(
    "/me",
    isLoggedIn,
    getProfile
);

router.get(
    "/logout",
    logout
);

router.post(
    "/forget-password",
    forgotPassword
);

router.post(
    "/reset-password/:resetToken",
    resetPassword
);

router.post(
    "/change-password",
    isLoggedIn,
    changePassword
);

router.put(
    "/update/:id",
    isLoggedIn,
    upload.single("avatar"),
    updateUser
);
export default router;