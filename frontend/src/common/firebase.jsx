import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, FacebookAuthProvider, getAuth, signInWithPopup } from 'firebase/auth'

const firebaseConfig = {
    apiKey: "AIzaSyCjfDeEyT2z0OKBmXpZWH9IlpU4-5dx86o",
    authDomain: "christisking-92eae.firebaseapp.com",
    projectId: "christisking-92eae",
    storageBucket: "christisking-92eae.firebasestorage.app",
    messagingSenderId: "454404922856",
    appId: "1:454404922856:web:0400a0ad32381f73a9185d"
};

const app = initializeApp(firebaseConfig);

// Google Authentication
const google_provider = new GoogleAuthProvider();
const google_auth = getAuth();

export const authWithGoogle = async () => {

    let user = null;

    await signInWithPopup(google_auth, google_provider)
    .then((result) => {
        user = result.user
    })
    .catch((err) => {
        console.log(err)
    })

    return user;
}

// Facebook Authentication
const facebook_provider = new FacebookAuthProvider();
const facebook_auth = getAuth();

export const authWithFacebook = async () => {

    let user = null;

    await signInWithPopup(facebook_auth, facebook_provider)
    .then((result) => {
        user = result.user
    })
    .catch((err) => {
        console.log(err)
    })

    return user;
}