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

  if (adminReq.user && adminReq.user.admin === true) {
    // User is authenticated and is an admin
    next();
  } else if (adminReq.user && adminReq.user.admin !== true) {
    // User is authenticated but not an admin
    res.status(403).json({
      error: "Forbidden",
      message: "You do not have administrative privileges.",
    });
  }
  // else if (!adminReq.user) {
    // This case should ideally be caught by a preceding general auth middleware
    // If ensureAdmin is used without a general auth middleware, this would be hit.
    // res.status(401).json({
    //   error: "Unauthorized",
    //   message: "You must be logged in to perform this action.",
    // });
  // }
  else {
    // Fallback for any other case (e.g. user object exists but no admin field)
    // This could also indicate an issue with how the user object is populated.
    res.status(403).json({
      error: "Forbidden",
      message: "Administrative status could not be verified.",
    });
  }
};
