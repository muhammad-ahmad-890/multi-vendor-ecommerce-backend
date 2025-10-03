import multer from "multer";
import { AWS_CONFIG } from "../config/aws.js";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (AWS_CONFIG.allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${AWS_CONFIG.allowedFileTypes.join(
          ", "
        )}`
      ),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: AWS_CONFIG.maxFileSize, // 5MB limit
  },
});

export const uploadVendorPhotos = upload.fields([
  { name: "profilePhoto", maxCount: 1 },
  { name: "coverPhoto", maxCount: 1 },
]);

export const uploadProfilePhoto = upload.single("profilePhoto");

export const uploadCoverPhoto = upload.single("coverPhoto");

export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        status: "error",
        message: "File too large. Maximum size is 5MB.",
      });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        status: "error",
        message:
          "Unexpected field name. Expected 'profilePhoto' or 'coverPhoto'.",
      });
    }
  }

  if (error.message.includes("Invalid file type")) {
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }

  return res.status(400).json({
    status: "error",
    message: "File upload error.",
  });
};
