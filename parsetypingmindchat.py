#! /usr/bin/env python3

import json
import sys
import textwrap
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


def _format_message(msg):
    """
    Return a short preview of the message content,
    whether it's plain text or the newer {type:'text', text:'...'} form.
    """
    if isinstance(msg["content"], str):
        block: str = msg["content"]
        lines = [line.rstrip() for line in block.splitlines() if line.strip()]
        if not lines:
            return ""
        if len(lines) > 1:
            payload = "\n".join(lines)
            return f"<text>\n{payload}\n</text>"
        return f"<text>{lines[0]}</text>"
    # content is a list of blocks; concatenate all blocks wrapped by their type
    blocks: list[dict] = msg["content"]
    parts = []
    for block in blocks or []:
        block_type = block.get("type", "type-field-empty")
        match block_type:
            case "text":
                lines = [
                    line.rstrip()
                    for line in block.get("text", "").splitlines()
                    if line.strip()
                ]
                if len(lines) > 1:
                    payload = "\n".join(lines)
                    parts.append(f"\n<{block_type}>\n{payload}\n</{block_type}>")
                else:
                    parts.append(f"<{block_type}>{lines[0]}</{block_type}>")
            case _:
                block_fields = ", ".join(
                    [f"{k!r}: {type(v).__name__}" for k, v in block.items()]
                )
                print(
                    f"         \x1b[33m[WARN] Unknown block type: {block_type}. Block fields: {block_fields}. Continuing anyway.\x1b[0m",
                    file=sys.stderr,
                )
                parts.append(f"\n<{block_type}>\n{block}\n</{block_type}>")
    return "".join(parts) if parts else "<empty-content>"


def walk(messages):
    is_full_chat_format = any("threads" in msg for msg in messages)
    if is_full_chat_format:
        return walk_threads(messages)
    return walk_messages(messages)


def walk_messages(messages):
    # This is perfect exactly as-is, don't modify.
    in_assistant_sequence = False
    for idx, msg in enumerate(messages):
        role = msg["role"]
        formatted_message = _format_message(msg).strip()
        if role == "assistant" and not in_assistant_sequence:
            in_assistant_sequence = True
            print(f"\n[{idx:02d}]")
            print(f"<{role.title()}>")
            if formatted_message:
                print(f"{formatted_message}")
            else:
                print("    --")
        elif role == "assistant" and in_assistant_sequence:
            print(f"    [{idx:02d}]")
            if formatted_message:
                print(textwrap.indent(formatted_message, "    "))
            else:
                print("    --")
        elif role == "user":
            in_assistant_sequence = False
            prefix = "" if idx == 0 else "</Assistant>\n\n"
            print(
                f"{prefix}[{idx:02d}]\n<{role.title()}>\n{formatted_message}\n</{role.title()}>"
            )
        else:
            assert in_assistant_sequence, (
                f"Logically shouldn't happen: in_assistant_sequence={in_assistant_sequence} and role={role}"
            )
            print(f"    [{idx:02d}]")
            print(
                textwrap.indent(
                    f"<{role.title()}: {msg['name']}>\n{formatted_message}\n</{role.title()}: {msg['name']}>",
                    "    ",
                )
            )


def walk_threads(messages, prefix="", in_thread=False):
    """
    prefix      – the ASCII tree decoration already built for this depth
    in_thread   – True if we’re currently inside a thread (branch)
    """
    for idx, msg in enumerate(messages):
        last = idx == len(messages) - 1  # helps pick └─ vs ├─
        pipe = "└─" if last else "├─"

        role = {"user": "User     ", "assistant": "Assistant"}.get(
            msg["role"], "<missing-role>"
        )
        where = "branch" if in_thread else "root"

        print(
            f"{prefix}{pipe} [{idx:02d}] {role} {msg['uuid'][:6]} [{where}]"
            f": {_format_message(msg)}"
        )

        # ── Prepare new prefix for children (threads or next siblings)
        new_prefix = prefix + ("   " if last else "│  ")

        # ── Recurse into each thread of this message
        for t_idx, th in enumerate(msg.get("threads", [])):
            # Show a header line so the thread stands out
            thread_pipe = "│  " if not last else "   "
            print(f"{new_prefix}{thread_pipe}⇢ thread-{t_idx}")
            walk_threads(th["messages"], new_prefix + thread_pipe, in_thread=True)


def main():
    file_path = sys.argv[1]
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # print_json_structure(data)
        # print("-" * 100)
        walk(data["messages"])
    except FileNotFoundError:
        print(f"Error: File not found at '{file_path}'", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from '{file_path}': {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e!r}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
