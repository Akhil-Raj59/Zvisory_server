import { Schema,model } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new Schema({
    fullName : {
        type : String,
        required : [true,"Fullname is required"],
        trim : true,
        lowercase : true,
        minLength : [5,"Fullname must be at least 5 characters"],
        maxLength : [50,"Fullname must be at most 50 characters"]
    },
    email : {
        type : String,
        required : [true,"Email is required"],
        unique : true,
        lowercase : true,
        trim : true,
        match : [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,"Please fill a valid email address"]
    },
    password : {
        type : String,
        required : [true,"Password is required"],
        minLength : [6,"Password must be at least 6 characters"],
        maxLength : [64,"Password must be at most 64 characters"],
        select : false,
    }   ,
    phoneNumber: {
        type: String,
        trim: true,
        default: ""
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'EMPLOYEE', 'ADMIN'],
      default: 'CUSTOMER',
    },
    
    avatar: {
        public_id: {
            type: String,
            required: true
        },
        secure_url: {   
            type: String,
            required: true
        }
    },
    isEmailVerified: {
    type: Boolean,
    default: false
    },

    emailVerificationOTP: String,
    emailVerificationOTPExpiry: Date,
    forgotPasswordToken : String,
    forgotPasswordExpiry : Date,

},{timestamps : true})


userSchema.pre("save", async function(next){
    // Hash password if modified
    if(this.isModified("password")){
        this.password = await bcrypt.hash(this.password, 10);
    }
    const companyDomain = process.env.COMPANY_DOMAIN;
    if (this.isNew && companyDomain && this.email && this.email.toLowerCase().endsWith(`@${companyDomain.toLowerCase()}`)) {
        if (this.role === "CUSTOMER") {
            this.role = "EMPLOYEE";
        }
    }
    next();
});

userSchema.methods = {
    generateToken : async function(){
        return await jwt.sign({_id : this._id, role: this.role}, process.env.JWT_SECRET,{
            expiresIn : process.env.JWT_EXPIRY
        });
    },
    comparePassword : async function(plainTextPassword){
        return await bcrypt.compare(plainTextPassword, this.password);
    },
    generatePasswordResetToken : async function(){
        const resetToken = crypto.randomBytes(20).toString('hex');

        this.forgotPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');
            
        this.forgotPasswordExpiry = Date.now() + (20 * 60 * 1000);
        
        return resetToken;
    },
    generateEmailVerificationOTP: async function () {

        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        this.emailVerificationOTP = crypto
            .createHash("sha256")
            .update(otp)
            .digest("hex");

        this.emailVerificationOTPExpiry = Date.now() + (10 * 60 * 1000);

        return otp;
    }

}

const User = model("User", userSchema);
export default User;