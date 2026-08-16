import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // sql.js 以 wasm 文件形式提供，交给 vite 静态资源处理（见 src/db.ts 的 ?url 导入）
  assetsInclude: ["**/*.wasm"],
});
