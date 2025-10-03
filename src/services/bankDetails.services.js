import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";

const prisma = new PrismaClient();

const bankDetailsServices = {
  // Create bank details for vendor
  async createBankDetails(bankData, vendorId) {
    const { holderName, accountName, idscCode, bankName, branch } = bankData;

    // Validate required fields
    if (!holderName || !accountName || !idscCode || !bankName || !branch) {
      throw createError(400, "All bank details fields are required");
    }

    const bankDetails = await prisma.bankDetails.create({
      data: {
        holderName: holderName.trim(),
        accountName: accountName.trim(),
        idscCode: idscCode.trim(),
        bankName: bankName.trim(),
        branch: branch.trim(),
        userId: vendorId
      }
    });

    return bankDetails;
  },

  // Get bank details by ID (with ownership validation)
  async getBankDetails(bankId, vendorId) {
    const bankDetails = await prisma.bankDetails.findFirst({
      where: { 
        id: bankId,
        userId: vendorId
      }
    });

    if (!bankDetails) {
      throw createError(404, "Bank details not found");
    }

    return bankDetails;
  },

  // Get all bank details for vendor
  async getVendorBankDetails(vendorId) {
    const bankDetails = await prisma.bankDetails.findMany({
      where: { userId: vendorId },
      orderBy: { createdAt: 'desc' }
    });

    return bankDetails;
  },

  // Update bank details
  async updateBankDetails(bankId, vendorId, updateData) {
    // Check if bank details exist and belong to vendor
    const existingBankDetails = await prisma.bankDetails.findFirst({
      where: { 
        id: bankId,
        userId: vendorId
      }
    });

    if (!existingBankDetails) {
      throw createError(404, "Bank details not found");
    }

    const updatedBankDetails = await prisma.bankDetails.update({
      where: { id: bankId },
      data: {
        holderName: updateData.holderName?.trim(),
        accountName: updateData.accountName?.trim(),
        idscCode: updateData.idscCode?.trim(),
        bankName: updateData.bankName?.trim(),
        branch: updateData.branch?.trim()
      }
    });

    return updatedBankDetails;
  },

  // Delete bank details
  async deleteBankDetails(bankId, vendorId) {
    // Check if bank details exist and belong to vendor
    const existingBankDetails = await prisma.bankDetails.findFirst({
      where: { 
        id: bankId,
        userId: vendorId
      }
    });

    if (!existingBankDetails) {
      throw createError(404, "Bank details not found");
    }

    await prisma.bankDetails.delete({
      where: { id: bankId }
    });

    return { message: "Bank details deleted successfully" };
  },

  // Get all bank details (for admin)
  async getAllBankDetails({ page = 1, limit = 10, search, sortBy = "createdAt", sortOrder = "desc" }) {
    const whereClause = {};

    if (search) {
      whereClause.OR = [
        { holderName: { contains: search, mode: "insensitive" } },
        { accountName: { contains: search, mode: "insensitive" } },
        { bankName: { contains: search, mode: "insensitive" } },
        { branch: { contains: search, mode: "insensitive" } },
        { user: { 
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } }
          ]
        }}
      ];
    }

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    const [bankDetails, total] = await prisma.$transaction([
      prisma.bankDetails.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              mobile: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.bankDetails.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: bankDetails,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }
};

export default bankDetailsServices;
