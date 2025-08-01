const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

class DeployService {
    constructor() {
        this.deployPath = process.env.DEPLOY_PATH;
        this.workingDir = process.env.WORKING_DIR;
    }

    /**
     * Deploy built code to target location
     * @param {string} buildId - Unique build identifier
     * @param {string} sourcePath - Path to built code
     * @param {Object} buildResult - Build result information
     * @returns {Promise<Object>} - Deployment result
     */
    async deployCode(buildId, sourcePath, buildResult) {
        try {
            console.log(`Starting deployment for build ${buildId}...`);
            
            const deployResult = {
                buildId: buildId,
                success: false,
                startTime: new Date(),
                endTime: null,
                logs: [],
                error: null,
                deployPath: this.deployPath
            };

            // Check if source exists
            if (!await fs.pathExists(sourcePath)) {
                throw new Error(`Source path does not exist: ${sourcePath}`);
            }

            deployResult.logs.push(`Starting deployment from ${sourcePath} to ${this.deployPath}`);

            // Create backup of existing deployment if it exists
            const backupResult = await this.createBackup(buildId);
            if (backupResult.success) {
                deployResult.logs.push(backupResult.message);
            }

            // Determine what to deploy based on project type
            const deploySource = await this.determineDeploySource(sourcePath, buildResult.projectType);
            deployResult.logs.push(`Deploy source determined: ${deploySource}`);

            // Perform deployment
            const copyResult = await this.copyToDeployment(deploySource, this.deployPath);
            
            deployResult.logs.push(...copyResult.logs);
            deployResult.success = copyResult.success;
            deployResult.error = copyResult.error;
            deployResult.endTime = new Date();
            deployResult.duration = deployResult.endTime - deployResult.startTime;

            if (deployResult.success) {
                // Set permissions if needed (for Linux/Unix systems)
                await this.setDeploymentPermissions();
                deployResult.logs.push('Deployment permissions set');
            }

            console.log(`Deployment ${deployResult.success ? 'completed successfully' : 'failed'} for build ${buildId}`);
            
            return deployResult;

        } catch (error) {
            console.error(`Error in deployCode for build ${buildId}:`, error);
            return {
                buildId: buildId,
                success: false,
                startTime: new Date(),
                endTime: new Date(),
                logs: [`Deployment error: ${error.message}`],
                error: error.message,
                duration: 0,
                deployPath: this.deployPath
            };
        }
    }

    /**
     * Determine what to deploy based on project type
     * @param {string} sourcePath - Source path
     * @param {string} projectType - Type of project
     * @returns {Promise<string>} - Path to deploy from
     */
    async determineDeploySource(sourcePath, projectType) {
        switch (projectType) {
            case 'dotnet':
                // Look for bin/Release or bin/Debug folders
                const releaseDir = path.join(sourcePath, 'bin', 'Release');
                const debugDir = path.join(sourcePath, 'bin', 'Debug');
                
                if (await fs.pathExists(releaseDir)) {
                    return releaseDir;
                } else if (await fs.pathExists(debugDir)) {
                    return debugDir;
                }
                
                // Look for published output
                const publishDir = path.join(sourcePath, 'bin', 'Release', 'net*', 'publish');
                const publishDirs = await this.findDirectories(sourcePath, '**/bin/**/publish');
                if (publishDirs.length > 0) {
                    return publishDirs[0];
                }
                
                return sourcePath;

            case 'node':
                // Look for dist, build, or public folders
                const distDir = path.join(sourcePath, 'dist');
                const buildDir = path.join(sourcePath, 'build');
                const publicDir = path.join(sourcePath, 'public');
                
                if (await fs.pathExists(distDir)) {
                    return distDir;
                } else if (await fs.pathExists(buildDir)) {
                    return buildDir;
                } else if (await fs.pathExists(publicDir)) {
                    return publicDir;
                }
                
                return sourcePath;

            case 'maven':
                // Look for target folder
                const targetDir = path.join(sourcePath, 'target');
                if (await fs.pathExists(targetDir)) {
                    return targetDir;
                }
                return sourcePath;

            case 'gradle':
                // Look for build/libs folder
                const gradleBuildDir = path.join(sourcePath, 'build', 'libs');
                if (await fs.pathExists(gradleBuildDir)) {
                    return gradleBuildDir;
                }
                return sourcePath;

            default:
                return sourcePath;
        }
    }

