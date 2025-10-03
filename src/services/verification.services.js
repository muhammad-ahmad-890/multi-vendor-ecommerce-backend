import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

function computeVerificationStatus(user, store) {
  const userStatus = String(user?.status || "PENDING").toUpperCase();
  const isVerified = Boolean(store?.isVerified);
  const isRejected = Boolean(store?.isRejected);

  if (userStatus === "REJECTED" || isRejected) return "REJECTED";
  if (userStatus === "PENDING" && !isVerified) return "PENDING";
  if (userStatus === "APPROVED" && !isVerified) return "FORM_APPROVED";
  if (userStatus === "APPROVED" && isVerified) return "APPROVED";
  return userStatus;
}

export async function getUnverifiedVendorsWithStore({ page = 1, limit = 10, search = "", status = "", documentStatus = "" } = {}) {
  const vendors = await prisma.user.findMany({
    where: { role: { in: ["VENDOR"] } },
    select: {
      id: true,
      firstName: true,  
      lastName: true,
      email: true,
      mobile: true,
      role: true,
      status: true,
      businessType:true,
      facebookUrl:true,
      instagramUrl:true,
      isActive: true,
      pinCode: true,
      city: true,
      state: true,
      country: true,
      Store: true
    }
  });

  const hydrated = [];

  for (const v of vendors) {
    let store = v.Store && v.Store.length > 0 ? v.Store[0] : null;

    if (!store) {
      const fallbackName = v.firstName || "store";
      const fallbackUserName = `${(v.firstName || "user")}${v.lastName || ''}`.toLowerCase().replace(/\s+/g, '');
      store = await prisma.store.create({
        data: {
          storeName: `${fallbackName}'s Store`,
          vendorId: v.id,
          userName: fallbackUserName,
          isVerified: false,
          pinCode: (v.pinCode && String(v.pinCode).trim()) || "000000",
          city: v.city || null,
          state: v.state || null,
          country: v.country || null
        }
      });
    }

    const documents = await prisma.storeDocument.findMany({
      where: { storeId: v.id },
      orderBy: { createdAt: "desc" }
    });

    hydrated.push({ vendor: v, store, documents });
  }

  // Compute stats across all hydrated items
  const stats = {
    totalVendors: hydrated.length,
    verifiedCount: hydrated.filter(i => i.store?.isVerified).length,
    unverifiedCount: hydrated.filter(i => !i.store?.isVerified && !i.store?.isRejected).length,
    rejectedCount: hydrated.filter(i => i.store?.isRejected).length,
    documents: {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0
    }
  };
  for (const h of hydrated) {
    for (const d of h.documents) {
      if (d.status && stats.documents[d.status] !== undefined) {
        stats.documents[d.status] += 1;
      }
    }
  }

  // Apply filters (status and documentStatus) and search in-memory
  let filtered = hydrated.map(i => ({
    vendor: { ...i.vendor, status: computeVerificationStatus(i.vendor, i.store) },
    store: i.store,
    documents: i.documents
  }));

  if (status) {
    const s = String(status).toUpperCase();
    if (s === "VERIFIED" || s === "APPROVED") filtered = filtered.filter(i => i.store?.isVerified === true && i.vendor.status === "APPROVED");
    else if (s === "UNVERIFIED" || s === "PENDING") filtered = filtered.filter(i => i.vendor.status === "PENDING");
    else if (s === "REJECTED") filtered = filtered.filter(i => i.vendor.status === "REJECTED");
    else if (s === "FORM_APPROVED") filtered = filtered.filter(i => i.vendor.status === "FORM_APPROVED");
  }

  if (documentStatus) {
    const ds = String(documentStatus).toUpperCase();
    filtered = filtered.filter(i => i.documents.some(d => d.status === ds));
  }

  if (search) {
    const q = String(search).trim().toLowerCase();
    filtered = filtered.filter(i => {
      const u = i.vendor;
      const s = i.store;
      return (
        (u.firstName && u.firstName.toLowerCase().includes(q)) ||
        (u.lastName && u.lastName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.mobile && u.mobile.toLowerCase().includes(q)) ||
        (s.storeName && s.storeName.toLowerCase().includes(q)) ||
        (s.userName && s.userName.toLowerCase().includes(q))
      );
    });
  }

  // Pagination
  const currentPage = Math.max(1, parseInt(page));
  const perPage = Math.max(1, parseInt(limit));
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / perPage) || 1;
  const start = (currentPage - 1) * perPage;
  const items = filtered.slice(start, start + perPage);

  // Shape response: include only necessary vendor fields
  const data = items.map(i => ({
    vendor: {
      id: i.vendor.id,
      firstName: i.vendor.firstName,
      lastName: i.vendor.lastName,
      email: i.vendor.email,
      mobile: i.vendor.mobile,
      role: i.vendor.role,
      status: i.vendor.status,
      isActive: i.vendor.isActive
    },
    store: i.store,
    documents: i.documents
  }));

  return {
    data,
    pagination: {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage: perPage
    },
    stats
  };
}

