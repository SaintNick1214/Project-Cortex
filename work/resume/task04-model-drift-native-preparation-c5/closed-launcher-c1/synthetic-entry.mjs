import fs from 'node:fs';import path from 'node:path';
const destination=path.resolve(process.argv[2]);fs.writeFileSync(destination,'OWN_SYNTHETIC_ONLY\n',{mode:0o600});
