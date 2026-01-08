import axios, { AxiosInstance } from 'axios'

// Local Node test server base URL (use 127.0.0.1 to avoid potential IPv6 localhost issues)
const LOCAL_BASE_URL = 'http://127.0.0.1:4000'

const localApi: AxiosInstance = axios.create({
  baseURL: LOCAL_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export default localApi


