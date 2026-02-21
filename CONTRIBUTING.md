# Contributing to @periodic/strontium

We welcome contributions! Please follow these guidelines.

## Development Setup

```bash
git clone https://github.com/periodic/strontium.git
cd strontium
npm install
npm run build
npm test
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make changes with tests
4. Run `npm run lint && npm run typecheck && npm test`
5. Open a PR with a clear description

## Coding Standards

- All code must be TypeScript with `strict: true`
- No `any` types
- Tests required for all new features
- Follow the existing code style (Prettier enforced)

## Reporting Bugs

Open an issue with:
- A minimal reproduction
- Expected vs actual behavior
- Node.js and package version

## License

By contributing, you agree your contributions will be licensed under MIT.
