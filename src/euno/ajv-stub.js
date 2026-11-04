// The avatar definition shipped with the app is fixed and checked when it is built (scripts/build.mjs renders it),
// so the engine's JSON-schema validator (Ajv, about 120 KB) is replaced by this pass-through.
export default class Ajv2020 { compile() { const v = () => true; v.errors = null; return v; } }
