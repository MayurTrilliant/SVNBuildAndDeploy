const express = require('express');
const BuildController = require('../controllers/buildController');
const AuthMiddleware = require('../middleware/auth');

const router = express.Router();
const buildController = new BuildController();
const authMiddleware = new AuthMiddleware();

// Public routes (read-only)
router.get('/status', buildController.getBuildStatus.bind(buildController));
router.get('/health', buildController.healthCheck.bind(buildController));
router.get('/history', 
    authMiddleware.optionalAuth.bind(authMiddleware),
    buildController.getBuildHistory.bind(buildController)
);
router.get('/stats', 
    authMiddleware.optionalAuth.bind(authMiddleware),
    buildController.getBuildStats.bind(buildController)
);
router.get('/details/:buildId', 
    authMiddleware.optionalAuth.bind(authMiddleware),
    buildController.getBuildDetails.bind(buildController)
);
router.get('/config', buildController.getSystemConfig.bind(buildController));
router.get('/svn-info', buildController.getSVNInfo.bind(buildController));

// Protected routes (require authentication)
router.post('/trigger', 
    authMiddleware.verifyToken.bind(authMiddleware),
    buildController.triggerBuild.bind(buildController)
);

router.post('/cancel', 
    authMiddleware.verifyToken.bind(authMiddleware),
    buildController.cancelBuild.bind(buildController)
);

module.exports = { router, buildController };