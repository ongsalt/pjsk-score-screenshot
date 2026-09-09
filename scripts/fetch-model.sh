#!/usr/bin/env bash
# One shot: grab the manga-ocr onnx weights + the onnxruntime-web wasm, cut them
# into <25 MiB parts (cloudflare's per-asset cap) with split, and write the
# manifest that src/lib/pipeline reads. Re-run only when bumping onnxruntime-web.
set -euo pipefail
cd "$(dirname "$0")/.."

MODEL=https://huggingface.co/onnx-community/manga-ocr-base-ONNX/resolve/main
# the onnx repo ships no tokenizer, so the vocab comes from the source model
TOKENIZER=https://huggingface.co/kha-white/manga-ocr-base/resolve/main
CACHE=.model-cache
OUT=static/ocr
CHUNK=20M

get() { # <url> <dest>
  if [[ -s "$2" ]]; then echo "cached  $(basename "$2")" >&2; return; fi
  mkdir -p "$(dirname "$2")"
  echo "fetch   $(basename "$2")" >&2
  curl -fSL --retry 3 --progress-bar -o "$2.tmp" "$1"
  mv "$2.tmp" "$2"
}

chop() { # <src> -> manifest entry {file,size,sha256,parts:[{path,size}]}
  local src="$1" name size
  name="$(basename "$src")"
  size="$(stat -c%s "$src")"
  split --bytes=$CHUNK --numeric-suffixes --suffix-length=2 "$src" "$OUT/$name.part"
  echo "split   $name -> $size bytes" >&2

  jq -n --arg file "$name" --argjson size "$size" \
        --arg sha256 "$(sha256sum "$src" | cut -d' ' -f1)" \
        --argjson parts "$(
          for part in "$OUT/$name".part*; do
            jq -n --arg path "$(basename "$part")" \
                  --argjson size "$(stat -c%s "$part")" '{ path: $path, size: $size }'
          done | jq -s .
        )" \
        '{ file: $file, size: $size, sha256: $sha256, parts: $parts }'
}

get "$MODEL/onnx/encoder_model_quantized.onnx" "$CACHE/encoder.onnx"
get "$MODEL/onnx/decoder_model_quantized.onnx" "$CACHE/decoder.onnx"
get "$MODEL/config.json"                       "$CACHE/config.json"
get "$MODEL/generation_config.json"            "$CACHE/generation_config.json"
get "$MODEL/preprocessor_config.json"          "$CACHE/preprocessor_config.json"
get "$TOKENIZER/vocab.txt"                     "$CACHE/vocab.txt"

rm -rf "$OUT"
mkdir -p "$OUT"
cp "$CACHE/vocab.txt" "$OUT/vocab.txt"   # 24 KiB, no need to split

encoder="$(chop "$CACHE/encoder.onnx")"
decoder="$(chop "$CACHE/decoder.onnx")"

# bake the generation/preprocessing constants in so the browser never has to
# parse (or download) the transformers configs
jq -n \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson encoder "$encoder" --argjson decoder "$decoder" \
  --slurpfile model "$CACHE/config.json" \
  --slurpfile generation "$CACHE/generation_config.json" \
  --slurpfile preprocessor "$CACHE/preprocessor_config.json" \
  '{
    model: "onnx-community/manga-ocr-base-ONNX",
    dtype: "q8",
    generatedAt: $generatedAt,
    vocab: "vocab.txt",
    config: {
      imageSize: $preprocessor[0].size.height,
      imageMean: $preprocessor[0].image_mean,
      imageStd: $preprocessor[0].image_std,
      rescaleFactor: $preprocessor[0].rescale_factor,
      vocabSize: $model[0].decoder.vocab_size,
      decoderStartTokenId: $generation[0].decoder_start_token_id,
      eosTokenId: $generation[0].eos_token_id,
      padTokenId: $generation[0].pad_token_id,
      maxLength: $generation[0].max_length,
      noRepeatNgramSize: $generation[0].no_repeat_ngram_size
    },
    assets: { encoder: $encoder, decoder: $decoder }
  }' > "$OUT/manifest.json"

du -sh "$OUT"
