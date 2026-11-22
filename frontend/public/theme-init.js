// Applies the saved theme before first paint. Kept as a file (not inline) so the
// Content-Security-Policy can stay strict with script-src 'self'.
(function () {
  try {
    // Support both key variants for compatibility
    var saved = localStorage.getItem("bharatsim-theme") || localStorage.getItem("bharatsim.theme");
    document.documentElement.dataset.theme = saved === "dark" ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
