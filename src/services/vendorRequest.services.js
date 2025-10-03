import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { sendOTP } from "./otpService.js";
import bcrypt from "bcrypt";
import { sendAndStoreOTP, verifyEmailOTP } from "./emailOtpService.js";

const prisma = new PrismaClient();


export async function createGuestVendorRequest(vendorData) {
  try {
    const {
      firstName,
      lastName,
      mobile,
      email,
      address,
      pinCode,
      city,
      state,
      country,
      businessType,
      storeName,
      storeAddress,
      storePinCode,
      storeCity,
      storeState,
      storeCountry,
      facebookUrl,
      instagramUrl,
      youtubeUrl
    } = vendorData;

    // Validate required fields
    if (!firstName || !lastName || !mobile || !storeName) {
      throw new Error("First name, last name, mobile, and store name are required");
    }

    // Validate mobile number format (E.164)
    if (!/^\+[1-9]\d{1,14}$/.test(mobile)) {
      throw new Error("Invalid mobile number format. Must be in E.164 format (e.g., +919876543210)");
    }

    // Check if mobile already exists
    const existingUser = await prisma.user.findFirst({
      where: { mobile }
    });

    if (existingUser) {
      throw new Error("User with this mobile number already exists");
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email }
      });

      if (existingEmail) {
        throw new Error("User with this email already exists");
      }
    }

    // Create guest user account
    const guestUser = await prisma.user.create({
      data: {
        firstName,
        lastName,
        mobile,
        phone: mobile || null,
        email: email || null,
        address: address || null,
        businessType: businessType || null,
        pinCode: pinCode || null,
        city: city || null,
        state: state || null,
        country: country || null,
        role: "VENDOR",
        status: "PENDING",
        isActive: true,
        isEmailVerified: false,
        isPhoneVerified: false,
        // Save social links on user
        ...(facebookUrl ? { facebookUrl } : {}),
        ...(instagramUrl ? { instagramUrl } : {}),
        ...(youtubeUrl ? { youtubeUrl } : {})
      }
    });

    // Create store for the vendor
    const store = await prisma.store.create({
      data: {
        storeName,
        vendorId: guestUser.id,
        userName: `${firstName}${lastName}`.toLowerCase().replace(/\s+/g, ''),
        street: storeAddress || null,
        city: storeCity || null,
        state: storeState || null,
        country: storeCountry || null,
        pinCode: storePinCode || null,
        isVerified: false
      }
    });

    // Send OTP for phone verification
    const otpResult = await sendOTP(mobile);

    return {
      success: true,
      message: "Guest vendor request created successfully and OTP sent",
      data: {
        userId: guestUser.id,
        storeId: store.id,
        otpSent: otpResult.success,
        otpMessage: otpResult.message,
        otp: otpResult.otp
      }
    };

  } catch (error) {
    console.error("Error creating guest vendor request:", error);
    throw new Error(error.message || "Failed to create guest vendor request");
  }
}