export async function getUserDocuments(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const documents = await prisma.storeDocument.findMany({
    where: { storeId: userId },
    orderBy: { createdAt: "desc" }
  });
  return documents;
}

export async function updateUserDocumentsStatus(userId, updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("Updates array is required");
  }
  const allowed = ["PENDING", "APPROVED", "REJECTED"];
  const ops = [];
  for (const u of updates) {
    if (!u?.id || !u?.status) throw new Error("Each update must include id and status");
    if (!allowed.includes(String(u.status).toUpperCase())) {
      throw new Error(`Invalid status: ${u.status}`);
    }
    ops.push(
      prisma.storeDocument.updateMany({
        where: { id: u.id, storeId: userId },
        data: { status: String(u.status).toUpperCase() }
      })
    );
  }
  await prisma.$transaction(ops);
  
  // Check if any documents were approved and verify if all are approved
  const hasApprovedUpdates = updates.some(u => String(u.status).toUpperCase() === "APPROVED");
  
  if (hasApprovedUpdates) {
    const allDocuments = await prisma.storeDocument.findMany({
      where: { storeId: userId }
    });
    
    // Check if all documents are approved
    const allApproved = allDocuments.length > 0 && allDocuments.every(doc => doc.status === "APPROVED");
    
    if (allApproved) {
      console.log("🚀 All documents approved via bulk update, auto-approving vendor and verifying store");
      
      // Get user and store info
      const user = await prisma.user.findUnique({ 
        where: { id: userId }, 
        include: { Store: true } 
      });
      
      if (user) {
        const store = user.Store && user.Store.length > 0 ? user.Store[0] : null;
        
        const autoApproveOps = [];
        
        // Update user status to APPROVED and role to VENDOR
        autoApproveOps.push(
          prisma.user.update({ 
            where: { id: userId }, 
            data: { 
              status: "APPROVED",
              role: "VENDOR"
            } 
          })
        );
        
        // Update store to verified
        if (store) {
          autoApproveOps.push(
            prisma.store.update({ 
              where: { id: store.id }, 
              data: { 
                isVerified: true, 
                isRejected: false, 
                reason: null 
              } 
            })
          );
        }
        
        // Execute all updates in a transaction
        await prisma.$transaction(autoApproveOps);
        console.log("🚀 Vendor auto-approved and store verified successfully via bulk update");
      }
    }
  }
  
  const documents = await getUserDocuments(userId);
  return documents;
}

