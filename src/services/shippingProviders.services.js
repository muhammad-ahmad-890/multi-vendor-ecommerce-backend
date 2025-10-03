import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";

const prisma = new PrismaClient();

const shippingProvidersServices = {
  async createShippingProvider(data) {
    const { providerName, trackingUrl, prefix, isActive = true } = data;

    if (!providerName || !trackingUrl) {
      throw createError(400, "providerName and trackingUrl are required");
    }

    const existing = await prisma.shippingProviders.findFirst({
      where: { providerName: providerName.trim() }
    });

    if (existing) {
      throw createError(400, "Shipping provider with this name already exists");
    }

    const provider = await prisma.shippingProviders.create({
      data: {
        providerName: providerName.trim(),
        trackingUrl: trackingUrl.trim(),
        prefix: prefix?.trim() || null,
        isActive: Boolean(isActive),
      },
    });

    return provider;
  },

  async getShippingProvider(providerId) {
    const provider = await prisma.shippingProviders.findUnique({
      where: { id: providerId }
    });

    if (!provider) {
      throw createError(404, "Shipping provider not found");
    }

    return provider;
  },

  async getAllShippingProviders({ page = 1, limit = 10, search, isActive, sortBy = "createdAt", sortOrder = "desc" }) {
    const whereClause = {};

    if (search) {
      whereClause.OR = [
        { providerName: { contains: search, mode: "insensitive" } },
        { trackingUrl: { contains: search, mode: "insensitive" } },
        { prefix: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== undefined) {
      if (typeof isActive === "string") {
        if (isActive.toLowerCase() === "true") whereClause.isActive = true;
        else if (isActive.toLowerCase() === "false") whereClause.isActive = false;
      } else {
        whereClause.isActive = Boolean(isActive);
      }
    }

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    const [providers, total] = await prisma.$transaction([
      prisma.shippingProviders.findMany({
        where: whereClause,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.shippingProviders.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: providers,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  async updateShippingProvider(providerId, updateData) {
    const existing = await prisma.shippingProviders.findUnique({
      where: { id: providerId }
    });

    if (!existing) {
      throw createError(404, "Shipping provider not found");
    }

    if (updateData.providerName && updateData.providerName.trim() !== existing.providerName) {
      const conflicting = await prisma.shippingProviders.findFirst({
        where: { 
          providerName: updateData.providerName.trim(),
          id: { not: providerId }
        }
      });

      if (conflicting) {
        throw createError(400, "Shipping provider with this name already exists");
      }
    }

    const updated = await prisma.shippingProviders.update({
      where: { id: providerId },
      data: {
        providerName: updateData.providerName?.trim(),
        trackingUrl: updateData.trackingUrl?.trim(),
        prefix: updateData.prefix?.trim() || null,
        isActive: updateData.isActive !== undefined ? Boolean(updateData.isActive) : undefined,
      },
    });

    return updated;
  },

  async getAllShippingProvidersWithoutPagination({ isActive, search = "" }) {
    const whereClause = {};

    if (isActive !== undefined) {
      if (typeof isActive === "string") {
        if (isActive.toLowerCase() === "true") whereClause.isActive = true;
        else if (isActive.toLowerCase() === "false") whereClause.isActive = false;
      } else {
        whereClause.isActive = Boolean(isActive);
      }
    }

    if (search) {
      whereClause.OR = [
        { providerName: { contains: search, mode: "insensitive" } },
        { trackingUrl: { contains: search, mode: "insensitive" } },
        { prefix: { contains: search, mode: "insensitive" } },
      ];
    }

    const providers = await prisma.shippingProviders.findMany({
      where: whereClause,
      orderBy: { providerName: "asc" },
    });

    return providers;
  },

  async toggleShippingProviderStatus(providerId) {
    const existing = await prisma.shippingProviders.findUnique({
      where: { id: providerId }
    });

    if (!existing) {
      throw createError(404, "Shipping provider not found");
    }

    const updated = await prisma.shippingProviders.update({
      where: { id: providerId },
      data: {
        isActive: !existing.isActive,
      },
    });

    return updated;
  },

  async deleteShippingProvider(providerId) {
    const existing = await prisma.shippingProviders.findUnique({
      where: { id: providerId }
    });

    if (!existing) {
      throw createError(404, "Shipping provider not found");
    }

    await prisma.shippingProviders.delete({ where: { id: providerId } });
    return { message: "Shipping provider deleted successfully" };
  },
};

export default shippingProvidersServices;
