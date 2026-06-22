const CHROM_LENGTH = 57227415;
const NUM_BINS = 200;
const BIN_WIDTH = CHROM_LENGTH / NUM_BINS;

const overview = document.getElementById("overview");
const detailTrack = document.getElementById("detail-track");
const detail = document.getElementById("detail-panel");

let allMarkers = [];
let bins = [];

fetch('isogg_H.json')
  .then(response => response.json())
  .then(markers => {
    allMarkers = markers;
    bins = binMarkers(markers);
    drawOverview(bins);
    drawScale();
    console.log(`Loaded ${markers.length} markers into ${NUM_BINS} bins`);
  })
  .catch(err => console.error("Failed to load JSON:", err));

function binMarkers(markers) {
  const counts = new Array(NUM_BINS).fill(0);
  const binContents = Array.from({length: NUM_BINS}, () => []);

  markers.forEach(m => {
    let idx = Math.floor(m.position / BIN_WIDTH);
    if (idx >= NUM_BINS) idx = NUM_BINS - 1;
    counts[idx]++;
    binContents[idx].push(m);
  });

  return counts.map((count, i) => ({
    index: i,
    count: count,
    start: Math.floor(i * BIN_WIDTH),
    end: Math.floor((i + 1) * BIN_WIDTH),
    markers: binContents[i]
  }));
}

function drawOverview(bins) {
  overview.innerHTML = "";
  const maxCount = Math.max(...bins.map(b => b.count), 1);

  bins.forEach(bin => {
    const cell = document.createElement("div");
    cell.className = "bin";
    const intensity = bin.count / maxCount;
    cell.style.backgroundColor = intensity === 0
      ? "#e5e7eb"
      : `rgba(249, 115, 22, ${0.15 + intensity * 0.85})`;
    cell.title = `${bin.count} SNPs · ${(bin.start/1e6).toFixed(1)}–${(bin.end/1e6).toFixed(1)} Mb`;

    if (bin.count > 0) {
      cell.addEventListener("click", () => showDetail(bin));
    }

    overview.appendChild(cell);
  });
}

function showDetail(bin) {
  detailTrack.innerHTML = "";
  detail.innerHTML = `<p>${bin.count} markers between ${(bin.start/1e6).toFixed(2)} and ${(bin.end/1e6).toFixed(2)} Mb. Click a marker below.</p>`;

  const rangeWidth = bin.end - bin.start;

  bin.markers.forEach(marker => {
    const relativePos = ((marker.position - bin.start) / rangeWidth) * 100;

    const el = document.createElement("div");
    el.className = "detail-marker";
    el.style.left = relativePos + "%";
    el.title = marker.snp;

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      detail.innerHTML = `
        <h2>${marker.haplogroup} · ${marker.snp}</h2>
        <p><strong>Position (GRCh38):</strong> ${(marker.position / 1e6).toFixed(3)} Mb</p>
        <p><strong>Mutation:</strong> ${marker.mutation}</p>
      `;
    });

    detailTrack.appendChild(el);
  });
}

function drawScale() {
  const scale = document.getElementById("scale");
  scale.innerHTML = "";
  const mbStep = 10;
  const totalMb = CHROM_LENGTH / 1e6;

  for (let mb = 0; mb <= totalMb; mb += mbStep) {
    const percent = (mb * 1e6 / CHROM_LENGTH) * 100;
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.style.left = percent + "%";
    tick.textContent = mb + " Mb";
    scale.appendChild(tick);
  }
}
