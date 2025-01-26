import express from 'express';
import mongoose from 'mongoose';
import 'dotenv/config'
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import admin from "firebase-admin";
import serviceAccountKey from "./etc/secrets/firebase_private_key.json" with { type: "json" }
import { getAuth } from "firebase-admin/auth";
import User from './Schema/User.js';

const server = express();

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey)
})

let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/; // regex for email
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/; // regex for password
let PORT = 3173;

server.use(express.json());
server.use(cors(
    {
        origin: '*',
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "username"],
        preflightContinue: false,
    }
))

mongoose.connect((process.env.DB_LOCATION), {
    autoIndex: true
})

const verifyJWT = (req, res, next) => {

    const authHeader = req.headers['authorization'];

    console.log("NUMBER 5: " + authHeader)

    const token = authHeader && authHeader.split(" ")[1];

    if(token == null){
        return res.status(401).json({ error: "No access token" })
    }

    jwt.verify(token, process.env.SECRET_ACCESS_KEY, (err, user) => {
        if(err) {
            return res.status(403).json({ error: "Access token is invalid" })
        }

        req.user = user.id
        req.admin = user.admin
        next()
    })

}

const formatDatatoSend = (user) => {

    const access_token = jwt.sign({ id: user._id, admin: user.admin }, process.env.SECRET_ACCESS_KEY)

    return {
        access_token,
        profile_img: user.personal_info.profile_img,
        username: user.personal_info.username,
        fullname: user.personal_info.fullname,
        isAdmin: user.admin
    }
}

const generateUsername = async (email) => {

    console.log("NUMBER 4: " + email)

    let username = email.split("@")[0];

    let isUsernameNotUnique = await User.exists({ "personal_info.username": username }).then((result) => result)

    isUsernameNotUnique ? username += nanoid().substring(0, 5) : "";

    return username;

}

server.post("/signup", (req, res) => {

    let { fullname, email, password } = req.body;
    let isAdmin = false;

    console.log("NUMBER 3: " + process.env.ADMIN_EMAILS)

    if (process.env.ADMIN_EMAILS.split(",").includes(email)) {
        isAdmin = true;
    }

   // validating the data from frontend
   if (fullname.length < 3){
        return res.status(403).json({ "error": "Fullname must be at least 3 letters long" })
   }
   if (!email.length){
        return res.status(403).json({ "error": "Enter Email" })
   }
   if (!emailRegex.test(email)){
        return res.status(403).json({ "error": "Email is invalid" })
   }
   if (!passwordRegex.test(password)){
        return res.status(403).json({ "error": "Password should be 6 to 20 characters long with a numeric, 1 lowercase and 1 uppercase letters" })
   }

   bcrypt.hash(password, 10, async (err, hashed_password) => {

        let username = await generateUsername(email);

        let user = new User({
            personal_info: { fullname, email, password: hashed_password, username },
            admin: isAdmin,
            google_auth: false,
            facebook_auth: false
        })

        user.save().then((u) => {

            console.log("You successfully signed up!")
            return res.status(200).json(formatDatatoSend(u))

        })
        .catch(err => {

            if(err.code == 11000) {
                return res.status(500).json({ "error": "Email already exists" })
            }

            return res.status(500).json({ "error": err.message })
        })

   })

})

server.post("/signin", (req, res) => {

    let { email, password } = req.body;

    User.findOne({ "personal_info.email": email })
    .then((user) => {
        if(!user){
            return res.status(403).json({ "error": "Email not found" });
        }
        

        if(!user.google_auth || !user.facebook_auth){

            bcrypt.compare(password, user.personal_info.password, (err, result) => {

                if(err) {
                    return res.status(403).json({ "error": "Error occured while login please try again" });
                }
    
                if(!result){
                    return res.status(403).json({ "error": "Incorrect password" })
                } else{
                    console.log("You successfully signed in with an email!")
                    return res.status(200).json(formatDatatoSend(user))
                }
    
            })

        } else {
            return res.status(403).json({ "error": "Account was created using an oauth provider. Try logging in with with Facebook or Google." })
        }

    })
    .catch(err => {
        console.log(err.message);
        return res.status(500).json({ "error": err.message })
    })

})

server.post("/google-auth", async (req, res) => {

    let { access_token } = req.body;

    getAuth()
    .verifyIdToken(access_token)
    .then(async (decodedUser) => {

        let { email, name, picture } = decodedUser;
        let isAdmin = false;

        console.log("NUMBER 1: " + process.env.ADMIN_EMAILS)
        
        if (process.env.ADMIN_EMAILS.split(",").includes(email)) {
            isAdmin = true;
        }

        picture = picture.replace("s96-c", "s384-c");

        let user = await User.findOne({"personal_info.email": email}).select("personal_info.fullname personal_info.username personal_info.profile_img admin google_auth facebook_auth").then((u) => {
            return u || null
        })
        .catch(err => {
            return res.status(500).json({ "error": err.message })
        })

        if(user) { // login
            if(!user.google_auth){
                return res.status(403).json({ "error": "This email was signed up without google. Please log in with password to access the account" })
            }
        }
        else { // sign up
            
            let username = await generateUsername(email);

            user = new User({
                personal_info: { fullname: name, email, username, profile_img: picture },
                admin: isAdmin,
                google_auth: true,
                facebook_auth: false
            })

            await user.save().then((u) => {
                user = u;
            })
            .catch(err => {
                return res.status(500).json({ "error": err.message })
            })

        }

        console.log("You successfully signed in with Google!")
        return res.status(200).json(formatDatatoSend(user))

    })
    .catch(err => {
        console.log(err.message)
        return res.status(500).json({ "error": "Failed to authenticate you with google. Try with some other google account" })
    })

})

