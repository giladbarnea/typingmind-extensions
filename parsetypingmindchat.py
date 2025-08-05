import json
import sys
from textwrap import shorten


def print_json_structure(data, indent=0, key=None):
    prefix = f"{'  ' * indent}{key}:" if key else ""

    if isinstance(data, dict):
        print(f"{prefix} dict")
        for k, v in data.items():
            print_json_structure(v, indent + 1, k)
    elif isinstance(data, list):
        print(f"{prefix} list ({len(data)} items)")
        if data:
            for i, item in enumerate(data):
                print_json_structure(item, indent + 1, f"item[{i}]")
        else:
            print(f"{'  ' * (indent + 1)}empty")
    elif isinstance(data, str):
        print(f"{prefix} str = {shorten(data, width=35)!r}")
    elif isinstance(data, int):
        print(f"{prefix} int = {data}")
    elif isinstance(data, float):
        print(f"{prefix} float = {data}")
    elif isinstance(data, bool):
        print(f"{prefix} bool = {data}")
    elif data is None:
        print(f"{prefix} null")
    else:
        print(f"{prefix} {type(data).__name__} = {shorten(str(data), width=35)!r}")


def _first_60_chars(msg):
    """
    Return a short preview of the message content,
    whether it's plain text or the newer {type:'text', text:'...'} form.
    """
    if isinstance(msg["content"], str):
        return msg["content"].replace("\n", " ")
    # content is a list of blocks; grab the first textual one
    blocks = msg["content"]
    if blocks and blocks[0]["type"] == "text":
        return blocks[0]["text"].replace("\n", " ")
    return "<non-text>"


def walk(messages, prefix="", in_thread=False):
    """
    prefix      – the ASCII tree decoration already built for this depth
    in_thread   – True if we’re currently inside a thread (branch)
    """
    for idx, msg in enumerate(messages):
        last = idx == len(messages) - 1  # helps pick └─ vs ├─
        pipe = "└─" if last else "├─"

        role_letter = {"user": "U", "assistant": "A"}.get(msg["role"], "?")
        where = "branch" if in_thread else "root"

        print(
            f"{prefix}{pipe} {role_letter} {msg['uuid'][:6]} [{where}]"
            f": {_first_60_chars(msg)}"
        )

        # ── Prepare new prefix for children (threads or next siblings)
        new_prefix = prefix + ("   " if last else "│  ")

        # ── Recurse into each thread of this message
        for t_idx, th in enumerate(msg.get("threads", [])):
            # Show a header line so the thread stands out
            thread_pipe = "│  " if not last else "   "
            print(f"{new_prefix}{thread_pipe}⇢ thread-{t_idx}")
            walk(th["messages"], new_prefix + thread_pipe, in_thread=True)


def main():
    file_path = "./pecan-chat-db-aug-4-2025.min.json"
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        print_json_structure(data)
        print("-" * 100)
        walk(data["messages"])
    except FileNotFoundError:
        print(f"Error: File not found at '{file_path}'", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from '{file_path}': {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
