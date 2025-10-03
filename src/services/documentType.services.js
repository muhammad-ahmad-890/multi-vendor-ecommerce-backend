import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

export async function createDocumentType({ name }) {
  if (!name || !String(name).trim()) throw new Error("Name is required");
  const exists = await prisma.documentType.findFirst({ where: { name: { equals: String(name).trim(), mode: "insensitive" } } });
  if (exists) throw new Error("Document type already exists");
  return prisma.documentType.create({ data: { name: String(name).trim() } });
}

export async function getAllDocumentTypes({ page = 1, limit = 10, search = "" } = {}) {
  const where = search
    ? { name: { contains: String(search).trim(), mode: "insensitive" } }
    : {};
  const currentPage = Math.max(1, parseInt(page));
  const perPage = Math.max(1, parseInt(limit));
  const skip = (currentPage - 1) * perPage;
  const [items, total] = await prisma.$transaction([
    prisma.documentType.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: perPage }),
    prisma.documentType.count({ where })
  ]);
  return {
    data: items,
    pagination: {
      currentPage,
      totalPages: Math.ceil(total / perPage) || 1,
      totalItems: total,
      itemsPerPage: perPage
    }
  };
}

export async function updateDocumentType({ id, name }) {
  if (!id) throw new Error("id is required");
  const data = {};
  if (name !== undefined) data.name = String(name).trim();
  return prisma.documentType.update({ where: { id }, data });
}

export async function deleteDocumentType(id) {
  if (!id) throw new Error("id is required");
  await prisma.documentType.delete({ where: { id } });
  return { success: true };
}
