#!/usr/bin/env bash
set -euo pipefail

RUST_VERSION="1.98.0"
RUSTUP_VERSION="1.28.2"
MANIFEST="rust/sha256-wasm/Cargo.toml"
WASM="rust/sha256-wasm/target/wasm32-unknown-unknown/release/proofstamp_sha256_wasm.wasm"
GENERATED="public/rust-sha256-wasm.js"

case "$(uname -m)" in
  x86_64)
    RUSTUP_HOST="x86_64-unknown-linux-gnu"
    RUSTUP_SHA256="20a06e644b0d9bd2fbdbfd52d42540bdde820ea7df86e92e533c073da0cdd43c"
    ;;
  aarch64|arm64)
    RUSTUP_HOST="aarch64-unknown-linux-gnu"
    RUSTUP_SHA256="e3853c5a252fca15252d07cb23a1bdd9377a8c6f3efa01531109281ae47f841c"
    ;;
  *)
    echo "Unsupported build architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

RUSTUP_INIT="${TMPDIR:-/tmp}/proofstamp-rustup-init"
RUSTUP_HOME="${TMPDIR:-/tmp}/proofstamp-rustup-home"
CARGO_HOME="${TMPDIR:-/tmp}/proofstamp-cargo-home"
export RUSTUP_HOME CARGO_HOME
export PATH="$CARGO_HOME/bin:$PATH"

rm -rf "$RUSTUP_HOME" "$CARGO_HOME"
curl --fail --location --proto '=https' --tlsv1.2 \
  "https://static.rust-lang.org/rustup/archive/${RUSTUP_VERSION}/${RUSTUP_HOST}/rustup-init" \
  --output "$RUSTUP_INIT"
printf '%s  %s\n' "$RUSTUP_SHA256" "$RUSTUP_INIT" | sha256sum --check --strict
chmod +x "$RUSTUP_INIT"

"$RUSTUP_INIT" \
  -y \
  --no-modify-path \
  --profile minimal \
  --default-toolchain "$RUST_VERSION" \
  --target wasm32-unknown-unknown

rustup --version
rustc +"$RUST_VERSION" --version
cargo +"$RUST_VERSION" --version

cargo +"$RUST_VERSION" build \
  --manifest-path "$MANIFEST" \
  --release \
  --target wasm32-unknown-unknown \
  --locked

node scripts/check-rust-wasm.mjs "$WASM"
node scripts/embed-rust-wasm.mjs "$WASM" "$GENERATED"
node scripts/check-dual-hash.mjs
