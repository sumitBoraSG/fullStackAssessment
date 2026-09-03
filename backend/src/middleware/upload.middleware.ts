import multer from "multer";
import createError from "http-errors";
import { Request, Response, NextFunction } from "express";

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "text/csv" ||
      file.originalname.toLowerCase().endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

const uploadSingle = upload.single("file");

/**
 * Wraps multer's single-file upload so its errors reach the app's error
 * middleware as proper HttpExceptions instead of falling through as a bare
 * Error/MulterError. Without this, both a rejected file type (fileFilter's
 * plain Error) and an oversized file (MulterError, no `.status` property)
 * hit error.ts's `error.status || 500` fallback and surface as an opaque
 * 500 leaking the raw multer/fileFilter message, instead of a clean
 * 400/413.
 */
export function uploadCsv(req: Request, res: Response, next: NextFunction): void {
  uploadSingle(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(createError(413, "Uploaded file exceeds the maximum allowed size (5MB)"));
        return;
      }
      next(createError(400, err.message));
      return;
    }

    next(createError(400, (err as Error).message || "Invalid file upload"));
  });
}