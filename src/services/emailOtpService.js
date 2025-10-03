import nodemailer from 'nodemailer';
import 'dotenv/config';

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD
  }
});

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

// Send OTP via email
export const sendEmailOTP = async (email, otp) => {
  try {
    const mailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Password Reset OTP</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 16px; color: #666;">
              You have requested to reset your password. Use the following OTP to complete the process:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="
                background-color: #007bff; 
                color: white; 
                padding: 15px 25px; 
                border-radius: 6px; 
                font-size: 24px; 
                font-weight: bold; 
                letter-spacing: 5px;
                display: inline-block;
              ">${otp}</span>
            </div>
            <p style="margin: 0; font-size: 14px; color: #999;">
              This OTP will expire in 10 minutes. If you didn't request this, please ignore this email.
            </p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #666; font-size: 12px;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, message: "OTP sent successfully", messageId: result.messageId };
  } catch (error) {
    console.error('Email OTP Error:', error);
    throw new Error('Failed to send OTP email');
  }
};

// Verify OTP
export const verifyEmailOTP = (email, otp) => {
  const storedOTP = otpStore.get(email);
  
  if (!storedOTP) {
    return { success: false, message: "OTP expired or not found" };
  }

  if (storedOTP.otp !== otp) {
    return { success: false, message: "Invalid OTP" };
  }

  if (Date.now() > storedOTP.expires) {
    otpStore.delete(email);
    return { success: false, message: "OTP expired" };
  }

  // OTP is valid, remove it from store
  otpStore.delete(email);
  return { success: true, message: "OTP verified successfully" };
};

// Store OTP with expiration
export const storeOTP = (email, otp) => {
  const expires = Date.now() + (10 * 60 * 1000); // 10 minutes
  otpStore.set(email, { otp, expires });
  
  // Clean up expired OTPs
  setTimeout(() => {
    otpStore.delete(email);
  }, 10 * 60 * 1000);
};

// Send OTP and store it
export const sendAndStoreOTP = async (email) => {
  const otp = generateOTP();
  await sendEmailOTP(email, otp);
  storeOTP(email, otp);
  return { success: true, message: "OTP sent and stored successfully" };
};
