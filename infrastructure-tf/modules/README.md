# Shared modules

Environment modules remain under `dev/` until the production requirements are
known. Move a module here only after its interface is proven reusable by both dev
and prod; premature sharing commonly couples their rollout and defaults.
