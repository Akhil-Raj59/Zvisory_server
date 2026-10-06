const error = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error"; 
    
    return res.status(statusCode).json({
        success: false,
        stack: err.stack,
        message
    });
}
export default error;