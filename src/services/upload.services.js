import axios from "axios";
import FormData from "form-data";

const uploadService = {
  // Utility function to check file size
  checkFileSize(fileBuffer, maxSizeMB = 10) {
    const maxSize = maxSizeMB * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      throw new Error(`File size too large. Maximum allowed size is ${maxSizeMB}MB. Your file size: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)}MB`);
    }
    return true;
  },

  async uploadToCloudinary(fileBuffer, originalName) {
    try {
      // Check file size using utility function
      this.checkFileSize(fileBuffer, 100);

      const formData = new FormData();
      formData.append("file", fileBuffer, originalName);
      formData.append("upload_preset", process.env.CLOUDNAIRY_UPLOAD_PRESET);

      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${process.env.CLOUDNAIRY_KEY}/image/upload`,
        formData,
        { headers: formData.getHeaders() }
      );

      return response.data.secure_url;
    } catch (error) {
      if (error.message.includes("File size too large")) {
        throw error; // Re-throw our custom size error
      }
      console.error("Cloudinary upload error:", error.response?.data || error.message);
      throw new Error("Failed to upload image");
    }
  },

  async uploadDocumentToCloudinary(fileBuffer, originalName, resourceType = "raw") {
    try {
      // Check file size using utility function
      this.checkFileSize(fileBuffer, 100);

      const formData = new FormData();
      formData.append("file", fileBuffer, originalName);
      formData.append("upload_preset", process.env.CLOUDNAIRY_UPLOAD_PRESET);

      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${process.env.CLOUDNAIRY_KEY}/${resourceType}/upload`,
        formData,
        { headers: formData.getHeaders() }
      );

      return response.data.secure_url;
    } catch (error) {
      if (error.message.includes("File size too large")) {
        throw error; // Re-throw our custom size error
      }
      console.error("Cloudinary document upload error:", error.response?.data || error.message);
      throw new Error("Failed to upload document");
    }
  },

  async uploadMultipleImages(files) {
    try {
      // Check file sizes before upload
      files.forEach(file => {
        this.checkFileSize(file.buffer, 100);
      });

      const urls = await Promise.all(
        files.map((file) => this.uploadToCloudinary(file.buffer, file.originalname))
      );
      return urls;
    } catch (error) {
      if (error.message.includes("File size too large")) {
        throw error; // Re-throw our custom size error
      }
      console.error("Multiple image upload error:", error.message);
      throw new Error("Failed to upload images");
    }
  },

  async uploadMultipleDocuments(files, resourceType = "raw") {
    try {
      // Check file sizes before upload
      files.forEach(file => {
        this.checkFileSize(file.buffer, 100);
      });

      const urls = await Promise.all(
        files.map((file) => this.uploadDocumentToCloudinary(file.buffer, file.originalname, resourceType))
      );
      return urls;
    } catch (error) {
      if (error.message.includes("File size too large")) {
        throw error; // Re-throw our custom size error
      }
      console.error("Multiple document upload error:", error.message);
      throw new Error("Failed to upload documents");
    }
  },

  async uploadFile(fileBuffer, originalName) {
    try {
      const ext = originalName.split('.').pop()?.toLowerCase();
      const imageExt = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
      const docExt = ["pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx", "csv", "ods", "ppt", "pptx", "odp", "zip", "rar", "7z", "tar", "gz"];

      if (ext && imageExt.includes(ext)) {
        return await this.uploadToCloudinary(fileBuffer, originalName);
      }

      return await this.uploadDocumentToCloudinary(fileBuffer, originalName, "raw");
    } catch (error) {
      console.error("Generic file upload error:", error.message);
      throw new Error("Failed to upload file");
    }
  },

  async uploadMultipleFiles(files) {
    try {
      // Check file sizes before upload
      files.forEach(file => {
        this.checkFileSize(file.buffer, 100 );
      });

      const urls = await Promise.all(
        files.map((file) => this.uploadFile(file.buffer, file.originalname))
      );
      return urls;
    } catch (error) {
      if (error.message.includes("File size too large")) {
        throw error; // Re-throw our custom size error
      }
      console.error("Multiple file upload error:", error.message);
      throw new Error("Failed to upload files");
    }
  },
};

export default uploadService;
