import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    server: {
      port: 4000,
      proxy: {
        '/api': {
          target: 'http://172.104.140.136',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', req.method, req.url);
              // Add CORS headers to the request
              proxyReq.setHeader('Origin', 'http://172.104.140.136');
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
              // Forward Set-Cookie headers
              if (proxyRes.headers['set-cookie']) {
                console.log('Set-Cookie headers found:', proxyRes.headers['set-cookie']);
              }
            });
          },
          // Ensure cookies are forwarded and domain is rewritten
          cookieDomainRewrite: {
            '172.104.140.136': 'localhost',
            '*': 'localhost'
          },
          // Handle CORS headers and cookies
          onProxyRes: (proxyRes, req, res) => {
            console.log('🔧 Processing proxy response...');
            
            // Set CORS headers to allow credentials
            res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4000');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Frappe-CSRF-Token, Accept');
            res.setHeader('Access-Control-Expose-Headers', 'X-Frappe-CSRF-Token, Set-Cookie');
            
            // Forward Set-Cookie headers with domain rewrite
            if (proxyRes.headers['set-cookie']) {
              console.log('🍪 Original Set-Cookie:', proxyRes.headers['set-cookie']);
              
              const rewrittenCookies = proxyRes.headers['set-cookie'].map(cookie => {
                // Rewrite domain from backend domain to localhost
                return cookie
                  .replace(/Domain=172\.104\.140\.136/gi, 'Domain=localhost')
                  .replace(/Domain=\.172\.104\.140\.136/gi, 'Domain=.localhost')
                  .replace(/; Secure/gi, '') // Remove Secure flag for localhost
                  .replace(/; SameSite=Strict/gi, '; SameSite=Lax'); // Relax SameSite for localhost
              });
              
              console.log('🍪 Rewritten Set-Cookie:', rewrittenCookies);
              res.setHeader('Set-Cookie', rewrittenCookies);
            }
            
            // Forward other important headers
            const headersToForward = [
              'x-frappe-csrf-token',
              'content-type',
              'content-length'
            ];
            
            headersToForward.forEach(header => {
              if (proxyRes.headers[header]) {
                res.setHeader(header, proxyRes.headers[header]);
              }
            });
          }
        }
      }
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true
      }),
      react()
    ]
  }
})
