const CHROM_LENGTH = 57227415;
const detail = document.getElementById("detail-panel");
const container = document.getElementById("map-container");

// create chromosome bar
const chrom = document.createElement("div");
chrom.id = "chromosome";
container.appendChild(chrom);

// fetch real ISOGG data
fetch('isogg_H.json')
  .then(response => response.json())
  .then(markers => {

    markers.forEach(function(marker) {
      const percent = (marker.position / CHROM_LENGTH) * 100;

      const el = document.createElement("div");
      el.className = "marker";
      el.style.left = percent + "%";
      el.style.backgroundColor = "#f97316";
      el.title = marker.snp;

      el.addEventListener("click", function() {
        detail.innerHTML = `
          <h2>${marker.haplogroup} · ${marker.snp}</h2>
          <p><strong>Position (GRCh38):</strong> ${(marker.position / 1e6).toFixed(3)} Mb</p>
          <p><strong>Mutation:</strong> ${marker.mutation}</p>
        `;
      });

      chrom.appendChild(el);
    });

    console.log(`Loaded ${markers.length} markers`);
  });