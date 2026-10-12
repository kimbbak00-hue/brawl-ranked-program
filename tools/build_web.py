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
# 앱용은 완전한 문서로 감싼다(브라우저 게시용은 게시 시 자동으로 감싸짐)
app_html = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">'
            '<style>[hidden]{display:none!important}</style></head><body>' + html + '</body></html>')
for out, body in [(root / "app/src/main/assets/index.html", app_html), (root / "dist/brawl-pickboard.html", html)]:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(body, encoding="utf-8")
    print("wrote", out.relative_to(root), len(body.encode()), "bytes")
