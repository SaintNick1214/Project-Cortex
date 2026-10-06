import js from '@eslint/js';
import globals from 'globals';
// Root ESLint ignores QA. Apply its recommended JS rules to affected standalones.
export default [{files:['**/*.mjs'],languageOptions:{ecmaVersion:2022,sourceType:'module',globals:{...globals.node,...globals.es2021}},rules:{...js.configs.recommended.rules}}];
