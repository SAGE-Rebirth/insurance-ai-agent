# 🚀 InsureVoice AI Agent — Complete AWS Deployment Guide
> **For absolute beginners.** This guide walks you through every single step, from creating an AWS account to having your app live on the internet. Take it one step at a time.

---

## 📐 What We Are Building

```
Your Users
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  CloudFront (HTTPS CDN — your public URL)                   │
│       ├── /* →  S3 Bucket (React frontend files)            │
│       └── /api/* → API Gateway (routes to Lambda)           │
│                        ├── /api/sessions  → Lambda          │
│                        ├── /api/policies  → Lambda          │
│                        └── /health        → Lambda          │
└─────────────────────────────────────────────────────────────┘
         │                       │
         ▼                       ▼
   MongoDB Atlas            ElastiCache Redis
   (stores sessions         (caching layer —
    and policies)            fast reads)
         │
         ▼
   SQS FIFO Queue → Lambda (Summary) → Gemini AI API
   (async AI summaries generated in background)
```

**Services used:**
| Service | What it does | Cost |
|---------|-------------|------|
| AWS Lambda | Runs your backend code | Pay per request (~free at low volume) |
| API Gateway | Public HTTP endpoints | ~$1 per million requests |
| S3 | Stores your React app files | ~$0.023/GB |
| CloudFront | CDN + HTTPS for your app | ~$0.01 per 10k requests |
| SQS | Message queue for async AI jobs | Free tier: 1M requests/month |
| ElastiCache | Redis caching | ~$0.002/GB/hour |
| Secrets Manager | Stores API keys securely | $0.40/secret/month |
| MongoDB Atlas | Database (external, free tier) | Free M0 cluster |

---

## 🗺️ Overview of Steps