export async function updateUserDocumentStatus(userId, documentId, status, reason) {
  console.log("🚀 ~ updateUserDocumentStatus ~ reason:", reason)
  const allowed = ["PENDING", "APPROVED", "REJECTED"];
  if (!documentId || !status) throw new Error("documentId and status are required");
  const next = String(status).toUpperCase();
  if (!allowed.includes(next)) throw new Error(`Invalid status: ${status}`);

  // Update the document status
  const updated = await prisma.storeDocument.updateMany({
    where: { id: documentId, storeId: userId },
    data: { status: next, reason }
  });
  if (updated.count === 0) {
    throw new Error("Document not found or not owned by user");
  }

  // Check if all documents are approved and auto-approve vendor if so
  if (next === "APPROVED") {
    const allDocuments = await prisma.storeDocument.findMany({
      where: { storeId: userId }
    });
    
    // Check if all documents are approved
    const allApproved = allDocuments.length > 0 && allDocuments.every(doc => doc.status === "APPROVED");
    
    if (allApproved) {
      console.log("🚀 All documents approved, auto-approving vendor and verifying store");
      
      // Get user and store info
      const user = await prisma.user.findUnique({ 
        where: { id: userId }, 
        include: { Store: true } 
      });
      
      if (user) {
        const store = user.Store && user.Store.length > 0 ? user.Store[0] : null;
        
        const ops = [];
        
        // Update user status to APPROVED and role to VENDOR
        ops.push(
          prisma.user.update({ 
            where: { id: userId }, 
            data: { 
              status: "APPROVED",
              role: "VENDOR"
            } 
          })
        );
        
        // Update store to verified
        if (store) {
          ops.push(
            prisma.store.update({ 
              where: { id: store.id }, 
              data: { 
                isVerified: true, 
                isRejected: false, 
                reason: null 
              } 
            })
          );
        }
        
        // Execute all updates in a transaction
        await prisma.$transaction(ops);
        console.log("🚀 Vendor auto-approved and store verified successfully");
      }
    }
  }

  return await prisma.storeDocument.findMany({ where: { storeId: userId }, orderBy: { createdAt: "desc" } });
}

export async function rejectVendorRequest(userId, reason = "") {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { Store: true } });
  if (!user) throw new Error("User not found");
  const store = user.Store && user.Store.length > 0 ? user.Store[0] : null;

  const ops = [];
  ops.push(prisma.user.update({ where: { id: userId }, data: { status: "REJECTED" } }));
  if (store) {
    ops.push(
      prisma.store.update({ where: { id: store.id }, data: { isVerified: false, isRejected: true, reason: reason || null } })
    );
    ops.push(
      prisma.storeDocument.updateMany({ where: { storeId: userId }, data: { status: "REJECTED" } })
    );
  }
  await prisma.$transaction(ops);
  return { success: true };
}

export async function approveVendorForm(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { Store: true } });
  if (!user) throw new Error("User not found");
  const store = user.Store && user.Store.length > 0 ? user.Store[0] : null;

  const ops = [];
  ops.push(prisma.user.update({ where: { id: userId }, data: { status: "APPROVED" } }));
  if (store) {
    ops.push(
      prisma.store.update({ where: { id: store.id }, data: { isRejected: false, reason: null } })
    );
  }
  await prisma.$transaction(ops);
  return { success: true };
}

export async function approveVendorFinal(userId, reason = null) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { Store: true } });
  if (!user) throw new Error("User not found");
  const store = user.Store && user.Store.length > 0 ? user.Store[0] : null;

  const ops = [];
  ops.push(prisma.user.update({ where: { id: userId }, data: { status: "APPROVED" } }));
  if (store) {
    ops.push(
      prisma.store.update({ where: { id: store.id }, data: { isVerified: true, isRejected: false, reason: reason || null } })
    );
  }
  await prisma.$transaction(ops);
  return { success: true };
}

export async function getUserDetailWithStoreAndDocuments(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      mobile: true,
      role: true,
      status: true,
      isActive: true,
      businessType: true,
      facebookUrl: true,
      instagramUrl: true,
      youtubeUrl: true,
      city: true,
      state: true,
      country: true,
      Store: true
    }
  });
  if (!user) throw new Error("User not found");

  let store = user.Store && user.Store.length > 0 ? user.Store[0] : null;
  if (!store) {
    store = null;
  }

  const documents = await prisma.storeDocument.findMany({
    where: { storeId: userId },
    orderBy: { createdAt: "desc" }
  });

  const combinedStatus = computeVerificationStatus(user, store);

  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      status: combinedStatus,
      isActive: user.isActive,
      businessType: user.businessType,
      facebookUrl: user.facebookUrl,
      instagramUrl: user.instagramUrl,
      youtubeUrl: user.youtubeUrl,
      city: user.city,
      state: user.state,
      country: user.country
    },
    store,
    documents
  };
}
