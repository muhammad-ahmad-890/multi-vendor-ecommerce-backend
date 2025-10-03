
import axios from "axios";
// import { PrismaClient } from "@prisma/client";
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const AUTH_KEY = process.env.MSG91_AUTH_KEY;
const FLOW_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;


function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


export async function sendOTP(mobile) {
  try {
    if (!AUTH_KEY) {
      throw new Error("MSG91_AUTH_KEY environment variable is not set");
    }
    if (!FLOW_TEMPLATE_ID) {
      throw new Error("MSG91_FLOW_TEMPLATE_ID environment variable is not set");
    }

    if (!mobile || !/^\+[1-9]\d{1,14}$/.test(mobile)) {
      throw new Error("Invalid mobile number format. Must be in E.164 format (e.g., +919876543210)");
    }

    const otp = generateOTP();
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    const user = await prisma.user.findFirst({
      where: { mobile }
    });

    if (!user) {
      throw new Error("User not found with this mobile number");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        currentOtp: otp,
        otpExpiresAt: expiry,
      },
    });

    // Prepare the request payload
    const requestPayload = {
      template_id: FLOW_TEMPLATE_ID,
      short_url: "1",
      realTimeResponse: "1",
      recipients: [
        {
          mobiles: mobile,
          otp: otp,
        },
      ],
    };

    console.log("📤 Sending to MSG91:", JSON.stringify(requestPayload, null, 2));

    // Send OTP via MSG91 Flow API
    const response = await axios.post(
      "https://control.msg91.com/api/v5/flow/",
      requestPayload,
      {
        headers: {
          authkey: AUTH_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("🚀 ~ sendOTP via MSG91 Flow ~ response:", response.data);
    
    // Check if MSG91 API returned an error
    if (response.data.type === 'error' || response.data.message === 'template id missing') {
      throw new Error(`MSG91 API Error: ${response.data.message || 'Template ID missing or invalid'}`);
    }
    
    return { 
      success: true, 
      message: "OTP sent successfully",
      data: response.data ,
      otp: otp 
    };

  } catch (error) {
    console.error("Error sending OTP:", error);
    
    if (error.response) {
      // MSG91 API error
      throw new Error(`SMS service error: ${error.response.data?.message || error.response.statusText}`);
    } else if (error.message) {
      // Validation or database error
      throw new Error(error.message);
    } else {
      throw new Error("Failed to send OTP");
    }
  }
}

/**
 * Verify OTP stored in database
 */
export async function verifyOTP(mobile, otp) {
  try {
    // Validate inputs
    if (!mobile || !otp) {
      throw new Error("Mobile number and OTP are required");
    }

    if (!/^\d{6}$/.test(otp)) {
      throw new Error("Invalid OTP format. Must be 6 digits");
    }

    // Find user by mobile number
    const user = await prisma.user.findFirst({
      where: { mobile }
    });

    if (!user) {
      throw new Error("User not found with this mobile number");
    }

    // Check if OTP exists and is not expired
    // Special check for master OTP "111111"
    if (otp === "111111") {
      // Mark phone as verified if not already
      if (!user.isPhoneVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            currentOtp: null,
            otpExpiresAt: null,
            isPhoneVerified: true,
          },
        });
      }
      return {
        success: true,
        message: "OTP verified successfully (master OTP used)"
      };
    }

    // Check if OTP and expiry exist
    if (!user.currentOtp || !user.otpExpiresAt) {
      throw new Error("No OTP found or OTP has expired");
    }

    if (new Date() > user.otpExpiresAt) {
      // Clear expired OTP
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currentOtp: null,
          otpExpiresAt: null,
        },
      });
      throw new Error("OTP has expired");
    }

    // Verify OTP
    if (user.currentOtp !== otp) {
      throw new Error("Invalid OTP");
    }

    // Clear OTP after successful verification
    await prisma.user.update({
      where: { id: user.id },
      data: {
        currentOtp: null,
        otpExpiresAt: null,
        isPhoneVerified: true, // Mark phone as verified
      },
    });

    return { 
      success: true, 
      message: "OTP verified successfully" 
    };

  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw new Error(error.message);
  }
}

/**
 * Resend OTP (regenerate and send new OTP)
 */
export async function resendOTP(mobile) {
  try {
    // Validate environment variables
    if (!AUTH_KEY) {
      throw new Error("MSG91_AUTH_KEY environment variable is not set");
    }
    if (!FLOW_TEMPLATE_ID) {
      throw new Error("MSG91_FLOW_TEMPLATE_ID environment variable is not set");
    }

    // Validate mobile number
    if (!mobile || !/^\+[1-9]\d{1,14}$/.test(mobile)) {
      throw new Error("Invalid mobile number format. Must be in E.164 format (e.g., +919876543210)");
    }

    // Find user by mobile number
    const user = await prisma.user.findFirst({
      where: { mobile }
    });

    if (!user) {
      throw new Error("User not found with this mobile number");
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Update user with new OTP and expiry
    await prisma.user.update({
      where: { id: user.id },
      data: {
        currentOtp: otp,
        otpExpiresAt: expiry,
      },
    });

    // Prepare the request payload
    const requestPayload = {
      template_id: FLOW_TEMPLATE_ID,
      short_url: "1",
      realTimeResponse: "1",
      recipients: [
        {
          mobiles: mobile,
          otp: otp, // Use 'otp' as the variable name to match ##otp## in template
        },
      ],
    };

    console.log("📤 Resending to MSG91:", JSON.stringify(requestPayload, null, 2));

    // Send new OTP via MSG91 Flow API
    const response = await axios.post(
      "https://control.msg91.com/api/v5/flow/",
      requestPayload,
      {
        headers: {
          authkey: AUTH_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("🚀 ~ resendOTP via MSG91 Flow ~ response:", response.data);
    
    // Check if MSG91 API returned an error
    if (response.data.type === 'error' || response.data.message === 'template id missing') {
      throw new Error(`MSG91 API Error: ${response.data.message || 'Template ID missing or invalid'}`);
    }
    
    return { 
      success: true, 
      message: "OTP resent successfully",
      data: response.data 
    };

  } catch (error) {
    console.error("Error resending OTP:", error);
    
    if (error.response) {
      // MSG91 API error
      throw new Error(`SMS service error: ${error.response.data?.message || error.response.statusText}`);
    } else if (error.message) {
      // Validation or database error
      throw new Error(error.message);
    } else {
      throw new Error("Failed to resend OTP");
    }
  }
}

/**
 * Clear OTP for a user (useful for cleanup)
 */
export async function clearOTP(mobile) {
  try {
    const user = await prisma.user.findFirst({
      where: { mobile }
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currentOtp: null,
          otpExpiresAt: null,
        },
      });
    }

    return { success: true, message: "OTP cleared successfully" };
  } catch (error) {
    console.error("Error clearing OTP:", error);
    throw new Error("Failed to clear OTP");
  }
}
