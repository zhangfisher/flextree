/// <reference types="vite/client" />

declare module "sql.js/dist/sql-wasm.wasm?url" {
  const url: string;
  export default url;
}
