import sendEmail from "../sendEmail.js";

const sendPasswordResetEmail = async (
    email,
    fullName,
    resetPasswordUrl
) => {

    const subject =
        "Password Reset Request";

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">

            <h2>Password Reset Request</h2>

            <p>Hello ${fullName},</p>

            <p>
                We received a request to reset your password.
            </p>

            <p>
                Click the button below to reset it:
            </p>

            <div style="margin: 30px 0;">
                <a
                    href="${resetPasswordUrl}"
                    style="
                        background:#000;
                        color:#fff;
                        text-decoration:none;
                        padding:12px 20px;
                        border-radius:8px;
                    "
                >
                    Reset Password
                </a>
            </div>

            <p>
                This Link Will Expire Shortly.
            </p>

            <p>
                If you did not request a password reset, please ignore this email.
            </p>

            <br/>

            <p>
                Regards,<br/>
                ${process.env.SMTP_FROM_NAME}
            </p>

        </div>
    `;

    await sendEmail(
        email,
        subject,
        html
    );
};

export default sendPasswordResetEmail;