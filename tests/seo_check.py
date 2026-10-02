"""Check a production build: python3 tests/seo_check.py /tmp/lyrumu-seo-after."""

import json
import sys
from base64 import b64decode
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.title, self.description, self.headings = "", [], []
        self.canonical, self.icons, self.images, self.links, self.schemas = [], [], [], [], []
        self.capture, self.anchor, self.alias = None, None, False
        self.in_head = False
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "head":
            self.in_head = True
        if tag == "meta":
            if attrs.get("name") == "description":
                self.description.append(attrs.get("content", ""))
            if attrs.get("http-equiv", "").lower() == "refresh":
                self.alias = True
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs["href"])
        if tag == "link" and attrs.get("rel") == "icon":
            self.icons.append(attrs.get("href", ""))
        if (tag == "title" and self.in_head) or tag == "h1" or (tag == "script" and attrs.get("type") == "application/ld+json"):
            self.capture = [tag, ""]
        if tag == "a":
            self.anchor = [attrs, ""]
        if tag == "img":
            self.images.append(attrs)
            if self.anchor:
                self.anchor[1] += attrs.get("alt") or ""

    def handle_data(self, data):
        if self.capture:
            self.capture[1] += data
        if self.anchor:
            self.anchor[1] += data

    def handle_endtag(self, tag):
        if tag == "head":
            self.in_head = False
        if self.capture and self.capture[0] == tag:
            text = self.capture[1].strip()
            if tag == "title":
                self.title = text
            elif tag == "h1":
                self.headings.append(text)
            else:
                self.schemas.append(json.loads(text))
            self.capture = None
        if tag == "a" and self.anchor:
            self.links.append(self.anchor)
            self.anchor = None


def check(root):
    pages, image_sizes = [], {}
    for file in root.rglob("index.html"):
        text = file.read_text()
        page = Page(text)
        if page.alias or file.name == "404.html":
            continue
        assert page.title and len(page.headings) == 1, file
        assert len(page.description) == 1 and page.description[0], file
        expected = "https://lyrumu.top/" + file.parent.relative_to(root).as_posix().strip(".")
        assert len(page.canonical) == 1 and unquote(page.canonical[0]) == expected.rstrip("/") + "/", file
        assert set(page.icons) == {"/favicon.ico", "/favicon-32x32.png", "/favicon-16x16.png", "/favicon.svg"}, file
        assert page.schemas, file
        for group in page.schemas:
            for item in group if isinstance(group, list) else [group]:
                if item.get("@type") == "Article":
                    assert item.get("mainEntityOfPage") == page.canonical[0], file
        assert "/cdn-cgi/l/email-protection" not in text, file
        assert "@users.noreply.github.com" not in text, file
        taxonomy_badges = []
        for attrs, label in page.links:
            url = urlparse(attrs.get("href", ""))
            if "relative mt-[0.5rem] me-2" in attrs.get("class", "") and url.path.startswith(("/tags/", "/categories/")):
                taxonomy_badges.append(label.strip())
            if attrs.get("target") == "_blank":
                assert {"noopener", "noreferrer"} & set(attrs.get("rel", "").split()), (file, attrs)
            if not url.scheme and not url.netloc and url.path:
                assert label.strip(), (file, attrs)
            if "docs-taxonomy-chip" in attrs.get("class", "").split():
                assert (root / unquote(url.path).strip("/") / "index.html").is_file(), (file, attrs)
            if "share-email" in attrs.get("class", "").split():
                assert attrs["href"] == "#", (file, attrs)
                mailto = urlparse(b64decode(attrs["data-email"]).decode("ascii"))
                assert mailto.scheme == "mailto", (file, mailto)
                query = parse_qs(mailto.query)
                assert query["body"] == page.canonical, (file, query)
                assert query["subject"] == page.headings, (file, query)
        assert len(taxonomy_badges) == len(set(taxonomy_badges)), (file, taxonomy_badges)
        for attrs in page.images:
            assert "alt" in attrs, (file, attrs)
            if "article-blur-img" not in attrs.get("class", "").split():
                continue
            assert attrs["src"].endswith(".webp"), (file, attrs)
            widths = []
            for candidate in attrs["srcset"].split(","):
                src, descriptor = candidate.split()
                assert descriptor.endswith("w"), candidate
                widths.append(int(descriptor[:-1]))
                assert (root / unquote(src).lstrip("/")).is_file(), src
            assert widths == sorted(set(widths)) and widths[-1] <= int(attrs["width"]), (file, widths)
            image = root / unquote(attrs["src"]).lstrip("/")
            image_sizes[attrs["src"]] = image.stat().st_size
        pages.append(page)
    assert pages, "No content pages found"
    home = (root / "index.html").read_text()
    notes = (root / "notes/index.html").read_text()
    music = (root / "life/music/index.html").read_text()
    projects = (root / "works/projects/index.html").read_text()
    assert "/css/cover.bundle.min." in home and "/css/cover.bundle.min." not in notes
    assert "/css/music.bundle.min." in music and "/css/music.bundle.min." not in home
    assert "/js/vanilla-tilt.min.js" in projects and "/js/vanilla-tilt.min.js" not in home
    for file in (root / "notes").rglob("index.html"):
        text = file.read_text()
        if 'id=single_header' in text or 'id="single_header"' in text:
            assert text.index('class="article-content') < text.index('class="not-prose article-author-bottom"'), file
            assert 'href="https://github.com/lyrumu"' in text or 'href=https://github.com/lyrumu ' in text, file
    for icon in ("favicon.ico", "favicon-32x32.png", "favicon-16x16.png", "favicon.svg", "apple-touch-icon.png",
                 "android-chrome-192x192.png", "android-chrome-512x512.png"):
        assert (root / icon).is_file(), icon
    for values in ([p.title for p in pages], [p.description[0] for p in pages], [p.headings[0] for p in pages]):
        assert not [v for v, n in Counter(values).items() if n > 1], "Duplicate metadata or H1"
    headers = (root / "_headers").read_text()
    for header in ("Strict-Transport-Security", "X-Frame-Options", "Content-Security-Policy", "Referrer-Policy"):
        assert header + ":" in headers, header
    redirects = set((root / "_redirects").read_text().splitlines())
    assert {
        "/categories/ai/ /categories/ 301",
        "/categories/development/ /categories/ 301",
        "/categories/devops/ /categories/ 301",
        "/categories/tools/ /categories/ 301",
    } <= redirects
    print(f"PASS: {len(pages)} pages; unique titles/descriptions/H1; valid JSON-LD, links and image candidates.")
    print(f"Article default images: {len(image_sizes)} files, {sum(image_sizes.values()):,} bytes; "
          f"{sum(size > 100_000 for size in image_sizes.values())} over 100 kB.")


if __name__ == "__main__":
    check(Path(sys.argv[1]))
