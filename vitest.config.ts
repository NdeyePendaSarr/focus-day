import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Même alias que tsconfig.json (« @/* » -> racine du projet) : sans lui,
  // un test qui importe un fichier de l'app (lib/repo.ts) échoue au
  // chargement.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
