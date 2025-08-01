const { v4: uuidv4 } = require('uuid');
const SVNService = require('./svnService');
const BuildService = require('./buildService');
const DeployService = require('./deployService');
const HistoryService = require('./historyService');

class BuildOrchestrator {
    constructor() {
        this.svnService = new SVNService();
        this.buildService = new BuildService();
        this.deployService = new DeployService();
        this.historyService = new HistoryService();
        this.activeBuild = null;
    }

    /**
     * Execute full build and deployment pipeline
     * @param {string} triggeredBy - User who triggered the build
     * @returns {Promise<Object>} - Complete build result
     */
    async executeBuild(triggeredBy = 'system') {
        const buildId = uuidv4();
        
        try {
            console.log(`Starting full build pipeline - Build ID: ${buildId}`);
            
            // Check if another build is running
            if (this.activeBuild) {
                throw new Error(`Another build is already in progress: ${this.activeBuild}`);
            }
            
            this.activeBuild = buildId;

            // Initialize result object
            const result = {
                buildId: buildId,
                success: false,
                steps: {},
                startTime: new Date(),
                endTime: null,
                duration: 0,
                triggeredBy: triggeredBy
            };

            // Step 1: Get SVN Information
            console.log(`Step 1: Getting SVN information...`);
            let svnInfo = {};
            try {
                const svnResult = await this.svnService.getSVNInfo();
                if (svnResult.success) {
                    svnInfo = svnResult.info;
                    result.steps.svnInfo = { success: true, data: svnInfo };
                } else {
                    result.steps.svnInfo = { success: false, error: svnResult.error };
                }
            } catch (error) {
                console.error('SVN info step failed:', error);
                result.steps.svnInfo = { success: false, error: error.message };
            }

            // Start build record in history
            await this.historyService.startBuild(buildId, triggeredBy, svnInfo);
            await this.historyService.recordBuildStep(buildId, 'SVN Info', 
                result.steps.svnInfo.success ? 'completed' : 'failed', result.steps.svnInfo);

            // Step 2: Fetch Code from SVN
            console.log(`Step 2: Fetching code from SVN...`);
            let fetchResult;
            try {
                fetchResult = await this.svnService.fetchLatestCode(buildId);
                result.steps.fetch = fetchResult;
                
                await this.historyService.recordBuildStep(buildId, 'SVN Checkout', 
                    fetchResult.success ? 'completed' : 'failed', fetchResult);

                if (!fetchResult.success) {
                    throw new Error(`SVN checkout failed: ${fetchResult.error}`);
                }
            } catch (error) {
                console.error('SVN fetch step failed:', error);
                result.steps.fetch = { success: false, error: error.message };
                
                await this.historyService.recordBuildStep(buildId, 'SVN Checkout', 'failed', 
                    { error: error.message });
                await this.cleanup(buildId);
                this.activeBuild = null;
                return this.finalizeResult(result);
            }

            // Step 3: Build Code
            console.log(`Step 3: Building code...`);
            let buildResult;
            try {
                buildResult = await this.buildService.buildCode(buildId, fetchResult.targetPath);
                result.steps.build = buildResult;
                
                await this.historyService.recordBuildStep(buildId, 'Build', 
                    buildResult.success ? 'completed' : 'failed', buildResult);

                if (!buildResult.success) {
                    throw new Error(`Build failed: ${buildResult.error}`);
                }
            } catch (error) {
                console.error('Build step failed:', error);
                result.steps.build = { success: false, error: error.message };
                
                await this.historyService.recordBuildStep(buildId, 'Build', 'failed', 
                    { error: error.message });
                await this.cleanup(buildId);
                this.activeBuild = null;
                return this.finalizeResult(result);
            }

            // Step 4: Deploy Code
            console.log(`Step 4: Deploying code...`);
            let deployResult;
            try {
                deployResult = await this.deployService.deployCode(buildId, fetchResult.targetPath, buildResult);
                result.steps.deploy = deployResult;
                
                await this.historyService.recordBuildStep(buildId, 'Deploy', 
                    deployResult.success ? 'completed' : 'failed', deployResult);

                if (!deployResult.success) {
                    throw new Error(`Deployment failed: ${deployResult.error}`);
                }
            } catch (error) {
                console.error('Deploy step failed:', error);
                result.steps.deploy = { success: false, error: error.message };
                
                await this.historyService.recordBuildStep(buildId, 'Deploy', 'failed', 
                    { error: error.message });
                await this.cleanup(buildId);
                this.activeBuild = null;
                return this.finalizeResult(result);
            }

            // All steps completed successfully
            result.success = true;
            console.log(`Build pipeline completed successfully - Build ID: ${buildId}`);

            // Complete build record in history
            await this.historyService.completeBuild(buildId, buildResult, deployResult);

            // Cleanup
            await this.cleanup(buildId);
            this.activeBuild = null;

            return this.finalizeResult(result);

        } catch (error) {
            console.error(`Build pipeline failed - Build ID: ${buildId}:`, error);
            
            // Record failure in history if not already recorded
            try {
                const failedBuildResult = { success: false, error: error.message, logs: [] };
                const failedDeployResult = { success: false, error: 'Build failed', logs: [] };
                await this.historyService.completeBuild(buildId, failedBuildResult, failedDeployResult);
            } catch (historyError) {
                console.error('Error recording build failure:', historyError);
            }

            await this.cleanup(buildId);
            this.activeBuild = null;

            result.success = false;
            result.error = error.message;
            return this.finalizeResult(result);
        }
    }

