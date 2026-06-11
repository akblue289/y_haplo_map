const container = document.getElementById("map-container");
const detail = document.getElementById("detail-panel");

// Step 1: create the chromosome bar
const chrom = document.createElement("div");
chrom.id = "chromosome";
container.appendChild(chrom);

// Step 2: place a marker for each entry in MARKERS
MARKERS.forEach(function(marker) {

  const percent = (marker.position / CHROM_LENGTH) * 100;

  const el = document.createElement("div");
  el.className = "marker";
  el.style.left = percent + "%";
  el.style.backgroundColor = marker.color;
  el.title = marker.haplogroup;

  // Step 3: clicking a marker updates the detail panel
  el.addEventListener("click", function() {
    detail.innerHTML = `
      <h2>${marker.haplogroup} · ${marker.snp}</h2>
      <p><strong>Position:</strong> ${(marker.position / 1e6).toFixed(2)} Mb</p>
      <p><strong>Base change:</strong> ${marker.change}</p>
      <p><strong>Region:</strong> ${marker.region}</p>
      <p><strong>Origin:</strong> ${marker.origin}</p>
      <p>${marker.description}</p>
    `;
  });

  chrom.appendChild(el);
});
