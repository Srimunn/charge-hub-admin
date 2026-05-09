import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

            // Get user from the token
            const isDbConnected = User.db.readyState === 1;
            if (isDbConnected && decoded.id.length === 24) {
                req.user = await User.findById(decoded.id).select('-password');
            } else {
                // Mock mode: create a dummy user object from the token ID
                req.user = { id: decoded.id };
            }

            if (!req.user) {
                return res.status(401).json({ error: 'Not authorized, user not found' });
            }

            return next();
        } catch (error) {
            console.error(error);
            return res.status(401).json({ error: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'Not authorized, no token' });
    }
};
