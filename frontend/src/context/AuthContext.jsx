/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext();
const SESSION_CHECK_INTERVAL_MS = 60_000;
const SESSION_REQUEST_TIMEOUT_MS = 5_000;

function authFromResponse(data) {
  return {
    accessToken: data.accessToken,
    role: data.user.role,
    username: data.user.username,
  };
}

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get("/api/auth/refresh", {
          withCredentials: true,
          timeout: SESSION_REQUEST_TIMEOUT_MS,
        });
        setAuth(authFromResponse(res.data));
      } catch {
        setAuth(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const accessToken = auth?.accessToken;
    if (!accessToken) return undefined;

    let cancelled = false;
    let nextCheck;

    const endSession = () => {
      if (cancelled) return;
      setAuth((current) =>
        current?.accessToken === accessToken ? null : current,
      );
    };

    const refreshSession = async () => {
      try {
        const response = await axios.get("/api/auth/refresh", {
          withCredentials: true,
          timeout: SESSION_REQUEST_TIMEOUT_MS,
        });
        if (!cancelled) setAuth(authFromResponse(response.data));
        return true;
      } catch {
        return false;
      }
    };

    const checkSession = async () => {
      try {
        await axios.get("/api/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
          withCredentials: true,
          timeout: SESSION_REQUEST_TIMEOUT_MS,
        });
      } catch (error) {
        const status = error?.response?.status;
        const refreshed =
          (status === 401 || status === 403) && (await refreshSession());
        if (!refreshed) endSession();
      } finally {
        if (!cancelled) {
          nextCheck = window.setTimeout(
            checkSession,
            SESSION_CHECK_INTERVAL_MS,
          );
        }
      }
    };

    nextCheck = window.setTimeout(checkSession, SESSION_CHECK_INTERVAL_MS);

    const checkWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(nextCheck);
      checkSession();
    };
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(nextCheck);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [auth?.accessToken]);

  return (
    <AuthContext.Provider value={{ auth, setAuth, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
