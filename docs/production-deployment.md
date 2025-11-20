# Production Deployment Guide

This comprehensive guide covers deploying the CDP automation system to production environments, including security considerations, scaling strategies, and monitoring.

## Overview

Production deployment requires careful consideration of:

- **Security** - Protecting API keys, credentials, and automation scripts
- **Scalability** - Handling multiple concurrent automation sessions
- **Reliability** - Ensuring high uptime and error recovery
- **Monitoring** - Comprehensive logging and alerting
- **Compliance** - Meeting regulatory and legal requirements

## Architecture

### Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                        │
│         ┌─────────────┬─────────────┐                │
│         │               │               │                │
│    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐        │
│    │  App     │   │  App     │   │  App     │        │
│    │  Server 1│   │  Server 2│   │  Server N│        │
│    └─────┬───┘   └─────┬───┘   └─────┬───┘        │
│            │               │               │                │
│      ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐        │
│      │  Database    │ │  Cache      │ │  Message   │        │
│      │  Cluster     │ │  Layer      │ │  Queue     │        │
│      └─────────────┘ └─────────────┘ └─────────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Chrome    │    │   Chrome    │    │   Chrome    │
│   Instance  │    │   Instance  │    │   Instance  │
│   Pool     │    │   Pool     │    │   Pool     │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Components

1. **Application Servers** - Node.js MCP servers with load balancing
2. **Database Cluster** - PostgreSQL for session storage and analytics
3. **Cache Layer** - Redis for session caching and performance
4. **Message Queue** - RabbitMQ for task distribution
5. **Monitoring Stack** - Prometheus, Grafana, and ELK
6. **Security Layer** - API gateway, authentication, and rate limiting

## Security Configuration

### API Security

#### Authentication

```yaml
# docker-compose.yml - Security Configuration
version: '3.8'

services:
  api-gateway:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    environment:
      - SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
      - SSL_KEY_PATH=/etc/nginx/ssl/key.pem
    depends_on:
      - app-server

  app-server:
    image: cdp-automation:production
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - API_RATE_LIMIT=${API_RATE_LIMIT}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    volumes:
      - ./logs:/app/logs
      - ./sessions:/app/sessions
    depends_on:
      - redis
      - postgres
```

#### Rate Limiting

```javascript
// config/rate-limiting.js
module.exports = {
  // Global rate limits
  global: {
    requestsPerSecond: 100,
    burstLimit: 500,
    windowSizeMs: 60000
  },
  
  // Per-user rate limits
  perUser: {
    requestsPerSecond: 10,
    burstLimit: 50,
    windowSizeMs: 60000
  },
  
  // Per-IP rate limits
  perIP: {
    requestsPerSecond: 20,
    burstLimit: 100,
    windowSizeMs: 60000
  },
  
  // Tool-specific limits
  tools: {
    'capture-and-analyze': {
      requestsPerSecond: 2,
      burstLimit: 10
    },
    'execute-optimally': {
      requestsPerSecond: 5,
      burstLimit: 25
    },
    'record-session': {
      requestsPerSecond: 3,
      burstLimit: 15
    },
    'replay-automation': {
      requestsPerSecond: 3,
      burstLimit: 15
    }
  }
};
```

#### Encryption

```javascript
// config/encryption.js
const crypto = require('crypto');

class SecurityConfig {
  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
  }
  
  encryptSensitiveData(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex')
    };
  }
  
  decryptSensitiveData(encryptedData) {
    const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    decipher.setAAD(Buffer.from(''));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
}

module.exports = SecurityConfig;
```

### Infrastructure Security

#### Network Security

```yaml
# docker-compose.yml - Network Security
networks:
  frontend:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
        gateway: 172.20.0.1
  
  backend:
    driver: bridge
    internal: true
    ipam:
      config:
        - subnet: 172.21.0.0/16

services:
  app-server:
    networks:
      - backend
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    security_opt:
      - no-new-privileges:true
      - seccomp:unconfined
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
```

#### Container Security

```dockerfile
# Dockerfile - Security Hardening
FROM node:20-alpine AS builder

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY --chown=nodejs:nodejs . .

# Security hardening
RUN apk add --no-cache dumb-init && \
    chown -R nodejs:nodejs /app && \
    chmod -R 755 /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Expose port (only to internal network)
EXPOSE 8080

# Run with dumb-init
ENTRYPOINT ["dumb-init", "--", "node", "dist/server.js"]
```

