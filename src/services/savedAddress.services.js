import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";
import validator from "validator";

const prisma = new PrismaClient();

const savedAddressServices = {
  // Create a new saved address
  async createSavedAddress(data, userId) {
    const { firstName, lastName, pinCode, city, state, address, phone, email } = data;

    // Validate required fields
    const requiredFields = { firstName, lastName, pinCode, city, state, address, phone };
    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value || value.trim() === '') {
        throw createError(400, `${key} is required`);
      }
    }

    // Validate phone number
    if (!validator.isMobilePhone(phone, 'any', { strictMode: true })) {
      throw createError(400, "Phone number must be in E.164 format (e.g., +1234567890)");
    }

    // Validate email if provided
    if (email && !validator.isEmail(email)) {
      throw createError(400, "Invalid email format");
    }

    // Validate pin code (assuming it should be 6 digits for India)
    if (!/^\d{6}$/.test(pinCode)) {
      throw createError(400, "Pin code must be 6 digits");
    }

    try {
      const savedAddress = await prisma.savedAddress.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          pinCode: pinCode.trim(),
          city: city.trim(),
          state: state.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email ? email.trim() : null,
          userId: userId
        }
      });

      return {
        success: true,
        message: "Address saved successfully",
        data: savedAddress
      };
    } catch (error) {
      console.error('Create Saved Address Error:', error);
      throw createError(500, "Failed to save address");
    }
  },

  // Get all saved addresses for a user
  async getUserSavedAddresses(userId) {
    try {
      const addresses = await prisma.savedAddress.findMany({
        where: {
          userId: userId
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return {
        success: true,
        message: "Addresses retrieved successfully",
        data: addresses,
        count: addresses.length
      };
    } catch (error) {
      console.error('Get Saved Addresses Error:', error);
      throw createError(500, "Failed to retrieve addresses");
    }
  },

  // Get a specific saved address by ID
  async getSavedAddress(addressId, userId) {
    try {
      const address = await prisma.savedAddress.findFirst({
        where: {
          id: addressId,
          userId: userId
        }
      });

      if (!address) {
        throw createError(404, "Address not found");
      }

      return {
        success: true,
        message: "Address retrieved successfully",
        data: address
      };
    } catch (error) {
      if (error.status === 404) {
        throw error;
      }
      console.error('Get Saved Address Error:', error);
      throw createError(500, "Failed to retrieve address");
    }
  },

  // Update a saved address
  async updateSavedAddress(addressId, data, userId) {
    const { firstName, lastName, pinCode, city, state, address, phone, email } = data;

    // Validate required fields
    const requiredFields = { firstName, lastName, pinCode, city, state, address, phone };
    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value || value.trim() === '') {
        throw createError(400, `${key} is required`);
      }
    }

    // Validate phone number
    if (!validator.isMobilePhone(phone, 'any', { strictMode: true })) {
      throw createError(400, "Phone number must be in E.164 format (e.g., +1234567890)");
    }

    // Validate email if provided
    if (email && !validator.isEmail(email)) {
      throw createError(400, "Invalid email format");
    }

    // Validate pin code
    if (!/^\d{6}$/.test(pinCode)) {
      throw createError(400, "Pin code must be 6 digits");
    }

    try {
      // Check if address exists and belongs to user
      const existingAddress = await prisma.savedAddress.findFirst({
        where: {
          id: addressId,
          userId: userId
        }
      });

      if (!existingAddress) {
        throw createError(404, "Address not found");
      }

      const updatedAddress = await prisma.savedAddress.update({
        where: {
          id: addressId
        },
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          pinCode: pinCode.trim(),
          city: city.trim(),
          state: state.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email ? email.trim() : null
        }
      });

      return {
        success: true,
        message: "Address updated successfully",
        data: updatedAddress
      };
    } catch (error) {
      if (error.status === 404) {
        throw error;
      }
      console.error('Update Saved Address Error:', error);
      throw createError(500, "Failed to update address");
    }
  },

  // Delete a saved address
  async deleteSavedAddress(addressId, userId) {
    try {
      // Check if address exists and belongs to user
      const existingAddress = await prisma.savedAddress.findFirst({
        where: {
          id: addressId,
          userId: userId
        }
      });

      if (!existingAddress) {
        throw createError(404, "Address not found");
      }

      await prisma.savedAddress.delete({
        where: {
          id: addressId
        }
      });

      return {
        success: true,
        message: "Address deleted successfully"
      };
    } catch (error) {
      if (error.status === 404) {
        throw error;
      }
      console.error('Delete Saved Address Error:', error);
      throw createError(500, "Failed to delete address");
    }
  },

  // Set default address (optional functionality)
  async setDefaultAddress(addressId, userId) {
    try {
      // Check if address exists and belongs to user
      const existingAddress = await prisma.savedAddress.findFirst({
        where: {
          id: addressId,
          userId: userId
        }
      });

      if (!existingAddress) {
        throw createError(404, "Address not found");
      }

      // First, remove default from all addresses
      await prisma.savedAddress.updateMany({
        where: {
          userId: userId
        },
        data: {
          isDefault: false
        }
      });

      // Set the selected address as default
      const updatedAddress = await prisma.savedAddress.update({
        where: {
          id: addressId
        },
        data: {
          isDefault: true
        }
      });

      return {
        success: true,
        message: "Default address set successfully",
        data: updatedAddress
      };
    } catch (error) {
      if (error.status === 404) {
        throw error;
      }
      console.error('Set Default Address Error:', error);
      throw createError(500, "Failed to set default address");
    }
  }
};

export default savedAddressServices;