server.post("/facebook-auth", async (req, res) => {

    let { access_token } = req.body;
    
    
    getAuth()
    .verifyIdToken(access_token)
    .then(async (decodedUser) => {
        
        let { email, name, picture } = decodedUser;
        let isAdmin = false;

        console.log("NUMBER 2: " + process.env.ADMIN_EMAILS)
        
        if (process.env.ADMIN_EMAILS.split(",").includes(email)) {
            isAdmin = true;
        }

        let user = await User.findOne({"personal_info.email": email}).select("personal_info.fullname personal_info.username personal_info.profile_img admin google_auth facebook_auth").then((u) => {
            return u || null
        })
        .catch(err => {
            return res.status(500).json({ "error": err.message })
        })

        if(user) { // login
            if(!user.facebook_auth){
                return res.status(403).json({ "error": "This email was signed up without facebook. Please log in with password to access the account" })
            }
        }
        else { // sign up
            
            let username = await generateUsername(email);

            user = new User({
                personal_info: { fullname: name, email, username, profile_img: picture },
                admin: isAdmin,
                google_auth: false,
                facebook_auth: true
            })

            await user.save().then((u) => {
                user = u;
            })
            .catch(err => {
                return res.status(500).json({ "error": err.message })
            })

        }

        console.log("You successfully signed in with Facebook!")
        return res.status(200).json(formatDatatoSend(user))

    })
    .catch(err => {
        console.log(err.message)
        return res.status(500).json({ "error": "Failed to authenticate you with facebook. Try with some other google account" })
    })

})

server.post("/change-password", verifyJWT, (req, res) => {

    let { currentPassword, newPassword } = req.body; 

    if(!passwordRegex.test(currentPassword) || !passwordRegex.test(newPassword)){
        return res.status(403).json({ error: "Password should be 6 to 20 characters long with a numeric, 1 lowercase and 1 uppercase letters" })
    }

    User.findOne({ _id: req.user })
    .then((user) => {

        if(user.google_auth){
            return res.status(403).json({ error: "You can't change account's password because you logged in through google" })
        }

        bcrypt.compare(currentPassword, user.personal_info.password, (err, result) => {
            if(err) {
                return res.status(500).json({ error: "Some error occured while changing the password, please try again later" })
            }

            if(!result){
                return res.status(403).json({ error: "Incorrect current password" })
            }

            bcrypt.hash(newPassword, 10, (err, hashed_password) => {

                User.findOneAndUpdate({ _id: req.user }, { "personal_info.password": hashed_password })
                .then((u) => {
                    return res.status(200).json({ status: 'password changed' })
                })
                .catch(err => {
                    return res.status(500).json({ error: 'Some error occured while saving new password, please try again later' })
                })

            })
        })

    })
    .catch(err => {
        console.log(err);
        res.status(500).json({ error : "User not found" })
    })

})

server.post("/get-profile", (req, res) => {

    let { username } = req.body;

    User.findOne({ "personal_info.username": username })
    .select("-personal_info.password -google_auth -facebook_auth -updatedAt -posts")
    .then(user => {
        return res.status(200).json(user)
    })
    .catch(err => {
        console.log(err);
        return res.status(500).json({ error: err.message })
    })

})

server.post("/update-profile-img", verifyJWT, (req, res) => {

    let { url } = req.body;

    User.findOneAndUpdate({ _id: req.user }, { "personal_info.profile_img": url })
    .then(() => {
        return res.status(200).json({ profile_img: url })
    })
    .catch(err => {
        return res.status(500).json({ error: err.message })
    })

})

server.post("/update-profile", verifyJWT, (req, res) => {

    let { username, bio, social_links } = req.body;

    let bioLimit = 150;

    if(username.length < 3){
        return res.status(403).json({ error: "Username should be at least 3 letters long" });
    }

    if(bio.length > bioLimit){
        return res.status(403).json({ error: `Bio should not be more than ${bioLimit} characters` });
    }

    let socialLinksArr = Object.keys(social_links);

    try {

        for(let i = 0; i < socialLinksArr.length; i++){
            if(social_links[socialLinksArr[i]].length){
                let hostname = new URL(social_links[socialLinksArr[i]]).hostname; 

                if(!hostname.includes(`${socialLinksArr[i]}.com`) && socialLinksArr[i] != 'website'){
                    return res.status(403).json({ error: `${socialLinksArr[i]} link is invalid. You must enter a full link` })
                }

            }
        }

    } catch (err) {
        return res.status(500).json({ error: "You must provide full social links with http(s) included" })
    }

    let updateObj = {
        "personal_info.username": username,
        "personal_info.bio": bio,
        social_links
    }

    User.findOneAndUpdate({ _id: req.user }, updateObj, {
        runValidators: true
    })
    .then(() => {
        return res.status(200).json({ username })
    })
    .catch(err => {
        if(err.code == 11000){
            return res.status(409).json({ error: "username is already taken" })
        }
        return res.status(500).json({ error: err.message })
    })

})

server.listen(PORT, '0.0.0.0', () => {
    console.log('listening on port -> ' + PORT);
})