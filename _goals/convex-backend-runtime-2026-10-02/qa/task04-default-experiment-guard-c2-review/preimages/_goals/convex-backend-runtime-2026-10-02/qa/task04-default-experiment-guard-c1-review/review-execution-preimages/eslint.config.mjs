import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
export default [
 {files:['**/scripts/*.mjs','**/eslint.config.mjs'],languageOptions:{ecmaVersion:2024,sourceType:'module',globals:globals.node},rules:js.configs.recommended.rules},
 {files:['**/fixture/convex/*.ts'],languageOptions:{parser:tsParser,parserOptions:{project:'./fixture/tsconfig.json',tsconfigRootDir:here},globals:{...globals.node,...globals.browser}},plugins:{'@typescript-eslint':tsPlugin},rules:{'@typescript-eslint/no-floating-promises':'error','@typescript-eslint/await-thenable':'error','@typescript-eslint/no-misused-promises':'error','@typescript-eslint/no-explicit-any':'error','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}}
];
