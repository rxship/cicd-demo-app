# CI/CD Demo App

A Node.js + Express API that demonstrates a complete, production-style **CI/CD pipeline** on Microsoft Azure using Jenkins, SonarQube, Snyk, Docker, and Azure Container Registry (ACR).

This repo is both a **working reference implementation** and a **learning project**. You can clone it, set up your own Azure infrastructure, and have the full pipeline running in a few hours.

---

## Table of Contents

1. [What This Project Does](#what-this-project-does)
2. [Architecture Overview](#architecture-overview)
3. [Tech Stack](#tech-stack)
4. [Repository Contents](#repository-contents)
5. [Prerequisites](#prerequisites)
6. [Part A — Run the App Locally](#part-a--run-the-app-locally)
7. [Part B — Reproduce the Full Pipeline on Azure](#part-b--reproduce-the-full-pipeline-on-azure)
   - [B.1 Create Azure Resource Group](#b1-create-azure-resource-group)
   - [B.2 Create Azure Container Registry (ACR)](#b2-create-azure-container-registry-acr)
   - [B.3 Provision the Jenkins VM](#b3-provision-the-jenkins-vm)
   - [B.4 Install Jenkins, Java, Docker, Node.js on the VM](#b4-install-jenkins-java-docker-nodejs-on-the-vm)
   - [B.5 Provision the SonarQube VM](#b5-provision-the-sonarqube-vm)
   - [B.6 Create Snyk Account and Token](#b6-create-snyk-account-and-token)
   - [B.7 Install Required Jenkins Plugins](#b7-install-required-jenkins-plugins)
   - [B.8 Add Credentials to Jenkins](#b8-add-credentials-to-jenkins)
   - [B.9 Configure SonarQube Server and Tools](#b9-configure-sonarqube-server-and-tools)
   - [B.10 Create the Jenkins Pipeline Job](#b10-create-the-jenkins-pipeline-job)
   - [B.11 Run the Pipeline](#b11-run-the-pipeline)
8. [Pipeline Stages Explained](#pipeline-stages-explained)
9. [Verifying the Pipeline Worked](#verifying-the-pipeline-worked)
10. [Cost Management](#cost-management)
11. [Troubleshooting](#troubleshooting)
12. [Project Structure Reference](#project-structure-reference)
13. [Learning Resources](#learning-resources)

---

## What This Project Does

The application itself is intentionally simple — a small REST API with a few endpoints for managing users. The **real value** of this repo is the **end-to-end pipeline** around it:

```
Code push to GitHub
       ↓
Jenkins auto-builds from main branch
       ↓
Pipeline runs 7 stages:
  1. Checkout        — clone latest code
  2. Install deps    — npm ci
  3. Run tests       — Jest + code coverage
  4. SonarQube scan  — code quality & bugs
  5. Snyk scan       — dependency vulnerabilities
  6. Docker build    — package the app
  7. Push to ACR     — versioned image upload
       ↓
Container image ready in ACR, tagged with build number
```

Every commit produces a **fully tested, scanned, and packaged** artifact — the foundation of modern software delivery.

---

## Architecture Overview

```
┌─────────────────┐       push        ┌─────────────────┐
│  Developer      │──────────────────▶│  GitHub         │
│  (laptop)       │                   │  (source code)  │
└─────────────────┘                   └────────┬────────┘
                                               │ poll/webhook
                                               ▼
┌──────────────────────────────────────────────────────────┐
│                  Azure Resource Group                    │
│                                                          │
│  ┌────────────────┐         ┌────────────────────┐      │
│  │  Jenkins VM    │◀───────▶│  SonarQube VM      │      │
│  │  (Ubuntu)      │  scans  │  (Ubuntu + Docker) │      │
│  │                │         │                    │      │
│  │  • Jenkins     │         │  • SonarQube       │      │
│  │  • Java 21     │         │  • PostgreSQL      │      │
│  │  • Docker      │         │    (both in        │      │
│  │  • Node.js     │         │     docker-compose)│      │
│  │  • Snyk CLI    │         └────────────────────┘      │
│  │  • Sonar Scanner│                                    │
│  └───────┬────────┘                                     │
│          │ push image                                   │
│          ▼                                              │
│  ┌─────────────────┐                                    │
│  │  Azure Container│                                    │
│  │  Registry (ACR) │                                    │
│  │                 │                                    │
│  │  cicd-demo-app: │                                    │
│  │   1, 2, latest  │                                    │
│  └─────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
                     │
                     │ (future: deploy to AKS)
                     ▼
                Kubernetes Cluster
```

**External SaaS services used:**
- **GitHub** — source code hosting
- **Snyk (snyk.io)** — vulnerability database

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js 20 | JavaScript server runtime |
| Framework | Express 4 | Web framework |
| Testing | Jest, Supertest | Unit and integration testing |
| Container | Docker | Packaging the app into an image |
| CI/CD | Jenkins | Pipeline orchestration |
| Code Quality | SonarQube | Static analysis, bugs, code smells |
| Security | Snyk | Dependency vulnerability scanning |
| Image Registry | Azure Container Registry | Private image storage |
| Compute | Azure VMs (Ubuntu 22.04) | Jenkins + SonarQube hosts |

---

## Repository Contents

```
cicd-demo-app/
├── app.js               # Express API (the actual application)
├── package.json         # Node dependencies and npm scripts
├── package-lock.json    # Exact dependency versions (deterministic installs)
├── Dockerfile           # Multi-stage build instructions
├── .dockerignore        # Files excluded from Docker image
├── .gitignore           # Files excluded from git
├── Jenkinsfile          # Declarative CI/CD pipeline definition
├── tests/
│   └── app.test.js      # Jest tests for the API
└── README.md            # You are here
```

---

## Prerequisites

Before you begin, you need:

### Accounts
- **Azure subscription** ([free trial available](https://azure.microsoft.com/free))
- **GitHub account**
- **Snyk account** ([free tier available](https://snyk.io))

### On Your Local Machine
- **Git**
- **Node.js 20 or later** ([download](https://nodejs.org))
- **Docker Desktop** ([download](https://www.docker.com/products/docker-desktop/))
- **Azure CLI** ([install guide](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli))
- **Code editor** (VS Code recommended)

### Skills
- Comfort with the command line (bash or PowerShell)
- Basic Git (clone, commit, push)
- Understanding of Docker basics helps but not required

### Time
- **Part A** (local app): 10 minutes
- **Part B** (full pipeline on Azure): 2–3 hours for a first-timer

### Cost Awareness
This project uses two small Azure VMs (~$30–45/month if left running 24/7). When not actively practicing, **deallocate** the VMs to minimize cost (see [Cost Management](#cost-management)).

---

## Part A — Run the App Locally

Fastest way to get a feel for the application before touching Azure.

### 1. Clone the Repo

```bash
git clone https://github.com/<your-username>/cicd-demo-app.git
cd cicd-demo-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Tests

```bash
npm test
```

Expected output:

```
Tests:       7 passed, 7 total
Coverage:    ~90%+
```

### 4. Start the Server

```bash
npm start
```

The API runs on `http://localhost:3000`. Try:

- `http://localhost:3000/` → API info
- `http://localhost:3000/health` → health check
- `http://localhost:3000/users` → list users
- `http://localhost:3000/users/1` → single user

Stop with `Ctrl+C`.

### 5. (Optional) Build and Run the Docker Image

```bash
docker build -t cicd-demo-app .
docker run -d -p 3000:3000 --name demo cicd-demo-app
```

Visit `http://localhost:3000`. Stop with:

```bash
docker stop demo && docker rm demo
```

---

## Part B — Reproduce the Full Pipeline on Azure

This is the real deal. You'll provision infrastructure, install tools, and wire everything together. Do it in order — each step depends on the previous ones.

> **Naming convention**: Names used in examples (like `tangodown15`, `learning-rg`) are placeholders. Replace them with your own unique names. ACR names in particular must be **globally unique** across all of Azure.

### B.1 Create Azure Resource Group

A resource group is a folder that holds everything. Deleting the group deletes all resources inside — perfect for easy cleanup.

```bash
az login
az group create --name learning-rg --location canadacentral
```

Pick a region close to you (e.g., `eastus`, `westeurope`, `southeastasia`). All subsequent resources should use the same region.

### B.2 Create Azure Container Registry (ACR)

```bash
az acr create \
  --resource-group learning-rg \
  --name <your-unique-acr-name> \
  --sku Basic \
  --location canadacentral

# Enable admin user (for learning/simplicity — use managed identity in production)
az acr update --name <your-unique-acr-name> --admin-enabled true
```

Note the **login server** (e.g., `<your-unique-acr-name>.azurecr.io`). You'll use this often.

### B.3 Provision the Jenkins VM

Use the Azure portal for a guided experience, or CLI for automation.

**Portal method:**
1. Azure Portal → Virtual Machines → Create → Azure virtual machine
2. Resource group: `learning-rg`
3. Name: `jenkins-vm`
4. Image: **Ubuntu Server 22.04 LTS**
5. Size: **Standard_B2s** (2 vCPU, 4 GB RAM)
6. Authentication: **SSH public key** — upload your local public key
7. Inbound ports: open **22 (SSH)** and **8080 (Jenkins)**
8. Review + Create

After deployment, note the **public IP**.

### B.4 Install Jenkins, Java, Docker, Node.js on the VM

SSH into the VM:

```bash
ssh -i ~/.ssh/your-private-key azureuser@<jenkins-vm-public-ip>
```

Inside the VM, run:

```bash
# 1. Update package catalog
sudo apt update

# 2. Install Java 21 (Jenkins 2.555+ requires Java 21)
sudo apt install -y fontconfig openjdk-21-jre
sudo update-java-alternatives --set java-1.21.0-openjdk-amd64

# 3. Install Jenkins
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key \
  | sudo tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/" \
  | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt update
sudo apt install -y jenkins
sudo systemctl enable --now jenkins

# 4. Install Docker
sudo apt install -y docker.io
sudo usermod -aG docker jenkins
sudo usermod -aG docker azureuser

# 5. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 6. Install libatomic (required by newer Node.js)
sudo apt install -y libatomic1

# 7. Install Snyk CLI globally
sudo npm install -g snyk

# 8. Restart Jenkins to pick up docker group membership
sudo systemctl restart jenkins
```

Get the Jenkins initial admin password:

```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

Copy it. Open `http://<jenkins-vm-public-ip>:8080` in your browser, paste the password, select **Install suggested plugins**, create an admin user, and save the Jenkins URL.

### B.5 Provision the SonarQube VM

Repeat the VM creation (same as B.3) with:
- Name: `sonarqube-vm`
- Size: **Standard_B2s** (SonarQube needs 2+ GB RAM just for Elasticsearch)
- Open ports: **22 (SSH)** and **9000 (SonarQube)**

SSH in and set it up:

```bash
# Update + install Docker and Compose
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker azureuser
newgrp docker

# Required by Elasticsearch (which SonarQube uses internally)
sudo sysctl -w vm.max_map_count=262144
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf

# Create docker-compose file
mkdir ~/sonarqube && cd ~/sonarqube
cat > docker-compose.yml <<'EOF'
version: "3"
services:
  sonarqube:
    image: sonarqube:community
    container_name: sonarqube
    depends_on:
      - db
    environment:
      SONAR_JDBC_URL: jdbc:postgresql://db:5432/sonar
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: sonar
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_extensions:/opt/sonarqube/extensions
      - sonarqube_logs:/opt/sonarqube/logs
    ports:
      - "9000:9000"
    restart: unless-stopped
  db:
    image: postgres:15
    container_name: sonar-db
    environment:
      POSTGRES_USER: sonar
      POSTGRES_PASSWORD: sonar
      POSTGRES_DB: sonar
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
volumes:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
  postgres_data:
EOF

docker compose up -d
```

Wait ~3 minutes for SonarQube to start. Watch logs:

```bash
docker logs -f sonarqube
```

Wait for `SonarQube is operational`, then `Ctrl+C` to stop watching.

Open `http://<sonarqube-vm-public-ip>:9000`:
- Default login: `admin` / `admin`
- Change the password immediately
- Generate a **Global Analysis Token**:
  - Avatar → My Account → Security
  - Name: `jenkins-token`
  - Type: Global Analysis Token
  - Click Generate → **copy the token immediately** (shown only once)

### B.6 Create Snyk Account and Token

1. Sign up at [snyk.io](https://snyk.io) (GitHub or Google login is easiest)
2. Skip the repo import onboarding
3. Go to **Account settings** → **Personal Access Tokens**
4. Click **Generate a Personal Access Token**
5. Name it `jenkins-ci`, set expiration to 90 days, click Generate
6. **Copy the token immediately** (shown only once)

### B.7 Install Required Jenkins Plugins

In Jenkins: **Manage Jenkins** → **Plugins** → **Available plugins**.

Install:
- **Docker Pipeline**
- **SonarQube Scanner**
- **NodeJS**
- **Blue Ocean** (optional but nice UI)

Check "Restart Jenkins when installation is complete and no jobs are running."

### B.8 Add Credentials to Jenkins

**Manage Jenkins** → **Credentials** → **(global)** → **Add Credentials**.

Add four credentials:

| ID | Kind | Content |
|---|---|---|
| `github-cred` | Username with password | Your GitHub username + a PAT with `repo` scope |
| `acr-cred` | Username with password | ACR name as username, `az acr credential show --name <acr-name> --query passwords[0].value -o tsv` output as password |
| `sonarqube-token` | Secret text | The SonarQube token from B.5 |
| `snyk-token` | Secret text | The Snyk token from B.6 |

**Never commit these values to git. Never paste them in chat/tickets.**

### B.9 Configure SonarQube Server and Tools

**Manage Jenkins** → **System**:

Scroll to **SonarQube servers** → **Add SonarQube**:
- Name: `sonarqube`
- Server URL: `http://<sonarqube-vm-public-ip>:9000`
- Server authentication token: select `sonarqube-token`
- Save

**Manage Jenkins** → **Tools**:

Under **SonarQube Scanner installations** → **Add**:
- Name: `sonar-scanner`
- Install automatically ✓

Under **NodeJS installations** → **Add**:
- Name: `nodejs-20`
- Install automatically ✓
- Version: pick a specific Node 20.x (e.g., `NodeJS 20.19.0`) — do not use "latest" as it may auto-upgrade to incompatible versions

Save.

### B.10 Create the Jenkins Pipeline Job

Dashboard → **+ New Item**:
- Name: `cicd-demo-pipeline`
- Type: **Pipeline**
- Click OK

In the job config:
- **Definition**: Pipeline script from SCM
- **SCM**: Git
- **Repository URL**: `https://github.com/<your-username>/cicd-demo-app.git`
- **Credentials**: `github-cred`
- **Branches**: `*/main`
- **Script Path**: `Jenkinsfile`

Save.

**Important — update the Jenkinsfile for your ACR:**

Before running, the `Jenkinsfile` in this repo references a specific ACR name. Edit the `environment` block in your fork to match your own registry:

```groovy
environment {
    ACR_NAME         = 'your-acr-name'                // ← your ACR
    ACR_LOGIN_SERVER = 'your-acr-name.azurecr.io'     // ← your ACR URL
    IMAGE_NAME       = 'cicd-demo-app'
    IMAGE_TAG        = "${BUILD_NUMBER}"
}
```

Commit and push the change to your fork.

### B.11 Run the Pipeline

On the job page, click **Build Now**. Watch Console Output. A green pipeline will show all stages passing.

---

## Pipeline Stages Explained

The `Jenkinsfile` defines seven stages:

| Stage | What It Does | Fails If |
|-------|-------------|----------|
| **Checkout** | Clones the repo using `github-cred` | GitHub unreachable or token invalid |
| **Install Dependencies** | Runs `npm ci` using `package-lock.json` | Lockfile is out of date or missing |
| **Run Tests** | Executes Jest tests with coverage | Any test fails |
| **SonarQube Analysis** | Sends code to SonarQube server for scanning | SonarQube is unreachable or token invalid |
| **Snyk Security Scan** | Scans dependencies for known vulnerabilities | High/critical issues found (currently set to warn-only for learning) |
| **Build Docker Image** | Builds and tags the Docker image | Dockerfile has errors or missing files |
| **Push to ACR** | Logs into ACR and pushes image (both `:<BUILD_NUMBER>` and `:latest`) | Auth fails or image too large |

Post-actions always run `docker logout` to clean up credentials on the build host.

---

## Verifying the Pipeline Worked

After a green build:

### Check ACR

```bash
az acr repository show-tags --name <your-acr-name> --repository cicd-demo-app --output table
```

You should see tags like `1`, `2`, `latest`.

### Check SonarQube

Visit `http://<sonarqube-vm-public-ip>:9000` → Projects → `cicd-demo-app`. View bugs, code smells, and coverage.

### Check Snyk

Visit the [Snyk dashboard](https://app.snyk.io). Recent scans appear in your activity feed.

### Pull and Run the Pipeline-Built Image Locally

```bash
az acr login --name <your-acr-name>
docker pull <your-acr-name>.azurecr.io/cicd-demo-app:latest
docker run -d -p 3000:3000 --name demo <your-acr-name>.azurecr.io/cicd-demo-app:latest
```

Visit `http://localhost:3000`. This is the image Jenkins built, now running on your laptop.

---

## Cost Management

Running both VMs 24/7 costs approximately **$45–60/month**. To minimize cost during learning:

### Deallocate When Not Using

```bash
# Stop both VMs (no compute charges)
az vm deallocate --resource-group learning-rg --name jenkins-vm
az vm deallocate --resource-group learning-rg --name sonarqube-vm

# Start them when you want to practice
az vm start --resource-group learning-rg --name jenkins-vm
az vm start --resource-group learning-rg --name sonarqube-vm
```

> **Note:** Public IPs may change when VMs restart (if using dynamic IPs). Update Jenkins' SonarQube server URL if the SonarQube IP changes.

### Tear Down Completely

When you're done with the project:

```bash
az group delete --name learning-rg --yes --no-wait
```

This deletes **everything** in the resource group.

### Alternative: Auto-Shutdown

Both VMs support scheduled auto-shutdown. Configure in the Azure portal: VM → **Auto-shutdown** → enable with your preferred daily time.

---

## Troubleshooting

### Pipeline fails at Install Dependencies with "libatomic.so.1: cannot open shared object file"

Install `libatomic1` on the Jenkins VM:
```bash
sudo apt install -y libatomic1
```
Also pin the Node.js version in Jenkins Tools to a specific 20.x (not "latest").

### Pipeline fails at SonarQube Analysis with "ECONNREFUSED"

Check that:
- SonarQube VM is running (`az vm show --resource-group learning-rg --name sonarqube-vm`)
- SonarQube container is up (SSH in: `docker ps`)
- Port 9000 is open in the NSG
- The URL in Jenkins' System config matches the current public IP

### Pipeline fails at Snyk with "401 Unauthorized"

Token is invalid. Generate a fresh one from the Snyk dashboard and update the `snyk-token` credential in Jenkins. Also verify no trailing whitespace was copied with the token.

### Pipeline fails at Push to ACR with "unauthorized"

ACR admin password may have been rotated. Regenerate:
```bash
az acr credential show --name <your-acr-name>
```
And update the `acr-cred` credential in Jenkins.

### Jenkins won't start after install — "Java version too old"

Jenkins 2.555+ requires Java 21. Install and set as default:
```bash
sudo apt install -y openjdk-21-jre
sudo update-java-alternatives --set java-1.21.0-openjdk-amd64
sudo systemctl reset-failed jenkins
sudo systemctl start jenkins
```

### "Permission denied" when Jenkins tries to run Docker

Add the `jenkins` user to the `docker` group and restart Jenkins:
```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

---

## Project Structure Reference

### `app.js`

Express application with a small in-memory REST API. Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check |
| GET | `/users` | List all users |
| GET | `/users/:id` | Get one user |
| POST | `/users` | Create a user (JSON body with `name` and optional `role`) |

### `tests/app.test.js`

Seven tests covering all endpoints, including happy paths and error paths (404s, 400s).

### `Dockerfile`

Multi-stage build using `node:20-alpine`. Key optimizations:

- Copies `package*.json` first to leverage Docker layer caching
- Uses `npm ci` for deterministic, fast installs
- Uses `--only=production` to skip dev dependencies in the final image

### `Jenkinsfile`

Declarative pipeline using:

- `tools` block to auto-install Node.js
- `environment` block for configuration
- `stages` block for the 7-stage pipeline
- `withCredentials` for secure token handling
- `post` block for cleanup actions

---

## Learning Resources

If you're new to any of the tools in this project:

- **Docker** — [Official Getting Started](https://docs.docker.com/get-started/)
- **Jenkins** — [Official Tutorials](https://www.jenkins.io/doc/tutorials/)
- **Jenkins Pipeline Syntax** — [Declarative Pipeline docs](https://www.jenkins.io/doc/book/pipeline/syntax/)
- **SonarQube** — [Getting Started](https://docs.sonarqube.org/latest/setup/get-started-2-minutes/)
- **Snyk** — [Snyk CLI docs](https://docs.snyk.io/snyk-cli)
- **Azure Container Registry** — [ACR tutorials](https://learn.microsoft.com/en-us/azure/container-registry/)
- **Azure CLI** — [Reference](https://learn.microsoft.com/en-us/cli/azure/)

---

## What's Next

Natural extensions for this project:

1. **Add a Deploy stage** — push to Azure Kubernetes Service (AKS) for true CD
2. **Add GitHub webhooks** — auto-trigger builds on push (instead of manual Build Now)
3. **Use Managed Identity** — replace ACR admin credentials with passwordless auth
4. **Store secrets in Azure Key Vault** — migrate Jenkins credentials out of Jenkins' own store
5. **Write the infrastructure in Terraform** — replace manual VM provisioning with IaC
6. **Add a frontend** — extend the pipeline to build/test/deploy a React or Vue app alongside the API
7. **Add quality gates** — enforce SonarQube and Snyk thresholds that fail builds on regression

---

## License

MIT — feel free to fork, adapt, and learn from this project.

---

## Acknowledgements

Built as a learning project to understand production DevOps workflows end-to-end. The goal is not just to have it work, but to understand *why* each piece is there.
