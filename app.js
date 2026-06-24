const CHROM_LENGTH = 57227415;
const NUM_BINS = 200;
const BIN_WIDTH = CHROM_LENGTH / NUM_BINS;

const HAPLOGROUPS = {
  H: { file: 'isogg_H.json', color: '#f97316', label: 'H' },
  R: { file: 'isogg_R.json', color: '#ef4444', label: 'R' },
  L: { file: 'isogg_L.json', color: '#8b5cf6', label: 'L' },
  J: { file: 'isogg_J.json', color: '#0ea5e9', label: 'J' },
  O: { file: 'isogg_O.json', color: '#10b981', label: 'O' }
};

const overview = document.getElementById("overview");
const detailTrack = document.getElementById("detail-track");
const detail = document.getElementById("detail-panel");
const viewportBox = document.getElementById("viewport-box");
const detailLabel = document.getElementById("detail-label");
const totalCount = document.getElementById("total-count");

let allData = {};       // { H: [...markers], R: [...markers], ... }
let activeGroups = new Set(["H"]);   // which haplogroups are currently shown
let bins = {};          // { H: [...bins], R: [...bins], ... }

// --- load all haplogroup files ---
async function loadAll() {
  const entries = Object.entries(HAPLOGROUPS);
  let total = 0;

  for (const [key, info] of entries) {
    const res = await fetch(info.file);
    const markers = await res.json();
    allData[key] = markers;
    bins[key] = binMarkers(markers);
    total += markers.length;
  }

  totalCount.textContent = `${total.toLocaleString()} markers loaded across ${entries.length} haplogroups`;
  drawRuler("ruler-top", 0, CHROM_LENGTH, 10);
  drawOverview();
  buildLegend();
}

loadAll();

// --- binning ---
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

// --- shared ruler ---
function drawRuler(containerId, rangeStart, rangeEnd, stepMb) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  const rangeSpan = rangeEnd - rangeStart;
  const startMb = rangeStart / 1e6;
  const endMb = rangeEnd / 1e6;

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

// --- overview: one row per active haplogroup, stacked, for direct loci comparison ---
function drawOverview() {
  overview.innerHTML = "";
  const groups = [...activeGroups];

  if (groups.length === 0) {
    overview.innerHTML = '<div class="empty-msg">Select at least one haplogroup below</div>';
    return;
  }

  groups.forEach(key => {
    const row = document.createElement("div");
    row.className = "overview-row";

    const rowLabel = document.createElement("div");
    rowLabel.className = "row-label";
    rowLabel.textContent = key;
    rowLabel.style.color = HAPLOGROUPS[key].color;
    row.appendChild(rowLabel);

    const track = document.createElement("div");
    track.className = "overview-track";

    const maxCount = Math.max(...bins[key].map(b => b.count), 1);

    bins[key].forEach(bin => {
      const cell = document.createElement("div");
      cell.className = "bin";
      const intensity = bin.count / maxCount;
      const c = HAPLOGROUPS[key].color;
      cell.style.backgroundColor = intensity === 0 ? "#e5e7eb" : hexToRgba(c, 0.15 + intensity * 0.85);
      cell.title = `${key}: ${bin.count} SNPs · ${(bin.start/1e6).toFixed(2)}–${(bin.end/1e6).toFixed(2)} Mb`;

      if (bin.count > 0) {
        cell.addEventListener("click", () => focusBin(key, bin));
      }
      track.appendChild(cell);
    });

    row.appendChild(track);
    overview.appendChild(row);
  });
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// --- legend / haplogroup toggle checkboxes ---
function buildLegend() {
  const legend = document.getElementById("legend");
  legend.innerHTML = "";

  Object.entries(HAPLOGROUPS).forEach(([key, info]) => {
    const item = document.createElement("label");
    item.className = "legend-toggle";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = activeGroups.has(key);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        activeGroups.add(key);
      } else {
        activeGroups.delete(key);
      }
      drawOverview();
    });

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = info.color;

    const text = document.createElement("span");
    text.textContent = `${key} (${allData[key].length.toLocaleString()})`;

    item.appendChild(checkbox);
    item.appendChild(dot);
    item.appendChild(text);
    legend.appendChild(item);
  });
}

