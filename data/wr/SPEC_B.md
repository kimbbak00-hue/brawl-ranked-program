# Per-brawler matchup data (metaforge)
For each brawler in your list, WebFetch https://metaforge.app/brawlstars/brawlers/<slug>
(slug = lowercase, spaces -> '-', drop '.' and '&': e.g. el-primo, mr-p, 8-bit, larry-lawrie, colonel-ruffs, r-t, jae-yong, starr-nova; if 404 try variants).
Prompt the fetch to return EXACT numbers: meta tier letter, rank "#N of M", overall win rate if shown, pick rate if shown,
and every "strong against" and "struggles against" opponent with its win rate.
Output: write a JSON array to the file named in your task:
[{"en":"Shelly","slug":"shelly","tier":"D","rank":107,"of":107,"wr":null,"pick":null,
  "strong":[["Edgar",48.9],["Colt",47.5]],"weak":[["Wendy",13.6],["Bolt",17.0]],"ok":true}]
- Opponent names must be official English brawler names (e.g. "Colonel Ruffs" not "Ruffs", "Mr. P", "8-Bit", "Larry & Lawrie", "R-T", "Jae-Yong", "Starr Nova").
- Copy numbers exactly; never estimate. If a page fails after 2 tries set "ok":false and leave lists empty.
Verify the file parses with python3. Final reply: count ok / failed (names).
