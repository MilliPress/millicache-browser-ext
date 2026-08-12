/**
 * Create the MilliCache panel.
 *
 * The icon follows the DevTools theme, which prefers-color-scheme cannot see,
 * and can only be chosen once: there is no API to change it after creation, and
 * Firefox declined `fill="context-fill"` for extension icons (bug 1391980), so
 * it cannot follow the tab colour the way built-in tabs do. This page runs on
 * every DevTools open, so a theme switch is picked up on the next one.
 */

const theme = browser.devtools.panels.themeName ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

browser.devtools.panels.create(
  "MilliCache",
  theme === "dark" ? "../icons/icon48-dark.png" : "../icons/icon48.png",
  "../panel/panel.html"
);
