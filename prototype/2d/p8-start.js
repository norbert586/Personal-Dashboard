// ---- Start ----
applySeason(seasonNow());
initFar();
buildWorld();
LS = lighting(simDate(), weatherNow());
measure();
setupActors();
setupSky();
resize();
document.getElementById('proj-count').textContent = String(PROJECTS.length);
document.getElementById('inv-count').textContent = String(new Set(PROJECTS.flatMap((p) => p.stack)).size);
tickHud();
requestAnimationFrame(frame);
const deepLink = bySlug(location.hash.slice(1));
if (deepLink) { startGame(); openBuilding(deepLink.id); } else boot();
</script>
