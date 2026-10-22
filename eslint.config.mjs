import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["out/**", "node_modules/**", ".vscode-test/**"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            "semi": [2, "always"],
            "@typescript-eslint/no-unused-vars": 0,
            "@typescript-eslint/no-explicit-any": 0,
            "@typescript-eslint/explicit-module-boundary-types": 0,
            "@typescript-eslint/no-non-null-assertion": 0,
            // `require()` is the conventional form for CommonJS modules in VS Code extensions
            "@typescript-eslint/no-require-imports": 0,
            // Existing code uses `cond ? a : b` as a statement
            "@typescript-eslint/no-unused-expressions": 0,
        },
    },
);
