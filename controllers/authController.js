const AuthMiddleware = require('../middleware/auth');

class AuthController {
    constructor() {
        this.authMiddleware = new AuthMiddleware();
    }

    /**
     * User login endpoint
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async login(req, res) {
        try {
            const { username, password } = req.body;

            // Validate input
            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Username and password are required'
                });
            }

            // Authenticate user
            const authResult = await this.authMiddleware.authenticate(username, password);

            if (authResult.success) {
                res.json({
                    success: true,
                    message: 'Login successful',
                    token: authResult.token,
                    user: authResult.user
                });
            } else {
                res.status(401).json({
                    success: false,
                    message: authResult.message
                });
            }
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during login'
            });
        }
    }

    /**
     * Get current user information
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getCurrentUser(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Not authenticated'
                });
            }

            res.json({
                success: true,
                user: {
                    username: req.user.username,
                    role: req.user.role
                }
            });
        } catch (error) {
            console.error('Get current user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user information'
            });
        }
    }

    /**
     * Logout endpoint (client-side token removal)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async logout(req, res) {
        try {
            // Since we're using stateless JWT, logout is handled on client side
            // by removing the token. We just acknowledge the logout request.
            res.json({
                success: true,
                message: 'Logout successful'
            });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
    }

    /**
     * Get default credentials (for setup/testing)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getDefaultCredentials(req, res) {
        try {
            const credentials = this.authMiddleware.getDefaultCredentials();
            res.json({
                success: true,
                credentials: credentials
            });
        } catch (error) {
            console.error('Get default credentials error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get default credentials'
            });
        }
    }

    /**
     * Verify token endpoint
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async verifyToken(req, res) {
        try {
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({
                    success: false,
                    message: 'Token is required'
                });
            }

            const user = this.authMiddleware.getUserFromToken(token);

            if (user) {
                res.json({
                    success: true,
                    valid: true,
                    user: {
                        username: user.username,
                        role: user.role
                    }
                });
            } else {
                res.json({
                    success: true,
                    valid: false,
                    message: 'Invalid or expired token'
                });
            }
        } catch (error) {
            console.error('Token verification error:', error);
            res.status(500).json({
                success: false,
                message: 'Token verification failed'
            });
        }
    }
}

module.exports = AuthController;