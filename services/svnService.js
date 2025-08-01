const svn = require('node-svn-ultimate');
const fs = require('fs-extra');
const path = require('path');

class SVNService {
    constructor() {
        this.svnUrl = process.env.SVN_URL;
        this.username = process.env.SVN_USERNAME;
        this.password = process.env.SVN_PASSWORD;
        this.workingDir = process.env.WORKING_DIR;
    }

    /**
     * Fetch latest code from SVN repository
     * @param {string} buildId - Unique build identifier
     * @returns {Promise<Object>} - Result with status and details
     */
    async fetchLatestCode(buildId) {
        try {
            const targetDir = path.join(this.workingDir, buildId);
            
            // Ensure working directory exists
            await fs.ensureDir(targetDir);
            
            // SVN checkout options
            const options = {
                username: this.username,
                password: this.password,
                trust: true,
                quiet: false
            };

            return new Promise((resolve, reject) => {
                console.log(`Starting SVN checkout for build ${buildId}...`);
                
                svn.commands.checkout(this.svnUrl, targetDir, options, (err) => {
                    if (err) {
                        console.error(`SVN checkout failed for build ${buildId}:`, err);
                        reject({
                            success: false,
                            error: err.message,
                            buildId: buildId
                        });
                    } else {
                        console.log(`SVN checkout completed for build ${buildId}`);
                        resolve({
                            success: true,
                            message: 'Code fetched successfully',
                            buildId: buildId,
                            targetPath: targetDir
                        });
                    }
                });
            });
        } catch (error) {
            console.error(`Error in fetchLatestCode for build ${buildId}:`, error);
            throw {
                success: false,
                error: error.message,
                buildId: buildId
            };
        }
    }

    /**
     * Get SVN information (revision, author, etc.)
     * @returns {Promise<Object>} - SVN info
     */
    async getSVNInfo() {
        try {
            const options = {
                username: this.username,
                password: this.password,
                trust: true
            };

            return new Promise((resolve, reject) => {
                svn.commands.info(this.svnUrl, options, (err, info) => {
                    if (err) {
                        reject({
                            success: false,
                            error: err.message
                        });
                    } else {
                        resolve({
                            success: true,
                            info: info
                        });
                    }
                });
            });
        } catch (error) {
            throw {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clean up working directory for a specific build
     * @param {string} buildId - Build identifier
     */
    async cleanupBuild(buildId) {
        try {
            const targetDir = path.join(this.workingDir, buildId);
            if (await fs.pathExists(targetDir)) {
                await fs.remove(targetDir);
                console.log(`Cleaned up build directory: ${targetDir}`);
            }
        } catch (error) {
            console.error(`Error cleaning up build ${buildId}:`, error);
        }
    }
}

module.exports = SVNService;