    /**
     * Find directories matching a pattern
     * @param {string} basePath - Base path to search
     * @param {string} pattern - Pattern to match
     * @returns {Promise<Array>} - Array of matching directories
     */
    async findDirectories(basePath, pattern) {
        try {
            // Simple implementation - could be enhanced with glob
            const result = [];
            const searchPath = pattern.replace('**/', '').replace('*', '');
            
            const walk = async (dir) => {
                const files = await fs.readdir(dir, { withFileTypes: true });
                for (const file of files) {
                    if (file.isDirectory()) {
                        const fullPath = path.join(dir, file.name);
                        if (file.name.includes(searchPath.split('/').pop())) {
                            result.push(fullPath);
                        }
                        await walk(fullPath);
                    }
                }
            };
            
            await walk(basePath);
            return result;
        } catch (error) {
            console.error('Error finding directories:', error);
            return [];
        }
    }

    /**
     * Create backup of existing deployment
     * @param {string} buildId - Build identifier
     * @returns {Promise<Object>} - Backup result
     */
    async createBackup(buildId) {
        try {
            if (!await fs.pathExists(this.deployPath)) {
                return {
                    success: true,
                    message: 'No existing deployment to backup'
                };
            }

            const backupDir = path.join(path.dirname(this.deployPath), 'backups');
            const backupPath = path.join(backupDir, `backup_${buildId}_${Date.now()}`);
            
            await fs.ensureDir(backupDir);
            await fs.copy(this.deployPath, backupPath);
            
            return {
                success: true,
                message: `Backup created at ${backupPath}`
            };
        } catch (error) {
            console.error('Error creating backup:', error);
            return {
                success: false,
                message: `Backup failed: ${error.message}`
            };
        }
    }

    /**
     * Copy files to deployment location
     * @param {string} source - Source path
     * @param {string} destination - Destination path
     * @returns {Promise<Object>} - Copy result
     */
    async copyToDeployment(source, destination) {
        try {
            const logs = [];
            
            // Ensure destination directory exists
            await fs.ensureDir(destination);
            logs.push(`Ensured destination directory exists: ${destination}`);
            
            // Remove existing files (except backups)
            const existingFiles = await fs.readdir(destination).catch(() => []);
            for (const file of existingFiles) {
                if (file !== 'backups') {
                    const filePath = path.join(destination, file);
                    await fs.remove(filePath);
                }
            }
            logs.push('Cleaned existing deployment files');
            
            // Copy new files
            await fs.copy(source, destination, {
                overwrite: true,
                errorOnExist: false
            });
            logs.push(`Files copied from ${source} to ${destination}`);
            
            return {
                success: true,
                logs: logs,
                error: null
            };
        } catch (error) {
            console.error('Error copying to deployment:', error);
            return {
                success: false,
                logs: [`Copy failed: ${error.message}`],
                error: error.message
            };
        }
    }

    /**
     * Set appropriate permissions for deployment
     * @returns {Promise<void>}
     */
    async setDeploymentPermissions() {
        try {
            if (process.platform !== 'win32') {
                // Set appropriate permissions for web server access
                await this.executeCommand(`chmod -R 755 "${this.deployPath}"`);
            }
        } catch (error) {
            console.error('Error setting permissions:', error);
        }
    }

    /**
     * Execute a command
     * @param {string} command - Command to execute
     * @returns {Promise<Object>} - Execution result
     */
    async executeCommand(command) {
        return new Promise((resolve) => {
            exec(command, (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    stdout: stdout,
                    stderr: stderr,
                    error: error?.message
                });
            });
        });
    }
}

module.exports = DeployService;