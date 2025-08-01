const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

class BuildService {
    constructor() {
        this.workingDir = process.env.WORKING_DIR;
    }

    /**
     * Build the fetched code
     * @param {string} buildId - Unique build identifier
     * @param {string} sourcePath - Path to the source code
     * @returns {Promise<Object>} - Build result
     */
    async buildCode(buildId, sourcePath) {
        try {
            console.log(`Starting build process for build ${buildId}...`);
            
            const buildResult = {
                buildId: buildId,
                success: false,
                startTime: new Date(),
                endTime: null,
                logs: [],
                error: null
            };

            // Check if source path exists
            if (!await fs.pathExists(sourcePath)) {
                throw new Error(`Source path does not exist: ${sourcePath}`);
            }

            // Detect project type and build accordingly
            const projectType = await this.detectProjectType(sourcePath);
            console.log(`Detected project type: ${projectType}`);
            
            buildResult.projectType = projectType;
            buildResult.logs.push(`Detected project type: ${projectType}`);

            let buildCommand;
            switch (projectType) {
                case 'dotnet':
                    buildCommand = await this.buildDotNetProject(sourcePath);
                    break;
                case 'node':
                    buildCommand = await this.buildNodeProject(sourcePath);
                    break;
                case 'maven':
                    buildCommand = await this.buildMavenProject(sourcePath);
                    break;
                case 'gradle':
                    buildCommand = await this.buildGradleProject(sourcePath);
                    break;
                default:
                    buildCommand = await this.buildGenericProject(sourcePath);
            }

            buildResult.buildCommand = buildCommand;
            buildResult.logs.push(`Build command: ${buildCommand}`);

            // Execute build command
            const executeResult = await this.executeCommand(buildCommand, sourcePath);
            
            buildResult.logs.push(...executeResult.logs);
            buildResult.success = executeResult.success;
            buildResult.error = executeResult.error;
            buildResult.endTime = new Date();
            buildResult.duration = buildResult.endTime - buildResult.startTime;

            console.log(`Build ${buildResult.success ? 'completed successfully' : 'failed'} for build ${buildId}`);
            
            return buildResult;

        } catch (error) {
            console.error(`Error in buildCode for build ${buildId}:`, error);
            return {
                buildId: buildId,
                success: false,
                startTime: new Date(),
                endTime: new Date(),
                logs: [`Build error: ${error.message}`],
                error: error.message,
                duration: 0
            };
        }
    }

    /**
     * Detect the type of project based on files present
     * @param {string} sourcePath - Path to source code
     * @returns {Promise<string>} - Project type
     */
    async detectProjectType(sourcePath) {
        try {
            const files = await fs.readdir(sourcePath);
            
            // Check for .NET projects
            if (files.some(file => file.endsWith('.sln') || file.endsWith('.csproj') || file.endsWith('.vbproj'))) {
                return 'dotnet';
            }
            
            // Check for Node.js projects
            if (files.includes('package.json')) {
                return 'node';
            }
            
            // Check for Maven projects
            if (files.includes('pom.xml')) {
                return 'maven';
            }
            
            // Check for Gradle projects
            if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
                return 'gradle';
            }
            
            return 'generic';
        } catch (error) {
            console.error('Error detecting project type:', error);
            return 'generic';
        }
    }

    /**
     * Build .NET project
     * @param {string} sourcePath - Source path
     * @returns {Promise<string>} - Build command
     */
    async buildDotNetProject(sourcePath) {
        // Look for solution file first, then project files
        const files = await fs.readdir(sourcePath);
        const solutionFile = files.find(file => file.endsWith('.sln'));
        
        if (solutionFile) {
            return `dotnet build "${path.join(sourcePath, solutionFile)}" --configuration Release`;
        }
        
        const projectFile = files.find(file => file.endsWith('.csproj') || file.endsWith('.vbproj'));
        if (projectFile) {
            return `dotnet build "${path.join(sourcePath, projectFile)}" --configuration Release`;
        }
        
        return `dotnet build "${sourcePath}" --configuration Release`;
    }

    /**
     * Build Node.js project
     * @param {string} sourcePath - Source path
     * @returns {Promise<string>} - Build command
     */
    async buildNodeProject(sourcePath) {
        const packagePath = path.join(sourcePath, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        
        if (packageJson.scripts && packageJson.scripts.build) {
            return `cd "${sourcePath}" && npm install && npm run build`;
        }
        
        return `cd "${sourcePath}" && npm install`;
    }

    /**
     * Build Maven project
     * @param {string} sourcePath - Source path
     * @returns {Promise<string>} - Build command
     */
    async buildMavenProject(sourcePath) {
        return `cd "${sourcePath}" && mvn clean package -DskipTests`;
    }

    /**
     * Build Gradle project
     * @param {string} sourcePath - Source path
     * @returns {Promise<string>} - Build command
     */
    async buildGradleProject(sourcePath) {
        return `cd "${sourcePath}" && ./gradlew build`;
    }

    /**
     * Build generic project (copy files)
     * @param {string} sourcePath - Source path
     * @returns {Promise<string>} - Build command
     */
    async buildGenericProject(sourcePath) {
        return `echo "No specific build process detected. Files will be copied as-is."`;
    }

    /**
     * Execute a command and capture output
     * @param {string} command - Command to execute
     * @param {string} workingDirectory - Working directory
     * @returns {Promise<Object>} - Execution result
     */
    async executeCommand(command, workingDirectory) {
        return new Promise((resolve) => {
            const logs = [];
            
            exec(command, { cwd: workingDirectory, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (stdout) {
                    logs.push(`STDOUT: ${stdout}`);
                }
                
                if (stderr) {
                    logs.push(`STDERR: ${stderr}`);
                }
                
                if (error) {
                    logs.push(`ERROR: ${error.message}`);
                    resolve({
                        success: false,
                        logs: logs,
                        error: error.message
                    });
                } else {
                    logs.push('Build completed successfully');
                    resolve({
                        success: true,
                        logs: logs,
                        error: null
                    });
                }
            });
        });
    }
}

module.exports = BuildService;