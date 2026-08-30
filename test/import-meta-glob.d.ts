// ponytail: `vite` isn't a top-level dependency, so `vite/client` types don't
// resolve. convex-test only needs the module map from `import.meta.glob`, so
// declare that one member instead of pulling in a dependency for its types.
interface ImportMeta {
  glob(pattern: string): Record<string, () => Promise<unknown>>;
}
