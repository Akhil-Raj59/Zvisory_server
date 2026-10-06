import cloudinary from "cloudinary";
import crypto from "crypto";
import fs from "fs/promises";


import User from "../models/user.model.js";
import AppError from "../utils/appError.js";
import resetPasswordEmail from "../utils/emails/sendPasswordResetEmail.js";
import sendVerificationEmail from "../utils/emails/sendVerificationEmail.js";
import asyncHandler from "../middleware/asyncHandler.middleware.js";



const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    maxAge: 7 * 24 * 60 * 60 * 1000
};


const register = asyncHandler(async (req, res, next) => {

    const { fullName, email, password, phoneNumber, role } = req.body;

    if (!fullName || !email || !password) {
        return next(
            new AppError(
                "All fields are required",
                400
            )
        );
    }

 

    const existingUser = await User.findOne({ email });

    if (existingUser) {

        if (!existingUser.isEmailVerified) {
            return next(
                new AppError(
                    "Email already registered but not verified. Please verify your email.",
                    409
                )
            );
        }

        return next(
            new AppError(
                "User already exists",
                409
            )
        );
    }

    let user;
    try {
        user = await User.create({
            fullName,
            email,
            password,
            phoneNumber: phoneNumber || "",
            role: role || "CUSTOMER",
            avatar: {
                public_id: "default_avatar",
                secure_url:
                    "https://res.cloudinary.com/du9jzqlpt/image/upload/v1674647316/avatar_drzgxv.jpg"
            }
        });
    } catch (err) {
        if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
            return next(
                new AppError("Email is already registered", 409)
            );
        }
        throw err;
    }


    if (req.file) {

        try {

            const result =
                await cloudinary.v2.uploader.upload(
                    req.file.path,
                    {
                        folder: "avatars",
                        width: 250,
                        height: 250,
                        crop: "fill",
                        gravity: "face"
                    }
                );

            if (result) {

                user.avatar = {
                    public_id: result.public_id,
                    secure_url: result.secure_url
                };
            }

            await fs.rm(
                req.file.path,
                { force: true }
            );

        } catch (error) {

            await fs.rm(
                req.file.path,
                { force: true }
            );

            return next(
                new AppError(
                    "Avatar upload failed",
                    500
                )
            );
        }
    }

    const otp =
        await user.generateEmailVerificationOTP();

    await user.save();

    try {

        await sendVerificationEmail(
            user.email,
            otp,
            user.fullName
        );

    } catch (error) {

        user.emailVerificationOTP = undefined;
        user.emailVerificationOTPExpiry = undefined;

        await user.save();

        return next(
            new AppError(
                "Failed to send verification email",
                500
            )
        );
    }

    res.status(201).json({
        success: true,
        message:
            "Verification OTP sent successfully"
    });
});

const verifyEmail = asyncHandler(
    async (req, res, next) => {

        const { email, otp } = req.body;

        if (!email || !otp) {
            return next(
                new AppError(
                    "Email and OTP are required",
                    400
                )
            );
        }

        const user = await User.findOne({
            email
        }).select("+emailVerificationOTP");

        if (!user) {
            return next(
                new AppError(
                    "User not found",
                    404
                )
            );
        }

        const hashedOTP = crypto
            .createHash("sha256")
            .update(otp)
            .digest("hex");

        if (
            user.emailVerificationOTP !==
            hashedOTP
        ) {
            return next(
                new AppError(
                    "Invalid OTP",
                    400
                )
            );
        }

        if (
            user.emailVerificationOTPExpiry <
            Date.now()
        ) {
            return next(
                new AppError(
                    "OTP has expired",
                    400
                )
            );
        }

        user.isEmailVerified = true;

        user.emailVerificationOTP = undefined;
        user.emailVerificationOTPExpiry =
            undefined;

        await user.save();

        const token =
            await user.generateToken();

        user.password = undefined;

        res.status(200).json({
            success: true,
            message:
                "Email verified successfully",
            token,
            user
        });
    }
);

const resendVerificationOTP =
    asyncHandler(
        async (req, res, next) => {

            const { email } = req.body;

            if (!email) {
                return next(
                    new AppError(
                        "Email is required",
                        400
                    )
                );
            }

            const user =
                await User.findOne({
                    email
                });

            if (!user) {
                return next(
                    new AppError(
                        "User not found",
                        404
                    )
                );
            }

            if (
                user.isEmailVerified
            ) {
                return next(
                    new AppError(
                        "Email is already verified",
                        400
                    )
                );
            }

            const otp =
                await user.generateEmailVerificationOTP();

            await user.save();

            try {

                await sendVerificationEmail(
                    user.email,
                    otp,
                    user.fullName
                );

            } catch (error) {

                return next(
                    new AppError(
                        "Failed to send OTP",
                        500
                    )
                );
            }

            res.status(200).json({
                success: true,
                message:
                    "OTP sent successfully"
            });
        }
    );