## Scaling Configuration

### Horizontal Scaling

#### Docker Swarm

```yaml
# docker-stack.yml
version: '3.8'

services:
  app:
    image: cdp-automation:production
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        monitor: 30s
        max_failure_ratio: 0.3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    networks:
      - backend
```

#### Kubernetes

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cdp-automation
spec:
  replicas: 5
  selector:
    matchLabels:
      app: cdp-automation
  template:
    metadata:
      labels:
        app: cdp-automation
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: app
        image: cdp-automation:production
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: cdp-automation-service
spec:
  selector:
    app: cdp-automation
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: LoadBalancer
```

### Load Balancing

#### Nginx Configuration

```nginx
# nginx/nginx.conf
upstream app_servers {
    least_conn;
    server app1:8080 max_fails=3 fail_timeout=30s;
    server app2:8080 max_fails=3 fail_timeout=30s;
    server app3:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5:!3DES;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    add_header Content-Security-Policy "default-src 'self'";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    location /api/ {
        limit_req zone=api;
        proxy_pass http://app_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    location /health {
        proxy_pass http://app_servers;
        access_log off;
    }
    
    # Block sensitive endpoints
    location ~ ^/api/(admin|debug|config) {
        deny all;
        return 403;
    }
}
```

## Database Configuration

### PostgreSQL Setup

```sql
-- database/schema.sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table with encryption
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE,
    encrypted_data BYTEA,
    created_at TIMESTAMP WITH TIME Z DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME Z DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME Z,
    is_active BOOLEAN DEFAULT TRUE
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_data JSONB,
    encrypted_credentials BYTEA,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME Z DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME Z,
    last_accessed TIMESTAMP WITH TIME Z
);

-- Automation tasks table
CREATE TABLE automation_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,
    task_data JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    result JSONB,
    created_at TIMESTAMP WITH TIME Z DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME Z,
    completed_at TIMESTAMP WITH TIME Z,
    error_message TEXT
);

-- Performance metrics
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME Z DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_tasks_user_id ON automation_tasks(user_id);
CREATE INDEX idx_tasks_status ON automation_tasks(status);
CREATE INDEX idx_metrics_session_id ON performance_metrics(session_id);
CREATE INDEX idx_metrics_timestamp ON performance_metrics(timestamp);
```

### Database Connection Pool

```javascript
// config/database.js
const { Pool } = require('pg');

class DatabaseConfig {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'cdp_automation',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20, // Maximum number of connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    });
  }
  
  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      return result;
    } finally {
      const duration = Date.now() - start;
      this.logQueryPerformance(text, duration);
    }
  }
  
  logQueryPerformance(query, duration) {
    // Log slow queries for optimization
    if (duration > 1000) { // Queries taking > 1s
      console.warn(`Slow query detected: ${duration}ms - ${query}`);
    }
  }
}

module.exports = DatabaseConfig;
```

## Monitoring & Logging

### Prometheus Metrics

```javascript
// monitoring/prometheus.js
const client = require('prom-client');

const prometheus = {
  // Request metrics
  httpRequestsTotal: new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  }),
  
  httpRequestDuration: new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.5, 1, 2, 5, 10]
  }),
  
  // Application metrics
  activeSessions: new client.Gauge({
    name: 'active_sessions_total',
    help: 'Number of currently active automation sessions'
  }),
  
  automationTasksTotal: new client.Counter({
    name: 'automation_tasks_total',
    help: 'Total number of automation tasks',
    labelNames: ['task_type', 'status']
  }),
  
  // System metrics
  memoryUsage: new client.Gauge({
    name: 'memory_usage_bytes',
    help: 'Memory usage in bytes'
  }),
  
  cpuUsage: new client.Gauge({
    name: 'cpu_usage_percent',
    help: 'CPU usage percentage'
  })
};

