import createError from "http-errors";
import savedAddressServices from "../services/savedAddress.services.js";
import authServices from "../services/auth.services.js";
import storeServices from "../services/store.services.js";
import * as vendorRequestServices from "../services/vendorRequest.services.js";
import { getAllDocumentTypes } from "../services/documentType.services.js";
import reviewsServices from "../services/reviews.services.js";
import favProductsServices from "../services/favProducts.services.js";
import mainCartServices from "../services/mainCart.services.js";

const customerController = {
  // Guest User Management
  async createGuestUser(req, res, next) {
    try {
      const { deviceId, email } = req.body;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: "Device ID is required"
        });
      }

      const result = await authServices.createGuestUser(deviceId, email);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
        isExisting: result.isExisting
      });
    } catch (error) {
      next(error);
    }
  },

  async getGuestUser(req, res, next) {
    try {
      const { deviceId } = req.params;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: "Device ID is required"
        });
      }

      const result = await authServices.getGuestUser(deviceId);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  },

  async updateGuestUser(req, res, next) {
    try {
      const { deviceId } = req.params;
      const updateData = req.body;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: "Device ID is required"
        });
      }

      const result = await authServices.updateGuestUser(deviceId, updateData);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  },

  // Public Stores
  async getVerifiedStores(req, res, next) {
    try {
      const stores = await storeServices.getVerifiedStores(req.query);
      return res.status(200).json({ success: true, message: "Verified stores retrieved successfully", data: stores });
    } catch (error) {
      next(error);
    }
  },

  async getVerifiedStore(req, res, next) {
    try {
      const { storeId } = req.params;
      const {userId} = req.query || null; // Get user ID if authenticated
      
      // Get store with products included
      const store = await storeServices.getStoreWithProducts(storeId, userId);
      
      if (!store.isVerified) {
        return res.status(404).json({ success: false, message: "Store not found" });
      }
      
      return res.status(200).json({ success: true, message: "Store retrieved successfully", data: store });
    } catch (error) {
      next(error);
    }
  },

  // Store products with filters and meta
  async getStoreProducts(req, res, next) {
    try {
      const { storeId } = req.params;
      const userId = req.user || null;

      const {
        page,
        limit,
        search,
        minPrice,
        maxPrice,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        inStock,
        hasDiscount
      } = req.query;

      const result = await storeServices.getStoreProducts(
        storeId,
        { page, limit, search, minPrice, maxPrice, sortBy, sortOrder, inStock, hasDiscount },
        userId
      );

      return res.status(200).json({ success: true, message: "Store products fetched", data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },

  // Toggle follow/unfollow store
  async toggleFollowStore(req, res, next) {
    try {
      const { storeId } = req.params;
      const userId = req.user;
      console.log("🚀 ~ toggleFollowStore ~ req.user:", req.user)
      console.log("🚀 ~ toggleFollowStore ~ userId:", userId)

      const result = await storeServices.toggleFollowStore(userId, storeId);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          isFollowing: result.isFollowing,
          followersCount: result.followersCount
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Get store reviews with filters
  async getStoreReviews(req, res, next) {
    try {
      const { storeId } = req.params;
      const filters = {
        rating: req.query.rating ? parseInt(req.query.rating) : null,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc',
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        mostImpressed: req.query.mostImpressed === 'true'
      };

      const result = await storeServices.getStoreReviews(storeId, filters);
      
      res.status(200).json({
        success: true,
        message: "Store reviews retrieved successfully",
        data: result
      });
    } catch (error) {
      next(error);
    }
  },
  
  // Public: list document types
  async listDocumentTypes(req, res, next) {
    try {
      const result = await getAllDocumentTypes(req.query);
      return res.status(200).json({ success: true, message: "Document types retrieved", data: result });
    } catch (error) {
      next(error);
    }
  },

  // User Authentication with Mobile OTP
  async sendOTP(req, res, next) {
    try {
      const { mobile } = req.body;

      if (!mobile) {
        return res.status(400).json({
          success: false,
          message: "Mobile number is required"
        });
      }

      const result = await authServices.userSendOTP(mobile);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          userId: result.userId,
          isNewUser: result.isNewUser,
          otp: result.otp
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async loginWithOTP(req, res, next) {
    try {
      const { mobile, otp } = req.body;

      if (!mobile || !otp) {
        return res.status(400).json({
          success: false,
          message: "Mobile number and OTP are required"
        });
      }

      const result = await authServices.userLoginWithOTP(mobile, otp);
      
      res.status(200).json({
        success: true,
        message: "Login successful",
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  // User Profile Management
  async getProfile(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT

      const result = await authServices.getUserProfile(userId);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT
      const profileData = req.body;

      const result = await authServices.updateUserProfile(userId, profileData);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  },

  // User Forgot Password - Request OTP
  async forgotPasswordRequest(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required"
        });
      }

      const result = await authServices.userForgotPasswordRequest(email);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          resetToken: result.resetToken
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // User Forgot Password - Verify OTP
  async forgotPasswordVerifyOTP(req, res, next) {
    try {
      const { email, otp, resetToken } = req.body;

      if (!email || !otp || !resetToken) {
        return res.status(400).json({
          success: false,
          message: "Email, OTP, and reset token are required"
        });
      }

      const result = await authServices.userForgotPasswordVerifyOTP(email, otp, resetToken);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          resetToken: result.resetToken,
          userId: result.userId
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // User Forgot Password - Reset Password
  async forgotPasswordReset(req, res, next) {
    try {
      const { email, resetToken, newPassword } = req.body;

      if (!email || !resetToken || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Email, reset token, and new password are required"
        });
      }

      const result = await authServices.userForgotPasswordReset(email, resetToken, newPassword);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          userId: result.userId,
          email: result.email,
          mobile: result.mobile
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // User Forgot Password - Resend OTP
  async resendForgotPasswordOTP(req, res, next) {
    try {
      const { email, resetToken } = req.body;

      if (!email || !resetToken) {
        return res.status(400).json({
          success: false,
          message: "Email and reset token are required"
        });
      }

      const result = await authServices.userResendForgotPasswordOTP(email, resetToken);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          resetToken: result.resetToken
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Create a new saved address
  async createSavedAddress(req, res, next) {
    try {
      const userId = req.user; 
      const addressData = req.body;

      const result = await savedAddressServices.createSavedAddress(addressData, userId);
      
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  },

  // Get all saved addresses for the authenticated user
  async getUserSavedAddresses(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT

      const result = await savedAddressServices.getUserSavedAddresses(userId);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
        count: result.count
      });
    } catch (error) {
      next(error);
    }
  },

  // Get a specific saved address by ID
  async getSavedAddress(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT
      const { addressId } = req.params;

      const result = await savedAddressServices.getSavedAddress(addressId, userId);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  },

  // Update a saved address
  async updateSavedAddress(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT
      const { addressId } = req.params;
      const addressData = req.body;

      const result = await savedAddressServices.updateSavedAddress(addressId, addressData, userId);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  },

  // Delete a saved address
  async deleteSavedAddress(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT
      const { addressId } = req.params;

      const result = await savedAddressServices.deleteSavedAddress(addressId, userId);
      
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  },

  // Set default address
  async setDefaultAddress(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT
      const { addressId } = req.params;

      const result = await savedAddressServices.setDefaultAddress(addressId, userId);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  },

  // Vendor Request Management
  async createGuestVendorRequest(req, res, next) {
    try {
      const vendorData = req.body;

      const result = await vendorRequestServices.createGuestVendorRequest(vendorData);
      
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data,
        otp: result.data.otp
      });
    } catch (error) {
      next(error);
    }
  },

  async createExistingUserVendorRequest(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT
      const vendorData = req.body;

      const result = await vendorRequestServices.createExistingUserVendorRequest(userId, vendorData);
      
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  },

  async getVendorRequestStatus(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT

      const result = await vendorRequestServices.getVendorRequestStatus(userId);
      
      res.status(200).json({
        success: true,
        message: "Vendor request status retrieved successfully",
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  },

  async updateVendorRequest(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT
      const updateData = req.body;

      const result = await vendorRequestServices.updateVendorRequest(userId, updateData);
      
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteVendorRequest(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT

      const result = await vendorRequestServices.deleteVendorRequest(userId);
      
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  },

  // Google Authentication
  async googleAuth(req, res, next) {
    try {
      const { accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          message: "Google access token is required"
        });
      }

      // Verify Google token and get user data
      const googleUserData = await authServices.verifyGoogleToken(accessToken);
      
      // Authenticate or create user
      const result = await authServices.googleAuth(googleUserData);
      
      res.status(200).json({
        success: true,
        message: "Google authentication successful",
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  async linkGoogleAccount(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT
      const { accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          message: "Google access token is required"
        });
      }

      // Verify Google token and get user data
      const googleUserData = await authServices.verifyGoogleToken(accessToken);
      
      // Link Google account to existing user
      const result = await authServices.linkGoogleAccount(userId, googleUserData);
      
      res.status(200).json({
        success: true,
        message: "Google account linked successfully",
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  async unlinkGoogleAccount(req, res, next) {
    try {
      const userId = req.user; // Extract user ID from JWT

      const result = await authServices.unlinkGoogleAccount(userId);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  },

  // Upload store documents for submission (vendor)
  async uploadStoreDocuments(req, res, next) {
    try {
      const userId = req.user;
      const { documents } = req.body; // [{ documentType, fileUrl }]

      const result = await vendorRequestServices.uploadStoreDocuments(userId, documents);
      return res.status(200).json({ success: true, message: result.message, data: result.data });
    } catch (error) {
      next(error);
    }
  },

  // Set vendor email/password after store verification
  async setVendorCredentials(req, res, next) {
    try {
      const userId = req.user;
      const { email, password, resetToken } = req.body;

      const result = await vendorRequestServices.setVendorCredentials(userId, { email, password, resetToken });
      return res.status(200).json({ success: true, message: result.message, data: result.data });
    } catch (error) {
      next(error);
    }
  },

  // Get all my store documents with status
  async getMyStoreDocuments(req, res, next) {
    try {
      const userId = req.user;
      const result = await vendorRequestServices.getStoreDocuments(userId);
      return res.status(200).json({ success: true, message: result.message, data: result.data });
    } catch (error) {
      next(error);
    }
  },

  // Update store information (name, username, address, policy, etc.)
  async updateStoreInfo(req, res, next) {
    try {
      const userId = req.user;
      const storeData = req.body;
      const result = await vendorRequestServices.updateStoreInfo(userId, storeData);
      return res.status(200).json({ success: true, message: result.message, data: result.data });
    } catch (error) {
      next(error);
    }
  },

  // Check store username availability
  async checkUsernameAvailability(req, res, next) {
    try {
      const { username } = req.query;
      const excludeUserId = req.user; // optional: logged in user excluded
      const result = await vendorRequestServices.checkUsernameAvailability(username, excludeUserId);
      return res.status(200).json({ success: true, available: result.available });
    } catch (error) {
      next(error);
    }
  },

  // Submit store info and multiple documents in a single request
  async submitStoreInfoAndDocuments(req, res, next) {
    try {
      const userId = req.user;
      const { store, documents } = req.body; // store: {}, documents: []
      const result = await vendorRequestServices.submitStoreInfoAndDocuments(userId, { store, documents });
      return res.status(200).json({ success: true, message: result.message, data: result.data });
    } catch (error) {
      next(error);
    }
  },

  // Send email OTP for credentials setup
  async sendCredentialsEmailOTP(req, res, next) {
    try {
      const userId = req.user;
      const { email } = req.body;
      const result = await vendorRequestServices.sendCredentialsEmailOTP(userId, email);
      return res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  },

  // Verify email OTP for credentials setup
  async verifyCredentialsEmailOTP(req, res, next) {
    try {
      const userId = req.user;
      const { email, otp } = req.body;
      const result = await vendorRequestServices.verifyCredentialsEmailOTP(userId, email, otp);
      return res.status(200).json({ success: true, message: result.message, data: { resetToken: result.resetToken } });
    } catch (error) {
      next(error);
    }
  }
  ,
  // Reviews
  async createReview(req, res, next) {
    try {
      const userId = req.user;
      const { productId } = req.params;
      const { rating, comment, images, purchasedVeriation } = req.body;

      const review = await reviewsServices.createReview({ 
        userId, 
        productId, 
        rating, 
        comment, 
        images, 
        purchasedVeriation 
      });
      return res.status(201).json({ success: true, message: "Review created", data: review });
    } catch (error) {
      next(error);
    }
  },

  async getProductReviews(req, res, next) {
    try {
      const { productId } = req.params;
      const userId = req.user || null; // Get user ID if authenticated, otherwise null
      const { starFilter, sortBy, page, limit } = req.query;
      
      // Debug: Log the userId being passed
      console.log('Controller - User ID:', userId, 'Product ID:', productId);
      
      const result = await reviewsServices.getProductReviews({ 
        productId, 
        userId, 
        starFilter, 
        sortBy, 
        page, 
        limit 
      });
      
      return res.status(200).json({ 
        success: true, 
        message: "Reviews fetched", 
        data: result.data, 
        meta: result.meta 
      });
    } catch (error) {
      next(error);
    }
  },

  async getReview(req, res, next) {
    try {
      const { reviewId } = req.params;
      const userId = req.user || null; 
      const review = await reviewsServices.getReview({ reviewId, userId });
      return res.status(200).json({ success: true, message: "Review fetched", data: review });
    } catch (error) {
      next(error);
    }
  },

  async updateReview(req, res, next) {
    try {
      const userId = req.user;
      const { reviewId } = req.params;
      const { rating, comment, images, purchasedVeriation } = req.body;
      const updated = await reviewsServices.updateReview({ 
        reviewId, 
        userId, 
        rating, 
        comment, 
        images, 
        purchasedVeriation 
      });
      return res.status(200).json({ success: true, message: "Review updated", data: updated });
    } catch (error) {
      next(error);
    }
  },

  async deleteReview(req, res, next) {
    try {
      const userId = req.user;
      const { reviewId } = req.params;
      await reviewsServices.deleteReview({ reviewId, userId });
      return res.status(200).json({ success: true, message: "Review deleted" });
    } catch (error) {
      next(error);
    }
  },

  async getMyReviews(req, res, next) {
    try {
      const userId = req.user;
      const result = await reviewsServices.getUserReviews({ userId, ...req.query });
      return res.status(200).json({ success: true, message: "My reviews fetched", data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },

  async toggleImpression(req, res, next) {
    try {
      const userId = req.user;
      const { reviewId } = req.params;
      const { isImpressed } = req.body;

      if (isImpressed === undefined) {
        return res.status(400).json({
          success: false,
          message: "isImpressed field is required (true for impressed, false for not impressed)"
        });
      }

      const result = await reviewsServices.toggleImpression({ reviewId, userId, isImpressed });
      
      const message = result.action === "impressed" ? "Review impressed" :
                     result.action === "not-impressed" ? "Review not impressed" :
                     result.action === "unimpressed" ? "Impression removed" :
                     "Not impressed removed";

      return res.status(200).json({ 
        success: true, 
        message, 
        data: result 
      });
    } catch (error) {
      next(error);
    }
  },

  async getUserImpression(req, res, next) {
    try {
      const userId = req.user;
      const { reviewId } = req.params;

      const impression = await reviewsServices.getUserImpression({ reviewId, userId });
      
      return res.status(200).json({ 
        success: true, 
        message: "User impression fetched", 
        data: { isImpressed: impression } 
      });
    } catch (error) {
      next(error);
    }
  }
  ,
  // Favorites
  async toggleFavoriteProduct(req, res, next) {
    try {
      const userId = req.user;
      const { productId } = req.params;
      const result = await favProductsServices.toggleFavorite({ userId, productId });
      return res.status(200).json({ success: true, message: result.isFav ? "Added to favorites" : "Removed from favorites", data: result });
    } catch (error) {
      next(error);
    }
  },

  async getMyFavoriteProducts(req, res, next) {
    try {
      const userId = req.user;
      const result = await favProductsServices.getUserFavorites({ userId, ...req.query });
      return res.status(200).json({ success: true, message: "Favorite products fetched", data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }
  ,
  // Cart
  async getMyCart(req, res, next) {
    try {
      const userId = req.user;
      const items = await mainCartServices.getMyCart({ userId });
      return res.status(200).json({ success: true, message: "Cart fetched", data: items });
    } catch (error) {
      next(error);
    }
  },

  async addToCart(req, res, next) {
    try {
      const userId = req.user;
      const { productId } = req.body;
      const { quantity, selectedVariationId } = req.body;
      const item = await mainCartServices.addToCart({ userId, productId, quantity, selectedVariationId });
      return res.status(201).json({ success: true, message: "Added to cart", data: item });
    } catch (error) {
      next(error);
    }
  },

  async updateCartItem(req, res, next) {
    try {
      const userId = req.user;
      const { cartItemId } = req.params;
      const { quantity, selectedVariationId } = req.body;
      const updated = await mainCartServices.updateCartItem({ userId, cartItemId, quantity, selectedVariationId });
      return res.status(200).json({ success: true, message: "Cart item updated", data: updated });
    } catch (error) {
      next(error);
    }
  },

  async removeFromCart(req, res, next) {
    try {
      const userId = req.user;
      const { cartItemId } = req.params;
      await mainCartServices.removeFromCart({ userId, cartItemId });
      return res.status(200).json({ success: true, message: "Removed from cart" });
    } catch (error) {
      next(error);
    }
  },

  async clearCart(req, res, next) {
    try {
      const userId = req.user;
      await mainCartServices.clearCart({ userId });
      return res.status(200).json({ success: true, message: "Cart cleared" });
    } catch (error) {
      next(error);
    }
  }
};

export default customerController;
