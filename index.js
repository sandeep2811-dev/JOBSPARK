import express from "express";
import fs from "fs";
import path,{ dirname } from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";
import session from "express-session";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
const _dirname = dirname(fileURLToPath(import.meta.url));
// load .env explicitly from this file's directory to avoid cwd issues
dotenv.config({ path: path.join(_dirname, '.env') });
console.log('Resolved .env path:', path.join(_dirname, '.env'));
console.log('Process cwd:', process.cwd());
// log loaded env at startup to help debug missing vars
// If dotenv didn't populate API_KEY (some env-injection tools may block it), try a manual fallback
if (!process.env.API_KEY) {
    try {
        const envRaw = fs.readFileSync(path.join(_dirname, '.env'), 'utf8');
        envRaw.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const idx = trimmed.indexOf('=');
            if (idx === -1) return;
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim();
            console.log('Parsed .env key:', key);
            if (!process.env[key]) process.env[key] = val.replace(/^\"|\"$/g, '');
        });
        console.log('Fallback loaded API_KEY from .env file:', process.env.API_KEY ? '[REDACTED]' : 'undefined');
    } catch (e) {
        console.error('Fallback .env read error:', e.message || e);
    }
}
console.log('Loaded API_KEY from .env:', process.env.API_KEY ? '[REDACTED]' : 'undefined');
const DB_PASSWORD = process.env.database_password || "Sandeep@8900";
const app = express();
const port = process.env.port || 3000;
const db = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ============ PASSPORT GOOGLE OAUTH SETUP ============
passport.use(new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const firstName = profile.name.givenName || "";
            const lastName = profile.name.familyName || "";
            const googleId = profile.id;
            
            // Check if user exists with this email
            const user = await db.query("SELECT * FROM user_details WHERE gmail=$1", [email]);
            
            if (user.rows.length > 0) {
                // User exists, return user data
                return done(null, user.rows[0]);
            } else {
                // Create new user with Google profile
                const newUser = await db.query(
                    "INSERT INTO user_details (first_name, last_name, gmail, username, pass) VALUES ($1, $2, $3, $4, $5) RETURNING *",
                    [firstName, lastName, email, email.split('@')[0], googleId]
                );
                return done(null, newUser.rows[0]);
            }
        } catch (error) {
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await db.query("SELECT * FROM user_details WHERE id=$1", [id]);
        done(null, user.rows[0]);
    } catch (error) {
        done(error);
    }
});

// ============ END PASSPORT SETUP ============

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));app.use(passport.initialize());
app.use(passport.session());app.use(express.static(_dirname));
app.use(express.json()); // add this line before routes
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});
app.get("/index.ejs",(req,res)=>{
    res.render("index.ejs");
})
app.get("/",(req,res)=>{
    res.render("index.ejs");
})
app.get("/register.ejs",(req,res)=>{
    res.render("register.ejs")
})
app.get("/about.ejs",(req,res)=>{
    res.render("about.ejs");
})
app.get("/carriers.ejs",async (req,res)=>{
    const jobs = await db.query("SELECT * FROM posts ");
    
    const date = await db.query("SELECT TO_CHAR(posted_on, 'DD-MM-YYYY') AS formatted_date FROM posts ");
    res.render("carriers.ejs",{jobs: jobs.rows,date: date.rows});
})
app.get("/dashboard.ejs", (req, res) => {
    if (!req.session.userid) {
        return res.redirect("/");
    }
    res.render("dashboard.ejs", { username: req.session.username });
});
app.get("/partials/posts.ejs",(req,res)=>{
    res.render("partials/posts.ejs");
})

app.get("/partials/applicants.ejs",(req,res)=>{
    res.render("partials/applicants.ejs",{applicants:""});
})      
app.post("/carriers", async (req, res) => {
    const { jobname, location, ['job type']: jobType, maxitems } = req.body;
    console.log(process.env.API_KEY,"-----------------------------------------");
    const reqdata = {
        query: jobname,
        location: location,
        Remote: jobType,
        maxItems: maxitems
    };
    try {
        const result = await axios.post(
            process.env.API_KEY,
            reqdata,
            { headers: { "Content-Type": "application/json" } }
        );

        // build a date array to match carriers.ejs expectation
        const dateArray = (Array.isArray(result.data) ? result.data : []).map(item => {
            const d = item.posted_on || item.postedOn || item.date || '';
            // If d looks like a date, format to DD-MM-YYYY; otherwise keep as-is
            let formatted = '';
            if (d) {
                const parsed = new Date(d);
                if (!isNaN(parsed)) {
                    formatted = parsed.toLocaleDateString('en-GB'); // DD/MM/YYYY
                } else {
                    formatted = d;
                }
            }
            return { formatted_date: formatted };
        });
        res.render("carriers.ejs", { jobs: result.data, date: dateArray });
    } catch (error) {
        console.error('Error in /carriers:', error?.message || error, error?.response?.data || 'no response data');
        res.status(500).send("Error occurred");
    }
});


