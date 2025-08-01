const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthMiddleware {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'default_secret_change_in_production';
        this.defaultUsername = process.env.DEFAULT_USERNAME || 'admin';
        this.defaultPassword = process.env.DEFAULT_PASSWORD || 'admin123';
        
        // Hash the default password for comparison
        this.hashedDefaultPassword = bcrypt.hashSync(this.defaultPassword, 10);
    }

    /**
     * Authenticate user credentials
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Object} - Authentication result
     */
    async authenticate(username, password) {
        try {
            // For simplicity, we're using a single default user
            // In production, this should connect to a proper user database
            if (username === this.defaultUsername) {
                const isValidPassword = await bcrypt.compare(password, this.hashedDefaultPassword);
                
                if (isValidPassword) {
                    // Generate JWT token
                    const token = jwt.sign(
                        { 
                            username: username,
                            role: 'admin',
                            iat: Date.now()
                        },
                        this.jwtSecret,
                        { expiresIn: '24h' }
                    );

                    return {
                        success: true,
                        token: token,
                        user: {
                            username: username,
                            role: 'admin'
                        }
                    };
                }
            }

            return {
                success: false,
                message: 'Invalid username or password'
            };
        } catch (error) {
            console.error('Authentication error:', error);
            return {
                success: false,
                message: 'Authentication failed'
            };
        }
    }

    /**
     * Verify JWT token middleware
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Next middleware function
     */
    verifyToken(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader) {
                return res.status(401).json({
                    success: false,
                    message: 'No authorization header provided'
                });
            }

            const token = authHeader.split(' ')[1]; // Bearer <token>
            
            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: 'No token provided'
                });
            }

            // Verify the token
            jwt.verify(token, this.jwtSecret, (err, decoded) => {
                if (err) {
                    console.error('Token verification failed:', err);
                    return res.status(401).json({
                        success: false,
                        message: 'Invalid or expired token'
                    });
                }

                // Add user info to request object
                req.user = decoded;
                next();
            });
        } catch (error) {
            console.error('Token verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Token verification failed'
            });
        }
    }

    /**
     * Optional authentication middleware (allows both authenticated and guest access)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Next middleware function
     */
    optionalAuth(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader) {
                req.user = null;
                return next();
            }

            const token = authHeader.split(' ')[1];
            
            if (!token) {
                req.user = null;
                return next();
            }

            // Try to verify the token
            jwt.verify(token, this.jwtSecret, (err, decoded) => {
                if (err) {
                    req.user = null;
                } else {
                    req.user = decoded;
                }
                next();
            });
        } catch (error) {
            console.error('Optional auth error:', error);
            req.user = null;
            next();
        }
    }

    /**
     * Get user info from token
     * @param {string} token - JWT token
     * @returns {Object} - User info or null
     */
    getUserFromToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            return decoded;
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if user has required role
     * @param {string} requiredRole - Required role
     * @returns {Function} - Middleware function
     */
    requireRole(requiredRole) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            if (req.user.role !== requiredRole && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions'
                });
            }

            next();
        };
    }

    /**
     * Get default credentials (for setup/testing purposes)
     * @returns {Object} - Default credentials
     */
    getDefaultCredentials() {
        return {
            username: this.defaultUsername,
            password: this.defaultPassword,
            note: 'These are the default credentials. Change them in production!'
        };
    }
}

module.exports = AuthMiddleware;