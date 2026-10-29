import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  // docs/ holds research material and one-off scripts, not app code
  { ignores: [".next/**", ".next-*/**", "out/**", "public/**", "docs/**", "next-env.d.ts"] },
];

export default config;