app.get("/contact.ejs",(req,res)=>{
    res.render("contact.ejs");
})
app.get("/partials/feedback.ejs",(req,res)=>{
    res.render("partials/feedback.ejs");
})


// registration

app.post("/register",async(req,res)=>{
    const data = req.body;
    await db.query("INSERT INTO user_details (first_name , last_name , username , pass , gmail , mobile) VALUES ($1,$2,$3,$4,$5,$6)",[data.fname , data.lname , data.username , data.password , data.email , data.mobile]);
    res.render("register.ejs",{message: "registered successfully please login."});

})

//login

app.post("/login",async(req,res)=>{
    const data = req.body;
    const user = await db.query("SELECT id,gmail,pass,username FROM user_details WHERE gmail=$1",[data.email]);
        
        if(data.email==user.rows[0].gmail && data.password==user.rows[0].pass){
            req.session.userid =user.rows[0].id; 
            res.render("dashboard.ejs",{username: user.rows[0].username});
        }
        else{
            res.render("index.ejs",{message: "invalid Username or password "});
        }

    
})

// ============ GOOGLE OAUTH ROUTES ============
app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (req, res) => {
        // Successful authentication, store user info in session
        if (req.user) {
            req.session.userid = req.user.id;
            req.session.username = req.user.username;
            res.redirect("/dashboard.ejs");
        } else {
            res.redirect("/");
        }
    }
);
// ============ END GOOGLE OAUTH ROUTES ============
//posting jobs
app.post("/posts",async(req,res)=>{
    const data = req.body;
    await db.query("INSERT INTO posts (title, description, company, loc, salary, joblink,user_id) VALUES ($1, $2, $3, $4, $5, $6,$7)", [data.title, data.description, data.company, data.location, data.salary, data.joblink,req.session.userid]);
    res.render("partials/posts.ejs",{message: "Job posted successfully."});
})
app.get("/partials/my_jobs.ejs",async(req,res)=>{
    const jobs = await db.query("SELECT * FROM posts WHERE user_id=$1",[req.session.userid]);
    const date = await db.query("SELECT TO_CHAR(posted_on, 'DD-MM-YYYY') AS formatted_date FROM posts WHERE user_id=$1",[req.session.userid]);
    res.render("partials/my_jobs.ejs",{jobs: jobs.rows,date: date.rows});
})
app.get("/partials/help.ejs",(req,res)=>{
    res.render("partials/help.ejs");
})
app.get("/logout",(req,res)=>{
    req.session.destroy((err)=>{
        if(err){
            console.log(err);
        }else{
            res.redirect("/");
        }
    })
})
// GET route to render the page initially
app.get("/forgot.ejs", (req, res) => {
    res.render("forgot.ejs", {
        message: "",
        email: "",
        otpSent: false,
        otpVerified: false
    });
});

