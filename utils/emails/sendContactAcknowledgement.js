import sendEmail from "../sendEmail.js";

const sendContactAcknowledgement = async (
    name,
    email,
    message
) => {

    const subject =
        "We Received Your Message";

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">

            <h2>Thank You for Contacting Us 🙌</h2>

            <p>Hello ${name},</p>

            <p>
                We have successfully received your message.
            </p>

            <p>
                Our support team will review your request
                and get back to you as soon as possible.
            </p>

            <div
                style="
                    background:#f7f7f7;
                    padding:15px;
                    border-radius:8px;
                    margin:20px 0;
                "
            >
                <strong>Your Message</strong>

                <p style="margin-top:10px;">
                    ${message}
                </p>
            </div>

            <p>
                Typical response time:
                <strong>24 - 48 Hours</strong>
            </p>

            <br />

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

export default sendContactAcknowledgement;