export async function createExistingUserVendorRequest(userId, vendorData) {
  try {
    const {
      firstName,
      lastName,
      phone,
      email,
      businessType,
      address,
      pinCode,
      city,
      state,
      country,
      storeName,
      storeAddress,
      storePinCode,
      storeCity,
      storeState,
      storeCountry,
      facebookUrl,
      instagramUrl,
      youtubeUrl
    } = vendorData;

    // Validate required fields
    if (!storeName) {
      throw new Error("Store name is required");
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      throw new Error("User not found");
    }

    // Check if user is already a vendor
    if (existingUser.role === "VENDOR") {
      throw new Error("User is already a vendor or vendor request is pending");
    }

    // Check if store name already exists
    const existingStore = await prisma.store.findFirst({
      where: { storeName }
    });

    if (existingStore) {
      throw new Error("Store name already exists");
    }

    // Prepare user update data
    const userUpdateData = {
      role: "VENDOR_PENDING",
      status: "PENDING"
    };

    // Add user profile updates if provided
    if (firstName) userUpdateData.firstName = firstName;
    if (lastName) userUpdateData.lastName = lastName;
    if (phone) userUpdateData.phone = phone;
    if (email) userUpdateData.email = email;
    if (address) userUpdateData.address = address;
    if (businessType) userUpdateData.businessType = businessType;
    if (pinCode) userUpdateData.pinCode = pinCode;
    if (city) userUpdateData.city = city;
    if (state) userUpdateData.state = state;
    if (country) userUpdateData.country = country;
    if (facebookUrl) userUpdateData.facebookUrl = facebookUrl;
    if (instagramUrl) userUpdateData.instagramUrl = instagramUrl;
    if (youtubeUrl) userUpdateData.youtubeUrl = youtubeUrl;

    // Update user role and profile details
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: userUpdateData
    });

    // Create store for the vendor
    const store = await prisma.store.create({
      data: {
        storeName,
        vendorId: userId,
        userName: `${existingUser.firstName || 'user'}${existingUser.lastName || ''}`.toLowerCase().replace(/\s+/g, ''),
        street: storeAddress || null,
        city: storeCity || null,
        state: storeState || null,
        country: storeCountry || null,
        pinCode: storePinCode || null,
        isVerified: false
      }
    });

    // Send OTP for phone verification if phone is not verified
    let otpResult = null;
    if (existingUser.mobile && !existingUser.isPhoneVerified) {
      otpResult = await sendOTP(existingUser.mobile);
    }

    return {
      success: true,
      message: "Existing user vendor request created successfully",
      data: {
        userId: updatedUser.id,
        storeId: store.id,
        otpSent: otpResult ? otpResult.success : false,
        otpMessage: otpResult ? otpResult.message : "Phone already verified"
      }
    };

  } catch (error) {
    console.error("Error creating existing user vendor request:", error);
    throw new Error(error.message || "Failed to create existing user vendor request");
  }
}

export async function getVendorRequestStatus(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        Store: true
      }
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get store documents separately since the relationship is from StoreDocument to Store
    let storeDocuments = [];
    if (user.Store && user.Store.length > 0) {
      const storeId = user.Store[0].id;
      storeDocuments = await prisma.storeDocument.findMany({
        where: { storeId: storeId }
      });
    }

    // Combine store and documents
    const storeWithDocuments = user.Store && user.Store.length > 0 ? {
      ...user.Store[0],
      documents: storeDocuments
    } : null;

    // Compute combined status
    const store = user.Store && user.Store.length > 0 ? user.Store[0] : null;
    const userStatus = String(user.status || 'PENDING').toUpperCase();
    const isVerified = Boolean(store?.isVerified);
    const isRejected = Boolean(store?.isRejected);
    let combinedStatus = userStatus;
    if (userStatus === 'REJECTED' || isRejected) combinedStatus = 'REJECTED';
    else if (userStatus === 'APPROVED' && !isVerified) combinedStatus = 'FORM_APPROVED';
    else if (userStatus === 'APPROVED' && isVerified) combinedStatus = 'APPROVED';
    else if (userStatus === 'PENDING' && !isVerified) combinedStatus = 'PENDING';

    return {
      success: true,
      data: {
        userId: user.id,
        role: user.role,
        status: combinedStatus,
        isPhoneVerified: user.isPhoneVerified,
        isEmailVerified: user.isEmailVerified,
        store: storeWithDocuments
      }
    };

  } catch (error) {
    console.error("Error getting vendor request status:", error);
    throw new Error(error.message || "Failed to get vendor request status");
  }
}


