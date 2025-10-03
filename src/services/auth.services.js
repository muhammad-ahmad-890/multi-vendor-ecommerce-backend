import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import 'dotenv/config';
import validator from "validator";
import { sendOTP, verifyOTP, resendOTP, clearOTP } from "./otpService.js";
import { sendAndStoreOTP, verifyEmailOTP } from "./emailOtpService.js";
import axios from "axios";

const prisma = new PrismaClient();
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123";
const DEFAULT_VENDOR_PASSWORD = process.env.DEFAULT_VENDOR_PASSWORD || "Vendor@123";

const authServices = {
	// Helper function to create JWT payload
	async getUserPayload(user) {
		const userData = { ...user };
		delete userData.email;
		delete userData.pinCode;

		const payload = {
			user: user.id,
			role: user.role,
			status: user.status
		};

		const resBody = {
			user: userData
		};

		const authToken = jwt.sign(payload, process.env.JWT_AUTHENTICATION_SECRET, { expiresIn: '7d' });
		resBody.authToken = authToken;

		return resBody;
	},

	validatePassword(password) {
		if (!password || password.length < 8) {
			throw createError(400, "Password must be at least 8 characters long");
		}
		const hasUpperCase = /[A-Z]/.test(password);
		const hasLowerCase = /[a-z]/.test(password);
		const hasNumbers = /\d/.test(password);
		const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

		if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar)) {
			throw createError(400, "Password is too weak. Must include uppercase, lowercase, numbers, and special characters");
		}
	},

	validateMobile(mobile) {
		if (!validator.isMobilePhone(mobile, 'any', { strictMode: true })) {
			throw createError(400, "Mobile number must be in E.164 format (e.g., +1234567890)");
		}
	},

	// Admin Registration
	async adminRegister(email, firstName, lastName, phone, password) {
		const existingAdmin = await prisma.user.findFirst({
			where: {
				OR: [
					{ email },
					{ phone }
				],
				role: "ADMIN"
			}
		});

		if (existingAdmin) {
			throw createError(400, "Admin with this email or phone already exists");
		}

		const hashedPassword = await bcrypt.hash(password || DEFAULT_ADMIN_PASSWORD, 10);

		const adminDeviceId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		const admin = await prisma.user.create({
			data: {
				email,
				firstName,
				lastName,
				phone,
				role: "ADMIN",
				isEmailVerified: true,
				isPhoneVerified: true,
				isActive: true,
				pinCode: hashedPassword,
				deviceId: adminDeviceId
			}
		});

		return {
			userId: admin.id,
			email: admin.email,
			phone: admin.phone,
			firstName: admin.firstName,
			lastName: admin.lastName,
			role: admin.role
		};
	},

	// Admin Login
	async adminLogin(identifier, password) {
		const admin = await prisma.user.findFirst({
			where: {
				role: "ADMIN",
				OR: [
					{ email: identifier },
					{ phone: identifier }
				]
			}
		});

		if (!admin) {
			throw createError(404, "Admin not found with this email or phone");
		}

		const isPasswordValid = await bcrypt.compare(password, admin.pinCode || '');
		if (!isPasswordValid) {
			throw createError(401, "Invalid credentials");
		}

		return this.getUserPayload(admin);
	},

	async vendorRegister({
		firstName,
		lastName,
		email,
		password,
		mobile,
		pinCode,
		city,
		state,
		address,
		storeName,
		storeAddress,
		facebookUrl,
		instagramUrl,
		youtubeUrl
	}) {
		const requiredFields = { firstName, lastName, email, mobile, storeName };
		for (const [key, value] of Object.entries(requiredFields)) {
			if (!value) {
				throw createError(400, `${key} is required`);
			}
		}

		if (!validator.isEmail(email)) {
			throw createError(400, "Invalid email format");
		}

		this.validateMobile(mobile);

		this.validatePassword(password);

		if (facebookUrl && !validator.isURL(facebookUrl, { require_host: true })) {
			throw createError(400, "Invalid Facebook URL");
		}
		if (instagramUrl && !validator.isURL(instagramUrl, { require_host: true })) {
			throw createError(400, "Invalid Instagram URL");
		}
		if (youtubeUrl && !validator.isURL(youtubeUrl, { require_host: true })) {
			throw createError(400, "Invalid YouTube URL");
		}

		// Check for existing vendor
		const existingVendor = await prisma.user.findFirst({
			where: {
				OR: [
					{ email },
					{ mobile }
				],
				role: { in: ["VENDOR"] }
			}
		});

		if (existingVendor) {
			throw createError(400, "Vendor with this email or mobile already exists");
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password || DEFAULT_VENDOR_PASSWORD, 10);

		// Create vendor
		const vendor = await prisma.user.create({
			data: {
				firstName,
				lastName,
				email,
				mobile,
				pinCode: hashedPassword,
				city,
				state,
				address,
				storeName,
				storeAddress,
				facebookUrl,
				instagramUrl,
				youtubeUrl,
				role: "VENDOR",
				status: "PENDING",
				isActive: true
			}
		});

		return {
			userId: vendor.id,
			email: vendor.email,
			mobile: vendor.mobile,
			firstName: vendor.firstName,
			lastName: vendor.lastName,
			storeName: vendor.storeName,
			role: vendor.role,
			status: vendor.status
		};
	},

	async vendorLogin(identifier, password) {
		const vendor = await prisma.user.findFirst({
			where: {
				role: { in: ["VENDOR"] },
				OR: [
					{ email: identifier },
					{ mobile: identifier }
				]
			}
		});

		if (!vendor) {
			throw createError(404, "Vendor not found with this email or mobile");
		}

		const isPasswordValid = await bcrypt.compare(password, vendor.pinCode || '');
		if (!isPasswordValid) {
			throw createError(401, "Invalid credentials");
		}

		return this.getUserPayload(vendor);
	},

	async vendorSendOTP(mobile) {
		this.validateMobile(mobile);

		const vendor = await prisma.user.findFirst({
			where: {
				mobile,
				role: { in: ["VENDOR"] }
			}
		});

		if (!vendor) {
			throw createError(404, "Vendor not found with this mobile number");
		}

		try {
			const otpResponse = await sendOTP(mobile);
			return { message: otpResponse.message };
		} catch (error) {
			throw createError(400, error.message || "Failed to send OTP");
		}
	},

	async vendorLoginWithOTP(mobile, otp) {
		this.validateMobile(mobile);

		if (!otp || !/^\d{6}$/.test(otp)) {
			throw createError(400, "Invalid OTP format. Must be 6 digits");
		}

		const vendor = await prisma.user.findFirst({
			where: {
				mobile,
				role: { in: ["VENDOR"] }
			}
		});

		if (!vendor) {
			throw createError(404, "Vendor not found with this mobile number");
		}

		try {
			const otpResult = await verifyOTP(mobile, otp);
			if (otpResult.success) {
				return this.getUserPayload(vendor);
			} else {
				throw createError(400, "Invalid OTP");
			}
		} catch (error) {
			throw createError(400, error.message || "OTP verification failed");
		}
	},

	// Resend OTP for Vendor
	async vendorResendOTP(mobile) {
		this.validateMobile(mobile);

		const vendor = await prisma.user.findFirst({
			where: {
				mobile,
				role: { in: ["VENDOR"] }
			}
		});

		if (!vendor) {
			throw createError(404, "Vendor not found with this mobile number");
		}

		try {
			const otpResponse = await resendOTP(mobile);
			return { message: otpResponse.message };
		} catch (error) {
			throw createError(400, error.message || "Failed to resend OTP");
		}
	},

	// Resend OTP for User
	async userResendOTP(mobile) {
		this.validateMobile(mobile);

		const user = await prisma.user.findFirst({
			where: {
				mobile,
				role: { in: ["CUSTOMER"] }
			}
		});

		if (!user) {
			throw createError(404, "User not found with this mobile number");
		}

		try {
			const otpResponse = await resendOTP(mobile);
			return { message: otpResponse.message };
		} catch (error) {
			throw createError(400, error.message || "Failed to resend OTP");
		}
	},

	// Clear OTP for any user
	async clearUserOTP(mobile) {
		this.validateMobile(mobile);

		try {
			const result = await clearOTP(mobile);
			return { message: result.message };
		} catch (error) {
			throw createError(400, error.message || "Failed to clear OTP");
		}
	},

	// Forgot Password - Request OTP
	async vendorForgotPasswordRequest(email) {
		if (!validator.isEmail(email)) {
			throw createError(400, "Invalid email format");
		}

		const vendor = await prisma.user.findFirst({
			where: {
				email,
				role: { in: ["VENDOR"] }
			}
		});

		if (!vendor) {
			throw createError(404, "Vendor not found with this email");
		}

		try {
			// Send OTP via email
			await sendAndStoreOTP(email);

			// Store reset token and expiry
			const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
			const resetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

			await prisma.user.update({
				where: { id: vendor.id },
				data: {
					resetPasswordToken: resetToken,
					resetPasswordExpires: resetExpires
				}
			});

			return {
				message: "OTP sent successfully to your email for password reset",
				resetToken: resetToken
			};
		} catch (error) {
			throw createError(400, "Failed to send OTP email for password reset");
		}
	},

	// Forgot Password - Verify OTP
	async vendorForgotPasswordVerifyOTP(email, otp, resetToken) {
		if (!validator.isEmail(email)) {
			throw createError(400, "Invalid email format");
		}

		if (!otp || !/^\d{6}$/.test(otp)) {
			throw createError(400, "Invalid OTP format. Must be 6 digits");
		}

		if (!resetToken) {
			throw createError(400, "Reset token is required");
		}

		const vendor = await prisma.user.findFirst({
			where: {
				email,
				role: { in: ["VENDOR"] },
				resetPasswordToken: resetToken,
				resetPasswordExpires: { gt: new Date() }
			}
		});

		if (!vendor) {
			throw createError(404, "Vendor not found or reset token expired");
		}

		try {
			// Verify email OTP
			const otpResult = verifyEmailOTP(email, otp);
			if (otpResult.success) {
				return {
					message: "OTP verified successfully",
					resetToken: resetToken,
					vendorId: vendor.id
				};
			} else {
				throw createError(400, otpResult.message);
			}
		} catch (error) {
			throw createError(400, "OTP verification failed");
		}
	},

	// Forgot Password - Reset Password
	async vendorForgotPasswordReset(email, resetToken, newPassword) {
		if (!validator.isEmail(email)) {
			throw createError(400, "Invalid email format");
		}

		if (!resetToken) {
			throw createError(400, "Reset token is required");
		}

		this.validatePassword(newPassword);

		const vendor = await prisma.user.findFirst({
			where: {
				email,
				role: { in: ["VENDOR"] },
				resetPasswordToken: resetToken,
				resetPasswordExpires: { gt: new Date() }
			}
		});

		if (!vendor) {
			throw createError(404, "Vendor not found or reset token expired");
		}

		// Hash new password
		const hashedPassword = await bcrypt.hash(newPassword, 10);

		// Update password and clear reset tokens
		const updatedVendor = await prisma.user.update({
			where: { id: vendor.id },
			data: {
				pinCode: hashedPassword,
				resetPasswordToken: null,
				resetPasswordExpires: null
			}
		});

		return {
			message: "Password reset successfully",
			userId: updatedVendor.id,
			email: updatedVendor.email,
			mobile: updatedVendor.mobile
		};
	},

	// Resend OTP for Forgot Password
	async vendorResendForgotPasswordOTP(email, resetToken) {
		if (!validator.isEmail(email)) {
			throw createError(400, "Invalid email format");
		}

		if (!resetToken) {
			throw createError(400, "Reset token is required");
		}

		const vendor = await prisma.user.findFirst({
			where: {
				email,
				role: { in: ["VENDOR"] },
				resetPasswordToken: resetToken,
				resetPasswordExpires: { gt: new Date() }
			}
		});

		if (!vendor) {
			throw createError(404, "Vendor not found or reset token expired");
		}

		try {
			// Send new OTP via email
			await sendAndStoreOTP(email);

			// Extend reset token expiry
			const resetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

			await prisma.user.update({
				where: { id: vendor.id },
				data: {
					resetPasswordExpires: resetExpires
				}
			});

			return {
				message: "OTP resent successfully to your email for password reset",
				resetToken: resetToken
			};
		} catch (error) {
			throw createError(400, "Failed to resend OTP email for password reset");
		}
	},

	// User Authentication with Mobile OTP
	async userSendOTP(mobile) {
		// this.validateMobile(mobile);

		// Check if user exists, if not create a new one
		let user = await prisma.user.findFirst({
			where: {
				mobile,
			}
		});
		console.log("🚀 ~ userSendOTP ~ user:", user)

		if (!user) {
			// Create new user with mobile number
			const deviceId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			user = await prisma.user.create({
				data: {
					mobile,
					deviceId,
					role: "CUSTOMER",
					status: "APPROVED",
					isActive: true,
					isPhoneVerified: false
				}
			});
		}

		if (!user.isActive) {
			throw createError(403, "User account is not active");
		}

		try {
			const otpResponse = await sendOTP(mobile);
			return {
				message: otpResponse.message,
				userId: user.id,
				isNewUser: !user.isPhoneVerified,
				otp: otpResponse.otp
			};
		} catch (error) {
			throw createError(400, error.message || "Failed to send OTP");
		}
	},

	async userLoginWithOTP(mobile, otp) {
		// this.validateMobile(mobile);

		if (!otp || !/^\d{6}$/.test(otp)) {
			throw createError(400, "Invalid OTP format. Must be 6 digits");
		}

		const user = await prisma.user.findFirst({
			where: {
				mobile,
			}
		});

		if (!user) {
			throw createError(404, "User not found with this mobile number");
		}

		if (!user.isActive) {
			throw createError(403, "User account is not active");
		}

		try {
			if (otp === "1111") {
				// For testing purposes, accept 1111 as valid OTP
				if (!user.isPhoneVerified) {
					await prisma.user.update({
						where: { id: user.id },
						data: { isPhoneVerified: true }
					});
				}
				return this.getUserPayload(user);
			} else {
				console.log("🚀 ~ userLoginWithOTP ~ otp:", otp);
				const otpResult = await verifyOTP(mobile, otp);
				if (otpResult.success) {
					return this.getUserPayload(user);
				} else {
					throw createError(400, "Invalid OTP");
				}
			}
		} catch (error) {
			throw createError(400, error.message || "OTP verification failed");
		}
	},

	// User Profile Update
	async updateUserProfile(userId, profileData) {
		const { firstName, lastName, email, city, state, address, avatar } = profileData;

		// Validate email if provided
		if (email && !validator.isEmail(email)) {
			throw createError(400, "Invalid email format");
		}

		try {
			const updatedUser = await prisma.user.update({
				where: { id: userId },
				data: {
					firstName: firstName?.trim(),
					lastName: lastName?.trim(),
					email: email?.trim(),
					city: city?.trim(),
					state: state?.trim(),
					address: address?.trim(),
					avatar: avatar?.trim()
				}
			});

			return {
				success: true,
				message: "Profile updated successfully",
				data: updatedUser
			};
		} catch (error) {
			console.error('Update User Profile Error:', error);
			throw createError(500, "Failed to update profile");
		}
	},

	// Get User Profile
	async getUserProfile(userId) {
		try {
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					mobile: true,
					city: true,
					state: true,
					address: true,
					avatar: true,
					profilePhoto: true,
					coverPhoto: true,
					isEmailVerified: true,
					isPhoneVerified: true,
					role: true,
					status: true,
					createdAt: true,
					updatedAt: true
				}
			});

			// if (!CUSTOMER) {
			//   throw createError(404, "User not found");
			// }

			return {
				success: true,
				message: "Profile retrieved successfully",
				data: user
			};
		} catch (error) {
			if (error.status === 404) {
				throw error;
			}
			console.error('Get User Profile Error:', error);
			throw createError(500, "Failed to retrieve profile");
		}
	},

	// User Forgot Password - Request OTP
	async userForgotPasswordRequest(email) {
		if (!validator.isEmail(email)) {
			throw createError(400, "Invalid email format");
		}

		const user = await prisma.user.findFirst({
			where: {
				email,
				role: { in: ["CUSTOMER"] }
			}
		});

		if (!user) {
			throw createError(404, "User not found with this email");
		}

		if (!user.isActive) {
			throw createError(403, "User account is not active");
		}

		try {
			// Send OTP via email
			await sendAndStoreOTP(email);

			// Store reset token and expiry
			const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
			const resetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

			await prisma.user.update({
				where: { id: user.id },
				data: {
					resetPasswordToken: resetToken,
					resetPasswordExpires: resetExpires
				}
			});

			return {
				message: "OTP sent successfully to your email for password reset",
				resetToken: resetToken
			};
		} catch (error) {
			throw createError(400, "Failed to send OTP email for password reset");
		}
	},

	// User Forgot Password - Verify OTP
	async userForgotPasswordVerifyOTP(email, otp, resetToken) {
		if (!validator.isEmail(email)) {
			throw createError(400, "Invalid email format");
		}

		if (!otp || !/^\d{6}$/.test(otp)) {
			throw createError(400, "Invalid OTP format. Must be 6 digits");
		}

		if (!resetToken) {
			throw createError(400, "Reset token is required");
		}

		const user = await prisma.user.findFirst({
			where: {
				email,
				role: { in: ["CUSTOMER"] },
				resetPasswordToken: resetToken,
				resetPasswordExpires: { gt: new Date() }
			}
		});

		if (!user) {
			throw createError(404, "User not found or reset token expired");
		}

		try {
			// Verify email OTP
			const otpResult = verifyEmailOTP(email, otp);
			if (otpResult.success) {
				return {
					message: "OTP verified successfully",
					resetToken: resetToken,
					userId: user.id
				};
			} else {
				throw createError(400, otpResult.message);
			}
		} catch (error) {
			throw createError(400, "OTP verification failed");
		}
	},

	// User Forgot Password - Reset Password
	async userForgotPasswordReset(email, resetToken, newPassword) {
		if (!validator.isEmail(email)) {
			throw createError(400, "Invalid email format");
		}

		if (!resetToken) {
			throw createError(400, "Reset token is required");
		}

		this.validatePassword(newPassword);

		const user = await prisma.user.findFirst({
			where: {
				email,
				role: { in: ["CUSTOMER"] },
				resetPasswordToken: resetToken,
				resetPasswordExpires: { gt: new Date() }
			}
		});

		if (!user) {
			throw createError(404, "User not found or reset token expired");
		}

		// Hash new password
		const hashedPassword = await bcrypt.hash(newPassword, 10);

		// Update password and clear reset tokens
		const updatedUser = await prisma.user.update({
			where: { id: user.id },
			data: {
				pinCode: hashedPassword,
				resetPasswordToken: null,
				resetPasswordExpires: null
			}
		});

		return {
			message: "Password reset successfully",
			userId: updatedUser.id,
			email: updatedUser.email,
			mobile: updatedUser.mobile
		};
	},

	// User Resend OTP for Forgot Password
	async userResendForgotPasswordOTP(email, resetToken) {
		if (!validator.isEmail(email)) {
			throw createError(400, "Invalid email format");
		}

		if (!resetToken) {
			throw createError(400, "Reset token is required");
		}

		const user = await prisma.user.findFirst({
			where: {
				email,
				role: { in: ["CUSTOMER"] },
				resetPasswordToken: resetToken,
				resetPasswordExpires: { gt: new Date() }
			}
		});

		if (!user) {
			throw createError(404, "User not found or reset token expired");
		}

		try {
			// Send new OTP via email
			await sendAndStoreOTP(email);

			// Extend reset token expiry
			const resetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

			await prisma.user.update({
				where: { id: user.id },
				data: {
					resetPasswordExpires: resetExpires
				}
			});

			return {
				message: "OTP resent successfully to your email for password reset",
				resetToken: resetToken
			};
		} catch (error) {
			throw createError(400, "Failed to resend OTP email for password reset");
		}
	},

	// Guest User Creation
	async createGuestUser(deviceId, email = null) {
		// Validate device ID (should be a non-empty string)
		if (!deviceId || typeof deviceId !== 'string' || deviceId.trim() === '') {
			throw createError(400, "Device ID is required and must be a valid string");
		}

		// Validate email if provided
		if (email && !validator.isEmail(email)) {
			throw createError(400, "Invalid email format");
		}

		try {
			console.log('🔍 Searching for existing user with deviceId:', deviceId.trim());

			// Check if guest user already exists with this device ID
			const existingUser = await prisma.user.findFirst({
				where: { deviceId: deviceId.trim() }
			});

			console.log('🔍 Existing user found:', existingUser ? 'Yes' : 'No');

			if (existingUser) {
				return {
					success: true,
					message: "Guest user already exists",
					data: {
						id: existingUser.id,
						deviceId: existingUser.deviceId,
						role: existingUser.role,
						status: existingUser.status
					},
					isExisting: true
				};
			}

			// Prepare data for guest user creation
			const guestData = {
				deviceId: deviceId.trim(),
				role: "GUEST",
				status: "PENDING",
				isActive: true
			};

			// Only add email if it's provided (to avoid unique constraint issues with null)
			if (email && email.trim()) {
				guestData.email = email.trim();
			}

			console.log('🆕 Creating new guest user with data:', guestData);

			// Create new guest user
			const guest = await prisma.user.create({
				data: guestData
			});

			console.log('✅ Guest user created successfully:', guest.id);

			return {
				success: true,
				message: "Guest user created successfully",
				data: {
					id: guest.id,
					deviceId: guest.deviceId,
					role: guest.role,
					status: guest.status
				},
				isExisting: false
			};
		} catch (error) {
			console.error('❌ Create Guest User Error:', error);
			console.error('❌ Error details:', {
				name: error.name,
				message: error.message,
				code: error.code,
				meta: error.meta
			});
			throw createError(500, "Failed to create guest user");
		}
	},

	// Get Guest User by Device ID
	async getGuestUser(deviceId) {
		if (!deviceId || typeof deviceId !== 'string' || deviceId.trim() === '') {
			throw createError(400, "Device ID is required and must be a valid string");
		}

		try {
			const guest = await prisma.user.findFirst({
				where: { deviceId: deviceId.trim() },
				select: {
					id: true,
					deviceId: true,
					email: true,
					role: true,
					status: true,
					isActive: true,
					createdAt: true,
					updatedAt: true
				}
			});

			if (!guest) {
				throw createError(404, "Guest user not found");
			}

			return {
				success: true,
				message: "Guest user retrieved successfully",
				data: guest
			};
		} catch (error) {
			if (error.status === 404) {
				throw error;
			}
			console.error('Get Guest User Error:', error);
			throw createError(500, "Failed to retrieve guest user");
		}
	},

	// Update Guest User
	async updateGuestUser(deviceId, updateData) {
		const { email, firstName, lastName, city, state, address } = updateData;

		if (!deviceId || typeof deviceId !== 'string' || deviceId.trim() === '') {
			throw createError(400, "Device ID is required and must be a valid string");
		}

		// Validate email if provided
		if (email && !validator.isEmail(email)) {
			throw createError(400, "Invalid email format");
		}

		try {
			// Check if guest user exists
			const existingGuest = await prisma.user.findFirst({
				where: { deviceId: deviceId.trim() }
			});

			if (!existingGuest) {
				throw createError(404, "Guest user not found");
			}

			if (existingGuest.role !== "GUEST") {
				throw createError(403, "Only guest users can be updated through this method");
			}

			const updatedGuest = await prisma.user.update({
				where: { id: existingGuest.id },
				data: {
					email: email?.trim(),
					firstName: firstName?.trim(),
					lastName: lastName?.trim(),
					city: city?.trim(),
					state: state?.trim(),
					address: address?.trim()
				}
			});

			return {
				success: true,
				message: "Guest user updated successfully",
				data: updatedGuest
			};
		} catch (error) {
			if (error.status === 404 || error.status === 403) {
				throw error;
			}
			console.error('Update Guest User Error:', error);
			throw createError(500, "Failed to update guest user");
		}
	},

	// Vendor Management for Admin
	async getAllVendors({ page = 1, limit = 10, search = '', status = '', sortBy = 'createdAt', sortOrder = 'desc' }) {
		try {
			const skip = (page - 1) * limit;

			// Build where clause
			const where = {
				role: { in: ["VENDOR"] }
			};

			if (search) {
				where.OR = [
					{ firstName: { contains: search, mode: 'insensitive' } },
					{ lastName: { contains: search, mode: 'insensitive' } },
					{ email: { contains: search, mode: 'insensitive' } },
					{ mobile: { contains: search, mode: 'insensitive' } },
					{ storeName: { contains: search, mode: 'insensitive' } }
				];
			}

			if (status) {
				where.status = status;
			}

			// Build order by clause
			const orderBy = {};
			orderBy[sortBy] = sortOrder;

			const [vendors, total] = await Promise.all([
				prisma.user.findMany({
					where,
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						mobile: true,
						phone: true,
						storeName: true,
						storeAddress: true,
						city: true,
						state: true,
						address: true,
						role: true,
						status: true,
						isActive: true,
						isEmailVerified: true,
						isPhoneVerified: true,
						createdAt: true,
						updatedAt: true,
						Store: {
							select: {
								id: true,
								storeName: true,
								isVerified: true,
								createdAt: true
							}
						}
					},
					skip,
					take: parseInt(limit),
					orderBy
				}),
				prisma.user.count({ where })
			]);

			const totalPages = Math.ceil(total / limit);

			return {
				vendors,
				pagination: {
					currentPage: parseInt(page),
					totalPages,
					totalItems: total,
					itemsPerPage: parseInt(limit)
				}
			};
		} catch (error) {
			console.error('Get All Vendors Error:', error);
			throw createError(500, "Failed to retrieve vendors");
		}
	},

	async getVendorsManagement({ page = 1, limit = 10, search = '', status = '', sortBy = 'createdAt', sortOrder = 'desc' }) {
		try {
			const skip = (page - 1) * limit;

			// Build where clause
			const where = {
				role: { in: ["VENDOR"] }
			};

			if (search) {
				where.OR = [
					{ firstName: { contains: search, mode: 'insensitive' } },
					{ lastName: { contains: search, mode: 'insensitive' } },
					{ email: { contains: search, mode: 'insensitive' } },
					{ mobile: { contains: search, mode: 'insensitive' } },
					{ storeName: { contains: search, mode: 'insensitive' } }
				];
			}

			if (status) {
				where.status = status;
			}

			// Build order by clause
			const orderBy = {};
			orderBy[sortBy] = sortOrder;

			const [vendors, total] = await Promise.all([
				prisma.user.findMany({
					where,
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						mobile: true,
						phone: true,
						storeName: true,
						storeAddress: true,
						city: true,
						state: true,
						address: true,
						role: true,
						status: true,
						isActive: true,
						isEmailVerified: true,
						isPhoneVerified: true,
						createdAt: true,
						updatedAt: true,
						Store: {
							select: {
								id: true,
								storeName: true,
								isVerified: true,
								createdAt: true
							}
						},
						Product: {
							select: {
								id: true,
								status: true
							}
						},
						order: {
							select: {
								id: true,
								totalAmount: true,
								status: true
							}
						}
					},
					skip,
					take: parseInt(limit),
					orderBy
				}),
				prisma.user.count({ where })
			]);

			// Transform data for frontend
			const transformedVendors = vendors.map(vendor => {
				const totalProducts = vendor.Product.length;
				const activeProducts = vendor.Product.filter(p => p.status === 'ACTIVE').length;
				const totalOrders = vendor.order.length;
				const totalSales = vendor.order.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

				return {
					id: vendor.id,
					name: `${vendor.firstName || ''} ${vendor.lastName || ''}`.trim(),
					storeName: vendor.storeName || vendor.Store?.[0]?.storeName || 'N/A',
					email: vendor.email,
					phone: vendor.mobile || vendor.phone,
					address: vendor.storeAddress || vendor.address || 'N/A',
					status: vendor.status.toLowerCase(),
					isActive: vendor.isActive,
					joinDate: vendor.createdAt,
					products: totalProducts,
					activeProducts: activeProducts,
					totalOrders: totalOrders,
					totalSales: totalSales,
					liveStreams: 0, // Default to 0 as requested
					storeVerified: vendor.Store?.[0]?.isVerified || false
				};
			});

			const totalPages = Math.ceil(total / limit);

			return {
				vendors: transformedVendors,
				pagination: {
					currentPage: parseInt(page),
					totalPages,
					totalItems: total,
					itemsPerPage: parseInt(limit)
				}
			};
		} catch (error) {
			console.error('Get Vendors Management Error:', error);
			throw createError(500, "Failed to retrieve vendors management data");
		}
	},

	async getVendorById(id) {
		try {
			const vendor = await prisma.user.findFirst({
				where: {
					id,
					role: { in: ["VENDOR"] }
				},
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					mobile: true,
					phone: true,
					storeName: true,
					storeAddress: true,
					city: true,
					state: true,
					address: true,
					facebookUrl: true,
					instagramUrl: true,
					youtubeUrl: true,
					role: true,
					status: true,
					isActive: true,
					isEmailVerified: true,
					isPhoneVerified: true,
					createdAt: true,
					updatedAt: true,
					Store: {
						select: {
							id: true,
							storeName: true,
							isVerified: true,
							coverImage: true,
							profileImage: true,
							returnPolicy: true,
							shippingDay: true,
							street: true,
							city: true,
							state: true,
							country: true,
							pinCode: true,
							createdAt: true
						}
					},
					StoreDocument: {
						select: {
							id: true,
							documentType: true,
							fileUrl: true,
							createdAt: true
						}
					},
					BankDetails: {
						select: {
							id: true,
							holderName: true,
							accountName: true,
							bankName: true,
							branch: true,
							createdAt: true
						}
					}
				}
			});

			if (!vendor) {
				throw createError(404, "Vendor not found");
			}

			return vendor;
		} catch (error) {
			if (error.status === 404) {
				throw error;
			}
			console.error('Get Vendor By ID Error:', error);
			throw createError(500, "Failed to retrieve vendor");
		}
	},

	async updateVendorStatus(id, status) {
		try {
			// Validate status
			const validStatuses = ['PENDING', 'APPROVED'];
			if (!validStatuses.includes(status)) {
				throw createError(400, "Invalid status. Must be one of: PENDING, APPROVED, LIVE");
			}

			const vendor = await prisma.user.findFirst({
				where: {
					id,
					role: { in: ["VENDOR"] }
				}
			});

			if (!vendor) {
				throw createError(404, "Vendor not found");
			}

			const updatedVendor = await prisma.user.update({
				where: { id },
				data: { status },
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					mobile: true,
					storeName: true,
					role: true,
					status: true,
					isActive: true,
					updatedAt: true
				}
			});

			return updatedVendor;
		} catch (error) {
			if (error.status === 404 || error.status === 400) {
				throw error;
			}
			console.error('Update Vendor Status Error:', error);
			throw createError(500, "Failed to update vendor status");
		}
	},

	async toggleVendorActiveStatus(id) {
		try {
			const vendor = await prisma.user.findFirst({
				where: {
					id,
					role: { in: ["VENDOR"] }
				}
			});

			if (!vendor) {
				throw createError(404, "Vendor not found");
			}

			const updatedVendor = await prisma.user.update({
				where: { id },
				data: { isActive: !vendor.isActive },
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					mobile: true,
					storeName: true,
					role: true,
					status: true,
					isActive: true,
					updatedAt: true
				}
			});

			return updatedVendor;
		} catch (error) {
			if (error.status === 404) {
				throw error;
			}
			console.error('Toggle Vendor Active Status Error:', error);
			throw createError(500, "Failed to toggle vendor active status");
		}
	},

	// Google Authentication
	async verifyGoogleToken(accessToken) {
		try {
			const response = await axios.get(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
			return response.data;
		} catch (error) {
			throw createError(401, "Invalid Google access token");
		}
	},

	async googleAuth(googleUserData) {
		try {
			const { email, given_name, family_name, picture, id: googleId } = googleUserData;

			if (!email) {
				throw createError(400, "Email is required from Google");
			}

			// Check if user already exists
			let user = await prisma.user.findFirst({
				where: { email }
			});

			if (user) {
				// User exists, update Google ID if not set
				if (!user.googleId) {
					user = await prisma.user.update({
						where: { id: user.id },
						data: { googleId }
					});
				}

				// If user is not active, activate them
				if (!user.isActive) {
					user = await prisma.user.update({
						where: { id: user.id },
						data: { isActive: true }
					});
				}

				// Mark email as verified if not already
				if (!user.isEmailVerified) {
					user = await prisma.user.update({
						where: { id: user.id },
						data: { isEmailVerified: true }
					});
				}

				return this.getUserPayload(user);
			} else {
				// Create new user
				const deviceId = `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

				const newUser = await prisma.user.create({
					data: {
						email,
						firstName: given_name || null,
						lastName: family_name || null,
						avatar: picture || null,
						googleId,
						deviceId,
						role: "CUSTOMER",
						status: "APPROVED",
						isActive: true,
						isEmailVerified: true,
						isPhoneVerified: false
					}
				});

				return this.getUserPayload(newUser);
			}
		} catch (error) {
			console.error('Google Auth Error:', error);
			throw error;
		}
	},

	async linkGoogleAccount(userId, googleUserData) {
		try {
			const { email, given_name, family_name, picture, id: googleId } = googleUserData;

			if (!email) {
				throw createError(400, "Email is required from Google");
			}

			// Check if user exists
			const user = await prisma.user.findUnique({
				where: { id: userId }
			});

			if (!user) {
				throw createError(404, "User not found");
			}

			// Check if Google account is already linked to another user
			const existingGoogleUser = await prisma.user.findFirst({
				where: {
					googleId,
					id: { not: userId }
				}
			});

			if (existingGoogleUser) {
				throw createError(400, "Google account is already linked to another user");
			}

			// Update user with Google information
			const updatedUser = await prisma.user.update({
				where: { id: userId },
				data: {
					googleId,
					email: email || user.email,
					firstName: given_name || user.firstName,
					lastName: family_name || user.lastName,
					avatar: picture || user.avatar,
					isEmailVerified: true
				}
			});

			return this.getUserPayload(updatedUser);
		} catch (error) {
			console.error('Link Google Account Error:', error);
			throw error;
		}
	},

	async unlinkGoogleAccount(userId) {
		try {
			const user = await prisma.user.findUnique({
				where: { id: userId }
			});

			if (!user) {
				throw createError(404, "User not found");
			}

			if (!user.googleId) {
				throw createError(400, "User does not have a linked Google account");
			}

			// Unlink Google account
			const updatedUser = await prisma.user.update({
				where: { id: userId },
				data: {
					googleId: null,
					// Keep other fields as they are
				}
			});

			return {
				success: true,
				message: "Google account unlinked successfully",
				data: {
					userId: updatedUser.id,
					email: updatedUser.email
				}
			};
		} catch (error) {
			console.error('Unlink Google Account Error:', error);
			throw error;
		}
	},

	// Generic: list users by roles with filters (Admin)
	async listUsersByRoles({ roles = [], page = 1, limit = 10, search = '', status = '', sortBy = 'createdAt', sortOrder = 'desc' }) {
		try {
			const skip = (page - 1) * limit;

			const where = {};
			if (roles && roles.length) {
				where.role = { in: roles };
			}
			if (status) {
				where.status = status;
			}
			if (search) {
				where.OR = [
					{ firstName: { contains: search, mode: 'insensitive' } },
					{ lastName: { contains: search, mode: 'insensitive' } },
					{ email: { contains: search, mode: 'insensitive' } },
					{ mobile: { contains: search, mode: 'insensitive' } },
					{ phone: { contains: search, mode: 'insensitive' } },
					{ storeName: { contains: search, mode: 'insensitive' } }
				];
			}

			const orderBy = {};
			orderBy[sortBy] = sortOrder;

			const [users, total] = await Promise.all([
				prisma.user.findMany({
					where,
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						mobile: true,
						phone: true,
						role: true,
						status: true,
						isActive: true,
						isEmailVerified: true,
						isPhoneVerified: true,
						storeName: true,
						createdAt: true,
						updatedAt: true,
						Store: {
							select: {
								id: true,
								storeName: true,
								isVerified: true,
								userName: true,
								createdAt: true
							}
						}
					},
					skip,
					take: parseInt(limit),
					orderBy
				}),
				prisma.user.count({ where })
			]);

			const totalPages = Math.ceil(total / limit);

			return {
				users,
				pagination: {
					currentPage: parseInt(page),
					totalPages,
					totalItems: total,
					itemsPerPage: parseInt(limit)
				}
			};
		} catch (error) {
			console.error('List Users By Roles Error:', error);
			throw createError(500, 'Failed to retrieve users');
		}
	},

	async getUserById(id) {
		try {
			const user = await prisma.user.findUnique({
				where: { id },
				select: {
					id: true,
					deviceId: true,
					email: true,
					firstName: true,
					lastName: true,
					phone: true,
					mobile: true,
					businessType: true,
					avatar: true,
					profilePhoto: true,
					coverPhoto: true,
					isEmailVerified: true,
					isPhoneVerified: true,
					isActive: true,
					role: true,
					status: true,
					pinCode: false,
					city: true,
					state: true,
					address: true,
					country: true,
					storeName: true,
					storeAddress: true,
					facebookUrl: true,
					instagramUrl: true,
					youtubeUrl: true,
					createdAt: true,
					updatedAt: true
				}
			});
			if (!user) {
				throw createError(404, 'User not found');
			}
			return user;
		} catch (error) {
			if (error.status === 404) throw error;
			console.error('Get User By ID Error:', error);
			throw createError(500, 'Failed to retrieve user');
		}
	},

	async createUser(data) {
		try {
			const { role, email, mobile, phone, password } = data;
			if (!role) throw createError(400, 'Role is required');

			// Ensure not duplicate for user types that have unique identifiers
			if (email || mobile || phone) {
				const existing = await prisma.user.findFirst({
					where: {
						OR: [
							email ? { email } : undefined,
							mobile ? { mobile } : undefined,
							phone ? { phone } : undefined
						].filter(Boolean)
					}
				});
				if (existing) throw createError(400, 'User with provided contact already exists');
			}

			let hashedPassword = null;
			if (password) {
				this.validatePassword(password);
				hashedPassword = await bcrypt.hash(password, 10);
			}

			const user = await prisma.user.create({
				data: {
					...data,
					pinCode: hashedPassword || null
				},
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					mobile: true,
					phone: true,
					role: true,
					status: true,
					isActive: true,
					createdAt: true
				}
			});
			return user;
		} catch (error) {
			if (error.status === 400) throw error;
			console.error('Create User Error:', error);
			throw createError(500, 'Failed to create user');
		}
	},

	// Staff: Create Admin Staff
	async createAdminStaff(data) {
		try {
			const { email, firstName, lastName, mobile, phone, adminId } = data;
			if (!adminId) throw createError(400, 'adminId is required');
			const admin = await prisma.user.findFirst({ where: { id: adminId, role: 'ADMIN' } });
			if (!admin) throw createError(404, 'Admin not found');
			if (email || mobile || phone) {
				const existing = await prisma.user.findFirst({
					where: {
						OR: [
							email ? { email } : undefined,
							mobile ? { mobile } : undefined,
							phone ? { phone } : undefined
						].filter(Boolean)
					}
				});
				if (existing) throw createError(400, 'User with provided contact already exists');
			}

			// Create user with ADMIN_STAFF role (exclude linkage fields)
			const { adminId: _omitAdminId, vendorId: _omitVendorId, ...userData } = data;
			const createdUser = await prisma.user.create({
				data: {
					...userData,
					role: 'ADMIN_STAFF',
					status: userData.status || 'APPROVED',
					isActive: userData.isActive ?? true
				}
			});

			// Create AdminStaff shadow record (with mirrored fields)
			const staff = await prisma.adminStaff.create({
				data: {
					userId: createdUser.id,
					adminId,
					firstName: createdUser.firstName || null,
					lastName: createdUser.lastName || null,
					email: createdUser.email || null,
					phone: createdUser.phone || null,
					mobile: createdUser.mobile || null,
					isActive: createdUser.isActive,
					role: 'ADMIN_STAFF',
					status: createdUser.status
				}
			});

			return { ...staff, user: createdUser };
		} catch (error) {
			if (error.status === 400) throw error;
			console.error('Create Admin Staff Error:', error);
			throw createError(500, 'Failed to create admin staff');
		}
	},

	// Staff: Create Vendor Staff
	async createVendorStaff(data) {
		try {
			const { email, mobile, phone, vendorId } = data;
			if (!vendorId) throw createError(400, 'vendorId is required');
			const vendor = await prisma.user.findFirst({ where: { id: vendorId, role: { in: ['VENDOR'] } } });
			if (!vendor) throw createError(404, 'Vendor not found');
			if (email || mobile || phone) {
				const existing = await prisma.user.findFirst({
					where: {
						OR: [
							email ? { email } : undefined,
							mobile ? { mobile } : undefined,
							phone ? { phone } : undefined
						].filter(Boolean)
					}
				});
				if (existing) throw createError(400, 'User with provided contact already exists');
			}

			// Create user with VENDOR_STAFF role (exclude linkage fields)
			const { vendorId: _omitVendorId2, adminId: _omitAdminId2, ...userData } = data;
			const createdUser = await prisma.user.create({
				data: {
					...userData,
					role: 'VENDOR_STAFF',
					status: userData.status || 'APPROVED',
					isActive: userData.isActive ?? true
				}
			});

			const staff = await prisma.vendorStaff.create({
				data: {
					userId: createdUser.id,
					vendorId,
					firstName: createdUser.firstName || null,
					lastName: createdUser.lastName || null,
					email: createdUser.email || null,
					phone: createdUser.phone || null,
					mobile: createdUser.mobile || null,
					isActive: createdUser.isActive,
					role: 'VENDOR_STAFF',
					status: createdUser.status
				}
			});

			return { ...staff, user: createdUser };
		} catch (error) {
			if (error.status === 400) throw error;
			console.error('Create Vendor Staff Error:', error);
			throw createError(500, 'Failed to create vendor staff');
		}
	},

	// Staff: List Admin Staff (with full user fields)
	async listAdminStaff({ page = 1, limit = 10, search = '', status = '', sortBy = 'createdAt', sortOrder = 'desc' }) {
		try {
			const skip = (page - 1) * limit;
			const whereUser = { role: 'ADMIN_STAFF' };
			if (status) whereUser.status = status;
			if (search) {
				whereUser.OR = [
					{ firstName: { contains: search, mode: 'insensitive' } },
					{ lastName: { contains: search, mode: 'insensitive' } },
					{ email: { contains: search, mode: 'insensitive' } },
					{ mobile: { contains: search, mode: 'insensitive' } },
					{ phone: { contains: search, mode: 'insensitive' } }
				];
			}
			const orderBy = {}; orderBy[sortBy] = sortOrder;

			const [users, total] = await Promise.all([
				prisma.adminStaff.findMany({
					where: status ? { status } : {},
					select: {
						id: true,
						adminId: true,
						createdAt: true,
						updatedAt: true,
						user: {
							select: {
								id: true,
								deviceId: true,
								email: true,
								firstName: true,
								lastName: true,
								phone: true,
								mobile: true,
								businessType: true,
								avatar: true,
								profilePhoto: true,
								coverPhoto: true,
								isEmailVerified: true,
								isPhoneVerified: true,
								isActive: true,
								role: true,
								status: true,
								city: true,
								state: true,
								address: true,
								country: true,
								createdAt: true,
								updatedAt: true
							}
						}
					},
					skip,
					take: parseInt(limit),
					orderBy: { [sortBy]: sortOrder }
				}),
				prisma.adminStaff.count({ where: status ? { status } : {} })
			]);

			return {
				users,
				pagination: {
					currentPage: parseInt(page),
					totalPages: Math.ceil(total / limit),
					totalItems: total,
					itemsPerPage: parseInt(limit)
				}
			};
		} catch (error) {
			console.error('List Admin Staff Error:', error);
			throw createError(500, 'Failed to retrieve admin staff');
		}
	},

	// Staff: List Vendor Staff (with full user fields)
	async listVendorStaff({ page = 1, limit = 10, search = '', status = '', sortBy = 'createdAt', sortOrder = 'desc' }) {
		try {
			const skip = (page - 1) * limit;
			const whereUser = { role: 'VENDOR_STAFF' };
			if (status) whereUser.status = status;
			if (search) {
				whereUser.OR = [
					{ firstName: { contains: search, mode: 'insensitive' } },
					{ lastName: { contains: search, mode: 'insensitive' } },
					{ email: { contains: search, mode: 'insensitive' } },
					{ mobile: { contains: search, mode: 'insensitive' } },
					{ phone: { contains: search, mode: 'insensitive' } }
				];
			}
			const orderBy = {}; orderBy[sortBy] = sortOrder;

			const [users, total] = await Promise.all([
				prisma.vendorStaff.findMany({
					where: status ? { status } : {},
					select: {
						id: true,
						vendorId: true,
						createdAt: true,
						updatedAt: true,
						user: {
							select: {
								id: true,
								deviceId: true,
								email: true,
								firstName: true,
								lastName: true,
								phone: true,
								mobile: true,
								businessType: true,
								avatar: true,
								profilePhoto: true,
								coverPhoto: true,
								isEmailVerified: true,
								isPhoneVerified: true,
								isActive: true,
								role: true,
								status: true,
								city: true,
								state: true,
								address: true,
								country: true,
								createdAt: true,
								updatedAt: true
							}
						}
					},
					skip,
					take: parseInt(limit),
					orderBy: { [sortBy]: sortOrder }
				}),
				prisma.vendorStaff.count({ where: status ? { status } : {} })
			]);

			return {
				users,
				pagination: {
					currentPage: parseInt(page),
					totalPages: Math.ceil(total / limit),
					totalItems: total,
					itemsPerPage: parseInt(limit)
				}
			};
		} catch (error) {
			console.error('List Vendor Staff Error:', error);
			throw createError(500, 'Failed to retrieve vendor staff');
		}
	},

	async updateUser(id, updateData) {
		try {
			const allowedStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
			if (updateData.status && !allowedStatuses.includes(updateData.status)) {
				throw createError(400, 'Invalid status');
			}

			if (updateData.password) {
				this.validatePassword(updateData.password);
				updateData.pinCode = await bcrypt.hash(updateData.password, 10);
				delete updateData.password;
			}

			const updated = await prisma.user.update({
				where: { id },
				data: updateData,
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					mobile: true,
					phone: true,
					role: true,
					status: true,
					isActive: true,
					updatedAt: true
				}
			});
			return updated;
		} catch (error) {
			if (error.status === 400) throw error;
			console.error('Update User Error:', error);
			throw createError(500, 'Failed to update user');
		}
	},

	async setPasswordForUser(id, newPassword) {
		try {
			this.validatePassword(newPassword);
			const hashed = await bcrypt.hash(newPassword, 10);
			const updated = await prisma.user.update({
				where: { id },
				data: { pinCode: hashed },
				select: { id: true }
			});
			return updated;
		} catch (error) {
			if (error.status === 400) throw error;
			console.error('Set Password For User Error:', error);
			throw createError(500, 'Failed to set user password');
		}
	},

	async deleteUserAndRelated(id) {
		try {
			// Gather product ids and variation ids for manual cleanup in Mongo
			const [products, variations, orders, stores] = await Promise.all([
				prisma.product.findMany({ where: { vendorId: id }, select: { id: true } }),
				prisma.variations.findMany({ where: { userId: id }, select: { id: true } }),
				prisma.order.findMany({ where: { userId: id }, select: { id: true } }),
				prisma.store.findMany({ where: { vendorId: id }, select: { id: true } })
			]);

			const productIds = products.map(p => p.id);
			const variationIds = variations.map(v => v.id);
			const orderIds = orders.map(o => o.id);
			const storeIds = stores.map(s => s.id);

			const ops = [];

			// Order-related
			if (orderIds.length) {
				ops.push(prisma.orderItems.deleteMany({ where: { orderId: { in: orderIds } } }));
				ops.push(prisma.shippingAddress.deleteMany({ where: { orderId: { in: orderIds } } }));
				ops.push(prisma.billingAddress.deleteMany({ where: { orderId: { in: orderIds } } }));
				ops.push(prisma.order.deleteMany({ where: { id: { in: orderIds } } }));
			}

			// Product-related (owned by this vendor)
			if (productIds.length) {
				ops.push(prisma.specification.deleteMany({ where: { productId: { in: productIds } } }));
				ops.push(prisma.productVeriations.deleteMany({ where: { productId: { in: productIds } } }));
				ops.push(prisma.orderItems.deleteMany({ where: { productId: { in: productIds } } }));
				ops.push(prisma.reviews.deleteMany({ where: { productId: { in: productIds } } }));
				ops.push(prisma.favProducts.deleteMany({ where: { productId: { in: productIds } } }));
				ops.push(prisma.mainCart.deleteMany({ where: { productId: { in: productIds } } }));
				ops.push(prisma.product.deleteMany({ where: { id: { in: productIds } } }));
			}

			// Variations owned by user
			if (variationIds.length) {
				ops.push(prisma.variationOptions.deleteMany({ where: { variationId: { in: variationIds } } }));
				ops.push(prisma.productVeriations.deleteMany({ where: { variationsId: { in: variationIds } } }));
				ops.push(prisma.variations.deleteMany({ where: { id: { in: variationIds } } }));
			}

			// Store-related for this user (as vendor)
			if (storeIds.length) {
				ops.push(prisma.zones.deleteMany({ where: { storeId: { in: storeIds } } }));
				ops.push(prisma.storeDocument.deleteMany({ where: { storeId: { in: storeIds } } }));
				ops.push(prisma.follow.deleteMany({ where: { storeId: { in: storeIds } } }));
				ops.push(prisma.following.deleteMany({ where: { storeId: { in: storeIds } } }));
				ops.push(prisma.store.deleteMany({ where: { id: { in: storeIds } } }));
			}

			// Misc relations directly by user
			ops.push(prisma.shippingPolicies.deleteMany({ where: { userId: id } }));
			ops.push(prisma.bankDetails.deleteMany({ where: { userId: id } }));
			ops.push(prisma.savedAddress.deleteMany({ where: { userId: id } }));
			ops.push(prisma.mainCart.deleteMany({ where: { userId: id } }));
			ops.push(prisma.favProducts.deleteMany({ where: { userId: id } }));
			ops.push(prisma.reviews.deleteMany({ where: { userId: id } }));
			ops.push(prisma.reviewImpressions.deleteMany({ where: { userId: id } }));
			ops.push(prisma.wareHouse.deleteMany({ where: { userId: id } }));

			// Staff relations where this user could be either side
			ops.push(prisma.adminStaff.deleteMany({ where: { OR: [{ userId: id }, { adminId: id }] } }));
			ops.push(prisma.vendorStaff.deleteMany({ where: { OR: [{ userId: id }, { vendorId: id }] } }));
			ops.push(prisma.userStaff.deleteMany({ where: { userId: id } }));

			// Follows where this user is follower/following
			ops.push(prisma.follow.deleteMany({ where: { OR: [{ userId: id }, { followerId: id }] } }));
			ops.push(prisma.following.deleteMany({ where: { OR: [{ userId: id }, { followingId: id }] } }));

			// Finally delete the user
			ops.push(prisma.user.delete({ where: { id } }));

			await prisma.$transaction(ops);

			return { success: true };
		} catch (error) {
			console.error('Delete User And Related Error:', error);
			throw createError(500, 'Failed to delete user');
		}
	},

	async demoteVendorToCustomer(id) {
		try {
			// Collect vendor-owned stores and products
			const [products, stores, variations] = await Promise.all([
				prisma.product.findMany({ where: { vendorId: id }, select: { id: true } }),
				prisma.store.findMany({ where: { vendorId: id }, select: { id: true } }),
				prisma.variations.findMany({ where: { userId: id }, select: { id: true } })
			]);

			const productIds = products.map(p => p.id);
			const storeIds = stores.map(s => s.id);
			const variationIds = variations.map(v => v.id);

			const ops = [];

			if (productIds.length) {
				ops.push(prisma.specification.deleteMany({ where: { productId: { in: productIds } } }));
				ops.push(prisma.productVeriations.deleteMany({ where: { productId: { in: productIds } } }));
				ops.push(prisma.orderItems.deleteMany({ where: { productId: { in: productIds } } }));
				ops.push(prisma.reviews.deleteMany({ where: { productId: { in: productIds } } }));
				ops.push(prisma.favProducts.deleteMany({ where: { productId: { in: productIds } } }));
				ops.push(prisma.mainCart.deleteMany({ where: { productId: { in: productIds } } }));
				ops.push(prisma.product.deleteMany({ where: { id: { in: productIds } } }));
			}

			if (variationIds.length) {
				ops.push(prisma.variationOptions.deleteMany({ where: { variationId: { in: variationIds } } }));
				ops.push(prisma.productVeriations.deleteMany({ where: { variationsId: { in: variationIds } } }));
				ops.push(prisma.variations.deleteMany({ where: { id: { in: variationIds } } }));
			}

			if (storeIds.length) {
				ops.push(prisma.zones.deleteMany({ where: { storeId: { in: storeIds } } }));
				ops.push(prisma.storeDocument.deleteMany({ where: { storeId: { in: storeIds } } }));
				ops.push(prisma.follow.deleteMany({ where: { storeId: { in: storeIds } } }));
				ops.push(prisma.following.deleteMany({ where: { storeId: { in: storeIds } } }));
				ops.push(prisma.store.deleteMany({ where: { id: { in: storeIds } } }));
			}

			// Update role to CUSTOMER
			ops.push(prisma.user.update({ where: { id }, data: { role: 'CUSTOMER' } }));

			await prisma.$transaction(ops);

			return { success: true };
		} catch (error) {
			console.error('Demote Vendor Error:', error);
			throw createError(500, 'Failed to demote vendor');
		}
	},
};

export default authServices;