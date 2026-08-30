import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Backend OpenAPI sxemasidan generatsiya qilinadi (pnpm gen:api) —
      // qoʻlda tahrirlanmaydi, shuning uchun tekshirilmaydi ham.
      "src/lib/api/**",
    ],
  },
];

export default eslintConfig;