export async function updateVendorRequest(userId, updateData) {
  try {
    const {
      firstName,
      lastName,
      phone,
      email,
      address,
      pinCode,
      city,
      state,
      country,
      storeName,
      storeAddress,
      storePinCode,
      storeCity,
      storeState,
      storeCountry,
      facebookUrl,
      instagramUrl,
      youtubeUrl,
      documents
    } = updateData;

    // Update user information
    const userUpdateData = {};
    if (firstName) userUpdateData.firstName = firstName;
    if (lastName) userUpdateData.lastName = lastName;
    if (phone) userUpdateData.phone = phone;
    if (email) userUpdateData.email = email;
    if (address) userUpdateData.address = address;
    if (pinCode) userUpdateData.pinCode = pinCode;
    if (city) userUpdateData.city = city;
    if (state) userUpdateData.state = state;
    if (country) userUpdateData.country = country;
    if (facebookUrl) userUpdateData.facebookUrl = facebookUrl;
    if (instagramUrl) userUpdateData.instagramUrl = instagramUrl;
    if (youtubeUrl) userUpdateData.youtubeUrl = youtubeUrl;

    let updatedUser = null;
    if (Object.keys(userUpdateData).length > 0) {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: userUpdateData
      });
    }

    // Update store information
    const store = await prisma.store.findFirst({
      where: { vendorId: userId }
    });

    let updatedStore = null;
    if (store) {
      const storeUpdateData = {};
      if (storeName) storeUpdateData.storeName = storeName;
      if (storeAddress) storeUpdateData.street = storeAddress;
      if (storePinCode) storeUpdateData.pinCode = storePinCode;
      if (storeCity) storeUpdateData.city = storeCity;
      if (storeState) storeUpdateData.state = storeState;
      if (storeCountry) storeUpdateData.country = storeCountry;

      if (Object.keys(storeUpdateData).length > 0) {
        updatedStore = await prisma.store.update({
          where: { id: store.id },
          data: storeUpdateData
        });
      }
    }

    // Process new documents if provided
    let newDocuments = [];
    if (Array.isArray(documents) && documents.length > 0 && store) {
      const documentData = documents.map(doc => ({
        storeId: store.id,
        documentType: String(doc.documentType).trim(),
        fileUrl: String(doc.fileUrl).trim(),
        status: "PENDING"
      }));

      const createdDocs = await prisma.storeDocument.createMany({
        data: documentData
      });

      // Fetch the created documents to return them
      if (createdDocs.count > 0) {
        newDocuments = await prisma.storeDocument.findMany({
          where: { 
            storeId: store.id,
            documentType: { in: documents.map(d => d.documentType) },
            fileUrl: { in: documents.map(d => d.fileUrl) }
          },
          orderBy: { createdAt: "desc" },
          take: createdDocs.count
        });
      }
    }

    // Get all existing documents for the store
    let existingDocuments = [];
    if (store) {
      existingDocuments = await prisma.storeDocument.findMany({
        where: { storeId: store.id }
      });
    }

    const result = {
      user: updatedUser,
      store: updatedStore || store,
      newDocuments: newDocuments,
      existingDocuments: existingDocuments,
      totalDocuments: existingDocuments.length + newDocuments.length
    };

    const updateMessages = [];
    if (Object.keys(userUpdateData).length > 0) updateMessages.push("user profile");
    if (updatedStore) updateMessages.push("store information");
    if (newDocuments.length > 0) updateMessages.push(`${newDocuments.length} new document(s)`);

    const message = updateMessages.length > 0 
      ? `${updateMessages.join(", ")} updated successfully`
      : "Nothing to update";

    return {
      success: true,
      message: message,
      data: result
    };

  } catch (error) {
    console.error("Error updating vendor request:", error);
    throw new Error(error.message || "Failed to update vendor request");
  }
}


export async function deleteVendorRequest(userId) {
  try {
    // Check if user exists and is a vendor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        Store: true
      }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.role !== "VENDOR_PENDING" && user.role !== "VENDOR") {
      throw new Error("User is not a vendor");
    }

    // Delete store and related data
    if (user.Store.length > 0) {
      await prisma.store.deleteMany({
        where: { vendorId: userId }
      });
    }

    // Delete store documents
    await prisma.storeDocument.deleteMany({
      where: { storeId: userId }
    });

    // Reset user role to USER
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: "CUSTOMER",
        status: "PENDING"
      }
    });

    return {
      success: true,
      message: "Vendor request deleted successfully"
    };

  } catch (error) {
    console.error("Error deleting vendor request:", error);
    throw new Error(error.message || "Failed to delete vendor request");
  }
}

