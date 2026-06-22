const CHROM_LENGTH = 57227415;
const NUM_BINS = 200;
const BIN_WIDTH = CHROM_LENGTH / NUM_BINS;

const overview = document.getElementById("overview");
const detailTrack = document.getElementById("detail-track");
const detail = document.getElementById("detail-panel");
const viewportBox = document.getElementById("viewport-box");
const detailLabel = document.getElementById("detail-label");

let allMarkers = [];
let bins = [];

fetch('isogg_H.json')
  .then(res => res.json())
  .then(markers => {
    allMarkers = markers;
    bins = binMarkers(markers);
    drawRuler("ruler-top", 0, CHROM_LENGTH, 10);
    drawOverview(bins);
    console.log(`Loaded ${markers.length} markers into ${NUM_BINS} bins`);
    document.getElementById("total-count").textContent = `${markers.length} markers loaded`;
  })
  .catch(err => console.error("Failed to load JSON:", err));

// --- depth-based coloring: more sub-clade letters/numbers = deeper = darker ---
function depthOf(haplogroupName) {
  // "H1a1a1" -> count characters after the root letter "H"
  return Math.max(0, haplogroupName.length - 1);
}

function colorForDepth(depth) {
  if (depth <= 2) return "#fdba74";   // shallow
  if (depth <= 4) return "#f97316";   // mid
  return "#9a3412";                   // deep
}

// --- binning for overview density track ---
function binMarkers(markers) {
  const counts = new Array(NUM_BINS).fill(0);
  const contents = Array.from({length: NUM_BINS}, () => []);

  markers.forEach(m => {
    let idx = Math.floor(m.position / BIN_WIDTH);
    if (idx >= NUM_BINS) idx = NUM_BINS - 1;
    counts[idx]++;
    contents[idx].push(m);
  });

  return counts.map((count, i) => ({
    index: i,
    count,
    start: Math.floor(i * BIN_WIDTH),
    end: Math.floor((i + 1) * BIN_WIDTH),
    markers: contents[i]
  }));
}

// --- shared ruler drawer, used for both top and detail views ---
function drawRuler(containerId, rangeStart, rangeEnd, stepMb) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  const rangeSpan = rangeEnd - rangeStart;
  const startMb = rangeStart / 1e6;
  const endMb = rangeEnd / 1e6;

  // pick a sensible step if not given
  let step = stepMb;
  if (!step) {
    const spanMb = endMb - startMb;
    step = spanMb / 6;
  }

  for (let mb = Math.ceil(startMb / step) * step; mb <= endMb; mb += step) {
    const posBp = mb * 1e6;
    const percent = ((posBp - rangeStart) / rangeSpan) * 100;
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.style.left = percent + "%";
    tick.textContent = mb.toFixed(mb < 1 ? 3 : (step < 1 ? 2 : 0)) + " Mb";
    el.appendChild(tick);
  }
}

// --- overview density bar ---
function drawOverview(binList) {
  overview.innerHTML = "";
  const maxCount = Math.max(...binList.map(b => b.count), 1);

  binList.forEach(bin => {
    const cell = document.createElement("div");
    cell.className = "bin";
    const intensity = bin.count / maxCount;
    cell.style.backgroundColor = intensity === 0
      ? "#e5e7eb"
      : `rgba(249, 115, 22, ${0.15 + intensity * 0.85})`;
    cell.title = `${bin.count} SNPs · ${(bin.start/1e6).toFixed(2)}–${(bin.end/1e6).toFixed(2)} Mb`;

    if (bin.count > 0) {
      cell.addEventListener("click", () => focusBin(bin));
    }
    overview.appendChild(cell);
  });
}

// --- draw the box on the overview showing current zoom region ---
function drawViewportBox(bin) {
  const percentLeft = (bin.start / CHROM_LENGTH) * 100;
  const percentWidth = ((bin.end - bin.start) / CHROM_LENGTH) * 100;
  viewportBox.style.left = percentLeft + "%";
  viewportBox.style.width = Math.max(percentWidth, 0.4) + "%";
  viewportBox.style.display = "block";
}