// POST route for all forgot password actions
app.post("/forgot", async (req, res) => {
    const { actiontype, email, otp, newPassword } = req.body;

    try {

        // 1️⃣ SEND OTP
        if (actiontype === "sendotp") {
            const user = await db.query("SELECT gmail FROM user_details WHERE gmail=$1", [email]);

            if (!user.rows.length) {
                return res.render("forgot", {
                    message: "Invalid email ID",
                    email,
                    otpSent: false,
                    otpVerified: false
                });
            }

            const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
            req.session.otp = generatedOtp;
            req.session.otpEmail = email;

            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: "teamjobspark@gmail.com",
                    pass: "gplu ovxn cpby lnyx"
                }
            });

            await transporter.sendMail({
                from: "teamjobspark@gmail.com",
                
                to: req.session.otpEmail,
                subject: "OTP for Reset Password",
                text: `Your OTP for password reset is: ${generatedOtp}`
            });

            return res.render("forgot", {
                message: "OTP sent successfully!",
                email,
                otpSent: true,
                otpVerified: false
            });
        }

        // 2️⃣ VERIFY OTP
        if (actiontype === "verifyotp") {
            if (!req.session.otp || email !== req.session.otpEmail) {
                return res.render("forgot", {
                    message: "Please send OTP first.",
                    email,
                    otpSent: false,
                    otpVerified: false
                });
            }

            if (otp === req.session.otp) {
                req.session.otpVerified = true;

                return res.render("forgot", {
                    message: "OTP verified successfully!",
                    email,
                    otpSent: true,
                    otpVerified: true
                });
            }

            return res.render("forgot", {
                message: "Incorrect OTP.",
                email,
                otpSent: true,
                otpVerified: false
            });
        }

        // 3️⃣ UPDATE PASSWORD
        if (actiontype === "updatepassword") {
            if (!req.session.otpVerified || email !== req.session.otpEmail) {
                return res.render("forgot", {
                    message: "Verify OTP first.",
                    email,
                    otpSent: true,
                    otpVerified: false
                });
            }

            await db.query("UPDATE user_details SET pass=$1 WHERE gmail=$2", [newPassword, email]);

            // Clear session OTP info
            req.session.otp = null;
            req.session.otpEmail = null;
            req.session.otpVerified = null;

            return res.render("forgot", {
                message: "Password updated successfully!",
                email: "",
                otpSent: false,
                otpVerified: false
            });
        }

        // Fallback
        return res.render("forgot", {
            message: "Unknown action.",
            email,
            otpSent: false,
            otpVerified: false
        });

    } catch (err) {
        return res.render("forgot", {
            message: "Server error. Please try again later.",
            email,
            otpSent: false,
            otpVerified: false
        });
    }
});

app.post("/support-help",async(req,res)=>{
    const data = req.body;
    const user = await db.query("SELECT gmail FROM user_details WHERE id=$1",[req.session.userid]);
    // Set up nodemailer transporter
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'teamjobspark@gmail.com',
            pass: "gplu ovxn cpby lnyx"
        }
    });
    let mailOptions = {
        from: 'teamjobspark@gmail.com',
        replyTo: user.rows[0].gmail,
        to: 'teamjobspark@gmail.com',
        subject: 'Support Request',
        text: data.issue
    };
   transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.log(error);
        return res.render("partials/help.ejs", { message: "There was an error on sending your issue. Please check your internet & try again later." });
    }
    res.render("partials/help.ejs", { message: "Your issue has been sent. We will contact you as soon as possible." });
});
})
app.post("/send-feedback",async(req,res)=>{
    const data = req.body;
    const user = await db.query("SELECT gmail FROM user_details WHERE id=$1",[req.session.userid]);
    // Set up nodemailer transporter
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'teamjobspark@gmail.com',
            pass: "gplu ovxn cpby lnyx"
        }
    });
    let mailOptions = {
        from: 'teamjobspark@gmail.com',
        replyTo: user.rows[0].gmail,
        to: 'teamjobspark@gmail.com',
        subject: 'Feedback Submission',
        text: data.rating
    };
   transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.log(error);
        return res.render("partials/feedback.ejs", { message: "There was an error on sending your feedback. Please check your internet & try again later." });
    }

    res.render("partials/feedback.ejs", { message: "Your feedback has been sent. Thanks for your response." });
});
    
})
app.post("/verify-otp", (req, res) => {
    const { otp } = req.body;
    if (!req.session || !req.session.otp) {
        return res.status(400).json({ success: false, message: "No OTP requested. Request an OTP first." });
    }
    if (!otp) {
        return res.status(400).json({ success: false, message: "OTP missing." });
    }
    if (otp.toString() === req.session.otp) {
        req.session.otpVerified = true;
        return res.json({ success: true, message: "OTP verified." });
    }
    return res.status(400).json({ success: false, message: "Invalid OTP." });
});
app.post("/reset-password", async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!req.session || !req.session.otpVerified || !req.session.otpEmail) {
            return res.status(400).json({ success: false, message: "OTP not verified or session expired." });
        }
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
        }

        await db.query(
            "UPDATE user_details SET pass = $1 WHERE gmail = $2",
            [newPassword, req.session.otpEmail]
        );

        // clear otp session flags
        delete req.session.otp;
        delete req.session.otpVerified;
        delete req.session.otpEmail;

        return res.json({ success: true, message: "Password updated." });
    } catch (err) {
        console.error("reset-password error:", err);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});
app.listen(port, () => {
    console.log("running at 3000 ");
})




