import createError from "http-errors";
import { dataResponse } from "../utils/response.js";
import authServices from "../services/auth.services.js";
import variationsServices from "../services/variation.services.js";
import storeServices from "../services/store.services.js";
import bankDetailsServices from "../services/bankDetails.services.js";
import shippingPoliciesServices from "../services/shippingPolicies.services.js";
import zonesServices from "../services/zones.services.js";
import storeDocumentServices from "../services/storeDocument.services.js";
import warehouseServices from "../services/warehouse.services.js";
import shippingProvidersServices from "../services/shippingProviders.services.js";
import orderServices from "../services/order.services.js";
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const vendorController = {
  async vendorRegister(req, res, next) {
      const {
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
        youtubeUrl,
      } = req.body;

      const user = await authServices.vendorRegister({
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
        youtubeUrl,
      });

      return res.status(200).send(dataResponse("Vendor registered successfully", user));
 
  },

  async vendorLogin(req, res, next) {
      const { identifier, password } = req.body;

      console.log("🚀 ~ vendorLogin ~ identifier:", identifier);
      console.log("🚀 ~ vendorLogin ~ password:", password);

      const user = await authServices.vendorLogin(identifier, password);

      return res.status(200).send(dataResponse("Vendor logged in successfully", user));
   
  },
  async vendorSendOtpController (req, res, next) {
  try {
    const { mobile } = req.body;

    console.log("🚀 ~ vendorSendOtpController ~ mobile:", mobile);

    const result = await authServices.vendorSendOTP(mobile);
    return res.status(200).send(dataResponse("OTP sent successfully", result));
  } catch (error) {
    next(createError(error.status || 400, error.message));
  }
},

async vendorVerifyOtpController (req, res, next) {
  try {
    const { mobile, otp } = req.body;

    console.log("🚀 ~ vendorVerifyOtpController ~ mobile:", mobile);
    console.log("🚀 ~ vendorVerifyOtpController ~ otp:", otp);

    const user = await authServices.vendorLoginWithOTP(mobile, otp);
    return res.status(200).send(dataResponse("Vendor logged in successfully with OTP", user));
  } catch (error) {
    next(createError(error.status || 400, error.message));
  }
},
 async createVariation(req, res, next) {
    const userId = req.user
    try {
      const variation = await variationsServices.createVariation(req.body,userId);
      return res.status(201).send(dataResponse("Variation created successfully", variation));
    } catch (err) {
      next(err);
    }
  },

  async getAllVariations(req, res, next) {
    try {
      const userId  = req.user; 
      const variations = await variationsServices.getAllVariations({ ...req.query, userId });
      return res.status(200).send(dataResponse("Variations fetched successfully", variations));
    } catch (err) {
      next(err);
    }
  },

  async getVariation(req, res, next) {
    try {
      const { id } = req.params;
            const userId  = req.user; 

      const variation = await variationsServices.getVariation({ id, userId });
      return res.status(200).send(dataResponse("Variation fetched successfully", variation));
    } catch (err) {
      next(err);
    }
  },

  async updateVariation(req, res, next) {
    try {
      const { id } = req.params;
          const userId  = req.user; 

      const variation = await variationsServices.updateVariation({ id, userId, ...req.body });
      return res.status(200).send(dataResponse("Variation updated successfully", variation));
    } catch (err) {
      next(err);
    }
  },

  async deleteVariation(req, res, next) {
    try {
      const { id } = req.params;
      const { userId } = req.query; // or req.user.id
      await variationsServices.deleteVariation({ id, userId });
      return res.status(200).send(dataResponse("Variation deleted successfully", true));
    } catch (err) {
      next(err);
    }
  },

  async updateVariationCategories(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { categories } = req.body;

      const updatedVariation = await variationsServices.updateVariationCategories({
        id,
        userId,
        categories,
      });

      return res.status(200).send(dataResponse("Variation categories updated successfully", updatedVariation));
    } catch (err) {
      next(err);
    }
  },

  // Forgot Password - Request OTP
  async vendorForgotPasswordRequest(req, res, next) {
    try {
      const { email } = req.body;

      const result = await authServices.vendorForgotPasswordRequest(email);
      return res.status(200).send(dataResponse("OTP sent successfully for password reset", result));
    } catch (err) {
      next(err);
    }
  },

  // Forgot Password - Verify OTP
  async vendorForgotPasswordVerifyOTP(req, res, next) {
    try {
      const { email, otp, resetToken } = req.body;

      const result = await authServices.vendorForgotPasswordVerifyOTP(email, otp, resetToken);
      return res.status(200).send(dataResponse("OTP verified successfully for password reset", result));
    } catch (err) {
      next(err);
    }
  },

  // Forgot Password - Reset Password
  async vendorForgotPasswordReset(req, res, next) {
    try {
      const { email, resetToken, newPassword } = req.body;

      const result = await authServices.vendorForgotPasswordReset(email, resetToken, newPassword);
      return res.status(200).send(dataResponse("Password reset successfully", result));
    } catch (err) {
      next(err);
    }
  },

  // Resend OTP for Forgot Password
  async vendorResendForgotPasswordOTP(req, res, next) {
    try {
      const { email, resetToken } = req.body;

      const result = await authServices.vendorResendForgotPasswordOTP(email, resetToken);
      return res.status(200).send(dataResponse("OTP resent successfully for password reset", result));
    } catch (err) {
      next(err);
    }
  },

  // Store Management
  async createStore(req, res, next) {
    try {
      const vendorId = req.user; // Extract vendor ID from JWT
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const storeData = { ...req.body, vendorId };

      const store = await storeServices.createStore(storeData);
      return res.status(201).send(dataResponse("Store created successfully", store));
    } catch (err) {
      next(err);
    }
  },

  async getMyStore(req, res, next) {
    try {
      const vendorId = req.user; // Extract vendor ID from JWT

      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const store = await storeServices.getStoreByVendor(vendorId);
      return res.status(200).send(dataResponse("Store retrieved successfully", store));
    } catch (err) {
      next(err);
    }
  },

  async updateStore(req, res, next) {
    try {
      const { storeId } = req.params;
      const vendorId = req.user; // Extract vendor ID from JWT
      const updateData = req.body;

      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const store = await storeServices.updateStore(storeId, vendorId, updateData);
      return res.status(200).send(dataResponse("Store updated successfully", store));
    } catch (err) {
      next(err);
    }
  },

  async deleteStore(req, res, next) {
    try {
      const { storeId } = req.params;
      const vendorId = req.user; // Extract vendor ID from JWT

      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const result = await storeServices.deleteStore(storeId, vendorId);
      return res.status(200).send(dataResponse("Store deleted successfully", result));
    } catch (err) {
      next(err);
    }
  },

  async checkStoreUserNameAvailability(req, res, next) {
    try {
      const vendorId = req.user;
      const { userName } = req.query;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }
      
      if (!userName) {
        return res.status(400).send(dataResponse("Username is required", null));
      }
      
      const result = await storeServices.checkUserNameAvailability({ userName, vendorId });
      return res.status(200).send(dataResponse("Username availability fetched", result));
    } catch (err) {
      next(err);
    }
  },

  // Bank Details Management
  async createBankDetails(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const bankDetails = await bankDetailsServices.createBankDetails(req.body, vendorId);
      return res.status(201).send(dataResponse("Bank details created successfully", bankDetails));
    } catch (err) {
      next(err);
    }
  },

  async getBankDetails(req, res, next) {
    try {
      const vendorId = req.user;
      const { bankId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const bankDetails = await bankDetailsServices.getBankDetails(bankId, vendorId);
      return res.status(200).send(dataResponse("Bank details retrieved successfully", bankDetails));
    } catch (err) {
      next(err);
    }
  },

  async getMyBankDetails(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const bankDetails = await bankDetailsServices.getVendorBankDetails(vendorId);
      return res.status(200).send(dataResponse("Bank details retrieved successfully", bankDetails));
    } catch (err) {
      next(err);
    }
  },

  async updateBankDetails(req, res, next) {
    try {
      const vendorId = req.user;
      const { bankId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const bankDetails = await bankDetailsServices.updateBankDetails(bankId, vendorId, req.body);
      return res.status(200).send(dataResponse("Bank details updated successfully", bankDetails));
    } catch (err) {
      next(err);
    }
  },

  async deleteBankDetails(req, res, next) {
    try {
      const vendorId = req.user;
      const { bankId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const result = await bankDetailsServices.deleteBankDetails(bankId, vendorId);
      return res.status(200).send(dataResponse("Bank details deleted successfully", result));
    } catch (err) {
      next(err);
    }
  },

  // Shipping Policies Management
  async createShippingPolicy(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const shippingPolicy = await shippingPoliciesServices.createShippingPolicy(req.body, vendorId);
      return res.status(201).send(dataResponse("Shipping policy created successfully", shippingPolicy));
    } catch (err) {
      next(err);
    }
  },

  async getShippingPolicy(req, res, next) {
    try {
      const vendorId = req.user;
      const { policyId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const shippingPolicy = await shippingPoliciesServices.getShippingPolicy(policyId, vendorId);
      return res.status(200).send(dataResponse("Shipping policy retrieved successfully", shippingPolicy));
    } catch (err) {
      next(err);
    }
  },

  async getMyShippingPolicies(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const shippingPolicies = await shippingPoliciesServices.getVendorShippingPolicy(vendorId);
      return res.status(200).send(dataResponse("Shipping policies retrieved successfully", shippingPolicies));
    } catch (err) {
      next(err);
    }
  },

  async updateShippingPolicy(req, res, next) {
    try {
      const vendorId = req.user;
      const { policyId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const shippingPolicy = await shippingPoliciesServices.updateShippingPolicy(policyId, vendorId, req.body);
      return res.status(200).send(dataResponse("Shipping policy updated successfully", shippingPolicy));
    } catch (err) {
      next(err);
    }
  },

  async deleteShippingPolicy(req, res, next) {
    try {
      const vendorId = req.user;
      const { policyId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const result = await shippingPoliciesServices.deleteShippingPolicy(policyId, vendorId);
      return res.status(200).send(dataResponse("Shipping policy deleted successfully", result));
    } catch (err) {
      next(err);
    }
  },

  // Shipping Type Management
  async getMyShippingType(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const shippingType = await storeServices.getShippingType(vendorId);
      return res.status(200).send(dataResponse("Shipping type retrieved successfully", shippingType));
    } catch (err) {
      next(err);
    }
  },

  async updateMyShippingType(req, res, next) {
    try {
      const vendorId = req.user;
      const { shippingType } = req.body;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      if (!shippingType) {
        return res.status(400).send(dataResponse("Shipping type is required", null));
      }

      const updatedStore = await storeServices.updateShippingType(vendorId, shippingType);
      return res.status(200).send(dataResponse("Shipping type updated successfully", updatedStore));
    } catch (err) {
      next(err);
    }
  },

  // Zones Management
  async createZone(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const zone = await zonesServices.createZone(req.body, vendorId);
      return res.status(201).send(dataResponse("Zone created successfully", zone));
    } catch (err) {
      next(err);
    }
  },

  async getZone(req, res, next) {
    try {
      const vendorId = req.user;
      const { zoneId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const zone = await zonesServices.getZone(zoneId, vendorId);
      return res.status(200).send(dataResponse("Zone retrieved successfully", zone));
    } catch (err) {
      next(err);
    }
  },

  async getMyZones(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const zones = await zonesServices.getVendorZones(vendorId);
      return res.status(200).send(dataResponse("Zones retrieved successfully", zones));
    } catch (err) {
      next(err);
    }
  },

  async updateZone(req, res, next) {
    try {
      const vendorId = req.user;
      const { zoneId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const zone = await zonesServices.updateZone(zoneId, vendorId, req.body);
      return res.status(200).send(dataResponse("Zone updated successfully", zone));
    } catch (err) {
      next(err);
    }
  },

  async deleteZone(req, res, next) {
    try {
      const vendorId = req.user;
      const { zoneId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const result = await zonesServices.deleteZone(zoneId, vendorId);
      return res.status(200).send(dataResponse("Zone deleted successfully", result));
    } catch (err) {
      next(err);
    }
  },

  // Shipping Methods Management
  async createShippingMethod(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const shippingMethod = await zonesServices.createShippingMethod(req.body, vendorId);
      return res.status(201).send(dataResponse("Shipping method created successfully", shippingMethod));
    } catch (err) {
      next(err);
    }
  },

  async getShippingMethod(req, res, next) {
    try {
      const vendorId = req.user;
      const { methodId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const shippingMethod = await zonesServices.getShippingMethod(methodId, vendorId);
      return res.status(200).send(dataResponse("Shipping method retrieved successfully", shippingMethod));
    } catch (err) {
      next(err);
    }
  },

  async getZoneShippingMethods(req, res, next) {
    try {
      const vendorId = req.user;
      const { zoneId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const shippingMethods = await zonesServices.getZoneShippingMethods(zoneId, vendorId);
      return res.status(200).send(dataResponse("Zone shipping methods retrieved successfully", shippingMethods));
    } catch (err) {
      next(err);
    }
  },

  async updateShippingMethod(req, res, next) {
    try {
      const vendorId = req.user;
      const { methodId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const shippingMethod = await zonesServices.updateShippingMethod(methodId, vendorId, req.body);
      return res.status(200).send(dataResponse("Shipping method updated successfully", shippingMethod));
    } catch (err) {
      next(err);
    }
  },

  async deleteShippingMethod(req, res, next) {
    try {
      const vendorId = req.user;
      const { methodId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const result = await zonesServices.deleteShippingMethod(methodId, vendorId);
      return res.status(200).send(dataResponse("Shipping method deleted successfully", result));
    } catch (err) {
      next(err);
    }
  },

  // Store Documents Management
  async createStoreDocument(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const storeDocument = await storeDocumentServices.createStoreDocument(req.body, vendorId);
      return res.status(201).send(dataResponse("Store document created successfully", storeDocument));
    } catch (err) {
      next(err);
    }
  },

  async getStoreDocument(req, res, next) {
    try {
      const vendorId = req.user;
      const { documentId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const storeDocument = await storeDocumentServices.getStoreDocument(documentId, vendorId);
      return res.status(200).send(dataResponse("Store document retrieved successfully", storeDocument));
    } catch (err) {
      next(err);
    }
  },

  async getMyStoreDocuments(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const storeDocuments = await storeDocumentServices.getVendorStoreDocuments(vendorId);
      return res.status(200).send(dataResponse("Store documents retrieved successfully", storeDocuments));
    } catch (err) {
      next(err);
    }
  },

  async updateStoreDocument(req, res, next) {
    try {
      const vendorId = req.user;
      const { documentId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const storeDocument = await storeDocumentServices.updateStoreDocument(documentId, vendorId, req.body);
      return res.status(200).send(dataResponse("Store document updated successfully", storeDocument));
    } catch (err) {
      next(err);
    }
  },

  async deleteStoreDocument(req, res, next) {
    try {
      const vendorId = req.user;
      const { documentId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const result = await storeDocumentServices.deleteStoreDocument(documentId, vendorId);
      return res.status(200).send(dataResponse("Store document deleted successfully", result));
    } catch (err) {
      next(err);
    }
  },

  // Warehouse Management
  async createWarehouse(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const warehouse = await warehouseServices.createWarehouse(req.body, vendorId);
      return res.status(201).send(dataResponse("Warehouse created successfully", warehouse));
    } catch (err) {
      next(err);
    }
  },

  async getWarehouse(req, res, next) {
    try {
      const vendorId = req.user;
      const { warehouseId } = req.params;

      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const warehouse = await warehouseServices.getWarehouse(warehouseId, vendorId);
      return res.status(200).send(dataResponse("Warehouse retrieved successfully", warehouse));
    } catch (err) {
      next(err);
    }
  },

  async getMyWarehouses(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const warehouses = await warehouseServices.getVendorWarehouses(vendorId);
      return res.status(200).send(dataResponse("Warehouses retrieved successfully", warehouses));
    } catch (err) {
      next(err);
    }
  },

  async updateWarehouse(req, res, next) {
    try {
      const vendorId = req.user;
      const { warehouseId } = req.params;

      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const warehouse = await warehouseServices.updateWarehouse(warehouseId, vendorId, req.body);
      return res.status(200).send(dataResponse("Warehouse updated successfully", warehouse));
    } catch (err) {
      next(err);
    }
  },

  async deleteWarehouse(req, res, next) {
    try {
      const vendorId = req.user;
      const { warehouseId } = req.params;

      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const result = await warehouseServices.deleteWarehouse(warehouseId, vendorId);
      return res.status(200).send(dataResponse("Warehouse deleted successfully", result));
    } catch (err) {
      next(err);
    }
  },

  // Shipping Providers Management
  async createShippingProvider(req, res, next) {
    try {
      const provider = await shippingProvidersServices.createShippingProvider(req.body);
      return res.status(201).send(dataResponse("Shipping provider created successfully", provider));
    } catch (err) {
      next(err);
    }
  },

  async getShippingProvider(req, res, next) {
    try {
      const { providerId } = req.params;
      const provider = await shippingProvidersServices.getShippingProvider(providerId);
      return res.status(200).send(dataResponse("Shipping provider retrieved successfully", provider));
    } catch (err) {
      next(err);
    }
  },

  async getAllShippingProviders(req, res, next) {
    try {
      const result = await shippingProvidersServices.getAllShippingProviders(req.query);
      return res.status(200).send(dataResponse("Shipping providers retrieved successfully", result));
    } catch (err) {
      next(err);
    }
  },

  async getAllShippingProvidersWithoutPagination(req, res, next) {
    try {
      const providers = await shippingProvidersServices.getAllShippingProvidersWithoutPagination(req.query);
      return res.status(200).send(dataResponse("All shipping providers retrieved successfully", providers));
    } catch (err) {
      next(err);
    }
  },

  async updateShippingProvider(req, res, next) {
    try {
      const { providerId } = req.params;
      const updated = await shippingProvidersServices.updateShippingProvider(providerId, req.body);
      return res.status(200).send(dataResponse("Shipping provider updated successfully", updated));
    } catch (err) {
      next(err);
    }
  },

  async toggleShippingProviderStatus(req, res, next) {
    try {
      const { providerId } = req.params;
      const updated = await shippingProvidersServices.toggleShippingProviderStatus(providerId);
      return res.status(200).send(dataResponse("Shipping provider status toggled successfully", updated));
    } catch (err) {
      next(err);
    }
  },

  async deleteShippingProvider(req, res, next) {
    try {
      const { providerId } = req.params;
      const result = await shippingProvidersServices.deleteShippingProvider(providerId);
      return res.status(200).send(dataResponse("Shipping provider deleted successfully", result));
    } catch (err) {
      next(err);
    }
  },

  // Order Management
  async createOrder(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const { orderData, userInfo } = req.body;
      
      const productIds = [...new Set(orderData.orderItems.map(item => item.productId))];
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          vendorId: vendorId
        },
        select: { id: true }
      });
      console.log("🚀 ~ createOrder ~ products:", products)

      if (products.length !== productIds.length) {
        return res.status(400).send(dataResponse("Some products do not belong to this vendor", null));
      }

      const order = await orderServices.createOrder({ vendorId, orderData, userInfo });
      return res.status(201).send(dataResponse("Order created successfully", order));
    } catch (err) {
      next(err);
    }
  },

  async getVendorOrders(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const result = await orderServices.getVendorOrders({ vendorId, ...req.query });
      return res.status(200).send(dataResponse("Vendor orders retrieved successfully", result));
    } catch (err) {
      next(err);
    }
  },

  async getVendorOrder(req, res, next) {
    try {
      const vendorId = req.user;
      const { orderId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const order = await orderServices.getVendorOrder({ orderId, vendorId });
      return res.status(200).send(dataResponse("Order retrieved successfully", order));
    } catch (err) {
      next(err);
    }
  },

  async updateOrderStatus(req, res, next) {
    try {
      const vendorId = req.user;
      const { orderId } = req.params;
      const { status, notes } = req.body;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const updatedOrder = await orderServices.updateOrderStatus({ orderId, vendorId, status, notes });
      return res.status(200).send(dataResponse("Order status updated successfully", updatedOrder));
    } catch (err) {
      next(err);
    }
  },

  async getVendorOrderStats(req, res, next) {
    try {
      const vendorId = req.user;
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      const stats = await orderServices.getVendorOrderStats({ vendorId, ...req.query });
      return res.status(200).send(dataResponse("Order statistics retrieved successfully", stats));
    } catch (err) {
      next(err);
    }
  },

  // User Management for Vendors
  async getUserCart(req, res, next) {
    try {
      const vendorId = req.user;
      const { userId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      if (!userId) {
        return res.status(400).send(dataResponse("User ID is required", null));
      }

      const cart = await prisma.mainCart.findMany({
        where: {
          userId: userId,
          product: {
            vendorId: vendorId
          }
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              discountedPrice: true,
              images: true,
              productId: true,
              stock: true,
              stockStatus: true,
              isVisible: true,
              adminApproved: true,
              status: true,
              brand: true,
              sku: true,
              description: true,
              weight: true,
              height: true,
              width: true,
              length: true,
              shippingMethod: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              },
              vendor: {
                select: {
                  id: true,
                  storeName: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  status: true,
                  Store: {
                    select: {
                      id: true,
                      storeName: true,
                      userName: true,
                      isVerified: true,
                      isRejected: true,
                      reason: true,
                      description: true,
                      profileImage: true,
                      coverImage: true,
                    }
                  }
                }
              }
            }
          },
          selectedVariation: {
            select: {
              id: true,
              name: true,
              price: true,
              discountedPrice: true,
              sku: true,
              stock: true,
              stockStatus: true,
              status: true,
              images: true,
              weight: true,
              height: true,
              width: true,
              length: true,
              shippingMethod: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).send(dataResponse("User cart retrieved successfully", cart));
    } catch (err) {
      next(err);
    }
  },

  async getPhoneSuggestions(req, res, next) {
    try {
      const { phone, userId } = req.query;
      
      if (!phone) {
        return res.status(400).send(dataResponse("Phone number is required", null));
      }

      // Clean the phone number - remove +91, spaces, and other characters
      let cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
      
      // Remove country code if present
      if (cleanPhone.startsWith('91') && cleanPhone.length > 10) {
        cleanPhone = cleanPhone.substring(2);
      }
      
      // If phone starts with +91, remove it
      if (phone.startsWith('+91')) {
        cleanPhone = phone.substring(3).replace(/[\s\-\+\(\)]/g, '');
      }

      // Search for users by phone number with multiple patterns
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { mobile: { contains: cleanPhone, mode: "insensitive" } },
            { phone: { contains: cleanPhone, mode: "insensitive" } },
            { mobile: { contains: phone, mode: "insensitive" } },
            { phone: { contains: phone, mode: "insensitive" } },
            // Also search with +91 prefix
            { mobile: { contains: `+91${cleanPhone}`, mode: "insensitive" } },
            { phone: { contains: `+91${cleanPhone}`, mode: "insensitive" } },
            // Search with 91 prefix
            { mobile: { contains: `91${cleanPhone}`, mode: "insensitive" } },
            { phone: { contains: `91${cleanPhone}`, mode: "insensitive" } }
          ],
          role: "CUSTOMER",
          isActive: true
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          mobile: true,
          phone: true,
          profilePhoto: true,
          createdAt: true
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).send(dataResponse("Phone suggestions retrieved successfully", users));
    } catch (err) {
      next(err);
    }
  },

  async getUserCompleteInfo(req, res, next) {
    try {
      const vendorId = req.user;
      const { userId } = req.params;
      
      if (!vendorId) {
        return res.status(400).send(dataResponse("Vendor ID not found in token", null));
      }

      if (!userId) {
        return res.status(400).send(dataResponse("User ID is required", null));
      }

      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          mobile: true,
          phone: true,
          profilePhoto: true,
          pinCode: true,
          city: true,
          state: true,
          address: true,
          country: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          isActive: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return res.status(404).send(dataResponse("User not found", null));
      }

      // Get user's cart with vendor's products only
      const cart = await prisma.mainCart.findMany({
        where: {
          userId: userId,
          product: {
            vendorId: vendorId
          }
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              discountedPrice: true,
              images: true,
              productId: true,
              stock: true,
              stockStatus: true,
              isVisible: true,
              adminApproved: true,
              status: true,
              brand: true,
              sku: true,
              description: true,
              weight: true,
              height: true,
              width: true,
              length: true,
              shippingMethod: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          },
          selectedVariation: {
            select: {
              id: true,
              name: true,
              price: true,
              discountedPrice: true,
              sku: true,
              stock: true,
              stockStatus: true,
              status: true,
              images: true,
              weight: true,
              height: true,
              width: true,
              length: true,
              shippingMethod: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Get user's default address
      const defaultAddress = await prisma.savedAddress.findFirst({
        where: {
          userId: userId,
          isDefault: true
        }
      });

      // Get all user's saved addresses
      const savedAddresses = await prisma.savedAddress.findMany({
        where: { userId: userId },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      // Get user's recent orders with this vendor
      const recentOrders = await prisma.order.findMany({
        where: {
          userId: userId,
          orderItems: {
            some: {
              product: {
                vendorId: vendorId
              }
            }
          }
        },
        include: {
          orderItems: {
            where: {
              product: {
                vendorId: vendorId
              }
            },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  discountedPrice: true,
                  images: true,
                  productId: true
                }
              },
              productVeriation: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  sku: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      const result = {
        user,
        cart,
        defaultAddress,
        savedAddresses,
        recentOrders
      };

      return res.status(200).send(dataResponse("User complete info retrieved successfully", result));
    } catch (err) {
      next(err);
    }
  }
};

export default vendorController;