export async function uploadStoreDocuments(userId, documents) {
  try {
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error("Documents array is required");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { Store: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.Store || user.Store.length === 0) {
      throw new Error("Store not found for user");
    }

    const store = user.Store[0];

    // Extract social URLs if accidentally sent as documents
    const socialDocs = documents.filter(d => /^(facebook_url|instagram_url|youtube_url)$/i.test(String(d.documentType || '')));
    if (socialDocs.length) {
      const socialUpdate = {};
      for (const d of socialDocs) {
        const t = String(d.documentType).toLowerCase();
        if (t === 'facebook_url') socialUpdate.facebookUrl = d.fileUrl;
        if (t === 'instagram_url') socialUpdate.instagramUrl = d.fileUrl;
        if (t === 'youtube_url') socialUpdate.youtubeUrl = d.fileUrl;
      }
      if (Object.keys(socialUpdate).length) {
        await prisma.user.update({ where: { id: userId }, data: socialUpdate });
      }
    }

    const sanitized = documents
      .filter(d => d && d.documentType && d.fileUrl)
      // exclude social urls from documents table
      .filter(d => !/^(facebook_url|instagram_url|youtube_url)$/i.test(String(d.documentType)))
      .map(d => ({
        storeId: userId,
        documentType: String(d.documentType).trim(),
        fileUrl: String(d.fileUrl).trim()
      }));

    if (sanitized.length) {
      await prisma.storeDocument.createMany({ data: sanitized });
    }

    // Return current list
    const documentsList = await prisma.storeDocument.findMany({ where: { storeId: userId } });

    return {
      success: true,
      message: "Documents uploaded successfully",
      data: {
        storeId: store.id,
        documents: documentsList
      }
    };
  } catch (error) {
    console.error("Error uploading store documents:", error);
    throw new Error(error.message || "Failed to upload store documents");
  }
}

export async function setVendorCredentials(userId, { email, password, resetToken }) {
  try {
    if (!email || !password || !resetToken) {
      throw new Error("Email, password and reset token are required");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { Store: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.Store || user.Store.length === 0) {
      throw new Error("Store not found for user");
    }

    const store = user.Store[0];

    if (!store.isVerified) {
      throw new Error("Store is not verified yet");
    }

    // Ensure email uniqueness
    const existingEmailUser = await prisma.user.findFirst({
      where: { email, id: { not: userId } }
    });

    if (existingEmailUser) {
      throw new Error("Email already in use");
    }

    // Validate reset token window
    if (!user.resetPasswordToken || user.resetPasswordToken !== resetToken || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      throw new Error("Invalid or expired token");
    }

    // Basic password rules (8+ chars with mixed types)
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (!(password.length >= 8 && hasUpper && hasLower && hasDigit && hasSpecial)) {
      throw new Error("Password must be 8+ chars with upper, lower, number, special");
    }

    const hashed = await bcrypt.hash(password, 10);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        email,
        pinCode: hashed,
        isEmailVerified: false,
        resetPasswordToken: null,
        resetPasswordExpires: null
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true
      }
    });

    return {
      success: true,
      message: "Credentials set successfully",
      data: updated
    };
  } catch (error) {
    console.error("Error setting vendor credentials:", error);
    throw new Error(error.message || "Failed to set credentials");
  }
}

export async function getStoreDocuments(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { Store: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.Store || user.Store.length === 0) {
      throw new Error("Store not found for user");
    }

    const documents = await prisma.storeDocument.findMany({
      where: { storeId: userId },
      orderBy: { createdAt: "desc" }
    });

    return {
      success: true,
      message: "Documents fetched successfully",
      data: documents
    };
  } catch (error) {
    console.error("Error fetching store documents:", error);
    throw new Error(error.message || "Failed to fetch store documents");
  }
}

