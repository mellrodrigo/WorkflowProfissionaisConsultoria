import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, o Vite serve o frontend e faz proxy das chamadas /api
// para o backend Express (porta 4000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
