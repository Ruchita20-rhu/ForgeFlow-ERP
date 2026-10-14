export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const asyncHandler = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || (err.code === '23505' ? 409 : 500);
  const message = status === 500 ? 'Internal server error' : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ error: message });
}
