import js from '@eslint/js';
import globals from 'globals';
import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';
export default [
 {files:['**/*.mjs'],languageOptions:{globals:{...globals.node,...globals.browser}},rules:{...js.configs.recommended.rules,'no-unused-vars':['error',{args:'none',caughtErrors:'none'}]}},
 {files:['**/*.ts'],languageOptions:{parser,globals:{...globals.node,...globals.browser}},plugins:{'@typescript-eslint':plugin},rules:{...js.configs.recommended.rules,'no-undef':'off','no-unused-vars':'off','@typescript-eslint/no-unused-vars':['error',{args:'none'}]}}
];