export async function updateStoreInfo(userId, storeData) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { Store: true } });
    if (!user) throw new Error("User not found");
    if (!user.Store || user.Store.length === 0) throw new Error("Store not found for user");

    const store = user.Store[0];

    const {
      userName,
      returnPolicy,
      shippingDay,
      street,
      city,
      state,
      country,
      pinCode,
      coverImage,
      profileImage
    } = storeData || {};

    const data = {};
    if (userName !== undefined) data.userName = String(userName).trim();
    if (returnPolicy !== undefined) data.returnPolicy = String(returnPolicy).trim();
    if (shippingDay !== undefined) data.shippingDay = Number(shippingDay);
    if (street !== undefined) data.street = String(street).trim();
    if (city !== undefined) data.city = String(city).trim();
    if (state !== undefined) data.state = String(state).trim();
    if (country !== undefined) data.country = String(country).trim();
    if (pinCode !== undefined) data.pinCode = String(pinCode).trim();
    if (coverImage !== undefined) data.coverImage = String(coverImage).trim();
    if (profileImage !== undefined) data.profileImage = String(profileImage).trim();

    if (Object.keys(data).length === 0) {
      return { success: true, message: "Nothing to update", data: store };
    }

    // If username provided, ensure available (case-insensitive) excluding current store
    if (data.userName) {
      const exists = await prisma.store.findFirst({
        where: {
          userName: { equals: data.userName, mode: "insensitive" },
          id: { not: store.id }
        }
      });
      if (exists) throw new Error("Username is already taken");
    }

    const updated = await prisma.store.update({ where: { id: store.id }, data });
    return { success: true, message: "Store updated successfully", data: updated };
  } catch (error) {
    console.error("Error updating store info:", error);
    throw new Error(error.message || "Failed to update store info");
  }
}

export async function checkUsernameAvailability(username, excludeUserId) {
  try {
    if (!username || !String(username).trim()) {
      throw new Error("Username is required");
    }
    const normalized = String(username).trim();

    let excludeStoreId = null;
    if (excludeUserId) {
      const user = await prisma.user.findUnique({ where: { id: excludeUserId }, include: { Store: true } });
      if (user && user.Store && user.Store.length > 0) excludeStoreId = user.Store[0].id;
    }

    const exists = await prisma.store.findFirst({
      where: {
        userName: { equals: normalized, mode: "insensitive" },
        ...(excludeStoreId ? { id: { not: excludeStoreId } } : {})
      }
    });

    return { success: true, available: !Boolean(exists) };
  } catch (error) {
    console.error("Error checking username availability:", error);
    throw new Error(error.message || "Failed to check username");
  }
}

