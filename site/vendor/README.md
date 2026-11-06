# Vendored builds

The page is a static site with no build step, so the two runtime
dependencies are committed here as ESM builds:

| File | Package | Version | Source |
| --- | --- | --- | --- |
| `imgcap.js` | [imgcap](https://www.npmjs.com/package/imgcap) | 1.1.0 | `core/dist/index.js` |
| `comctx.js` | [comctx](https://www.npmjs.com/package/comctx) | 1.7.7 | `core/dist/index.js` |

`imgcap` does the compression; `comctx` carries calls between the page and
the Web Worker that runs it. Refresh both with:

```shell
curl -sL -o site/vendor/imgcap.js https://unpkg.com/imgcap@latest/core/dist/index.js
curl -sL -o site/vendor/comctx.js https://unpkg.com/comctx@latest/core/dist/index.js
```