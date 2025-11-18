const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  // Get token from header (Format: "Bearer <token>")
  const bearerHeader = req.headers['authorization'];

  if (!bearerHeader) {
    return res.status(403).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const token = bearerHeader.split(' ')[1]; // Remove "Bearer "
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to the request object
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

module.exports = verifyToken;