// --- viewport box on overview (shows current zoom region) ---
function drawViewportBox(bin) {
  const percentLeft = (bin.start / CHROM_LENGTH) * 100;
  const percentWidth = ((bin.end - bin.start) / CHROM_LENGTH) * 100;
  viewportBox.style.left = percentLeft + "%";
  viewportBox.style.width = Math.max(percentWidth, 0.4) + "%";
  viewportBox.style.display = "block";
}

// --- detail view: lollipop plot, colored by haplogroup, for the clicked region ---
function focusBin(sourceKey, bin) {
  drawViewportBox(bin);
  detailLabel.textContent = `Detail view — ${bin.start.toLocaleString()}–${bin.end.toLocaleString()} bp`;
  drawRuler("ruler-detail", bin.start, bin.end, null);

  detailTrack.innerHTML = "";
  const rangeWidth = bin.end - bin.start;

  // gather markers from ALL active haplogroups within this bp range, not just the clicked one
  const allMarkersInRange = [];
  activeGroups.forEach(key => {
    allData[key].forEach(m => {
      if (m.position >= bin.start && m.position < bin.end) {
        allMarkersInRange.push({ ...m, _group: key });
      }
    });
  });

  allMarkersInRange.sort((a, b) => a.position - b.position);

  const TRACK_HEIGHT = 130;
  const STEM_MIN = 40;
  const STEM_MAX = 90;
  const trackWidthPx = detailTrack.clientWidth || 900;
  const minGapPx = 14;

  let lastPercent = -999;
  let toggle = 0;

  allMarkersInRange.forEach(marker => {
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

    const color = HAPLOGROUPS[marker._group].color;

    const wrapper = document.createElement("div");
    wrapper.className = "lollipop";
    wrapper.style.left = relativePos + "%";
    wrapper.dataset.snp = marker.snp;
    wrapper.dataset.group = marker._group;

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
    label.textContent = `${marker._group}:${marker.snp}`;

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

  detail.innerHTML = `<p>${allMarkersInRange.length} markers in this region across ${activeGroups.size} active haplogroup(s). Hover to preview, click any node for full details.</p>`;
}

// --- detail panel content, position now in raw bp, no sub-clade depth ---
function showMarkerDetail(marker) {
  detail.innerHTML = `
    <h2>${marker.haplogroup} &middot; ${marker.snp}</h2>
    <div class="info-grid">
      <div class="info-cell">
        <div class="label">Position (GRCh38)</div>
        <div class="value">${marker.position.toLocaleString()} bp</div>
      </div>
      <div class="info-cell">
        <div class="label">Mutation</div>
        <div class="value">${marker.mutation || "n/a"}</div>
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

// --- search across ALL haplogroups, exact match ---
function searchSNP() {
  const query = document.getElementById("snp-search").value.trim().toUpperCase();
  const status = document.getElementById("search-status");
  if (!query) { status.textContent = ""; return; }

  let match = null;
  let matchGroup = null;

  for (const key of Object.keys(HAPLOGROUPS)) {
    const found = allData[key].find(m => m.snp.toUpperCase() === query);
    if (found) { match = found; matchGroup = key; break; }
  }

  if (!match) {
    status.textContent = `"${query}" not found in any loaded haplogroup.`;
    status.style.color = "#1a1a1a";
    return;
  }

  status.textContent = `Found ${match.snp} → haplogroup ${matchGroup}`;
  status.style.color = "#15803d";

  if (!activeGroups.has(matchGroup)) {
    activeGroups.add(matchGroup);
    buildLegend();
    drawOverview();
  }

  const binIndex = Math.min(Math.floor(match.position / BIN_WIDTH), NUM_BINS - 1);
  const bin = bins[matchGroup][binIndex];
  focusBin(matchGroup, bin);

  setTimeout(() => {
    const el = detailTrack.querySelector(`[data-snp="${match.snp}"][data-group="${matchGroup}"]`);
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
