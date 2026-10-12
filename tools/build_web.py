"""web/ 소스를 하나의 HTML로 합친다.
- app/src/main/assets/index.html : 안드로이드 앱 오버레이용
- dist/brawl-pickboard.html      : 브라우저용(같은 파일)
"""
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
web = root / "web"
head = (web / "head.html").read_text(encoding="utf-8")
js = "".join((web / f).read_text(encoding="utf-8") + "\n" for f in ["data.js", "model.js", "engine.js", "app.js"])
html = head + "<script>\n" + js + "</script>\n"
for out in [root / "app/src/main/assets/index.html", root / "dist/brawl-pickboard.html"]:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("wrote", out.relative_to(root), len(html.encode()), "bytes")
