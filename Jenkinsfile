pipeline {
    agent any

    tools {
        nodejs 'nodejs-20'
    }

    environment {
        ACR_NAME         = 'tangodown15'
        ACR_LOGIN_SERVER = 'tangodown15.azurecr.io'
        IMAGE_NAME       = 'cicd-demo-app'
        IMAGE_TAG        = "${BUILD_NUMBER}"
    }

    stages {

        stage('Checkout') {
            steps {
                echo "==> Cloning from GitHub..."
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo "==> Installing npm packages..."
                sh 'npm ci'
            }
        }

        stage('Run Tests') {
            steps {
                echo "==> Running Jest tests..."
                sh 'npm test'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                echo "==> Running SonarQube scan..."
                script {
                    def scannerHome = tool 'sonar-scanner'
                    withSonarQubeEnv('sonarqube') {
                        sh """
                            ${scannerHome}/bin/sonar-scanner \
                              -Dsonar.projectKey=cicd-demo-app \
                              -Dsonar.projectName=cicd-demo-app \
                              -Dsonar.sources=. \
                              -Dsonar.exclusions=node_modules/**,coverage/**,tests/**,Jenkinsfile \
                              -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                        """
                    }
                }
            }
        }

        stage('Snyk Security Scan') {
            steps {
                echo "==> Running Snyk dependency scan..."
                withCredentials([string(credentialsId: 'snyk-token', variable: 'SNYK_TOKEN')]) {
                    sh '''
                        snyk auth $SNYK_TOKEN
                        snyk test --severity-threshold=high || echo "Snyk found issues — review above, continuing for learning"
                    '''
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                echo "==> Building Docker image..."
                sh "docker build -t ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG} ."
                sh "docker tag ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG} ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest"
            }
        }

        stage('Push to ACR') {
            steps {
                echo "==> Pushing to Azure Container Registry..."
                withCredentials([usernamePassword(
                    credentialsId: 'acr-cred',
                    usernameVariable: 'ACR_USER',
                    passwordVariable: 'ACR_PASS'
                )]) {
                    sh 'echo $ACR_PASS | docker login $ACR_LOGIN_SERVER -u $ACR_USER --password-stdin'
                    sh "docker push ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}"
                    sh "docker push ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest"
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded. Image pushed: ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}"
        }
        failure {
            echo "Pipeline failed. See the logs for which stage broke."
        }
        always {
            sh 'docker logout $ACR_LOGIN_SERVER || true'
        }
    }
}