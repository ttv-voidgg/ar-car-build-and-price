import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
    server: {
        https: true,
        host: '0.0.0.0',
        port: 5179
    },
    plugins: [
        tailwindcss(),mkcert(),
    ],
})