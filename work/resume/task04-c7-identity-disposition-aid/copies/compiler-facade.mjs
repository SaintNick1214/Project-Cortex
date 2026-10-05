/** The hook redirects exactly esbuild imports here after a source-bound session is installed. */
export async function build(options){const session=globalThis[Symbol.for('CORTEX_OWN_C3_COMPILER_SESSION')];if(!session)throw Error('QA_BRIDGE_COMPILER_SESSION_REQUIRED');return session.build(options);}
export function stop(){throw Error('QA_BRIDGE_COMPILER_STOP_UNSUPPORTED');}
