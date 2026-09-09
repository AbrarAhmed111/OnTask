import axios from "axios";
export const baseDomain = process.env.NEXT_PUBLIC_BASE_URL;

export const axiosInstance = axios.create({
  baseURL: baseDomain,
});

