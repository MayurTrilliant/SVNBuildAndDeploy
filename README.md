# SVN Build & Deploy Service

A comprehensive Node.js service for automated SVN code fetching, building, and deployment with authentication, build history tracking, and RESTful API.

## Features

- 🔄 **Automated SVN Integration**: Fetch latest code from SVN repository
- 🏗️ **Multi-Platform Build Support**: Supports .NET, Node.js, Maven, Gradle projects
- 🚀 **Automated Deployment**: Deploy built code to specified target path
- 📊 **Build History Tracking**: SQLite database for comprehensive build history
- 🔐 **Authentication**: JWT-based authentication system
- 🌐 **RESTful API**: Complete REST API for all operations
- 📈 **Build Statistics**: Track success rates, duration, and performance
- 🛡️ **Error Handling**: Comprehensive error handling and logging
- 🔧 **Configurable**: Environment-based configuration

## Quick Start

### Prerequisites

- Node.js 14.x or higher
- SVN client installed on the system
- Access to SVN repository
- Build tools for your project type (.NET SDK, Node.js, Maven, etc.)

### Installation

1. **Clone or download the project files**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables** (see `.env` file):
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=production

   # SVN Configuration
   SVN_URL=https://datavault.trilliant.com:8443/svn/RadiantHR/trunk
   SVN_USERNAME=mayur
   SVN_PASSWORD=Shwetya@123

   # Deployment Configuration
   DEPLOY_PATH=\\DATAVAULT\wwwroot\Test_WebSite
   WORKING_DIR=./temp_workspace

   # Authentication
   JWT_SECRET=your_jwt_secret_key_here_change_in_production
   DEFAULT_USERNAME=admin
   DEFAULT_PASSWORD=admin123

   # Database
   DB_PATH=./build_history.db
   ```

4. **Start the service**:
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

## API Documentation

### Base URL
```
http://localhost:3000
```

### Authentication

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

#### Get Default Credentials
```http
GET /api/auth/credentials
```

### Build Operations

#### Trigger Build (Protected)
```http
POST /api/build/trigger
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Build process started",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "triggeredBy": "admin"
}
```

#### Get Build Status
```http
GET /api/build/status
```

**Response:**
```json
{
  "success": true,
  "status": {
    "isBuilding": true,
    "activeBuildId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Get Build History
```http
GET /api/build/history?page=1&limit=20&status=completed
```

**Response:**
```json
{
  "success": true,
  "data": {
    "builds": [
      {
        "id": 1,
        "build_id": "550e8400-e29b-41d4-a716-446655440000",
        "started_at": "2024-01-15T10:30:00.000Z",
        "completed_at": "2024-01-15T10:35:00.000Z",
        "status": "completed",
        "project_type": "dotnet",
        "duration": 300000,
        "triggered_by": "admin"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

#### Get Build Details
```http
GET /api/build/details/:buildId
```

#### Get Build Statistics
```http
GET /api/build/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 10,
    "completed": 8,
    "failed": 2,
    "running": 0,
    "avgDuration": 285000,
    "avgDurationFormatted": "4m 45s"
  }
}
```

#### Cancel Active Build (Protected)
```http
POST /api/build/cancel
Authorization: Bearer <your-jwt-token>
```

#### Health Check
```http
GET /api/build/health
```

## Project Structure

```
svn-build-deploy/
├── controllers/
│   ├── authController.js      # Authentication endpoints
│   └── buildController.js     # Build operation endpoints
├── middleware/
│   └── auth.js               # JWT authentication middleware
├── routes/
│   ├── authRoutes.js         # Authentication routes
│   └── buildRoutes.js        # Build operation routes
├── services/
│   ├── svnService.js         # SVN operations
│   ├── buildService.js       # Build logic
│   ├── deployService.js      # Deployment logic
│   ├── historyService.js     # Database operations
│   └── buildOrchestrator.js  # Main orchestrator
├── .env                      # Environment configuration
├── package.json              # Dependencies and scripts
├── server.js                 # Main server file
└── README.md                 # This file
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `SVN_URL` | SVN repository URL | Required |
| `SVN_USERNAME` | SVN username | Required |
| `SVN_PASSWORD` | SVN password | Required |
| `DEPLOY_PATH` | Deployment target path | Required |
| `WORKING_DIR` | Temporary workspace | `./temp_workspace` |
| `JWT_SECRET` | JWT signing secret | Required |
| `DEFAULT_USERNAME` | Default login username | `admin` |
| `DEFAULT_PASSWORD` | Default login password | `admin123` |
| `DB_PATH` | SQLite database path | `./build_history.db` |

