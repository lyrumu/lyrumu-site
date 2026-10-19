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
        self.scripts = []
        self.inputs, self.project_cards, self.stylesheets = [], [], []
        self.card_count, self.cover_images = 0, []
        self.ids, self.nested_links = [], []
        self.labels, self.label_for = {}, None
        self.social_descriptions = {"og:description": [], "twitter:description": []}
        self.social_titles = {"og:title": [], "twitter:title": []}
        self.capture, self.anchor, self.alias = None, None, False
        self.in_head = False
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        if tag == "head":
            self.in_head = True
        if tag == "script":
            self.scripts.append(attrs)
        if tag == "input":
            self.inputs.append(attrs)
        if tag == "article" and "project-card" in attrs.get("class", "").split():
            self.project_cards.append(attrs)
        if tag == "article" and {"article-link--cover-card", "article-link--card"} & set(attrs.get("class", "").split()):
            self.card_count += 1
        if tag == "label":
            self.label_for = attrs.get("for")
            self.capture = [tag, ""]
        if tag == "meta":
            key = attrs.get("property") or attrs.get("name")
            if key in self.social_descriptions:
                self.social_descriptions[key].append(attrs.get("content", ""))
            if key in self.social_titles:
                self.social_titles[key].append(attrs.get("content", ""))
            if attrs.get("name") == "description":
                self.description.append(attrs.get("content", ""))
            if attrs.get("http-equiv", "").lower() == "refresh":
                self.alias = True
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs["href"])
        if tag == "link" and attrs.get("rel") == "icon":
            self.icons.append(attrs.get("href", ""))
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.stylesheets.append(attrs["href"])
        if (tag == "title" and self.in_head) or tag == "h1" or (tag == "script" and attrs.get("type") == "application/ld+json"):
            self.capture = [tag, ""]
        if tag == "a":
            if self.anchor:
                self.nested_links.append(attrs)
            self.anchor = [attrs, ""]
        if tag == "img":
            self.images.append(attrs)
            if "cover-card__bg-img" in attrs.get("class", "").split():
                self.cover_images.append((self.card_count - 1, attrs))
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
            elif tag == "label":
                self.labels[self.label_for] = text
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
        is_article = False
        for group in page.schemas:
            for item in group if isinstance(group, list) else [group]:
                if item.get("@type") == "Article":
                    is_article = True
                    assert item.get("mainEntityOfPage") == page.canonical[0], file
        # 评论只属于 notes 普通文章与既有独立页面；列表及其所有分页不能加载。
        path = urlparse(page.canonical[0]).path
        if path == "/" or path.startswith(("/categories/", "/tags/", "/topics/", "/series/", "/notes/page/")):
            for key, descriptions in page.social_descriptions.items():
                assert descriptions == page.description, (file, key, "Social description mismatch or duplicate")
        if path == "/":
            assert page.title == "lyrumu's page", (file, "Unexpected homepage title")
            for key, titles in page.social_titles.items():
                assert titles == [page.title], (file, key, "Homepage title mismatch or duplicate")
        comments_enabled = (is_article and path.startswith("/notes/")) or path in {
            "/about/", "/life/music/",
        }
        giscus_loaders = [s for s in page.scripts if "/js/giscus-loader.min." in s.get("src", "")]
        assert len(giscus_loaders) == int(comments_enabled), (file, "Giscus loading scope")
        assert not any(s.get("src", "").startswith("https://giscus.app/") for s in page.scripts), file
        for script in giscus_loaders:
            assert "defer" in script and script.get("integrity"), (file, script)
            assert (root / urlparse(script["src"]).path.lstrip("/")).is_file(), (file, script)
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
        if path in {"/", "/notes/"} or path.startswith(("/notes/page/", "/tags/", "/categories/", "/topics/", "/series/")):
            for index, image in page.cover_images:
                expected = ("eager", "high") if index == 0 else ("lazy", "low")
                assert (image.get("loading"), image.get("fetchpriority")) == expected, (file, index, image)
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
    works = (root / "works/index.html").read_text()
    assert "/css/cover.bundle.min." in home and "/css/cover.bundle.min." not in notes
    assert "/css/music.bundle.min." in music and "/css/music.bundle.min." not in home
    assert "/js/vanilla-tilt.min.js" not in works and "data-project-tilt" not in works
    works_page = Page(works)
    radios = [item for item in works_page.inputs if item.get("name") == "works-category"]
    assert [item["value"] for item in radios] == ["project", "demo"]
    assert [item["value"] for item in radios if "checked" in item] == ["project"]
    for item in radios:
        assert item["type"] == "radio" and item.get("autocomplete") == "off", item
        count = sum(card["data-category"] == item["value"] for card in works_page.project_cards)
        assert "".join(works_page.labels[item["id"]].split()) == f'{item["value"].title()}{count}', item
    covers = [item for item in works_page.images if "blur-img" in item.get("class", "").split()]
    assert len(covers) == len(works_page.project_cards) == 3
    assert {image["alt"]: card["data-category"] for image, card in zip(covers, works_page.project_cards)} == {
        "pi-diff PLUGIN": "project", "MusicPocket": "demo", "Linear Algebra Calculator": "demo",
    }
    for image in covers:
        assert image.get("data-lqip") == "1", image
        assert "nozoom" in image.get("class", "").split(), image
        for src in [image["data-full-src"]] + [part.split()[0] for part in image["srcset"].split(",")]:
            assert src.endswith(".webp") and (root / unquote(src).lstrip("/")).is_file(), src
    detail_paths = {"/works/pi-diff/", "/works/musicpocket/", "/works/linear-algebra-calculator/"}
    card_links = [attrs for attrs, _ in works_page.links if "project-card-link" in attrs.get("class", "").split()]
    assert len(card_links) == 3 and {attrs["href"] for attrs in card_links} == detail_paths
    assert not works_page.nested_links and len(works_page.ids) == len(set(works_page.ids))
    for attrs in card_links:
        assert attrs["aria-labelledby"] in works_page.ids and "target" not in attrs, attrs
    assert not any("project-card-btn" in attrs.get("class", "").split() for attrs, _ in works_page.links)
    assert "project-card-cta" not in works
    filter_scripts = [s for s in works_page.scripts if "/js/works-filter.min." in s.get("src", "")]
    assert len(filter_scripts) == 1 and "defer" in filter_scripts[0] and filter_scripts[0].get("integrity")
    assert (root / filter_scripts[0]["src"].lstrip("/")).is_file()
    search = {item["permalink"]: item for item in json.loads((root / "index.json").read_text())}
    for path in detail_paths:
        text = (root / path.lstrip("/") / "index.html").read_text()
        detail = Page(text)
        repo_name = {"/works/musicpocket/": "MusicPocket", "/works/linear-algebra-calculator/": "linear_algebra_calculator"}.get(path, "pi-diff")
        repo = "https://github.com/lyrumu/" + repo_name
        assert repo + "#readme" in {a.get("href") for a, _ in detail.links}, path
        buttons = [(a, label) for a, label in detail.links if "project-card-btn" in a.get("class", "").split()]
        assert len(buttons) == 1 and buttons[0][0]["href"] == repo + "#readme" and buttons[0][1].strip() == "README", path
        assert not any(term in text for term in ("README 快照来源", "首次提交：", "work-project-summary", "work-back-link")), path
        category = "project" if path == "/works/pi-diff/" else "demo"
        returns = [label.strip() for a, label in detail.links if a.get("href") == "/works/#" + category]
        assert returns == ["WORKS"], path
        assert not detail.nested_links, path
        assert not any("giscus-loader" in s.get("src", "") or "works-filter" in s.get("src", "") for s in detail.scripts), path
        assert search[path]["type"] == "work" and search[path]["content"], path
        assert path not in {a.get("href") for a, _ in Page(home).links}, path
        assert "https://lyrumu.top" + path in (root / "sitemap.xml").read_text(), path
        badges = [i for i in detail.images if "readme-badge" in i.get("class", "").split()]
        assert len(badges) == {"pi-diff": 2, "MusicPocket": 0, "linear_algebra_calculator": 4}[repo_name], path
        for image in badges:
            assert "nozoom" in image["class"].split() and urlparse(image["src"]).netloc == "img.shields.io", image
        for image in detail.images:
            if not urlparse(image["src"]).scheme:
                assert (root / unquote(image["src"]).lstrip("/")).is_file(), (path, image)
        if repo_name == "linear_algebra_calculator":
            assert "https://lyrumu.github.io/linear_algebra_calculator/" in {a.get("href") for a, _ in detail.links}
    css = "\n".join((root / unquote(src).lstrip("/")).read_text() for src in works_page.stylesheets)
    assert (
        "#works-project:checked~.projects-grid>[data-category=demo],"
        "#works-demo:checked~.projects-grid>[data-category=project]{display:none}"
    ) in css
    assert ".works-category-input:focus-visible+.works-category-label" in css
    assert not (root / "works/projects").exists()
    assert "https://lyrumu.top/works/projects/" not in (root / "sitemap.xml").read_text()
    for page in pages:
        assert not any(urlparse(attrs.get("href", "")).path.startswith("/works/projects") for attrs, _ in page.links), page.canonical
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
        "/works/projects /works/ 301",
        "/works/projects/ /works/ 301",
        "/works/projects/index.xml /works/index.xml 301",
    } <= redirects
    assert (root / "works/index.xml").is_file()
    assert {
        "/series/wsl2 /notes/linux-getting-started/ 301",
        "/series/wsl2/ /notes/linux-getting-started/ 301",
    } <= redirects
    assert (root / "notes/linux-getting-started/index.html").is_file()
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
