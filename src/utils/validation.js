import {
  VALIDATION_PATTERNS,
  ERROR_MESSAGES,
  PRODUCT_STATUS,
} from "../constants/validation.js";

export const validateEmail = (email) => {
  if (!email || !VALIDATION_PATTERNS.EMAIL.test(email)) {
    return { isValid: false, message: ERROR_MESSAGES.INVALID_EMAIL };
  }
  return { isValid: true };
};

export const validateMobile = (mobile) => {
  if (!mobile || !VALIDATION_PATTERNS.MOBILE.test(mobile)) {
    return { isValid: false, message: ERROR_MESSAGES.INVALID_MOBILE };
  }
  return { isValid: true };
};

export const validateOTP = (otp) => {
  if (!otp || !VALIDATION_PATTERNS.OTP.test(otp)) {
    return { isValid: false, message: ERROR_MESSAGES.INVALID_OTP };
  }
  return { isValid: true };
};

export const validateDeviceId = (deviceId) => {
  if (
    !deviceId ||
    typeof deviceId !== "string" ||
    deviceId.trim().length === 0
  ) {
    return { isValid: false, message: ERROR_MESSAGES.INVALID_DEVICE_ID };
  }
  return { isValid: true };
};

export const validateRequiredFields = (fields, fieldNames) => {
  for (const fieldName of fieldNames) {
    if (!fields[fieldName]) {
      return { isValid: false, message: ERROR_MESSAGES.REQUIRED_FIELDS };
    }
  }
  return { isValid: true };
};

// Category validation functions
export const validateCategoryName = (name) => {
  if (!name || typeof name !== "string") {
    return { isValid: false, message: ERROR_MESSAGES.INVALID_CATEGORY_NAME };
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 50) {
    return { isValid: false, message: ERROR_MESSAGES.INVALID_CATEGORY_NAME };
  }

  return { isValid: true };
};

export const validateSlug = (slug) => {
  if (!slug || !VALIDATION_PATTERNS.SLUG.test(slug)) {
    return { isValid: false, message: ERROR_MESSAGES.INVALID_SLUG };
  }
  return { isValid: true };
};

// Product validation functions
export const validatePrice = (price) => {
  if (!price || isNaN(price) || parseFloat(price) < 0) {
    return { isValid: false, message: ERROR_MESSAGES.INVALID_PRICE };
  }
  return { isValid: true };
};

export const validateStock = (stock) => {
  if (
    stock === undefined ||
    stock === null ||
    isNaN(stock) ||
    parseInt(stock) < 0
  ) {
    return { isValid: false, message: ERROR_MESSAGES.INVALID_STOCK };
  }
  return { isValid: true };
};

export const validateSku = (sku) => {
  if (!sku) {
    return { isValid: false, message: ERROR_MESSAGES.INVALID_SKU };
  }
  return { isValid: true };
};

export const validateProductStatus = (status) => {
  if (!Object.values(PRODUCT_STATUS).includes(status)) {
    return { isValid: false, message: "Invalid product status" };
  }
  return { isValid: true };
};

// Utility function to generate slug from name
export const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces, underscores, and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading and trailing hyphens
};
