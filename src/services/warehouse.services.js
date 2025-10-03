import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";

const prisma = new PrismaClient();

const warehouseServices = {
  async createWarehouse(data, vendorId) {
    const { name, address, postCode, city, state } = data;

    if (!name || !address || !postCode || !city || !state) {
      throw createError(400, "name, address, postCode, city and state are required");
    }

    const warehouse = await prisma.wareHouse.create({
      data: {
        name: name.trim(),
        address: address.trim(),
        postCode: postCode.trim(),
        city: city.trim(),
        state: state.trim(),
        userId: vendorId,
      },
    });

    return warehouse;
  },

  async getWarehouse(warehouseId, vendorId) {
    const warehouse = await prisma.wareHouse.findFirst({
      where: { id: warehouseId, userId: vendorId },
    });

    if (!warehouse) {
      throw createError(404, "Warehouse not found");
    }

    return warehouse;
  },

  async getVendorWarehouses(vendorId) {
    const warehouses = await prisma.wareHouse.findMany({
      where: { userId: vendorId },
      orderBy: { createdAt: 'desc' },
    });

    return warehouses;
  },

  async updateWarehouse(warehouseId, vendorId, updateData) {
    const exists = await prisma.wareHouse.findFirst({
      where: { id: warehouseId, userId: vendorId },
    });

    if (!exists) {
      throw createError(404, "Warehouse not found");
    }

    const updated = await prisma.wareHouse.update({
      where: { id: warehouseId },
      data: {
        name: updateData.name?.trim(),
        address: updateData.address?.trim(),
        postCode: updateData.postCode?.trim(),
        city: updateData.city?.trim(),
        state: updateData.state?.trim(),
      },
    });

    return updated;
  },

  async deleteWarehouse(warehouseId, vendorId) {
    const exists = await prisma.wareHouse.findFirst({
      where: { id: warehouseId, userId: vendorId },
    });

    if (!exists) {
      throw createError(404, "Warehouse not found");
    }

    await prisma.wareHouse.delete({ where: { id: warehouseId } });
    return { message: "Warehouse deleted successfully" };
  },
};

export default warehouseServices;


