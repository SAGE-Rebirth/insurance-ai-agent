# InsureVoice AI Agent — Serverless AWS Deployment Guide

## Architecture at a Glance

```
User → CloudFront (HTTPS + CDN)
         ├── /* → S3 (React static files)
         └── /api/* → API Gateway HTTP API
                          ├── GET/POST/DELETE /sessions → Lambda (Sessions)
                          │       └── saves to MongoDB + enqueues SQS
                          ├── GET/POST/DELETE /policies → Lambda (Policies)
                          └── GET /health              → Lambda (Health)

SQS FIFO Queue → Lambda (Summary) → Gemini API → update MongoDB
```

---

## Step 1 — Prerequisites

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Configure AWS credentials
aws configure
# Enter: Access Key ID, Secret Key, Region (ap-south-1), output (json)

# Install AWS SAM CLI
pip install aws-sam-cli
# or: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

# Verify
sam --version
aws sts get-caller-identity   # Should show your AWS account
```

---

## Step 2 — MongoDB Atlas Setup

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → Create **M0 free cluster**
2. **Database Access** → Add user → `insurevoice-user` + strong password
3. **Network Access** → Add IP `0.0.0.0/0` (Lambda egress IPs are dynamic)
4. **Connect** → Copy connection string:
   ```
   mongodb+srv://insurevoice-user:PASSWORD@cluster0.xxxxx.mongodb.net/insurevoice
   ```

---

## Step 3 — ElastiCache Serverless (Redis)

```bash
# Create via AWS Console: ElastiCache → Serverless caches → Create
# Name: insurevoice-cache
# Engine: Redis OSS 7

# OR via CLI:
aws elasticache create-serverless-cache \
  --serverless-cache-name insurevoice-cache \
  --engine redis \
  --major-engine-version 7

# Get endpoint:
aws elasticache describe-serverless-caches \
  --serverless-cache-name insurevoice-cache \
  --query 'ServerlessCaches[0].Endpoint.Address'
```

> **Note**: ElastiCache Serverless is public internet accessible. Use the TLS endpoint format:
> `rediss://insurevoice-cache.xxx.serverless.euc1.cache.amazonaws.com:6379`

---

## Step 4 — Secrets Manager

```bash
aws secretsmanager create-secret \
  --name insurevoice/production \
  --secret-string '{
    "MONGODB_URI": "mongodb+srv://insurevoice-user:PASSWORD@cluster0.xxxxx.mongodb.net/insurevoice",
    "REDIS_URL": "rediss://insurevoice-cache.xxx.serverless.cache.amazonaws.com:6379",
    "GEMINI_API_KEY": "AIzaSy..."
  }'
```

---

## Step 5 — Deploy Backend (SAM)

```bash
# Install Lambda dependencies
cd lambda && npm install && cd ..

# Build all Lambda functions (TypeScript → JS via esbuild)
sam build

# First deploy (interactive guided setup)
sam deploy --guided
# It will ask:
#   Stack name: insurevoice-prod
#   Region: ap-south-1
#   Stage: prod
#   SecretName: insurevoice/production
#   FrontendBucketName: insurevoice-frontend-prod

# After guided deploy, subsequent deploys use samconfig.toml:
sam deploy
```

**SAM will output:**
```
CloudFrontUrl   = https://d1xyz.cloudfront.net  ← Your app URL
ApiEndpoint     = https://abc123.execute-api.ap-south-1.amazonaws.com/prod
FrontendBucket  = insurevoice-frontend-prod
SummaryQueueUrl = https://sqs.ap-south-1.amazonaws.com/...
```

---

## Step 6 — Deploy Frontend (S3 + CloudFront)

```bash
# Build React app (use the API Gateway endpoint from SAM output above)
# The frontend calls /api/* which CloudFront proxies — no env var needed

VITE_API_KEY=your_gemini_key npm run build

# Upload to S3
aws s3 sync dist/ s3://insurevoice-frontend-prod --delete

# Invalidate CloudFront cache (so users get the new build)
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name insurevoice-prod \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

---

## Step 7 — Custom Domain (Optional)

```bash
# 1. Request SSL cert in ACM (must be us-east-1 for CloudFront)
aws acm request-certificate \
  --domain-name insurevoice.yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# 2. Add the CNAME DNS record shown in ACM console to your DNS provider

# 3. Update template.yaml CloudFront distribution:
#    Add: Aliases: [insurevoice.yourdomain.com]
#          ViewerCertificate: { AcmCertificateArn: arn:..., SslSupportMethod: sni-only }

# 4. Redeploy: sam deploy
```

---

## CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1

      - name: Build & Deploy Backend
        run: |
          cd lambda && npm ci && cd ..
          sam build && sam deploy --no-confirm-changeset

      - name: Build & Deploy Frontend
        env:
          VITE_API_KEY: ${{ secrets.VITE_API_KEY }}
        run: |
          npm ci && npm run build
          aws s3 sync dist/ s3://insurevoice-frontend-prod --delete
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} \
            --paths "/*"
```

---

## Useful Commands

```bash
# View Lambda logs (tail)
sam logs -n SessionsFunction --stack-name insurevoice-prod --tail

# Test locally (requires Docker)
sam local start-api --port 5000
curl http://localhost:5000/health

# Check SQS Dead-Letter Queue (failed summaries)
aws sqs get-queue-attributes \
  --queue-url YOUR_DLQ_URL \
  --attribute-names ApproximateNumberOfMessages

# Re-drive DLQ messages back to main queue
aws sqs start-message-move-task \
  --source-arn YOUR_DLQ_ARN

# Lambda cost estimate
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-02-01 \
  --granularity MONTHLY \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["AWS Lambda"]}}'
```
