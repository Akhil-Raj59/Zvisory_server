import sendEmail from "../sendEmail.js";

const sendVerificationEmail = async (
    email,
    otp,
    fullName
) => {

    const subject = "Verify your email address for Zvisory";

    const message = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
            <h2>Email Verification</h2>

            <p>Hello ${fullName},</p>

            <p >
                Thank you for registering.
                Please use the OTP below to verify your email address.
            </p>

            <div
                style="
                    background: #f4f4f4;
                    padding: 15px;
                    text-align: center;
                    font-size: 28px;
                    font-weight: bold;
                    letter-spacing: 5px;
                    border-radius: 8px;
                "
            >
                ${otp}
            </div>

            <p>
                This OTP is valid for
                <strong>10 minutes</strong>.
            </p>

            <p>
                If you did not create this account,
                please ignore this email.
            </p>

            <br />

            <p>
                Regards,<br />
                ${process.env.SMTP_FROM_NAME}
            </p>
        </div>
    `;

    await sendEmail(
        email,
        subject,
        message
    );
};

export default sendVerificationEmail;