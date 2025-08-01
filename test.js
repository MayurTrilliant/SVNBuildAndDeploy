#!/usr/bin/env node

const http = require('http');
const fs = require('fs');

class ServiceTester {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.token = null;
    }

    async makeRequest(path, method = 'GET', data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };

            const req = http.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(responseData);
                        resolve({
                            status: res.statusCode,
                            data: jsonData,
                            headers: res.headers
                        });
                    } catch (error) {
                        resolve({
                            status: res.statusCode,
                            data: responseData,
                            headers: res.headers
                        });
                    }
                });
            });

            req.on('error', reject);

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    async testHealth() {
        console.log('🔍 Testing health endpoint...');
        try {
            const response = await this.makeRequest('/api/build/health');
            if (response.status === 200 && response.data.status === 'healthy') {
                console.log('✅ Health check - PASSED');
                return true;
            } else {
                console.log('❌ Health check - FAILED', response.status);
                return false;
            }
        } catch (error) {
            console.log('❌ Health check - FAILED (Connection error)');
            return false;
        }
    }

    async testRootEndpoint() {
        console.log('🔍 Testing root endpoint...');
        try {
            const response = await this.makeRequest('/');
            if (response.status === 200 && response.data.name) {
                console.log('✅ Root endpoint - PASSED');
                console.log(`   Service: ${response.data.name} v${response.data.version}`);
                return true;
            } else {
                console.log('❌ Root endpoint - FAILED', response.status);
                return false;
            }
        } catch (error) {
            console.log('❌ Root endpoint - FAILED (Connection error)');
            return false;
        }
    }

    async testAuthentication() {
        console.log('🔍 Testing authentication...');
        
        // First get default credentials
        try {
            const credsResponse = await this.makeRequest('/api/auth/credentials');
            if (credsResponse.status !== 200) {
                console.log('❌ Get credentials - FAILED', credsResponse.status);
                return false;
            }

            const credentials = credsResponse.data.credentials;
            console.log(`   Using credentials: ${credentials.username} / ${credentials.password}`);

            // Test login
            const loginResponse = await this.makeRequest('/api/auth/login', 'POST', {
                username: credentials.username,
                password: credentials.password
            });

            if (loginResponse.status === 200 && loginResponse.data.token) {
                this.token = loginResponse.data.token;
                console.log('✅ Authentication - PASSED');
                return true;
            } else {
                console.log('❌ Authentication - FAILED', loginResponse.status);
                return false;
            }
        } catch (error) {
            console.log('❌ Authentication - FAILED (Connection error)');
            return false;
        }
    }

    async testBuildStatus() {
        console.log('🔍 Testing build status...');
        try {
            const response = await this.makeRequest('/api/build/status');
            if (response.status === 200 && typeof response.data.status === 'object') {
                console.log('✅ Build status - PASSED');
                console.log(`   Is building: ${response.data.status.isBuilding}`);
                return true;
            } else {
                console.log('❌ Build status - FAILED', response.status);
                return false;
            }
        } catch (error) {
            console.log('❌ Build status - FAILED (Connection error)');
            return false;
        }
    }

    async testBuildHistory() {
        console.log('🔍 Testing build history...');
        try {
            const response = await this.makeRequest('/api/build/history');
            if (response.status === 200 && Array.isArray(response.data.data.builds)) {
                console.log('✅ Build history - PASSED');
                console.log(`   Total builds: ${response.data.data.builds.length}`);
                return true;
            } else {
                console.log('❌ Build history - FAILED', response.status);
                return false;
            }
        } catch (error) {
            console.log('❌ Build history - FAILED (Connection error)');
            return false;
        }
    }

    async testBuildStats() {
        console.log('🔍 Testing build statistics...');
        try {
            const response = await this.makeRequest('/api/build/stats');
            if (response.status === 200 && typeof response.data.data.total === 'number') {
                console.log('✅ Build stats - PASSED');
                console.log(`   Total builds: ${response.data.data.total}`);
                return true;
            } else {
                console.log('❌ Build stats - FAILED', response.status);
                return false;
            }
        } catch (error) {
            console.log('❌ Build stats - FAILED (Connection error)');
            return false;
        }
    }

    async testProtectedEndpoint() {
        if (!this.token) {
            console.log('⚠️  Skipping protected endpoint test (no token)');
            return false;
        }

        console.log('🔍 Testing protected endpoint (build status with auth)...');
        try {
            const response = await this.makeRequest('/api/build/status', 'GET', null, {
                'Authorization': `Bearer ${this.token}`
            });
            if (response.status === 200) {
                console.log('✅ Protected endpoint - PASSED');
                return true;
            } else {
                console.log('❌ Protected endpoint - FAILED', response.status);
                return false;
            }
        } catch (error) {
            console.log('❌ Protected endpoint - FAILED (Connection error)');
            return false;
        }
    }

    async checkConfiguration() {
        console.log('🔍 Checking configuration...');
        
        if (!fs.existsSync('.env')) {
            console.log('❌ .env file not found');
            return false;
        }

        console.log('✅ Configuration file exists');
        return true;
    }

    async runAllTests() {
        console.log('\n🧪 SVN Build & Deploy Service - Test Suite');
        console.log('='.repeat(50));

        const tests = [
            { name: 'Configuration Check', fn: () => this.checkConfiguration() },
            { name: 'Root Endpoint', fn: () => this.testRootEndpoint() },
            { name: 'Health Check', fn: () => this.testHealth() },
            { name: 'Authentication', fn: () => this.testAuthentication() },
            { name: 'Build Status', fn: () => this.testBuildStatus() },
            { name: 'Build History', fn: () => this.testBuildHistory() },
            { name: 'Build Statistics', fn: () => this.testBuildStats() },
            { name: 'Protected Endpoint', fn: () => this.testProtectedEndpoint() }
        ];

        let passed = 0;
        let failed = 0;

        for (const test of tests) {
            const result = await test.fn();
            if (result) {
                passed++;
            } else {
                failed++;
            }
            console.log(''); // Empty line between tests
        }

        console.log('='.repeat(50));
        console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
        
        if (failed === 0) {
            console.log('🎉 All tests passed! Service is working correctly.');
        } else {
            console.log('⚠️  Some tests failed. Check the service configuration and logs.');
        }

        console.log('\n💡 Tips:');
        console.log('• Make sure the service is running (npm start)');
        console.log('• Check the .env configuration file');
        console.log('• Verify SVN credentials and connectivity');
        console.log('• Check server logs for detailed error information');
        
        return failed === 0;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new ServiceTester();
    tester.runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = ServiceTester;