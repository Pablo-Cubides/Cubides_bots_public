import argparse
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe audio with local faster-whisper.")
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", default="small")
    parser.add_argument("--language", default="es")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except Exception as exc:
        print(f"faster-whisper no esta instalado: {exc}", file=sys.stderr)
        return 2

    model = WhisperModel(args.model, device="auto", compute_type="auto")
    segments, _info = model.transcribe(args.audio, language=None if args.language == "auto" else args.language)
    text = " ".join(segment.text.strip() for segment in segments if segment.text and segment.text.strip()).strip()
    if text:
        print(text)
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())


