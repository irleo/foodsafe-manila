import { useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const axiosPrivate = axios.create({
  withCredentials: true,
});

export default function useAxiosPrivate() {
  const { auth, setAuth } = useAuth();

  useEffect(() => {
    const requestIntercept = axiosPrivate.interceptors.request.use(
      (config) => {
        if (!config.headers.Authorization && auth?.accessToken) {
          config.headers.Authorization = `Bearer ${auth.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseIntercept = axiosPrivate.interceptors.response.use(
      (response) => response,
      async (error) => {
        const prevRequest = error?.config;

        if (
          error?.response?.status === 401 &&
          !prevRequest?._retry
        ) {
          prevRequest._retry = true;

          try {
            const refreshRes = await axios.get("/api/auth/refresh", {
              withCredentials: true,
            });

            const newAccessToken = refreshRes.data.accessToken;

            setAuth({
              accessToken: newAccessToken,
              role: refreshRes.data.user.role,
              username: refreshRes.data.user.username,
            });

            prevRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return axiosPrivate(prevRequest);
          } catch (refreshError) {
            setAuth(null);
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axiosPrivate.interceptors.request.eject(requestIntercept);
      axiosPrivate.interceptors.response.eject(responseIntercept);
    };
  }, [auth, setAuth]);

  return axiosPrivate;
}