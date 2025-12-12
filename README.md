# Client Info Viewer – Google Cloud Deployment

This project is a simple web application that displays technical information about a visitor, including:

- IP Address  
- Browser  
- Operating System  
- City, Region, Country  
- Latitude & Longitude  

Each visit is logged and stored in a PostgreSQL Cloud SQL database.  
The application was deployed using **Google App Engine** with a fully automated **Cloud Build CI/CD pipeline** connected to GitHub.

A custom **About page** was also added as my own modification.

---

## 🚀 Live URLs

**Main Application:**  
https://cloud-ca1-aaron.ew.r.appspot.com/

**Client Info Endpoint:**  
https://cloud-ca1-aaron.ew.r.appspot.com/api/client-info

**Visit Logs Page:**  
https://cloud-ca1-aaron.ew.r.appspot.com/logs

**Custom About Page (Modification):**  
https://cloud-ca1-aaron.ew.r.appspot.com/about

---

## 🧱 Architecture Summary

The application uses the following Google Cloud services:

### **1. App Engine (Standard Environment)**
- Hosts and serves the Node.js application  
- Automatically scales based on incoming traffic  
- Uses buildpacks for dependency detection and deployment  

### **2. Cloud SQL – PostgreSQL**
- Stores all visit logs (IP, browser, OS, geolocation data)  
- Connected to App Engine using the Cloud SQL Unix socket connector  

### **3. Cloud Build (CI/CD Pipeline)**
- Automatically deploys the application when changes are pushed to GitHub  
- Uses `cloudbuild.yaml` to run the build and deploy steps  

---

## 🔧 Deployment Process (CI/CD)

Deployment is **fully automated**:

1. I push code to the `main` branch on GitHub.  
2. Cloud Build trigger (`deploy-on-main`) detects the push.  
3. Cloud Build runs using `cloudbuild.yaml`.  
4. Buildpacks package the Node.js application.  
5. App Engine receives the new build and redeploys the service.

No manual `gcloud app deploy` commands were used.

---

## 🗄️ Database Details

The Cloud SQL connection string used by the application:

postgresql://secure_user:YourChoice123!@/client_info?host=/cloudsql/cloud-ca1-aaron:europe-west1:client-info-postgres


- **User:** secure_user  
- **Password:** YourChoice123!  
- **Database:** client_info  
- **Connection:** App Engine → Cloud SQL 

---



