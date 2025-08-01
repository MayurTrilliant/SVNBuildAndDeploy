const express = require('express');
const AuthController = require('../controllers/authController');
const AuthMiddleware = require('../middleware/auth');

const router = express.Router();
const authController = new AuthController();
const authMiddleware = new AuthMiddleware();

// Public routes
router.post('/login', authController.login.bind(authController));
router.get('/credentials', authController.getDefaultCredentials.bind(authController));
router.post('/verify', authController.verifyToken.bind(authController));

// Protected routes
router.get('/user', 
    authMiddleware.verifyToken.bind(authMiddleware), 
    authController.getCurrentUser.bind(authController)
);

router.post('/logout', 
    authMiddleware.verifyToken.bind(authMiddleware), 
    authController.logout.bind(authController)
);

module.exports = router;