### Supported Project Types

The service automatically detects and builds different project types:

1. **ASP.NET / .NET Core**: Detects `.sln`, `.csproj`, `.vbproj` files
2. **Node.js**: Detects `package.json`
3. **Maven**: Detects `pom.xml`
4. **Gradle**: Detects `build.gradle` or `build.gradle.kts`
5. **Generic**: Copies files as-is for other project types

## Security Considerations

### Default Credentials
- **Default Username**: `admin`
- **Default Password**: `admin123`
- **⚠️ IMPORTANT**: Change these credentials in production!

### JWT Security
- Change the `JWT_SECRET` in production
- Tokens expire after 24 hours
- Use HTTPS in production

### SVN Credentials
- SVN credentials are stored in environment variables
- Consider using encrypted storage for sensitive environments

## Build Process Flow

1. **Authentication**: Verify user credentials (for protected endpoints)
2. **SVN Info**: Get repository information and current revision
3. **SVN Checkout**: Fetch latest code from SVN repository
4. **Project Detection**: Automatically detect project type
5. **Build**: Execute appropriate build commands
6. **Deploy**: Copy built artifacts to deployment path
7. **History**: Record build details and logs in database
8. **Cleanup**: Remove temporary files

## Database Schema

### Builds Table
```sql
CREATE TABLE builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id TEXT UNIQUE NOT NULL,
    started_at DATETIME NOT NULL,
    completed_at DATETIME,
    status TEXT NOT NULL,
    project_type TEXT,
    svn_revision TEXT,
    svn_info TEXT,
    build_logs TEXT,
    deploy_logs TEXT,
    error_message TEXT,
    duration INTEGER,
    triggered_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Build Steps Table
```sql
CREATE TABLE build_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id TEXT NOT NULL,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at DATETIME NOT NULL,
    completed_at DATETIME,
    logs TEXT,
    error_message TEXT,
    duration INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (build_id) REFERENCES builds (build_id)
);
```

## Monitoring and Logging

### Health Check
The service provides a health check endpoint at `/api/build/health` that returns:
- System status
- Current build status
- Memory usage
- Uptime
- Version information

### Logging
- All requests are logged with timestamps
- Build operations include detailed step-by-step logs
- Error handling with stack traces in development mode

## Troubleshooting

### Common Issues

1. **SVN Connection Issues**
   - Verify SVN URL, username, and password
   - Check network connectivity
   - Ensure SVN client is installed

2. **Build Failures**
   - Check if required build tools are installed
   - Verify project structure and dependencies
   - Review build logs in build history

3. **Deployment Issues**
   - Ensure deployment path exists and is writable
   - Check file permissions
   - Verify network access to deployment location

4. **Authentication Issues**
   - Verify JWT secret is set
   - Check token expiration
   - Ensure correct username/password

### Log Locations
- Application logs: Console output
- Build history: SQLite database (`./build_history.db`)
- Build artifacts: Temporary workspace (`./temp_workspace`)

## Development

### Running in Development Mode
```bash
npm run dev
```

### Adding New Project Types
1. Extend `buildService.js` with new detection logic
2. Add build commands for the new project type
3. Update deployment logic if needed

### Extending Authentication
- Modify `authMiddleware.js` for additional authentication methods
- Update user management in `authController.js`

## Production Deployment

### Security Checklist
- [ ] Change default username and password
- [ ] Set strong JWT secret
- [ ] Use HTTPS
- [ ] Secure SVN credentials
- [ ] Configure proper file permissions
- [ ] Set up monitoring and logging
- [ ] Configure backups for build history database

### Performance Considerations
- Monitor disk space for temporary workspace
- Consider cleanup policies for old builds
- Implement build queuing for high-load scenarios
- Monitor memory usage during builds

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review application logs
3. Verify configuration settings
4. Check build history for error details

## License

MIT License - See project files for details.