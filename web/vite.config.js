import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Geliştirme sırasında (npm run dev) frontend 5173'te, backend 3000'de çalışır.
// /api istekleri backend'e yönlendirilir. Production'da backend zaten dist'i
// servis ettiği için aynı origin'dir, proxy gerekmez.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