// --- zoom into a bin: show its own ruler + spaced markers ---
function focusBin(bin) {
  drawViewportBox(bin);
  detailLabel.textContent = `Detail view — ${(bin.start/1e6).toFixed(2)} to ${(bin.end/1e6).toFixed(2)} Mb (${bin.count} markers)`;
  drawRuler("ruler-detail", bin.start, bin.end, null);

  detailTrack.innerHTML = "";
  const rangeWidth = bin.end - bin.start;
  const TRACK_HEIGHT = 90;
  const STEM_MIN = 30;
  const STEM_MAX = 70;

  // sort markers by position so we can detect close neighbors
  const sorted = [...bin.markers].sort((a, b) => a.position - b.position);

  // assign alternating stem heights when markers are close together (dandelion style)
  const minGapPx = 14; // approx px below which we treat markers as "close"
  const trackWidthPx = detailTrack.clientWidth || 900;

  let lastPercent = -999;
  let toggle = 0;

  sorted.forEach(marker => {
    const relativePos = ((marker.position - bin.start) / rangeWidth) * 100;
    const percentGapPx = ((relativePos - lastPercent) / 100) * trackWidthPx;

    let stemHeight;
    if (Math.abs(percentGapPx) < minGapPx) {
      toggle = 1 - toggle;
      stemHeight = toggle === 0 ? STEM_MIN : STEM_MAX;
    } else {
      toggle = 0;
      stemHeight = STEM_MAX;
    }
    lastPercent = relativePos;

    const color = colorForDepth(depthOf(marker.haplogroup));

    const wrapper = document.createElement("div");
    wrapper.className = "lollipop";
    wrapper.style.left = relativePos + "%";
    wrapper.dataset.snp = marker.snp;

    const stem = document.createElement("div");
    stem.className = "lollipop-stem";
    stem.style.height = stemHeight + "px";
    stem.style.backgroundColor = color;

    const node = document.createElement("div");
    node.className = "lollipop-node";
    node.style.backgroundColor = color;
    node.style.bottom = stemHeight - 5 + "px";

    const label = document.createElement("div");
    label.className = "lollipop-label";
    label.style.bottom = stemHeight + 8 + "px";
    label.textContent = marker.snp;

    wrapper.appendChild(stem);
    wrapper.appendChild(node);
    wrapper.appendChild(label);

    wrapper.addEventListener("mouseenter", () => { label.style.opacity = 1; });
    wrapper.addEventListener("mouseleave", () => { label.style.opacity = 0; });

    wrapper.addEventListener("click", (e) => {
      e.stopPropagation();
      showMarkerDetail(marker);
    });

    detailTrack.appendChild(wrapper);
  });

  detail.innerHTML = `<p>${bin.count} markers in this region. Hover to preview, click any node for full details.</p>`;
}

function showMarkerDetail(marker) {
  const depth = depthOf(marker.haplogroup);
  const depthLabel = depth <= 2 ? "Shallow" : depth <= 4 ? "Mid" : "Deep";

  detail.innerHTML = `
    <h2>${marker.haplogroup} &middot; ${marker.snp}</h2>
    <div class="info-grid">
      <div class="info-cell">
        <div class="label">Position (GRCh38)</div>
        <div class="value">${(marker.position / 1e6).toFixed(3)} Mb</div>
      </div>
      <div class="info-cell">
        <div class="label">Base pair coordinate</div>
        <div class="value">${marker.position.toLocaleString()} bp</div>
      </div>
      <div class="info-cell">
        <div class="label">Mutation</div>
        <div class="value">${marker.mutation}</div>
      </div>
      <div class="info-cell">
        <div class="label">Sub-clade branch depth</div>
        <div class="value">${depthLabel} (${depth})</div>
      </div>
      <div class="info-cell">
        <div class="label">rsID</div>
        <div class="value">${marker.rsid || "n/a"}</div>
      </div>
      <div class="info-cell">
        <div class="label">Other names</div>
        <div class="value">${marker.other_names || "n/a"}</div>
      </div>
    </div>
  `;
}

// --- search ---
function searchSNP() {
  const query = document.getElementById("snp-search").value.trim().toUpperCase();
  const status = document.getElementById("search-status");
  if (!query) { status.textContent = ""; return; }

  const match = allMarkers.find(m => m.snp.toUpperCase() === query);
  if (!match) {
    status.textContent = `"${query}" not found.`;
    status.style.color = "#dc2626";
    return;
  }

  status.textContent = `Found ${match.snp} → ${match.haplogroup}`;
  status.style.color = "#15803d";

  const binIndex = Math.min(Math.floor(match.position / BIN_WIDTH), NUM_BINS - 1);
  const bin = bins[binIndex];
  focusBin(bin);

  setTimeout(() => {
    const el = detailTrack.querySelector(`[data-snp="${match.snp}"]`);
    if (el) {
      el.querySelector(".lollipop-node").style.outline = "3px solid #15803d";
      el.querySelector(".lollipop-label").style.opacity = 1;
      el.querySelector(".lollipop-label").style.color = "#15803d";
      el.scrollIntoView({ behavior: "smooth", inline: "center" });
    }
    showMarkerDetail(match);
  }, 50);
}

document.getElementById("search-btn").addEventListener("click", searchSNP);
document.getElementById("snp-search").addEventListener("keypress", e => {
  if (e.key === "Enter") searchSNP();
});
