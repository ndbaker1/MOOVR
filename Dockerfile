FROM rust:alpine as rust-builder
WORKDIR /home/rust/src
RUN apt update && apt install -y libssl-dev pkg-config
COPY server/src/ src/
COPY server/Cargo.* .
RUN cargo build --release

FROM scratch as deployment
COPY --from=rust-builder /home/rust/src/target/release/server .

ENV RUST_LOG=info

ENV PORT=${PORT:-80}

ENTRYPOINT ["./server"]