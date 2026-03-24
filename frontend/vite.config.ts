import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const apiProxyTarget = env.API_PROXY_TARGET || 'http://127.0.0.1:8000'

    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
                '@components': path.resolve(__dirname, './src/components'),
                '@pages': path.resolve(__dirname, './src/pages'),
                '@hooks': path.resolve(__dirname, './src/hooks'),
                '@context': path.resolve(__dirname, './src/context'),
                '@services': path.resolve(__dirname, './src/services'),
                '@utils': path.resolve(__dirname, './src/utils'),
                '@types': path.resolve(__dirname, './src/types'),
            },
        },
        server: {
            port: 3000,
            proxy: {
                '/api': {
                    target: apiProxyTarget,
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/api/, ''),
                },
            },
        },
    }
})
