# 🧭 JOBSPARK – Recruiter & Seekers Job Portal

**JOBSPARK** is a full-stack project for final-year students to help recruiters manage jobs and applicants efficiently.  
The portal allows recruiters to post jobs, manage listings, review applicants, and handle the hiring process.  
OTP verification is implemented only for **forgot-password** functionality.

---

## 🚀 Features

### 👤 Recruiter Module
- Secure login for recruiters  
- Forgot password with OTP verification via email  
- Recruiter dashboard to:  
  - Post new jobs  
  - Manage job listings  
  - Review applicants  
  - Track hiring process  

### 🔐 Backend & Security
- OTP verification for password reset  
- Password hashing for security  
- API keys and sensitive data stored in `.env`  
- Server-side rendering using **EJS**

---

## 🛠️ Technologies Used
- **Frontend:** HTML, CSS, JavaScript, EJS Templates  
- **Backend:** Node.js, Express.js  
- **Database:** PostgreSQL  
- **Other Tools:** Nodemailer (for OTP), dotenv  

---

## 📁 Project Structure

```
JOBSPARK/
│
├── node_modules/
│
├── public/                     # Static assets (CSS, JS, Images)
│
├── views/
    ├── pages/                    # EJS templates # Header, footer, navbar, etc.
│   ├── partials/               
│     ├── pages/                  # Dashboard & job-related pages
│                 
│
├── index.js                    # Main backend server file
├── package.json
├── package-lock.json
├── .env                        # Environment variables
└── README.md
```

---

## 🔑 Environment Variables (.env)

Create a `.env` file in the project root:

```
PORT=3000
EMAIL_SERVICE_USER=your_email@example.com
EMAIL_SERVICE_PASS=your_email_password
OTP_SECRET=your_random_secret
```

> ⚠️ Do not push `.env` to GitHub.

---

## 🗄️ PostgreSQL Database

---

## ▶️ Running the Project Locally

### 1️⃣ Install Dependencies
```bash
npm install
```

### 2️⃣ Start the Server
```bash
node index.js
```

### 3️⃣ Open in Browser
```
http://localhost:3000
```

---


## 🎓 Final Year Project Highlights
- Single backend file managing server, routes, and database connection  
- OTP verification for password reset  
- Efficient recruiter dashboard for job management  
- Relational PostgreSQL database  
- Deployment-ready on platforms like Render  

---

## 🤝 Contributing
Contributions are welcome for UI improvements or additional features.

---

## 📝 License
Free to use for educational purposes.

---
## 📥 Clone the Project

You can clone the JOBSPARK project to your local machine using Git:

```bash
# Clone the repository
git clone https://github.com/sandeep2811-dev/JOBSPARK.git

# Navigate into the project folder
cd JOBSPARK

# Install dependencies
npm install

# Start the server
node index.js

# Open the app in your browser
http://localhost:5000
```

> Make sure you have [Node.js](https://nodejs.org/) and [Git](https://git-scm.com/) installed on your machine.
---
>This project was **developed entirely from scratch** by me, without any contributions from other developers.

