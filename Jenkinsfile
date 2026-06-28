pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t floor-app:latest .'
            }
        }

        stage('Run Container') {
            steps {
                sh 'docker run -d --rm -p 3001:80 --name floor-ci floor-app:latest || true'
            }
        }
    }
}