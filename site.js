/* ============================================================
   site.js — your settings and your posts. This is the only file
   you edit to publish: add one line to POSTS.
   ============================================================ */

var SITE = {
  name: "Randropy",
  url: "https://www.randropy.com",
  author: "Randropy",
  lang: "en",
  description: "An entropy engine owns this blog.",
  keywords: "An entropy engine owns this blog.",

  // Shown at the bottom of every page (plain HTML).
  footer: 'To reach out, use <a href="mailto:hi@randropy.com">hi@randropy.com</a>',

  // Cloudflare Web Analytics token, or "" for none.
  analytics: "fa9d590e107f431ba52a7404a40a5370"
};

/* One line per post. Order does not matter: the newest date is
   listed first. A post dated in the future stays hidden until then.

     date     "YYYY-MM-DD"
     file     the name of the file in posts/, without ".html"
     title    shown on the home page and at the top of the post
     summary  (optional) one line for search engines and link previews
     image    (optional) a picture in assets/, shown under the title
     updated  (optional) "YYYY-MM-DD" if you revised the post
*/
var POSTS = [
  { date: "2026-09-06", file: "how-this-blog-works", title: "How this blog works", summary: "A blog made of plain files: no build step, no database, one HTML page as the editor, and a publish button that writes straight to disk." },
  { date: "2026-09-06", file: "2-ros2-client-tools", title: "2. ROS2 -Client tools" },
  { date: "2026-09-06", file: "logs-from-reviewed-papers", title: "Logs from reviewed papers" },
  { date: "2026-09-06", file: "new-2", title: "new 2" },
  { date: "2026-09-06", file: "live-by-design-not-by-default", title: "live by design not by default" },
  { date: "2026-09-05", file: "there-is-no-why", title: "There is no why"},
  { date: "2026-09-05", file: "how-to-write-here", title: "How to write here"},
  
];
