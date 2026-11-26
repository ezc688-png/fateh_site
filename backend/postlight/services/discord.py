"""Sends a short message to your Discord channel. Never raises, so a Discord problem cannot break the website."""
import json
import threading
import urllib.request

from postlight.config import settings


def _clip(text: str, limit: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _post(url: str, payload: dict) -> None:
    try:
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "FatehSite/1.0"},
            method="POST",
        )
        urllib.request.urlopen(request, timeout=8).close()
    except Exception:
        pass


def notify(title: str, content: str = "", fields: list[tuple[str, str]] | None = None, color: int = 0xC00000) -> None:
    """title = the bold heading; content = the main text (what the visitor typed); fields = small labelled extras."""
    url = settings.discord_webhook_url
    if not url:
        return
    embed = {
        "title": _clip(title, 250),
        "description": _clip(content, 3500),
        "color": color,
        "fields": [
            {"name": _clip(name, 250), "value": _clip(value, 1000) or "-", "inline": True}
            for name, value in (fields or [])
        ][:10],
    }
    # parse: [] stops visitors from sneaking @everyone into your channel.
    payload = {"embeds": [embed], "allowed_mentions": {"parse": []}}
    threading.Thread(target=_post, args=(url, payload), daemon=True).start()
