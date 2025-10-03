import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";

const prisma = new PrismaClient();

const zonesServices = {
  // Create zone for vendor
  async createZone(zoneData, vendorId) {
    const { zoneName, country, state, restrictedPin = [] } = zoneData;

    // Validate required fields
    if (!zoneName || !country || !state || !Array.isArray(state) || state.length === 0) {
      throw createError(400, "Zone name, country, and at least one state are required");
    }

    // Check if zone name already exists for this vendor
    const existingZone = await prisma.zones.findFirst({
      where: { 
        zoneName: zoneName.trim(),
        storeId: vendorId
      }
    });

    if (existingZone) {
      throw createError(400, "Zone name already exists for this vendor");
    }

    const zone = await prisma.zones.create({
      data: {
        zoneName: zoneName.trim(),
        country: country.trim(),
        state: state.map(s => s.trim()),
        restrictedPin: Array.isArray(restrictedPin) ? restrictedPin.map(p => p.trim()) : [],
        storeId: vendorId
      }
    });

    return zone;
  },

  // Get zone by ID (with ownership validation)
  async getZone(zoneId, vendorId) {
    const zone = await prisma.zones.findFirst({
      where: { 
        id: zoneId,
        storeId: vendorId
      },
      include: {
        shippingMethod: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!zone) {
      throw createError(404, "Zone not found");
    }

    return zone;
  },

  // Get all zones for vendor
  async getVendorZones(vendorId) {
    const zones = await prisma.zones.findMany({
      where: { storeId: vendorId },
      include: {
        shippingMethod: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return zones;
  },

  // Update zone
  async updateZone(zoneId, vendorId, updateData) {
    // Check if zone exists and belongs to vendor
    const existingZone = await prisma.zones.findFirst({
      where: { 
        id: zoneId,
        storeId: vendorId
      }
    });

    if (!existingZone) {
      throw createError(404, "Zone not found");
    }

    // Check if new zone name conflicts with existing zones (excluding current)
    if (updateData.zoneName && updateData.zoneName.trim() !== existingZone.zoneName) {
      const conflictingZone = await prisma.zones.findFirst({
        where: { 
          zoneName: updateData.zoneName.trim(),
          storeId: vendorId,
          id: { not: zoneId }
        }
      });

      if (conflictingZone) {
        throw createError(400, "Zone name already exists for this vendor");
      }
    }

    const updatedZone = await prisma.zones.update({
      where: { id: zoneId },
      data: {
        zoneName: updateData.zoneName?.trim(),
        country: updateData.country?.trim(),
        state: updateData.state ? updateData.state.map(s => s.trim()) : undefined,
        restrictedPin: updateData.restrictedPin ? updateData.restrictedPin.map(p => p.trim()) : undefined
      }
    });

    return updatedZone;
  },

  // Delete zone
  async deleteZone(zoneId, vendorId) {
    // Check if zone exists and belongs to vendor
    const existingZone = await prisma.zones.findFirst({
      where: { 
        id: zoneId,
        storeId: vendorId
      }
    });

    if (!existingZone) {
      throw createError(404, "Zone not found");
    }

    await prisma.zones.delete({
      where: { id: zoneId }
    });

    return { message: "Zone deleted successfully" };
  },

  // Get all zones (for admin)
  async getAllZones({ page = 1, limit = 10, search, country, sortBy = "createdAt", sortOrder = "desc" }) {
    const whereClause = {};

    if (search) {
      whereClause.OR = [
        { zoneName: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
        { state: { has: search } },
        { store: { 
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } }
          ]
        }}
      ];
    }

    if (country) {
      whereClause.country = { contains: country, mode: "insensitive" };
    }

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    const [zones, total] = await prisma.$transaction([
      prisma.zones.findMany({
        where: whereClause,
        include: {
          store: {
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
      prisma.zones.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: zones,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  // Shipping Method CRUD Operations
  async createShippingMethod(methodData, vendorId) {
    const { zoneId, method, title, freeShippingRequired, minimunOrderAmount, cost = 0 } = methodData;

    // Validate required fields
    if (!zoneId || !method) {
      throw createError(400, "Zone ID and method are required");
    }

    // Check if zone exists and belongs to vendor
    const zone = await prisma.zones.findFirst({
      where: { 
        id: zoneId,
      }
    });

    if (!zone) {
      throw createError(404, "Zone not found");
    }

  
 

    const shippingMethod = await prisma.shippingMethod.create({
      data: {
        zoneId: zoneId,
        method: method.trim(),
        title: title?.trim() || '',
        freeShippingRequired: freeShippingRequired ?? null,
        minimunOrderAmount: minimunOrderAmount ?? null,
        cost: parseFloat(cost) || 0
      }
    });

    return shippingMethod;
  },

  async getShippingMethod(methodId, vendorId) {
    const shippingMethod = await prisma.shippingMethod.findFirst({
      where: { 
        id: methodId,
      },
      include: {
        zone: {
          select: {
            id: true,
            zoneName: true,
            country: true,
            state: true
          }
        }
      }
    });

    if (!shippingMethod) {
      throw createError(404, "Shipping method not found");
    }

    return shippingMethod;
  },

  async getZoneShippingMethods(zoneId) {
    console.log("🚀 ~ getZoneShippingMethods ~ zoneId:", zoneId)
    // Check if zone exists and belongs to vendor
    const zone = await prisma.zones.findFirst({
      where: { 
        id: zoneId,
      }
    });
    console.log("🚀 ~ getZoneShippingMethods ~ zone:", zone)

    if (!zone) {
      throw createError(404, "Zone not found");
    }

    const shippingMethods = await prisma.shippingMethod.findMany({
      where: { zoneId: zoneId },
      orderBy: { createdAt: 'asc' }
    });

    return shippingMethods;
  },

  async updateShippingMethod(methodId, vendorId, updateData) {
    // Check if shipping method exists and belongs to vendor
    const existingMethod = await prisma.shippingMethod.findFirst({
      where: { 
        id: methodId,
        zone: {
          storeId: vendorId
        }
      }
    });

    if (!existingMethod) {
      throw createError(404, "Shipping method not found");
    }

    // Check if new method name conflicts with existing methods in the same zone
    if (updateData.method && updateData.method.trim() !== existingMethod.method) {
      const conflictingMethod = await prisma.shippingMethod.findFirst({
        where: { 
          zoneId: existingMethod.zoneId,
          method: updateData.method.trim(),
          id: { not: methodId }
        }
      });

      if (conflictingMethod) {
        throw createError(400, "Shipping method already exists for this zone");
      }
    }

    const updatedMethod = await prisma.shippingMethod.update({
      where: { id: methodId },
      data: {
        method: updateData.method?.trim(),
        title: updateData.title !== undefined ? updateData.title?.trim() : undefined,
        freeShippingRequired: updateData.freeShippingRequired !== undefined ? updateData.freeShippingRequired : undefined,
        minimunOrderAmount: updateData.minimunOrderAmount !== undefined ? updateData.minimunOrderAmount : undefined,
        cost: updateData.cost !== undefined ? parseFloat(updateData.cost) : undefined
      }
    });

    return updatedMethod;
  },

  async deleteShippingMethod(methodId, vendorId) {
    // Check if shipping method exists and belongs to vendor
    const existingMethod = await prisma.shippingMethod.findFirst({
      where: { 
        id: methodId,
        zone: {
          storeId: vendorId
        }
      }
    });

    if (!existingMethod) {
      throw createError(404, "Shipping method not found");
    }

    await prisma.shippingMethod.delete({
      where: { id: methodId }
    });

    return { message: "Shipping method deleted successfully" };
  }
};

export default zonesServices;
