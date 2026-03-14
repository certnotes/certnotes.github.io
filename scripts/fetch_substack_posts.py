#!/usr/bin/env python3
"""Fetch recent posts from a Substack RSS feed into a Jekyll data file."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from xml.etree import ElementTree


CONTENT_NAMESPACE = {"content": "http://purl.org/rss/1.0/modules/content/"}
DEFAULT_FEED_URL = "https://lostmemos.substack.com/feed"
REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_PATH = REPO_ROOT / "_data" / "substack_posts.json"
DEFAULT_POST_LIMIT = 7
REQUEST_TIMEOUT_SECONDS = 20
EXCERPT_MAX_LENGTH = 280


class HTMLTextExtractor(HTMLParser):
    """Convert small HTML fragments into readable plain text."""

    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self._parts.append(data)

    def get_text(self) -> str:
        return "".join(self._parts)


@dataclass(frozen=True)
class FeedPost:
    published_at: str
    title: str
    excerpt: str
    url: str
    _sort_key: datetime

    def as_json(self) -> dict[str, str]:
        return {
            "published_at": self.published_at,
            "title": self.title,
            "excerpt": self.excerpt,
            "url": self.url,
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download recent Substack posts and save them as JSON for Jekyll.",
    )
    parser.add_argument(
        "--feed-url",
        default=DEFAULT_FEED_URL,
        help=f"RSS feed URL to fetch (default: {DEFAULT_FEED_URL})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help=f"Path to the JSON output file (default: {DEFAULT_OUTPUT_PATH})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_POST_LIMIT,
        help=f"Number of posts to keep (default: {DEFAULT_POST_LIMIT})",
    )
    return parser.parse_args()


def resolve_output_path(output_path: Path) -> Path:
    if output_path.is_absolute():
        return output_path
    return REPO_ROOT / output_path


def fetch_feed_xml(feed_url: str) -> bytes:
    request = Request(
        feed_url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
    )
    with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return response.read()


def strip_html(value: str) -> str:
    parser = HTMLTextExtractor()
    parser.feed(unescape(value))
    parser.close()
    return re.sub(r"\s+", " ", parser.get_text()).strip()


def truncate_text(value: str, max_length: int) -> str:
    if len(value) <= max_length:
        return value
    truncated = value[: max_length - 3].rsplit(" ", 1)[0].rstrip()
    if not truncated:
        truncated = value[: max_length - 3].rstrip()
    return f"{truncated}..."


def parse_pub_date(raw_value: str) -> datetime:
    parsed = parsedate_to_datetime(raw_value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def parse_feed_posts(feed_xml: bytes) -> list[FeedPost]:
    root = ElementTree.fromstring(feed_xml)
    items = root.findall("./channel/item")

    posts: list[FeedPost] = []
    for item in items:
        title = (item.findtext("title") or "").strip()
        url = (item.findtext("link") or "").strip()
        pub_date_raw = (item.findtext("pubDate") or "").strip()
        description_html = (
            item.findtext("description")
            or item.findtext("content:encoded", default="", namespaces=CONTENT_NAMESPACE)
        )

        if not title or not url or not pub_date_raw:
            continue

        published_at = parse_pub_date(pub_date_raw)
        excerpt = truncate_text(strip_html(description_html), EXCERPT_MAX_LENGTH)

        posts.append(
            FeedPost(
                published_at=published_at.isoformat(),
                title=title,
                excerpt=excerpt,
                url=url,
                _sort_key=published_at,
            )
        )

    posts.sort(key=lambda post: post._sort_key, reverse=True)
    return posts


def build_payload(feed_url: str, posts: Iterable[FeedPost], limit: int) -> dict[str, object]:
    selected_posts = [post.as_json() for post in list(posts)[:limit]]
    return {
        "feed_url": feed_url,
        "generated_at": datetime.now(tz=UTC).isoformat(),
        "posts": selected_posts,
    }


def write_json(output_path: Path, payload: dict[str, object]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    args = parse_args()
    output_path = resolve_output_path(args.output)

    if args.limit <= 0:
        print("--limit must be a positive integer.", file=sys.stderr)
        return 2

    try:
        feed_xml = fetch_feed_xml(args.feed_url)
        posts = parse_feed_posts(feed_xml)
        payload = build_payload(args.feed_url, posts, args.limit)
        write_json(output_path, payload)
    except HTTPError as exc:
        print(f"Failed to fetch feed: HTTP {exc.code} from {args.feed_url}", file=sys.stderr)
        return 1
    except URLError as exc:
        print(f"Failed to fetch feed: {exc.reason}", file=sys.stderr)
        return 1
    except ElementTree.ParseError as exc:
        print(f"Failed to parse feed XML: {exc}", file=sys.stderr)
        return 1

    print(f"Wrote {len(payload['posts'])} posts to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
