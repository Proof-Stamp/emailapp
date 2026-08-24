#!/usr/bin/env bash
set -euo pipefail

RUST_VERSION="1.98.0"
RUSTUP_VERSION="1.29.0"
MANIFEST="rust/sha256-wasm/Cargo.toml"
WASM="rust/sha256-wasm/target/wasm32-unknown-unknown/release/proofstamp_sha256_wasm.wasm"
GENERATED="public/rust-sha256-wasm.js"

case "$(uname -m)" in
  x86_64)
    RUSTUP_HOST="x86_64-unknown-linux-gnu"
    RUSTUP_SHA256="4acc9acc76d5079515b46346a485974457b5a79893cfb01112423c89aeb5aa10"
    ;;
  aarch64|arm64)
    RUSTUP_HOST="aarch64-unknown-linux-gnu"
    RUSTUP_SHA256="9732d6c5e2a098d3521fca8145d826ae0aaa067ef2385ead08e6feac88fa5792"
    ;;
  *)
    echo "Unsupported build architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

# Keep executable toolchain files under HOME. Some hosted builders mount /tmp
# with noexec. Keep the installer basename exactly "rustup-init" because rustup
# dispatches behavior from argv[0].
RUSTUP_STAGE="$HOME/.proofstamp-rustup-stage"
RUSTUP_INIT="$RUSTUP_STAGE/rustup-init"
RUSTUP_HOME="$HOME/.proofstamp-rustup"
CARGO_HOME="$HOME/.proofstamp-cargo"
export RUSTUP_HOME CARGO_HOME
export PATH="$CARGO_HOME/bin:$PATH"

rm -rf "$RUSTUP_STAGE" "$RUSTUP_HOME" "$CARGO_HOME"
mkdir -p "$RUSTUP_STAGE"
curl --fail --location --proto '=https' --tlsv1.2 \
  "https://static.rust-lang.org/rustup/archive/${RUSTUP_VERSION}/${RUSTUP_HOST}/rustup-init" \
  --output "$RUSTUP_INIT"
printf '%s  %s\n' "$RUSTUP_SHA256" "$RUSTUP_INIT" | sha256sum --check
chmod +x "$RUSTUP_INIT"

"$RUSTUP_INIT" \
  -y \
  --no-modify-path \
  --profile minimal \
  --default-toolchain "$RUST_VERSION" \
  --default-host "$RUSTUP_HOST"

rustup target add wasm32-unknown-unknown --toolchain "$RUST_VERSION"
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

rm -rf "$RUSTUP_STAGE"
