package webassets

import "embed"

// Dist is replaced by the root pnpm build script after the Svelte app builds.
//
//go:embed all:dist
var Dist embed.FS
