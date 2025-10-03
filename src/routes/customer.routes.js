import express from "express";
import customerController from "../controller/customer.controller.js";
import { authGuard } from "../middleware/auth.middleware.js";
import productController from "../controller/product.controller.js";
import { errorHandler } from "../handlers/error.handler.js";
import adminController from "../controller/admin.controllers.js";

const router = express.Router();

router.post("/guest", customerController.createGuestUser);
router.get("/guest/:deviceId", customerController.getGuestUser);
router.put("/guest/:deviceId", customerController.updateGuestUser);
router.post("/vendor-request/guest", customerController.createGuestVendorRequest);
router.post("/auth/guest-verify", customerController.loginWithOTP);
router.post("/auth/send-otp", customerController.sendOTP);
router.post("/auth/login", customerController.loginWithOTP);
router.post("/auth/google", customerController.googleAuth);
router.post("/auth/google/link", authGuard("CUSTOMER"), customerController.linkGoogleAccount);
router.delete("/auth/google/unlink", authGuard("CUSTOMER"), customerController.unlinkGoogleAccount);
router.get("/stores", errorHandler(customerController.getVerifiedStores));
router.get("/stores/:storeId", errorHandler(customerController.getVerifiedStore));
router.get("/stores/:storeId/products", errorHandler(customerController.getStoreProducts));
router.post("/stores/:storeId/follow", authGuard("all"), authGuard("all"), errorHandler(customerController.toggleFollowStore));
router.get("/stores/:storeId/reviews", errorHandler(customerController.getStoreReviews));
router.get("/document-types", authGuard("all"), customerController.listDocumentTypes);
router.get("/profile",authGuard("all"), customerController.getProfile);
router.put("/profile",authGuard("all"), customerController.updateProfile);
router.post("/addresses",authGuard("CUSTOMER"), customerController.createSavedAddress);
router.get("/addresses",authGuard("CUSTOMER"), customerController.getUserSavedAddresses);
router.get("/addresses/:addressId", authGuard("CUSTOMER"),customerController.getSavedAddress);
router.put("/addresses/:addressId", authGuard("CUSTOMER"),customerController.updateSavedAddress);
router.delete("/addresses/:addressId",authGuard("CUSTOMER") ,customerController.deleteSavedAddress);
router.patch("/addresses/:addressId/default",authGuard("CUSTOMER"), customerController.setDefaultAddress);
router.post("/vendor-request", authGuard("CUSTOMER"), customerController.createExistingUserVendorRequest);
router.get("/vendor-request/status", authGuard("all"), customerController.getVendorRequestStatus);
router.put("/vendor-request", authGuard("all"), customerController.updateVendorRequest);
router.delete("/vendor-request", authGuard("all"), customerController.deleteVendorRequest);
router.post("/vendor-request/documents", authGuard("all"), customerController.uploadStoreDocuments);
router.post("/vendor-request/credentials", authGuard("all"), customerController.setVendorCredentials);
router.post("/vendor-request/credentials/send-otp", authGuard("all"), customerController.sendCredentialsEmailOTP);
router.post("/vendor-request/credentials/verify-otp", authGuard("all"), customerController.verifyCredentialsEmailOTP);
router.get("/vendor-request/documents", authGuard("all"), customerController.getMyStoreDocuments);
router.put("/vendor-request/store", authGuard("CUSTOMER"), customerController.updateStoreInfo);
router.get("/vendor-request/username-available", customerController.checkUsernameAvailability);
router.post("/vendor-request/store/submit", authGuard("all"), customerController.submitStoreInfoAndDocuments);
router.get("/products", errorHandler(productController.getPublicProducts));
router.get("/products/:id", errorHandler(productController.getProduct));
// Product reviews
router.post("/products/:productId/reviews", authGuard("all"), errorHandler(customerController.createReview));
router.get("/products/:productId/reviews", errorHandler(customerController.getProductReviews));
router.get("/reviews/:reviewId", errorHandler(customerController.getReview));
router.put("/reviews/:reviewId", authGuard("all"), errorHandler(customerController.updateReview));
router.delete("/reviews/:reviewId", authGuard("all"), errorHandler(customerController.deleteReview));
router.get("/my/reviews", authGuard("all"), errorHandler(customerController.getMyReviews));
// Review impressions
router.post("/reviews/:reviewId/impression", authGuard("all"), errorHandler(customerController.toggleImpression));
router.get("/reviews/:reviewId/impression", authGuard("all"), errorHandler(customerController.getUserImpression));
// Favorites
router.post("/products/:productId/fav/toggle", authGuard("all"), errorHandler(customerController.toggleFavoriteProduct));
router.get("/my/favorites", authGuard("all"), errorHandler(customerController.getMyFavoriteProducts));
// Cart
router.get("/cart", authGuard("all"), errorHandler(customerController.getMyCart));
router.post("/cart", authGuard("all"), errorHandler(customerController.addToCart));
router.put("/cart/:cartItemId", authGuard("all"), errorHandler(customerController.updateCartItem));
router.delete("/cart/:cartItemId", authGuard("all"), errorHandler(customerController.removeFromCart));
router.delete("/cart", authGuard("all"), errorHandler(customerController.clearCart));
router.get("/categories/active", errorHandler(adminController.getActiveCategories));
router.get("/categories/:id", errorHandler(adminController.getCategory));

export default router;
