import nodemailer from "nodemailer";

const sendEmail = async (email, subject, message) => {
  try {
    // Basic validation
    if (!email) {
      throw new Error("Recipient email is required");
    }

    if (!subject) {
      throw new Error("Email subject is required");
    }

    if (!message) {
      throw new Error("Email message is required");
    }
    

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to: email,
      subject,
      html: message,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully: ${info.messageId}`);

    return info;
  } catch (error) {
    console.error("❌ Email sending failed:", error);

    throw new Error(
      error?.message || "Failed to send email. Please try again later."
    );
  }
};

export default sendEmail;