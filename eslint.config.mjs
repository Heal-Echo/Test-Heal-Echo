import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";
import checkFile from "eslint-plugin-check-file";
import tsParser from "@typescript-eslint/parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** @type {import("eslint").Linter.Config[]} */
const config = [
  // ============================================
  // 무시할 파일/폴더
  // ============================================
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "healecho-infra/**",
      "*.config.js",
      "*.config.ts",
      "*.config.mjs",
      "next-env.d.ts",
    ],
  },

  // ============================================
  // Next.js + TypeScript 기본 규칙
  // ============================================
  ...compat.extends("next/core-web-vitals"),
  ...compat.extends("plugin:@typescript-eslint/recommended"),

  // ============================================
  // Prettier 충돌 방지 (포맷 관련 ESLint 규칙 비활성화)
  // 반드시 다른 extends 뒤에 위치해야 함
  // ============================================
  ...compat.extends("prettier"),

  // ============================================
  // 전체 소스 공통 규칙
  // ============================================
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "check-file": checkFile,
    },
    rules: {
      // ------------------------------------------
      // N-01: 파일명 kebab-case 강제
      // ------------------------------------------
      "check-file/filename-naming-convention": [
        "error",
        { "src/**/*.{ts,tsx}": "KEBAB_CASE" },
        { ignoreMiddleExtensions: true },
      ],

      // ------------------------------------------
      // N-02, N-03, N-07, N-08: 네이밍 규칙
      // ------------------------------------------
      "@typescript-eslint/naming-convention": [
        "warn",
        // 기본: camelCase
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        // 변수: camelCase, UPPER_CASE(상수), PascalCase(컴포넌트)
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
        },
        // 함수: camelCase 또는 PascalCase (React 컴포넌트)
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        // Boolean 변수: is/has/can/should 접두사 강제 (N-08)
        {
          selector: "variable",
          types: ["boolean"],
          format: ["PascalCase"],
          prefix: ["is", "has", "can", "should"],
        },
        // Boolean 파라미터: is/has/can/should 접두사 강제 (N-08)
        {
          selector: "parameter",
          types: ["boolean"],
          format: ["PascalCase"],
          prefix: ["is", "has", "can", "should"],
        },
        // 파라미터: camelCase
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        // 타입, 인터페이스: PascalCase
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        // enum 멤버: camelCase, UPPER_CASE, snake_case 허용
        {
          selector: "enumMember",
          format: ["camelCase", "UPPER_CASE", "snake_case"],
        },
        // 객체 속성: 유연하게 허용 (API 응답, DynamoDB 키 등)
        {
          selector: "objectLiteralProperty",
          format: null,
        },
        // import: 유연하게 허용
        {
          selector: "import",
          format: null,
        },
      ],

      // ------------------------------------------
      // S-05: barrel export(index.ts) 금지
      // ------------------------------------------
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/types",
              message:
                "barrel import 금지 (S-05). 직접 파일 경로를 지정하세요. 예: '@/types/video'",
            },
            {
              name: "@/lib",
              message:
                "barrel import 금지 (S-05). 직접 파일 경로를 지정하세요. 예: '@/lib/storage'",
            },
            {
              name: "@/components",
              message:
                "barrel import 금지 (S-05). 직접 파일 경로를 지정하세요. 예: '@/components/admin/AdminShell'",
            },
            {
              name: "@/auth",
              message:
                "barrel import 금지 (S-05). 직접 파일 경로를 지정하세요. 예: '@/auth/tokenManager'",
            },
            {
              name: "@/config",
              message:
                "barrel import 금지 (S-05). 직접 파일 경로를 지정하세요. 예: '@/config/constants'",
            },
          ],
        },
      ],

      // ------------------------------------------
      // S-06: process.env 직접 참조 금지
      // (config, API route, middleware에서는 override로 허용)
      // ------------------------------------------
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']",
          message:
            "process.env 직접 참조 금지 (S-06). '@/config/constants'에서 import하세요.",
        },
      ],

      // ------------------------------------------
      // 기본 품질 규칙
      // ------------------------------------------
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },

  // ============================================
  // Override: config 폴더에서 process.env 허용 (S-06 예외)
  // ============================================
  {
    files: ["src/config/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },

  // ============================================
  // Override: API Route에서 process.env 허용
  // ============================================
  {
    files: ["src/app/api/**/*.ts", "src/api/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },

  // ============================================
  // Override: middleware.ts에서 process.env 허용
  // ============================================
  {
    files: ["src/middleware.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },

  // ============================================
  // Override: Next.js 특수 파일명 예외 (page.tsx, layout.tsx 등)
  // ============================================
  {
    files: [
      "src/app/**/layout.tsx",
      "src/app/**/page.tsx",
      "src/app/**/loading.tsx",
      "src/app/**/error.tsx",
      "src/app/**/not-found.tsx",
      "src/app/**/template.tsx",
      "src/app/**/default.tsx",
      "src/app/api/**/route.ts",
    ],
    rules: {
      "check-file/filename-naming-convention": "off",
    },
  },
];

export default config;