export async function submitStoreInfoAndDocuments(userId, { store = {}, documents = [] } = {}) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { Store: true } });
    if (!user) throw new Error("User not found");
    if (!user.Store || user.Store.length === 0) throw new Error("Store not found for user");

    const storeRecord = user.Store[0];

    // Prepare store update (reuse logic from updateStoreInfo)
    const {
      userName,
      returnPolicy,
      shippingDay,
      address,
      storeName,
      description,  
      city,
      businessType,
      state,
      country,
      pinCode,
      coverImage,
      profileImage,
      facebookUrl,
      instagramUrl,
      youtubeUrl
    } = store || {};

    const storeUpdateData = {};
    if (storeName !== undefined) storeUpdateData.storeName = String(storeName).trim();
    if (description !== undefined) storeUpdateData.description = String(description).trim();
    if (userName !== undefined) storeUpdateData.userName = String(userName).trim();
    if (returnPolicy !== undefined) storeUpdateData.returnPolicy = String(returnPolicy).trim();
    if (shippingDay !== undefined) storeUpdateData.shippingDay = Number(shippingDay);
    if (address !== undefined) storeUpdateData.street = String(address).trim();
    if (city !== undefined) storeUpdateData.city = String(city).trim();
    if (state !== undefined) storeUpdateData.state = String(state).trim();
    if (country !== undefined) storeUpdateData.country = String(country).trim();
    if (pinCode !== undefined) storeUpdateData.pinCode = String(pinCode).trim();
    if (coverImage !== undefined) storeUpdateData.coverImage = String(coverImage).trim();
    if (profileImage !== undefined) storeUpdateData.profileImage = String(profileImage).trim();

    // Social links: update on user, not documents
    const socialUpdate = {};
    if (facebookUrl) socialUpdate.facebookUrl = facebookUrl;
    if (instagramUrl) socialUpdate.instagramUrl = instagramUrl;
    if (youtubeUrl) socialUpdate.youtubeUrl = youtubeUrl;
    if (businessType) socialUpdate.businessType = businessType;

    if (storeUpdateData.userName) {
      const exists = await prisma.store.findFirst({
        where: {
          userName: { equals: storeUpdateData.userName, mode: "insensitive" },
          id: { not: storeRecord.id }
        }
      });
      if (exists) throw new Error("Username is already taken");
    }

    // Sanitize documents (exclude social URL types)
    const docsToCreate = Array.isArray(documents)
      ? documents
          .filter(d => d && d.documentType && d.fileUrl)
          .filter(d => !/^(facebook_url|instagram_url|youtube_url)$/i.test(String(d.documentType)))
          .map(d => ({
            storeId: userId,
            documentType: String(d.documentType).trim(),
            fileUrl: String(d.fileUrl).trim(),
            ...(d.status ? { status: String(d.status).trim() } : {})
          }))
      : [];

    // Execute operations
    const tx = [];
    tx.push(
      Object.keys(storeUpdateData).length
        ? prisma.store.update({ where: { id: storeRecord.id }, data: storeUpdateData })
        : prisma.store.findUnique({ where: { id: storeRecord.id } })
    );
    if (Object.keys(socialUpdate).length) {
      tx.push(prisma.user.update({ where: { id: userId }, data: socialUpdate }));
    }
    if (docsToCreate.length) {
      tx.push(prisma.storeDocument.createMany({ data: docsToCreate }));
    }

    const results = await prisma.$transaction(tx);
    const updatedStore = results[0];

    const documentsList = await prisma.storeDocument.findMany({ where: { storeId: userId }, orderBy: { createdAt: "desc" } });

    return {
      success: true,
      message: "Store info and documents submitted successfully",
      data: {
        store: updatedStore,
        documents: documentsList
      }
    };
  } catch (error) {
    console.error("Error submitting store info and documents:", error);
    throw new Error(error.message || "Failed to submit store info and documents");
  }
}

export async function sendCredentialsEmailOTP(userId, email) {
  try {
    if (!email) throw new Error("Email is required");
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { Store: true } });
    if (!user) throw new Error("User not found");
    if (!user.Store || user.Store.length === 0) throw new Error("Store not found for user");
    // Send OTP to email
    await sendAndStoreOTP(email);
    return { success: true, message: "OTP sent to email" };
  } catch (error) {
    console.error("Error sending credentials email OTP:", error);
    throw new Error(error.message || "Failed to send OTP");
  }
}

export async function verifyCredentialsEmailOTP(userId, email, otp) {
  try {
    if (!email || !otp) throw new Error("Email and OTP are required");
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { Store: true } });
    if (!user) throw new Error("User not found");
    if (!user.Store || user.Store.length === 0) throw new Error("Store not found for user");
    // Verify OTP
    const result = verifyEmailOTP(email, otp);
    if (!result.success) throw new Error(result.message || "Invalid OTP");
    // Issue short-lived token to allow setting credentials
    const resetToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const resetExpires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({
      where: { id: userId },
      data: { resetPasswordToken: resetToken, resetPasswordExpires: resetExpires }
    });
    return { success: true, message: "OTP verified", resetToken };
  } catch (error) {
    console.error("Error verifying credentials email OTP:", error);
    throw new Error(error.message || "Failed to verify OTP");
  }
}
