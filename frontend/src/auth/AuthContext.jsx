import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("mc_token");
    const savedUser = localStorage.getItem("mc_user");
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  async function login(username, password) {
    const { token, user: loggedInUser } = await api.login(username, password);
    localStorage.setItem("mc_token", token);
    localStorage.setItem("mc_user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  }

  function logout() {
    localStorage.removeItem("mc_token");
    localStorage.removeItem("mc_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
