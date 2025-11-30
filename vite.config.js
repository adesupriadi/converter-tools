import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// KONFIGURASI BERSIH (STANDARD)
// Kita menghapus "Plugin Paksa Header" karena kita menggunakan FFmpeg v0.10.1.
// Versi ini tidak membutuhkan SharedArrayBuffer, jadi lebih aman tanpa header ketat.

export default defineConfig({
  plugins: [react()],
  // Tambahan opsional: Supaya port-nya konsisten 5173
  server: {
    port: 5173,
    strictPort: true, 
  }
})