const login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new AppError("Email and password are required", 400));
    }

    
    const user = await User.findOne({ email }).select("+password");

    
    if (!user) {
        return next(new AppError("Invalid email or password", 401));
    }

    
    if (!user.isEmailVerified) {
        return next(new AppError("Please verify your email first", 403));
    }

    
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        return next(new AppError("Invalid email or password", 401));
    }

    
    const token = await user.generateToken();
    user.password = undefined;

    res.status(200).json({
        success: true,
        message: "User logged in successfully",
        token,
        user
    });
});


const getProfile = asyncHandler(async (req, res, next) => {

    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user) {
        return next(new AppError("User not found", 404));
    }

    res.status(200).json({
        success: true,
        message: "User profile fetched successfully",
        user
    });
});



const logout = asyncHandler(async (req, res) => {
    res.status(200).json({
        success: true,
        message: "User logged out successfully"
    });
});


const forgotPassword = asyncHandler(async (req, res, next) => {

    const { email } = req.body;
    

    if (!email) {
        return next(new AppError("Email is required", 400));
    }

    const user = await User.findOne({ email });

    if (!user) {
        return next(new AppError("Email not registered", 404));
    }

    const resetToken = await user.generatePasswordResetToken();
    await user.save();

    const resetPasswordUrl =
        `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        
    try {
        
        await resetPasswordEmail(
            email,
            user.fullName,
            resetPasswordUrl
        );

        res.status(200).json({
            success: true,
            message: `Reset password link sent to ${email}`
        });

    } catch (error) {

        user.forgotPasswordToken = undefined;
        user.forgotPasswordExpiry = undefined;

        await user.save();

        return next(
            new AppError("Failed to send reset email", 500)
        );
    }
});

const resetPassword = asyncHandler(async (req, res, next) => {

    const { resetToken } = req.params;

    const { password } = req.body;
    console.log(password, resetToken);

    if (!password || !resetToken) {
        return next(new AppError("Password and reset token are required", 400));
    }
    const forgotPasswordToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    const user = await User.findOne({
        forgotPasswordToken,
        forgotPasswordExpiry: { $gt: Date.now() }
    });

    if (!user) {
        return next(
            new AppError(
                "Token is invalid or expired",
                400
            )
        );
    }

    user.password = password;

    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;

    await user.save();

    res.status(200).json({
        success: true,
        message: "Password reset successful"
    });
});

const changePassword = asyncHandler(async (req, res, next) => {

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return next(
            new AppError(
                "Old password and new password are required",
                400
            )
        );
    }

    const user = await User.findById(req.user._id)
        .select("+password");

    if (!user) {
        return next(new AppError("User not found", 404));
    }

    const isPasswordValid =
        await user.comparePassword(oldPassword);

    if (!isPasswordValid) {
        return next(
            new AppError("Invalid old password", 400)
        );
    }

    user.password = newPassword;

    await user.save();

    user.password = undefined;

    res.status(200).json({
        success: true,
        message: "Password changed successfully"
    });
});



const updateUser = asyncHandler(async (req, res, next) => {

    const { fullName } = req.body;

    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user) {
        return next(new AppError("User not found", 404));
    }
    if (fullName) {
        user.fullName = fullName;
    }

    if (req.file) {

        try {
            if (
                user.avatar &&
                user.avatar.public_id &&
                user.avatar.public_id !== "default_avatar"
            ) {
                await cloudinary.v2.uploader.destroy(
                    user.avatar.public_id
                );
            }
            const result = await cloudinary.v2.uploader.upload(
                req.file.path,
                {
                    folder: "avatars",
                    width: 250,
                    height: 250,
                    crop: "fill",
                    gravity: "face"
                }
            );
            if (result) {

                user.avatar = {
                    public_id: result.public_id,
                    secure_url: result.secure_url
                };
            }
            await fs.rm(req.file.path, { force: true });

        } catch (error) {
            await fs.rm(req.file.path, { force: true });

            return next(
                new AppError(
                    "Avatar upload failed",
                    500
                )
            );
        }
    }

    await user.save();

    res.status(200).json({
        success: true,
        message: "User updated successfully",
        user
    });
});

export {
    register,
    verifyEmail,
    resendVerificationOTP,
    login,
    getProfile,
    logout,
    forgotPassword,
    resetPassword,
    changePassword,
    updateUser
};