1. [Create AWS Account & IAM User](#step-1--create-aws-account--iam-user)
2. [Install Tools on Your Computer](#step-2--install-tools-on-your-computer)
3. [Set Up MongoDB Atlas (Database)](#step-3--set-up-mongodb-atlas-database)
4. [Set Up ElastiCache Redis (Cache)](#step-4--set-up-elasticache-serverless-redis)
5. [Store Secrets in AWS Secrets Manager](#step-5--store-secrets-in-aws-secrets-manager)
6. [Build & Deploy Lambda + API Gateway (SAM)](#step-6--build--deploy-backend-with-aws-sam)
7. [Build & Deploy React Frontend to S3](#step-7--build--deploy-react-frontend)
8. [Verify Everything is Working](#step-8--verify-everything-works)
9. [Useful Maintenance Commands](#step-9--useful-maintenance-commands)
10. [Optional: Custom Domain](#step-10--optional-custom-domain)
11. [Optional: GitHub Actions CI/CD](#step-11--optional-cicd-with-github-actions)

---

## Step 1 — Create AWS Account & IAM User

> Skip this step if you already have an AWS account and access keys.

### 1a. Create AWS Account
1. Go to [aws.amazon.com](https://aws.amazon.com) → click **"Create an AWS Account"**
2. Enter your email, choose a root account password
3. Fill in your payment info (you won't be charged for free-tier usage)
4. Choose **Basic Support** (free)
5. Log in to the [AWS Console](https://console.aws.amazon.com)

### 1b. Create an IAM User (never use root account for deployments)
1. In the AWS Console search bar, type **IAM** → open it
2. Click **Users** in the left sidebar → **Create user**
3. Username: `insurevoice-deployer`
4. Click **Next** → select **Attach policies directly**
5. Search and attach these policies:
   - `AdministratorAccess` *(simplest for first deployment — you can tighten later)*
6. Click **Create user**
7. Click on the new user → **Security credentials** tab → **Create access key**
8. Choose **CLI** use case → click through → **Download CSV** (save this file!)

> ⚠️ **IMPORTANT**: Save your Access Key ID and Secret Access Key — you only see the secret once!

---

## Step 2 — Install Tools on Your Computer

> Do this in **WSL** (Windows Subsystem for Linux) or your terminal.

### 2a. Install Node.js (v20+)
```bash
# In WSL:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify:
node -v   # should show v20.x.x
npm -v    # should show 10.x.x
```

### 2b. Install AWS CLI
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify:
aws --version
```

### 2c. Install AWS SAM CLI
```bash
# Option 1 — pip (if you have Python):
pip3 install aws-sam-cli

# Option 2 — direct download:
curl -Lo aws-sam-cli.zip https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip
unzip aws-sam-cli.zip -d sam-installation
sudo ./sam-installation/install

# Verify:
sam --version   # should show SAM CLI 1.x.x
```

### 2d. Install Docker Desktop (required for local Lambda testing)
1. Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. Install it and restart your computer
3. Open Docker Desktop → Settings → **Resources → WSL Integration** → toggle ON your WSL distro
4. In WSL, verify: `docker --version`

### 2e. Configure AWS credentials
```bash
aws configure
```
When prompted, enter:
```
AWS Access Key ID:     AKIA...  (from your CSV downloaded in Step 1b)
AWS Secret Access Key: xxxxxxx  (from your CSV)
Default region name:  ap-south-1
Default output format: json
```

Test it works:
```bash
aws sts get-caller-identity
# Should print your account ID and user ARN — if it does, you're connected!
```

---

## Step 3 — Set Up MongoDB Atlas (Database)

MongoDB Atlas is a free cloud database. Your Lambda functions store sessions and policies here.

### 3a. Create a free cluster
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → **Sign up** (free)
2. Click **Create a deployment** → choose **M0 Free** (the free tier)
3. Cloud provider: **AWS** | Region: **Mumbai (ap-south-1)** → **Create Deployment**

### 3b. Create a database user
1. In the left sidebar → **Database Access** → **Add New Database User**
2. Username: `insurevoice-user`
3. Password: click **Autogenerate Secure Password** → **Copy** the password and save it
4. Under **Database User Privileges** → select **Read and write to any database**
5. Click **Add User**

### 3c. Allow network access (Lambda IPs are dynamic, so allow all)
1. In the left sidebar → **Network Access** → **Add IP Address**
2. Click **Allow Access from Anywhere** (adds `0.0.0.0/0`)
3. Click **Confirm**

### 3d. Get your connection string
1. In the left sidebar → **Database** → click **Connect** on your cluster
2. Choose **Drivers** → select **Node.js**
3. Copy the connection string — it looks like:
   ```
   mongodb+srv://insurevoice-user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with the password you saved, and add the database name:
   ```
   mongodb+srv://insurevoice-user:YourPassword@cluster0.xxxxx.mongodb.net/insurevoice?retryWrites=true&w=majority
   ```
5. **Save this URI** — you'll need it in Step 5.

---

## Step 4 — Set Up ElastiCache Serverless (Redis)

Redis is used to cache API responses so your app is fast and MongoDB isn't hit on every request.

### 4a. Create a serverless cache via AWS Console
1. Go to [AWS Console](https://console.aws.amazon.com) → search **ElastiCache** → open it
2. In the left sidebar → **Serverless caches** → **Create serverless cache**
3. Fill in:
   - **Cache name**: `insurevoice-cache`
   - **Engine**: Redis OSS
   - **Major engine version**: 7
4. Leave everything else as default → click **Create**
5. Wait ~2 minutes for status to become **Available**

### 4b. Get the Redis endpoint
1. Click on `insurevoice-cache` → look for **Endpoint**
2. It will look like:
   ```
   insurevoice-cache.xxxxxx.serverless.apso1.cache.amazonaws.com:6379
   ```
3. Your Redis URL (with TLS, required): 
   ```
   rediss://insurevoice-cache.xxxxxx.serverless.apso1.cache.amazonaws.com:6379
   ```
   *(note the double `ss` in `rediss://` — that means TLS/SSL)*
4. **Save this URL** — you'll need it in Step 5.

---

## Step 5 — Store Secrets in AWS Secrets Manager

Never put database passwords or API keys directly in code. Secrets Manager stores them securely, and your Lambda functions fetch them at runtime.

### 5a. Open Secrets Manager
1. Go to [AWS Console](https://console.aws.amazon.com) → search **Secrets Manager**
2. Click **Store a new secret**

### 5b. Create the secret
1. **Secret type**: Other type of secret
2. **Key/value pairs** — add these 3 keys:

   | Key | Value |
   |-----|-------|
   | `MONGODB_URI` | Your MongoDB connection string from Step 3d |
   | `REDIS_URL` | Your Redis URL from Step 4b |
   | `GEMINI_API_KEY` | Your Gemini API key (from [aistudio.google.com](https://aistudio.google.com/apikey)) |

3. Click **Next**
4. **Secret name**: `insurevoice/production` *(must exactly match this — it's in template.yaml)*
5. Click through → **Store**

### 5c. Verify via CLI
```bash
aws secretsmanager get-secret-value --secret-id insurevoice/production
# Should print your JSON with all 3 keys
```

---

## Step 6 — Build & Deploy Backend with AWS SAM

AWS SAM deploys your Lambda functions, API Gateway, SQS queues, and CloudFront — all from `template.yaml`.

### 6a. Navigate to your project
```bash
# In WSL, Windows paths are under /mnt/c/
cd /mnt/c/Users/ASUS/Desktop/Puskpako2/insurance-ai-agent
```

### 6b. Install Lambda dependencies
```bash
cd lambda
npm install
cd ..
```

### 6c. Build all Lambda functions
```bash
sam build
```
This compiles the TypeScript code in `lambda/sessions/`, `lambda/policies/`, `lambda/health/`, and `lambda/summary/` into optimized JavaScript using esbuild.

Expected output:
```
Build Succeeded

Built Artifacts  : .aws-sam/build
Built Template   : .aws-sam/build/template.yaml
```

### 6d. First-time guided deploy
```bash
sam deploy --guided
```

Answer the prompts like this:
```
Stack Name [insurevoice-prod]: insurevoice-prod          ← press Enter
AWS Region [ap-south-1]: ap-south-1                      ← press Enter
Parameter Stage [prod]: prod                             ← press Enter
Parameter SecretName [insurevoice/production]: insurevoice/production  ← press Enter
Parameter CorsOrigin [*]: *                              ← press Enter
Parameter FrontendBucketName [insurevoice-frontend]: insurevoice-frontend-prod  ← type this
Confirm changes before deploy [y/N]: N                   ← press Enter
Allow SAM CLI IAM role creation [Y/n]: Y                 ← press Enter
Disable rollback [y/N]: N                                ← press Enter
Save arguments to configuration file [Y/n]: Y            ← press Enter
SAM configuration file [samconfig.toml]: samconfig.toml  ← press Enter
SAM configuration environment [default]: default         ← press Enter
```

Then it will show a **changeset** (list of resources to create) and ask:
```
Deploy this changeset? [y/N]: y   ← type y and press Enter
```

> ☕ This takes **5-10 minutes** on first deploy. Go get a coffee!

### 6e. Save the outputs
When done, SAM prints the **Outputs** section — **copy these values**:

```
Key          ApiEndpoint
Value        https://abc123.execute-api.ap-south-1.amazonaws.com/prod

Key          CloudFrontUrl
Value        https://d1xyz123.cloudfront.net

Key          FrontendBucketName
Value        insurevoice-frontend-prod

Key          SummaryQueueUrl
Value        https://sqs.ap-south-1.amazonaws.com/123456789/prod-insurevoice-summary.fifo
```

### 6f. Test the backend is live
```bash
# Replace with your actual API endpoint from above
curl https://abc123.execute-api.ap-south-1.amazonaws.com/prod/health
# Expected: {"status":"ok",...}
```

---

## Step 7 — Build & Deploy React Frontend

### 7a. Install frontend dependencies
```bash
# From the project root
npm install
```

### 7b. Build the React app
```bash
VITE_API_KEY=your_gemini_api_key npm run build
```
> Replace `your_gemini_api_key` with your actual Gemini key.  
> This creates a `dist/` folder with all the HTML, CSS, and JS files.

### 7c. Upload to S3
```bash
aws s3 sync dist/ s3://insurevoice-frontend-prod --delete
```
- `--delete` removes old files that are no longer in your build
- You should see files being uploaded one by one

### 7d. Get your CloudFront Distribution ID
```bash
aws cloudformation describe-stacks \
  --stack-name insurevoice-prod \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" \
  --output text
```

Now get the actual Distribution ID:
```bash
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='InsureVoice AI (prod)'].Id" \
  --output text
```

### 7e. Invalidate CloudFront cache (so users get your new app)
```bash
# Replace EXXXXXXXXXX with your Distribution ID from above
aws cloudfront create-invalidation \
  --distribution-id EXXXXXXXXXX \
  --paths "/*"
```

### 7f. Open your app!
Open the `CloudFrontUrl` from Step 6e in your browser:
```
https://d1xyz123.cloudfront.net
```

🎉 **Your app is now live on the internet!**

---

## Step 8 — Verify Everything Works

Run through this checklist to confirm everything is deployed correctly:

```bash
# 1. Health check — should return {"status":"ok"}
curl https://YOUR_API_ENDPOINT/health

# 2. List sessions — should return [] (empty array on first run)
curl https://YOUR_API_ENDPOINT/api/sessions

# 3. List policies — should return []
curl https://YOUR_API_ENDPOINT/api/policies

# 4. Create a test session
curl -X POST https://YOUR_API_ENDPOINT/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Session","messages":[]}'

# 5. Check Lambda logs (last 5 minutes)
sam logs -n HealthFunction --stack-name insurevoice-prod
sam logs -n SessionsFunction --stack-name insurevoice-prod
```

In the browser:
- ✅ App loads at your CloudFront URL
- ✅ No console errors in browser DevTools (F12 → Console)
- ✅ API calls in DevTools Network tab return 200 status

### Troubleshooting common issues

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| `Internal Server Error` from API | Lambda can't reach MongoDB or Secrets Manager | Check `sam logs` for the specific error |
| `CORS error` in browser | CloudFront or API Gateway config | Make sure your CloudFront URL matches `CorsOrigin` in the secret |
| Frontend shows blank page | Bad build or S3 upload | Re-run `npm run build` and `aws s3 sync` |
| `Secret not found` error | Secret name mismatch | Secret must be named exactly `insurevoice/production` |
| Lambda timeout | MongoDB connection is slow | Check MongoDB Atlas cluster is in `ap-south-1` |

---

## Step 9 — Useful Maintenance Commands

```bash
# ─── View live logs ────────────────────────────────────────────
sam logs -n SessionsFunction --stack-name insurevoice-prod --tail
sam logs -n SummaryFunction  --stack-name insurevoice-prod --tail

# ─── Redeploy after code changes ───────────────────────────────
sam build && sam deploy          # backend
npm run build && aws s3 sync dist/ s3://insurevoice-frontend-prod --delete  # frontend

# ─── Check SQS dead-letter queue (failed AI summary jobs) ──────
aws sqs get-queue-attributes \
  --queue-url YOUR_DLQ_URL \
  --attribute-names ApproximateNumberOfMessages

# ─── Retry failed SQS messages ─────────────────────────────────
aws sqs start-message-move-task --source-arn YOUR_DLQ_ARN

# ─── Update a secret (e.g. rotate API key) ─────────────────────
aws secretsmanager update-secret \
  --secret-id insurevoice/production \
  --secret-string '{"MONGODB_URI":"...","REDIS_URL":"...","GEMINI_API_KEY":"NEW_KEY"}'

# ─── Check your monthly Lambda cost ────────────────────────────
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-02-01 \
  --granularity MONTHLY \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["AWS Lambda"]}}'

# ─── Delete everything (tear down all AWS resources) ───────────
sam delete --stack-name insurevoice-prod
```

---

## Step 10 — Optional: Custom Domain

Want `https://insurevoice.yourdomain.com` instead of the ugly CloudFront URL?

### 10a. Request an SSL Certificate (must be in us-east-1 for CloudFront)
```bash
aws acm request-certificate \
  --domain-name insurevoice.yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

### 10b. Validate the certificate
1. Go to [ACM Console](https://console.aws.amazon.com/acm/home?region=us-east-1)
2. Click your certificate → expand **Domains** → click **Create records in Route 53** (if using Route 53)
   - Or manually add the CNAME record shown in your DNS provider (Namecheap, GoDaddy, etc.)
3. Wait ~5 minutes for status to become **Issued**

### 10c. Update template.yaml
In `template.yaml`, find the `CloudFrontDistribution` resource and add inside `DistributionConfig`:
```yaml
Aliases:
  - insurevoice.yourdomain.com
ViewerCertificate:
  AcmCertificateArn: arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_CERT_ID
  SslSupportMethod: sni-only
  MinimumProtocolVersion: TLSv1.2_2021
```

### 10d. Redeploy
```bash
sam build && sam deploy
```

### 10e. Add DNS record
In your DNS provider, add a **CNAME** record:
```
Host:  insurevoice
Value: d1xyz123.cloudfront.net   ← your CloudFront domain
TTL:   300
```

Wait 5-30 minutes for DNS to propagate. Your app is now at your custom domain! ✅

---

## Step 11 — Optional: CI/CD with GitHub Actions

Automate deployments so every `git push` to `main` deploys your app automatically.

### 11a. Add secrets to GitHub
1. In your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:

   | Secret name | Value |
   |-------------|-------|
   | `AWS_ACCESS_KEY_ID` | Your IAM access key |
   | `AWS_SECRET_ACCESS_KEY` | Your IAM secret key |
   | `VITE_API_KEY` | Your Gemini API key |
   | `CF_DISTRIBUTION_ID` | Your CloudFront distribution ID |

### 11b. Create the workflow file
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1

      - name: Install SAM CLI
        run: pip install aws-sam-cli

      - name: Build and deploy backend (Lambda + API Gateway)
        run: |
          cd lambda && npm ci && cd ..
          sam build
          sam deploy --no-confirm-changeset

      - name: Build frontend (React app)
        env:
          VITE_API_KEY: ${{ secrets.VITE_API_KEY }}
        run: |
          npm ci
          npm run build

      - name: Deploy frontend to S3
        run: |
          aws s3 sync dist/ s3://insurevoice-frontend-prod --delete

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} \
            --paths "/*"
```

### 11c. Push and watch it deploy!
```bash
git add .
git commit -m "Add GitHub Actions deployment"
git push origin main
```
Go to your GitHub repo → **Actions** tab → watch it deploy in real time! 🚀

---

## 💰 Cost Estimate (Monthly)

At typical startup/demo traffic levels:

| Service | Expected usage | Monthly cost |
|---------|---------------|-------------|
| Lambda | 100k requests | ~$0.00 (free tier) |
| API Gateway | 100k requests | ~$0.10 |
| S3 | 1 GB storage | ~$0.02 |
| CloudFront | 10 GB transfer | ~$0.85 |
| SQS | 100k messages | ~$0.00 (free tier) |
| ElastiCache Serverless | Light usage | ~$1-3 |
| Secrets Manager | 1 secret | $0.40 |
| MongoDB Atlas M0 | Unlimited | $0.00 (free) |
| **Total** | | **~$2-5/month** |

---

## 📋 Quick Cheatsheet

```bash
# Full deploy from scratch (after Steps 1-5):
cd /mnt/c/Users/ASUS/Desktop/Puskpako2/insurance-ai-agent
cd lambda && npm install && cd ..
sam build
sam deploy --guided                                               # backend
npm install && VITE_API_KEY=xxx npm run build                    # build frontend
aws s3 sync dist/ s3://insurevoice-frontend-prod --delete        # upload frontend
aws cloudfront create-invalidation --distribution-id EX --paths "/*"  # clear cache

# Subsequent deploys (after code changes):
sam build && sam deploy                                          # backend only
npm run build && aws s3 sync dist/ s3://insurevoice-frontend-prod --delete  # frontend only
```
