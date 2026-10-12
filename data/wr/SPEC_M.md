# Per-map win-rate data
Each line of your list is "Mode|modeId|Map".
1) brawlbetter (RANKED, top players, 21 days): WebFetch https://www.brawlbetter.com/maps/<map-slug> (lowercase, spaces->'-', apostrophes removed, e.g. belles-rock, out-in-the-open). Ask for EVERY brawler with a numeric win rate anywhere on the page (top-12 table AND any others mentioned in other sections) with win rate %, pick/use rate %, matches (sample size), plus total battles and "N measured brawlers".
2) metaforge (top ladder): WebFetch https://metaforge.app/brawlstars/maps?mode=<modeId>&map=<Map URL-encoded>. Ask for EVERY brawler with win rate and every team comp with its win rate and "win together" %.
Output JSON array to the file named in your task:
[{"map":"Hard Rock Mine","mode":"Gem Grab",
  "bb":{"battles":955,"measured":40,"rows":[["Rico",58,60,573],["Ash",52,30,285]]},   // [name, wr%, pick%, matches]
  "mf":{"rows":[["Bolt",62.2]], "comps":[[["Bolt","Wendy","Janet"],58,75]]},
  "ok":true}]
- Official English brawler names ("Colonel Ruffs", "Mr. P", "8-Bit", "Larry & Lawrie", "R-T", "Jae-Yong", "Starr Nova").
- Copy numbers exactly; never estimate; null for any number not shown. If a site fails twice, set that block to null.
Verify the file parses with python3. Final reply: per map, row counts for bb and mf, and any failures.
