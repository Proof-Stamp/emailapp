#!/usr/bin/env bash
set -euo pipefail

RUST_VERSION="1.98.0"
MANIFEST="rust/sha256-wasm/Cargo.toml"
WASM="rust/sha256-wasm/target/wasm32-unknown-unknown/release/proofstamp_sha256_wasm.wasm"
GENERATED="public/rust-sha256-wasm.js"
LOCK_EXPORT="public/cargo-lock-preview.txt"

if [[ ! -f "$GENERATED" ]]; then
  if ! command -v rustup >/dev/null 2>&1; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup-init.sh
    sh /tmp/rustup-init.sh -y --profile minimal --default-toolchain "$RUST_VERSION" --target wasm32-unknown-unknown
    # shellcheck disable=SC1090
    source "$HOME/.cargo/env"
  fi

  rustup toolchain install "$RUST_VERSION" --profile minimal --target wasm32-unknown-unknown
  cargo +"$RUST_VERSION" generate-lockfile --manifest-path "$MANIFEST"
  cargo +"$RUST_VERSION" build --manifest-path "$MANIFEST" --release --target wasm32-unknown-unknown --locked
  node scripts/check-rust-wasm.mjs "$WASM"
  node scripts/embed-rust-wasm.mjs "$WASM" "$GENERATED"
fi

# Temporary preview-only export so the exact lockfile produced by the pinned
# Cloudflare build can be committed before removing this compiler path.
cp rust/sha256-wasm/Cargo.lock "$LOCK_EXPORT"

node scripts/check-dual-hash.mjs