    /**
     * Get current build status
     * @returns {Object} - Current build status
     */
    getCurrentBuildStatus() {
        return {
            isBuilding: !!this.activeBuild,
            activeBuildId: this.activeBuild,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get build history
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     * @param {string} status - Filter by status
     * @returns {Promise<Object>} - Build history
     */
    async getBuildHistory(page = 1, limit = 20, status = null) {
        return await this.historyService.getBuildHistory(page, limit, status);
    }

    /**
     * Get specific build details
     * @param {string} buildId - Build identifier
     * @returns {Promise<Object>} - Build details
     */
    async getBuildDetails(buildId) {
        return await this.historyService.getBuildDetails(buildId);
    }

    /**
     * Get build statistics
     * @returns {Promise<Object>} - Build statistics
     */
    async getBuildStats() {
        return await this.historyService.getBuildStats();
    }

    /**
     * Cancel active build
     * @returns {Promise<Object>} - Cancellation result
     */
    async cancelBuild() {
        if (!this.activeBuild) {
            return { success: false, message: 'No active build to cancel' };
        }

        const buildId = this.activeBuild;
        console.log(`Cancelling build: ${buildId}`);

        try {
            // Record cancellation
            await this.historyService.recordBuildStep(buildId, 'Cancellation', 'completed', 
                { logs: ['Build cancelled by user'] });

            const cancelledBuildResult = { success: false, error: 'Build cancelled', logs: ['Build cancelled by user'] };
            const cancelledDeployResult = { success: false, error: 'Build cancelled', logs: [] };
            await this.historyService.completeBuild(buildId, cancelledBuildResult, cancelledDeployResult);

            // Cleanup
            await this.cleanup(buildId);
            this.activeBuild = null;

            return { success: true, message: `Build ${buildId} cancelled successfully` };
        } catch (error) {
            console.error('Error cancelling build:', error);
            return { success: false, message: `Failed to cancel build: ${error.message}` };
        }
    }

    /**
     * Cleanup build resources
     * @param {string} buildId - Build identifier
     */
    async cleanup(buildId) {
        try {
            console.log(`Cleaning up build resources for: ${buildId}`);
            await this.svnService.cleanupBuild(buildId);
        } catch (error) {
            console.error(`Error during cleanup for build ${buildId}:`, error);
        }
    }

    /**
     * Finalize build result with timing information
     * @param {Object} result - Build result object
     * @returns {Object} - Finalized result
     */
    finalizeResult(result) {
        result.endTime = new Date();
        result.duration = result.endTime - result.startTime;
        result.durationFormatted = this.formatDuration(result.duration);
        
        return result;
    }

    /**
     * Format duration in milliseconds to human readable format
     * @param {number} duration - Duration in milliseconds
     * @returns {string} - Formatted duration
     */
    formatDuration(duration) {
        if (!duration || duration === 0) return '0s';
        
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Close all services
     */
    async close() {
        console.log('Closing all services...');
        this.historyService.close();
    }
}

module.exports = BuildOrchestrator;