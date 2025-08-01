const BuildOrchestrator = require('../services/buildOrchestrator');

class BuildController {
    constructor() {
        this.buildOrchestrator = new BuildOrchestrator();
    }

    /**
     * Trigger a new build
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async triggerBuild(req, res) {
        try {
            const triggeredBy = req.user ? req.user.username : 'anonymous';
            
            console.log(`Build triggered by: ${triggeredBy}`);

            // Start the build process (this runs asynchronously)
            const buildPromise = this.buildOrchestrator.executeBuild(triggeredBy);
            
            // Return immediate response
            res.json({
                success: true,
                message: 'Build process started',
                timestamp: new Date().toISOString(),
                triggeredBy: triggeredBy
            });

            // Handle the build completion in the background
            buildPromise.then(result => {
                console.log(`Build ${result.buildId} completed:`, result.success ? 'SUCCESS' : 'FAILED');
            }).catch(error => {
                console.error('Build execution error:', error);
            });

        } catch (error) {
            console.error('Error triggering build:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to trigger build',
                error: error.message
            });
        }
    }

    /**
     * Get current build status
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getBuildStatus(req, res) {
        try {
            const status = this.buildOrchestrator.getCurrentBuildStatus();
            res.json({
                success: true,
                status: status
            });
        } catch (error) {
            console.error('Error getting build status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get build status',
                error: error.message
            });
        }
    }

    /**
     * Get build history with pagination
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getBuildHistory(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const status = req.query.status || null;

            const history = await this.buildOrchestrator.getBuildHistory(page, limit, status);
            
            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            console.error('Error getting build history:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get build history',
                error: error.message
            });
        }
    }

    /**
     * Get specific build details
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getBuildDetails(req, res) {
        try {
            const { buildId } = req.params;

            if (!buildId) {
                return res.status(400).json({
                    success: false,
                    message: 'Build ID is required'
                });
            }

            const details = await this.buildOrchestrator.getBuildDetails(buildId);
            
            if (!details.build) {
                return res.status(404).json({
                    success: false,
                    message: 'Build not found'
                });
            }

            res.json({
                success: true,
                data: details
            });
        } catch (error) {
            console.error('Error getting build details:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get build details',
                error: error.message
            });
        }
    }

    /**
     * Get build statistics
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getBuildStats(req, res) {
        try {
            const stats = await this.buildOrchestrator.getBuildStats();
            
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error getting build stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get build statistics',
                error: error.message
            });
        }
    }

    /**
     * Cancel active build
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async cancelBuild(req, res) {
        try {
            const result = await this.buildOrchestrator.cancelBuild();
            
            if (result.success) {
                res.json({
                    success: true,
                    message: result.message
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: result.message
                });
            }
        } catch (error) {
            console.error('Error cancelling build:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to cancel build',
                error: error.message
            });
        }
    }

    /**
     * Get SVN repository information
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getSVNInfo(req, res) {
        try {
            const svnInfo = await this.buildOrchestrator.svnService.getSVNInfo();
            
            res.json({
                success: true,
                data: svnInfo
            });
        } catch (error) {
            console.error('Error getting SVN info:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get SVN information',
                error: error.message
            });
        }
    }

    /**
     * Get system configuration
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getSystemConfig(req, res) {
        try {
            const config = {
                svnUrl: process.env.SVN_URL,
                deployPath: process.env.DEPLOY_PATH,
                workingDir: process.env.WORKING_DIR,
                environment: process.env.NODE_ENV || 'development',
                version: '1.0.0'
            };

            res.json({
                success: true,
                data: config
            });
        } catch (error) {
            console.error('Error getting system config:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get system configuration',
                error: error.message
            });
        }
    }

    /**
     * Health check endpoint
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async healthCheck(req, res) {
        try {
            const buildStatus = this.buildOrchestrator.getCurrentBuildStatus();
            
            res.json({
                success: true,
                status: 'healthy',
                timestamp: new Date().toISOString(),
                buildSystem: {
                    isBuilding: buildStatus.isBuilding,
                    activeBuildId: buildStatus.activeBuildId
                },
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: '1.0.0'
            });
        } catch (error) {
            console.error('Health check error:', error);
            res.status(500).json({
                success: false,
                status: 'unhealthy',
                error: error.message
            });
        }
    }

    /**
     * Close all services (for graceful shutdown)
     */
    async close() {
        console.log('Closing build controller services...');
        await this.buildOrchestrator.close();
    }
}

module.exports = BuildController;