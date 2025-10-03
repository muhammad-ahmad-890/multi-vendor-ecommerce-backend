import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";

const prisma = new PrismaClient();

const storeDocumentServices = {
  // Create store document for vendor
  async createStoreDocument(documentData, vendorId) {
    const { documentType, fileUrl } = documentData;

    // Validate required fields
    if (!documentType || !fileUrl) {
      throw createError(400, "Document type and file URL are required");
    }

    const storeDocument = await prisma.storeDocument.create({
      data: {
        documentType: documentType.trim(),
        fileUrl: fileUrl.trim(),
        storeId: vendorId
      }
    });

    return storeDocument;
  },

  // Get store document by ID (with ownership validation)
  async getStoreDocument(documentId, vendorId) {
    const storeDocument = await prisma.storeDocument.findFirst({
      where: { 
        id: documentId,
        storeId: vendorId
      }
    });

    if (!storeDocument) {
      throw createError(404, "Store document not found");
    }

    return storeDocument;
  },

  // Get all store documents for vendor
  async getVendorStoreDocuments(vendorId) {
    const storeDocuments = await prisma.storeDocument.findMany({
      where: { storeId: vendorId },
      orderBy: { createdAt: 'desc' }
    });

    return storeDocuments;
  },

  // Update store document
  async updateStoreDocument(documentId, vendorId, updateData) {
    // Check if store document exists and belongs to vendor
    const existingDocument = await prisma.storeDocument.findFirst({
      where: { 
        id: documentId,
        storeId: vendorId
      }
    });

    if (!existingDocument) {
      throw createError(404, "Store document not found");
    }

    const updatedDocument = await prisma.storeDocument.update({
      where: { id: documentId },
      data: {
        documentType: updateData.documentType?.trim(),
        fileUrl: updateData.fileUrl?.trim()
      }
    });

    return updatedDocument;
  },

  // Delete store document
  async deleteStoreDocument(documentId, vendorId) {
    // Check if store document exists and belongs to vendor
    const existingDocument = await prisma.storeDocument.findFirst({
      where: { 
        id: documentId,
        storeId: vendorId
      }
    });

    if (!existingDocument) {
      throw createError(404, "Store document not found");
    }

    await prisma.storeDocument.delete({
      where: { id: documentId }
    });

    return { message: "Store document deleted successfully" };
  },

  // Get all store documents (for admin)
  async getAllStoreDocuments({ page = 1, limit = 10, search, documentType, sortBy = "createdAt", sortOrder = "desc" }) {
    const whereClause = {};

    if (search) {
      whereClause.OR = [
        { documentType: { contains: search, mode: "insensitive" } },
        { fileUrl: { contains: search, mode: "insensitive" } },
        { store: { 
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } }
          ]
        }}
      ];
    }

    if (documentType) {
      whereClause.documentType = { contains: documentType, mode: "insensitive" };
    }

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    const [documents, total] = await prisma.$transaction([
      prisma.storeDocument.findMany({
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
      prisma.storeDocument.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: documents,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }
};

export default storeDocumentServices;
