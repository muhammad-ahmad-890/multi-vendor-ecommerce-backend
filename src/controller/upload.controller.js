import uploadService from "../services/upload.services.js";
import { dataResponse } from "../utils/response.js";

const uploadController = {
  async uploadImage(req, res, next) {
    try {
      if (!req.file) throw new Error("No file uploaded");

      const secureUrl = await uploadService.uploadToCloudinary(req.file.buffer, req.file.originalname);

      return res.status(200).send(dataResponse("Image uploaded successfully", { url: secureUrl }));
    } catch (err) {
      next(err);
    }
  },

  async uploadDocument(req, res, next) {
    try {
      if (!req.file) throw new Error("No file uploaded");

      const secureUrl = await uploadService.uploadDocumentToCloudinary(req.file.buffer, req.file.originalname);

      return res.status(200).send(dataResponse("Document uploaded successfully", { url: secureUrl }));
    } catch (err) {
      next(err);
    }
  },

  async uploadMultipleFiles(req, res, next) {
    try {
      if (!req.files || !req.files.length) throw new Error("No files uploaded");

      const urls = await uploadService.uploadMultipleFiles(req.files);

      return res.status(200).send(dataResponse("Files uploaded successfully", { urls }));
    } catch (err) {
      next(err);
    }
  },
};

export default uploadController;
