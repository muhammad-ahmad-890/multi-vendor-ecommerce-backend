import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";

const prisma = new PrismaClient();

const shippingPoliciesServices = {
  // Create shipping policy for user
  async createShippingPolicy(policyData, userId) {
    const { policy, isCheck = false } = policyData;

    // Validate required fields
    if (!policy) {
      throw createError(400, "Policy field is required");
    }

    const shippingPolicy = await prisma.shippingPolicies.create({
      data: {
        policy: policy.trim(),
        isCheck: Boolean(isCheck),
        userId: userId
      }
    });

    return shippingPolicy;
  },

  // Get shipping policy by ID (with ownership validation)
  async getShippingPolicy(policyId, userId) {
    const shippingPolicy = await prisma.shippingPolicies.findFirst({
      where: { 
        id: policyId,
        userId: userId
      }
    });

    if (!shippingPolicy) {
      throw createError(404, "Shipping policy not found");
    }

    return shippingPolicy;
  },

  // Get all shipping policies for user
  async getUserShippingPolicies(userId) {
    const shippingPolicies = await prisma.shippingPolicies.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });

    return shippingPolicies;
  },

  // Backwards-compatible alias used by controller
  async getVendorShippingPolicy(userId) {
    return this.getUserShippingPolicies(userId);
  },

  // Update shipping policy
  async updateShippingPolicy(policyId, userId, updateData) {
    // Check if shipping policy exists and belongs to user
    const existingPolicy = await prisma.shippingPolicies.findFirst({
      where: { 
        id: policyId,
        userId: userId
      }
    });

    if (!existingPolicy) {
      throw createError(404, "Shipping policy not found");
    }

    const updatedPolicy = await prisma.shippingPolicies.update({
      where: { id: policyId },
      data: {
        policy: updateData.policy?.trim(),
        isCheck: updateData.isCheck !== undefined ? Boolean(updateData.isCheck) : undefined
      }
    });

    return updatedPolicy;
  },

  // Delete shipping policy
  async deleteShippingPolicy(policyId, userId) {
    // Check if shipping policy exists and belongs to user
    const existingPolicy = await prisma.shippingPolicies.findFirst({
      where: { 
        id: policyId,
        userId: userId
      }
    });

    if (!existingPolicy) {
      throw createError(404, "Shipping policy not found");
    }

    await prisma.shippingPolicies.delete({
      where: { id: policyId }
    });

    return { message: "Shipping policy deleted successfully" };
  },

  // Get all shipping policies (for admin)
  async getAllShippingPolicies({ page = 1, limit = 10, search, isCheck, sortBy = "createdAt", sortOrder = "desc" }) {
    const whereClause = {};

    if (search) {
      whereClause.OR = [
        { policy: { contains: search, mode: "insensitive" } },
        { user: { 
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } }
          ]
        }}
      ];
    }

    if (isCheck !== undefined) {
      if (typeof isCheck === "string") {
        if (isCheck.toLowerCase() === "true") whereClause.isCheck = true;
        else if (isCheck.toLowerCase() === "false") whereClause.isCheck = false;
      } else {
        whereClause.isCheck = Boolean(isCheck);
      }
    }

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    const [policies, total] = await prisma.$transaction([
      prisma.shippingPolicies.findMany({
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
      prisma.shippingPolicies.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: policies,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  // Toggle shipping policy check status
  async toggleShippingPolicyCheck(policyId, userId) {
    const existingPolicy = await prisma.shippingPolicies.findFirst({
      where: { 
        id: policyId,
        userId: userId
      }
    });

    if (!existingPolicy) {
      throw createError(404, "Shipping policy not found");
    }

    const updatedPolicy = await prisma.shippingPolicies.update({
      where: { id: policyId },
      data: {
        isCheck: !existingPolicy.isCheck,
      },
    });

    return updatedPolicy;
  }
};

export default shippingPoliciesServices;
