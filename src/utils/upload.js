import axios from "axios";
import FormData from "form-data";

// Image upload to Cloudinary
export const uploadToCloudinary = async (fileBuffer, originalName) => {
  const formData = new FormData();
  formData.append("file", fileBuffer, originalName);
  formData.append("upload_preset", process.env.CLOUDNAIRY_UPLOAD_PRESET);

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDNAIRY_KEY}/image/upload`,
    formData,
    {
      headers: formData.getHeaders(),
    }
  );

  return response.data.secure_url;
};

// Document upload to Cloudinary (PDF, DOC, DOCX, etc.)
export const uploadDocumentToCloudinary = async (fileBuffer, originalName, resourceType = "raw") => {
  const formData = new FormData();
  formData.append("file", fileBuffer, originalName);
  formData.append("upload_preset", process.env.CLOUDNAIRY_UPLOAD_PRESET);
  formData.append("resource_type", resourceType);

  // For documents, we can also specify format-specific options
  if (resourceType === "raw") {
    formData.append("format", "pdf"); // Default to PDF for documents
  }

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDNAIRY_KEY}/raw/upload`,
    formData,
    {
      headers: formData.getHeaders(),
    }
  );

  return response.data.secure_url;
};

// Upload multiple documents
export const uploadMultipleDocuments = async (files, resourceType = "raw") => {
  const uploadPromises = files.map(file => 
    uploadDocumentToCloudinary(file.buffer, file.originalname, resourceType)
  );
  
  const uploadedUrls = await Promise.all(uploadPromises);
  return uploadedUrls;
};

// Upload multiple images
export const uploadMultipleImages = async (files) => {
  const uploadPromises = files.map(file => 
    uploadToCloudinary(file.buffer, file.originalname)
  );
  
  const uploadedUrls = await Promise.all(uploadPromises);
  return uploadedUrls;
};

// Generic file upload that detects type and uploads accordingly
export const uploadFile = async (fileBuffer, originalName) => {
  const fileExtension = originalName.split('.').pop()?.toLowerCase();
  
  // Image types
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  
  // Document types
  const documentExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];
  
  // Spreadsheet types
  const spreadsheetExtensions = ['xls', 'xlsx', 'csv', 'ods'];
  
  // Presentation types
  const presentationExtensions = ['ppt', 'pptx', 'odp'];
  
  // Archive types
  const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz'];

  if (imageExtensions.includes(fileExtension)) {
    return await uploadToCloudinary(fileBuffer, originalName);
  } else if (documentExtensions.includes(fileExtension)) {
    return await uploadDocumentToCloudinary(fileBuffer, originalName, "raw");
  } else if (spreadsheetExtensions.includes(fileExtension)) {
    return await uploadDocumentToCloudinary(fileBuffer, originalName, "raw");
  } else if (presentationExtensions.includes(fileExtension)) {
    return await uploadDocumentToCloudinary(fileBuffer, originalName, "raw");
  } else if (archiveExtensions.includes(fileExtension)) {
    return await uploadDocumentToCloudinary(fileBuffer, originalName, "raw");
  } else {
    // Default to raw upload for unknown file types
    return await uploadDocumentToCloudinary(fileBuffer, originalName, "raw");
  }
};

// Upload multiple files of mixed types
export const uploadMultipleFiles = async (files) => {
  const uploadPromises = files.map(file => 
    uploadFile(file.buffer, file.originalname)
  );
  
  const uploadedUrls = await Promise.all(uploadPromises);
  return uploadedUrls;
};

// Delete file from Cloudinary (if needed)
export const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    const response = await axios.delete(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDNAIRY_KEY}/${resourceType}/destroy`,
      {
        data: {
          public_id: publicId,
          api_key: process.env.CLOUDNAIRY_API_KEY,
          signature: process.env.CLOUDNAIRY_SIGNATURE
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw new Error('Failed to delete file from Cloudinary');
  }
};

// Get file info from Cloudinary
export const getFileInfo = async (publicId, resourceType = "image") => {
  try {
    const response = await axios.get(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDNAIRY_KEY}/${resourceType}/info/${publicId}`
    );
    
    return response.data;
  } catch (error) {
    console.error('Error getting file info from Cloudinary:', error);
    throw new Error('Failed to get file info from Cloudinary');
  }
};