// Export metrics for Prometheus scraping
module.exports = prometheus;
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "CDP Automation Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_seconds)",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Active Sessions",
        "type": "singlestat",
        "targets": [
          {
            "expr": "active_sessions_total"
          }
        ]
      },
      {
        "title": "Task Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(automation_tasks_total{status=\"success\"}[5m]) / rate(automation_tasks_total[5m])",
            "legendFormat": "Success Rate"
          }
        ]
      }
    ]
  }
}
```

### ELK Stack

```yaml
# docker-compose.elk.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./logstash/pipeline.yml:/usr/share/logstash/pipeline.yml
      - ./logs:/var/log/app
    ports:
      - "5044:5044"
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

## Performance Optimization

### Caching Strategy

```javascript
// config/cache.js
const Redis = require('redis');

class CacheConfig {
  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
  }
  
  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  async set(key, value, ttl = 3600) {
    try {
      await this.client.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }
  
  async invalidate(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return keys.length;
    } catch (error) {
      console.error('Cache invalidate error:', error);
      return 0;
    }
  }
}

module.exports = CacheConfig;
```

### Session Management

```javascript
// config/session-manager.js
class SessionManager {
  constructor(cache, database) {
    this.cache = cache;
    this.database = database;
    this.maxSessions = 1000;
    this.sessionTimeout = 3600000; // 1 hour
  }
  
  async createSession(userId, sessionData) {
    const sessionId = require('uuid').v4();
    
    // Store in cache for fast access
    await this.cache.set(`session:${sessionId}`, {
      userId,
      data: sessionData,
      createdAt: Date.now()
    }, this.sessionTimeout);
    
    // Store in database for persistence
    await this.database.query(
      'INSERT INTO sessions (id, user_id, session_data, status, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [sessionId, userId, JSON.stringify(sessionData), 'active', new Date(Date.now() + this.sessionTimeout)]
    );
    
    return sessionId;
  }
  
  async getSession(sessionId) {
    // Try cache first
    let session = await this.cache.get(`session:${sessionId}`);
    
    if (!session) {
      // Fallback to database
      const result = await this.database.query(
        'SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()',
        [sessionId]
      );
      
      if (result.rows.length > 0) {
        session = {
          userId: result.rows[0].user_id,
          data: JSON.parse(result.rows[0].session_data),
          createdAt: new Date(result.rows[0].created_at)
        };
        
        // Cache for future requests
        await this.cache.set(`session:${sessionId}`, session, this.sessionTimeout);
      }
    }
    
    return session;
  }
  
  async cleanupExpiredSessions() {
    // Clean up expired sessions
    await this.database.query(
      'DELETE FROM sessions WHERE expires_at < NOW()'
    );
    
    // Clean up cache entries
    const deletedCount = await this.cache.invalidate('session:*');
    
    console.log(`Cleaned up ${deletedCount} expired sessions`);
  }
}

module.exports = SessionManager;
```

## Deployment Strategies

### Blue-Green Deployment

```bash
#!/bin/bash
# deploy.sh

set -e

CURRENT_ENVIRONMENT=$(curl -s http://load-balancer/health | jq -r '.environment')
NEW_VERSION=$1

if [ "$CURRENT_ENVIRONMENT" = "blue" ]; then
    TARGET_ENVIRONMENT="green"
else
    TARGET_ENVIRONMENT="blue"
fi

echo "🚀 Deploying version $NEW_VERSION to $TARGET_ENVIRONMENT"

# Build new version
docker build -t cdp-automation:$NEW_VERSION .

# Deploy to target environment
docker-compose -f docker-compose.$TARGET_ENVIRONMENT.yml up -d

# Health check
echo "⏳ Waiting for deployment to be healthy..."
for i in {1..30}; do
    if curl -f http://$TARGET_ENVIRONMENT.cdp-automation.local/health; then
        echo "✅ Deployment healthy after ${i} checks"
        
        # Switch load balancer
        curl -X POST http://load-balancer/switch \
          -H "Content-Type: application/json" \
          -d "{\"environment\": \"$TARGET_ENVIRONMENT\"}"
        
        echo "🎉 Deployment complete!"
        exit 0
    fi
    
    sleep 10
done

echo "❌ Deployment failed to become healthy"
exit 1
```

### Rolling Update

```yaml
# k8s-rolling-update.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cdp-automation
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
      progressDeadlineSeconds: 600
  template:
    spec:
      containers:
      - name: app
        image: cdp-automation:latest
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 3
          successThreshold: 3
          failureThreshold: 3
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
```

