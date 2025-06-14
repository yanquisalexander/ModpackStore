import { Request, Response, NextFunction } from 'express';

// Define an interface for requests that include a user object, potentially with admin status
export interface AdminRequest extends Request {
  user?: {
    id: string;
    admin?: boolean;
    // Include other user properties if they are part of req.user
    // For example: username?: string; email?: string;
  };
}

/**
 * Middleware to ensure that the authenticated user has administrative privileges.
 */
export const ensureAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Cast req to AdminRequest to access the typed user property
  const adminReq = req as AdminRequest;

  // Cast req to AdminRequest to access the typed user property
  const adminReq = req as AdminRequest;

  // 1. Check if user is authenticated (req.user should be populated by a preceding auth middleware)
  if (!adminReq.user) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required. You must be logged in to perform this action.",
    });
  }

  // 2. Check if user is an admin
  // The `admin` property could be explicitly undefined or null if not set.
  // We strictly check for `admin === true`.
  if (adminReq.user.admin === true) {
    // User is authenticated and is an admin
    return next();
  }

  // 3. User is authenticated but not an admin, or admin status is not explicitly true
  // This also covers cases where adminReq.user.admin is false, undefined, or null.
  return res.status(403).json({
    error: "Forbidden",
    message: "You do not have administrative privileges.",
  });
};
