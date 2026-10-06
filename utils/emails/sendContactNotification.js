import sendEmail from "../sendEmail.js";

const sendContactNotification = async (
    name,
    email,
    message
) => {

    const subject = `New Contact Form Submission - ${name}`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: auto;">
            
            <h2>📩 New Contact Form Submission</h2>

            <table
                style="
                    border-collapse: collapse;
                    width: 100%;
                    margin-top: 20px;
                "
            >
                <tr>
                    <td><strong>Name</strong></td>
                    <td>${name}</td>
                </tr>

                <tr>
                    <td><strong>Email</strong></td>
                    <td>${email}</td>
                </tr>
            </table>

            <hr />

            <h3>Message</h3>

            <div
                style="
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 8px;
                "
            >
                ${message}
            </div>

        </div>
    `;

    await sendEmail(
        process.env.CONTACT_US_EMAIL,
        subject,
        html
    );
};

export default sendContactNotification;