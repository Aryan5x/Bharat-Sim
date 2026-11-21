// Applies the saved theme before first paint. Kept as a file (not inline) so the
// Content-Security-Policy can stay strict with script-src 'self'.
(function () {
  try {
    var saved = localStorage.getItem("bharatsim.theme");
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
