import js from '@eslint/js';
import globals from 'globals';
// Root profile explicitly excludes QA standalones; apply its recommended JS rules here.
export default [{files:['**/*.mjs'],languageOptions:{ecmaVersion:2022,sourceType:'module',globals:{...globals.node,...globals.es2021}},rules:{...js.configs.recommended.rules}}];
