import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import UserAuthForm from "./pages/userAuthForm";
import { createContext, useEffect, useState } from "react";
import HomePage from "./pages/Home";
import ChangePassword from "./pages/change-password";
import PageNotFound from "./pages/404";
import ProfilePage from "./pages/profile";
import SideNav from "./components/sidenavbar";
import PrivacyPolicy from "./pages/privacy-policy";
import DataDeletion from "./pages/data-deletion";
import EditProfile from "./pages/edit-profile";

export const UserContext = createContext({})

export const ThemeContext = createContext({});

const darkThemePreference = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

const App = () => {

    const [userAuth, setUserAuth] = useState({});

    const [ theme, setTheme ] = useState(() => darkThemePreference() ? "dark" : "light" );

    useEffect(() => {

        let userInSession = sessionStorage.getItem("user");
        let themeInSession = sessionStorage.getItem("theme");

        userInSession ? setUserAuth(JSON.parse(userInSession)) : setUserAuth({ access_token: null })
        
        if (themeInSession) {
            setTheme(() => {

                document.body.setAttribute('data-theme', themeInSession);

                return themeInSession;
            
            })
        } else {
            document.body.setAttribute('data-theme', theme)
        }

    }, [])


    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            <UserContext.Provider value={{userAuth, setUserAuth}}>
                <Routes>
                    <Route path="/" element={<Navbar />}> 
                        <Route index element={<HomePage />} />
                        <Route path="dashboard" element={<SideNav />} /> 
                        <Route path="settings" element={<SideNav />}>
                            <Route path="edit-profile" element={<EditProfile />} />
                            <Route path="change-password" element={<ChangePassword />} />
                        </Route>  
                        <Route path="signin" element={<UserAuthForm type="sign-in" />} />
                        <Route path="signup" element={<UserAuthForm type="sign-up" />} />
                        <Route path="user/:id" element={<ProfilePage />} />
                        <Route path="privacy-policy" element={<PrivacyPolicy />} />
                        <Route path="data-deletion" element={<DataDeletion />} />
                        <Route path="*" element={<PageNotFound />} /> 
                    </Route>
                </Routes>
            </UserContext.Provider>
        </ThemeContext.Provider>
    );

}

export default App;