## Backup & Recovery

### Database Backup

```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/backups/database/$(date +%Y%m%d_%H%M%S)"
DB_NAME="cdp_automation"

echo "🗄️ Creating database backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
pg_dump -h localhost -U postgres -d "$DB_NAME" \
  --format=custom \
  --file="$BACKUP_DIR/database_backup.sql" \
  --verbose

# Compress backup
gzip "$BACKUP_DIR/database_backup.sql"

echo "✅ Database backup completed: $BACKUP_DIR/database_backup.sql.gz"

# Cleanup old backups (keep last 7 days)
find /backups/database -type d -mtime +7 -exec rm -rf {} \;
```

### Session Backup

```bash
#!/bin/bash
# backup-sessions.sh

BACKUP_DIR="/backups/sessions/$(date +%Y%m%d_%H%M%S)"

echo "📦 Creating session backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup active sessions
docker exec cdp-automation_app_1 \
  tar -czf "$BACKUP_DIR/sessions.tar.gz" /app/sessions

echo "✅ Session backup completed: $BACKUP_DIR/sessions.tar.gz"
```

### Disaster Recovery

```bash
#!/bin/bash
# disaster-recovery.sh

echo "🚨 Starting disaster recovery..."

# Stop current services
docker-compose down

# Restore from latest backup
LATEST_DB_BACKUP=$(ls -t /backups/database/ | head -n1)
LATEST_SESSION_BACKUP=$(ls -t /backups/sessions/ | head -n1)

echo "📂 Restoring database: $LATEST_DB_BACKUP"
gunzip -c "/backups/database/$LATEST_DB_BACKUP" | \
  psql -h localhost -U postgres -d cdp_automation

echo "📂 Restoring sessions: $LATEST_SESSION_BACKUP"
tar -xzf "/backups/sessions/$LATEST_SESSION_BACKUP" -C /

# Start services
docker-compose up -d

echo "✅ Disaster recovery completed"
```

## Security Checklist

### Pre-Deployment

- [ ] **API Keys**: All API keys rotated and stored securely
- [ ] **SSL Certificates**: Valid certificates installed
- [ ] **Firewall Rules**: Only necessary ports open
- [ ] **User Permissions**: Non-root user configured
- [ ] **Resource Limits**: CPU/memory limits configured
- [ ] **Monitoring**: All monitoring tools configured
- [ ] **Backup Strategy**: Automated backups configured
- [ ] **Access Control**: RBAC policies implemented
- [ ] **Audit Logging**: Comprehensive audit trail enabled

### Post-Deployment

- [ ] **Health Checks**: All endpoints responding correctly
- [ ] **Load Testing**: Performance under load verified
- [ ] **Security Scans**: Vulnerability scans completed
- [ ] **Monitoring Alerts**: Alerting configured and tested
- [ ] **Backup Verification**: Backups working correctly
- [ ] **Documentation**: Deployment documented
- [ ] **Rollback Plan**: Rollback procedures tested

## Troubleshooting

### Common Production Issues

#### 1. High Memory Usage

```bash
# Check memory usage
docker stats cdp-automation_app --no-stream

# Identify memory leaks
docker exec cdp-automation_app node --inspect=0.0.0.0:9229 app.js

# Optimize Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### 2. Database Connection Issues

```bash
# Check database connectivity
docker exec cdp-automation_app npm run db:test

# Monitor database performance
docker exec postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"

# Restart database if needed
docker-compose restart postgres
```

#### 3. Chrome Instance Failures

```bash
# Check Chrome processes
ps aux | grep chrome

# Monitor Chrome crashes
docker logs cdp-automation_app | grep -i "chrome\|crash\|error"

# Restart Chrome pool
docker-compose restart chrome-pool
```

## References

- [Production Deployment Best Practices](https://12factor.net/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/security/)
- [Kubernetes Security](https://kubernetes.io/docs/concepts/security/)
- [Nginx Security](https://www.nginx.com/resources/admin-guide/security.html)
- [Prometheus Monitoring](https://prometheus.io/docs/practices/)
- [PostgreSQL Performance](https://www.postgresql.org/docs/performance/)