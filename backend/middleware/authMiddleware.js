import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET environment variable is not set.');
        return res.status(500).json({ error: 'Server configuration error' });
    }
    let token;

    if (req.headers.authorization && req.headers.authorization.toLowerCase().startsWith('bearer ')) {
        token = req.headers.authorization.split(' ')[1]?.trim();
        if (!token) {
            return res.status(401).json({ error: 'Not authorized, invalid token format' });
        }

        try {
            const decoded = jwt.verify(token, jwtSecret);

            const isDbConnected = User.db.readyState === 1;
            if (!isDbConnected) {
                return res.status(503).json({ error: 'Database not connected' });
            }

            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user) {
                return res.status(401).json({ error: 'Not authorized, user not found' });
            }

            return next();
        } catch (error) {
            const message = error?.name === 'TokenExpiredError'
                ? 'Token expired, please log in again'
                : 'Invalid token, please log in again';

            console.warn('Auth token validation failed:', error?.message || error);
            return res.status(401).json({ error: message });
        }
    }

    return res.status(401).json({ error: 'Not authorized, no token' });
};
