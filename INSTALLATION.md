# Installation

## Requirements

- Node.js >= 18
- npm >= 8 or pnpm >= 8 or yarn >= 1.22

## npm

```bash
npm install @periodic/strontium
```

## pnpm

```bash
pnpm add @periodic/strontium
```

## yarn

```bash
yarn add @periodic/strontium
```

## Optional Peer Dependencies

For OpenTelemetry tracing:

```bash
npm install @opentelemetry/api
```

## TypeScript

No additional `@types` packages are required. Types are bundled.

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "strict": true
  }
}
```
