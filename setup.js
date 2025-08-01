#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');

class SetupWizard {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.config = {};
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    async start() {
        console.log('\n🚀 SVN Build & Deploy Service Setup Wizard');
        console.log('='.repeat(50));
        
        try {
            await this.checkPrerequisites();
            await this.gatherConfiguration();
            await this.createConfiguration();
            await this.initializeDirectories();
            await this.installDependencies();
            await this.setupComplete();
        } catch (error) {
            console.error('\n❌ Setup failed:', error.message);
            process.exit(1);
        } finally {
            this.rl.close();
        }
    }

    async checkPrerequisites() {
        console.log('\n📋 Checking prerequisites...');
        
        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
        
        if (majorVersion < 14) {
            throw new Error(`Node.js 14.x or higher required. Current version: ${nodeVersion}`);
        }
        console.log(`✅ Node.js ${nodeVersion} - OK`);

        // Check if SVN is available
        try {
            await this.execCommand('svn --version');
            console.log('✅ SVN client - OK');
        } catch (error) {
            console.log('⚠️  SVN client not found. Please install SVN client.');
        }

        // Check for .NET (optional)
        try {
            await this.execCommand('dotnet --version');
            console.log('✅ .NET SDK - Available');
        } catch (error) {
            console.log('ℹ️  .NET SDK not found (optional for .NET projects)');
        }

        // Check for Maven (optional)
        try {
            await this.execCommand('mvn --version');
            console.log('✅ Maven - Available');
        } catch (error) {
            console.log('ℹ️  Maven not found (optional for Java projects)');
        }
    }

    async gatherConfiguration() {
        console.log('\n⚙️  Configuration Setup');
        console.log('Please provide the following information:\n');

        // SVN Configuration
        this.config.SVN_URL = await this.question('SVN Repository URL: ');
        this.config.SVN_USERNAME = await this.question('SVN Username: ');
        this.config.SVN_PASSWORD = await this.question('SVN Password: ');

        // Deployment Configuration
        this.config.DEPLOY_PATH = await this.question('Deployment Path: ');
        
        // Optional configurations with defaults
        const port = await this.question('Server Port (default: 3000): ');
        this.config.PORT = port || '3000';

        const workingDir = await this.question('Working Directory (default: ./temp_workspace): ');
        this.config.WORKING_DIR = workingDir || './temp_workspace';

        const username = await this.question('Admin Username (default: admin): ');
        this.config.DEFAULT_USERNAME = username || 'admin';

        const password = await this.question('Admin Password (default: admin123): ');
        this.config.DEFAULT_PASSWORD = password || 'admin123';

        // Generate JWT secret
        this.config.JWT_SECRET = this.generateJWTSecret();
        
        this.config.NODE_ENV = 'production';
        this.config.DB_PATH = './build_history.db';
    }

    async createConfiguration() {
        console.log('\n📝 Creating configuration files...');

        const envContent = Object.entries(this.config)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        await fs.writeFile('.env', envContent);
        console.log('✅ .env file created');

        // Create .env.example without sensitive data
        const exampleConfig = { ...this.config };
        exampleConfig.SVN_PASSWORD = 'your_svn_password_here';
        exampleConfig.JWT_SECRET = 'your_jwt_secret_here';
        
        const exampleContent = Object.entries(exampleConfig)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        await fs.writeFile('.env.example', exampleContent);
        console.log('✅ .env.example file created');
    }

    async initializeDirectories() {
        console.log('\n📁 Creating directories...');

        const directories = [
            this.config.WORKING_DIR,
            './logs',
            path.dirname(this.config.DB_PATH)
        ];

        for (const dir of directories) {
            if (dir && dir !== '.') {
                await fs.ensureDir(dir);
                console.log(`✅ Created directory: ${dir}`);
            }
        }
    }

    async installDependencies() {
        console.log('\n📦 Installing dependencies...');
        
        if (await fs.pathExists('package.json')) {
            console.log('Installing npm packages...');
            await this.execCommand('npm install');
            console.log('✅ Dependencies installed');
        } else {
            console.log('⚠️  package.json not found. Skipping dependency installation.');
        }
    }

    async setupComplete() {
        console.log('\n🎉 Setup Complete!');
        console.log('='.repeat(50));
        console.log('Your SVN Build & Deploy Service is ready to start.');
        console.log('\nNext steps:');
        console.log('1. Review the configuration in .env file');
        console.log('2. Start the service with: npm start');
        console.log('3. Access the API at: http://localhost:' + this.config.PORT);
        console.log('\n📖 Documentation: See README.md for detailed usage instructions');
        console.log('\n🔐 Default Login Credentials:');
        console.log(`   Username: ${this.config.DEFAULT_USERNAME}`);
        console.log(`   Password: ${this.config.DEFAULT_PASSWORD}`);
        console.log('\n⚠️  Remember to change default credentials in production!');
        console.log('='.repeat(50));
    }

    generateJWTSecret() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 64; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    const wizard = new SetupWizard();
    wizard.start().catch(console.error);
}

module.exports = SetupWizard;