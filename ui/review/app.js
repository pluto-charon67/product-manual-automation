const elements = {
  summary: document.querySelector("#summary"),
  mode: document.querySelector("#review-mode"),
  filter: document.querySelector("#status-filter"),
  captureList: document.querySelector("#capture-list"),
  objectList: document.querySelector("#object-list"),
  canvas: document.querySelector("#review-canvas"),
  empty: document.querySelector("#empty-state"),
  form: document.querySelector("#object-form"),
  toast: document.querySelector("#toast"),
  approveCapture: document.querySelector("#approve-capture"),
};

const context = elements.canvas.getContext("2d");
const state = { data: null, capture: null, object: null, objectType: null, image: null, view: "raw", drag: null };

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "content-type": "application/json" }, ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `Request failed: ${response.status}`);
  return result;
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  setTimeout(() => elements.toast.classList.remove("visible"), 1800);
}

function statusLabel(status) {
  return ({ pending: "待审核", approved: "已通过", rejected: "已退回", bypassed: "已跳过" })[status] ?? status;
}

function selectedGeometry() {
  if (!state.object) return null;
  return state.objectType === "annotation" ? (state.object.target ?? state.object.geometry) : state.object.geometry;
}

function renderCaptureList() {
  const filter = elements.filter.value;
  const captures = (state.data?.captures ?? []).filter((capture) => filter === "all" || capture.status === filter);
  elements.captureList.replaceChildren(...captures.map((capture) => {
    const button = document.createElement("button");
    button.className = `capture-card${capture.id === state.capture?.id ? " active" : ""}`;
    button.innerHTML = `<strong>${capture.operationId ?? capture.id}</strong><span>${capture.platform ?? ""} · ${capture.id}</span><span class="status ${capture.status}">${statusLabel(capture.status)}</span>`;
    button.addEventListener("click", () => selectCapture(capture.id));
    return button;
  }));
  const counts = (state.data?.captures ?? []).reduce((accumulator, capture) => {
    accumulator[capture.status] = (accumulator[capture.status] ?? 0) + 1;
    return accumulator;
  }, {});
  elements.summary.textContent = `共 ${state.data?.captures?.length ?? 0} 张 · 待审核 ${counts.pending ?? 0} · 已通过 ${counts.approved ?? 0} · 已退回 ${counts.rejected ?? 0}`;
}

function renderObjectList() {
  if (!state.capture) return elements.objectList.replaceChildren();
  const objects = [
    ...(state.capture.annotations ?? []).map((value) => ({ type: "annotation", value })),
    ...(state.capture.redactions ?? []).map((value) => ({ type: "redaction", value })),
  ];
  elements.objectList.replaceChildren(...objects.map(({ type, value }) => {
    const button = document.createElement("button");
    button.className = `object-row${state.object?.id === value.id ? " active" : ""}`;
    button.innerHTML = `<span class="meta"><strong>${value.id}</strong><span>${type === "annotation" ? "标注" : "脱敏"} · 修订 ${value.revision ?? 1}</span></span><span class="status ${value.status ?? "pending"}">${statusLabel(value.status ?? "pending")}</span>`;
    button.addEventListener("click", () => selectObject(type, value.id));
    return button;
  }));
}

function fillInspector() {
  elements.form.hidden = !state.object;
  if (!state.object) return;
  const geometry = selectedGeometry() ?? { x: 0, y: 0, width: 1, height: 1 };
  document.querySelector("#object-id").value = state.object.id;
  document.querySelector("#object-type").value = state.objectType === "annotation" ? "标注" : "脱敏";
  document.querySelector("#geo-x").value = Math.round(geometry.x);
  document.querySelector("#geo-y").value = Math.round(geometry.y);
  document.querySelector("#geo-width").value = Math.round(geometry.width);
  document.querySelector("#geo-height").value = Math.round(geometry.height);
  document.querySelector("#label-point-fields").hidden = state.objectType !== "annotation";
  document.querySelector("#label-x").value = Math.round(state.object.labelPoint?.x ?? geometry.x - 50);
  document.querySelector("#label-y").value = Math.round(state.object.labelPoint?.y ?? geometry.y - 40);
  document.querySelector("#object-source").value = state.object.source ?? "manual";
  document.querySelector("#object-confidence").value = state.object.confidence ?? 1;
}

async function loadImage() {
  if (!state.capture) return;
  const path = state.view === "raw" ? state.capture.rawPath : state.view === "redacted" ? state.capture.redactedPath : (state.capture.annotatedPath ?? state.capture.imagePath);
  if (!path) {
    state.image = null;
    draw();
    return;
  }
  const image = new Image();
  image.onload = () => {
    state.image = image;
    elements.canvas.width = image.naturalWidth;
    elements.canvas.height = image.naturalHeight;
    elements.empty.hidden = true;
    draw();
  };
  image.onerror = () => toast(`无法读取图片：${path}`);
  image.src = `/asset?path=${encodeURIComponent(path)}&t=${Date.now()}`;
}

function draw() {
  context.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  if (state.image) context.drawImage(state.image, 0, 0);
  if (!state.capture || state.view === "annotated") return;
  for (const redaction of state.capture.redactions ?? []) {
    const geometry = redaction.geometry;
    if (!geometry) continue;
    context.fillStyle = redaction.id === state.object?.id ? "rgb(147 51 234 / 55%)" : "rgb(31 41 55 / 45%)";
    context.fillRect(geometry.x, geometry.y, geometry.width, geometry.height);
    context.strokeStyle = "#7e22ce";
    context.lineWidth = redaction.id === state.object?.id ? 4 : 2;
    context.strokeRect(geometry.x, geometry.y, geometry.width, geometry.height);
  }
  for (const annotation of state.capture.annotations ?? []) {
    const target = annotation.target ?? annotation.geometry;
    if (!target) continue;
    const active = annotation.id === state.object?.id;
    const label = annotation.labelPoint ?? { x: Math.max(22, target.x - 50), y: Math.max(22, target.y - 40) };
    const center = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    context.strokeStyle = active ? "#2563eb" : "#ff1f0f";
    context.lineWidth = active ? 5 : 3;
    context.strokeRect(target.x, target.y, target.width, target.height);
    context.beginPath();
    context.moveTo(label.x, label.y);
    context.lineTo(center.x, center.y);
    context.stroke();
    context.fillStyle = active ? "#2563eb" : "#ff1f0f";
    context.beginPath();
    context.arc(label.x, label.y, 18, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff";
    context.font = "bold 18px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(annotation.number ?? 1, label.x, label.y + 1);
  }
}

async function selectCapture(id) {
  state.capture = state.data.captures.find((capture) => capture.id === id);
  state.object = null;
  state.objectType = null;
  renderCaptureList();
  renderObjectList();
  fillInspector();
  await loadImage();
}

function selectObject(type, id) {
  state.objectType = type;
  state.object = (type === "annotation" ? state.capture.annotations : state.capture.redactions).find((item) => item.id === id);
  renderObjectList();
  fillInspector();
  draw();
}

async function refresh(preserveCapture = true) {
  const previous = preserveCapture ? state.capture?.id : null;
  state.data = await api("/api/state");
  elements.mode.value = state.data.mode;
  renderCaptureList();
  const target = previous && state.data.captures.some((capture) => capture.id === previous) ? previous : state.data.captures[0]?.id;
  if (target) await selectCapture(target);
}

function canvasPoint(event) {
  const rectangle = elements.canvas.getBoundingClientRect();
  return { x: (event.clientX - rectangle.left) * elements.canvas.width / rectangle.width, y: (event.clientY - rectangle.top) * elements.canvas.height / rectangle.height };
}

elements.canvas.addEventListener("pointerdown", (event) => {
  if (!state.capture || state.view === "annotated") return;
  const point = canvasPoint(event);
  for (const annotation of [...(state.capture.annotations ?? [])].reverse()) {
    const label = annotation.labelPoint;
    if (label && Math.hypot(point.x - label.x, point.y - label.y) <= 24) {
      selectObject("annotation", annotation.id);
      state.drag = { kind: "label", start: point, original: { ...label } };
      elements.canvas.setPointerCapture(event.pointerId);
      return;
    }
    const target = annotation.target ?? annotation.geometry;
    if (target && point.x >= target.x && point.x <= target.x + target.width && point.y >= target.y && point.y <= target.y + target.height) {
      selectObject("annotation", annotation.id);
      state.drag = { kind: "geometry", start: point, original: { ...target } };
      elements.canvas.setPointerCapture(event.pointerId);
      return;
    }
  }
  for (const redaction of [...(state.capture.redactions ?? [])].reverse()) {
    const geometry = redaction.geometry;
    if (geometry && point.x >= geometry.x && point.x <= geometry.x + geometry.width && point.y >= geometry.y && point.y <= geometry.y + geometry.height) {
      selectObject("redaction", redaction.id);
      state.drag = { kind: "geometry", start: point, original: { ...geometry } };
      elements.canvas.setPointerCapture(event.pointerId);
      return;
    }
  }
});

elements.canvas.addEventListener("pointermove", (event) => {
  if (!state.drag || !state.object) return;
  const point = canvasPoint(event);
  const dx = point.x - state.drag.start.x;
  const dy = point.y - state.drag.start.y;
  if (state.drag.kind === "label") state.object.labelPoint = { x: state.drag.original.x + dx, y: state.drag.original.y + dy };
  else {
    const geometry = { ...state.drag.original, x: state.drag.original.x + dx, y: state.drag.original.y + dy };
    if (state.objectType === "annotation") state.object.target = geometry;
    else state.object.geometry = geometry;
  }
  fillInspector();
  draw();
});

elements.canvas.addEventListener("pointerup", () => { state.drag = null; });

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const geometry = {
    x: Number(document.querySelector("#geo-x").value),
    y: Number(document.querySelector("#geo-y").value),
    width: Number(document.querySelector("#geo-width").value),
    height: Number(document.querySelector("#geo-height").value),
  };
  const patch = state.objectType === "annotation" ? { target: geometry, labelPoint: { x: Number(document.querySelector("#label-x").value), y: Number(document.querySelector("#label-y").value) } } : { geometry };
  await api("/api/object", { method: "POST", body: JSON.stringify({ captureId: state.capture.id, objectType: state.objectType, objectId: state.object.id, patch }) });
  toast("局部修改已保存，相关衍生图片已标记为待重建");
  await refresh();
});

for (const [selector, action] of [["#approve-object", "approve"], ["#reject-object", "reject"]]) {
  document.querySelector(selector).addEventListener("click", async () => {
    if (!state.object) return;
    await api("/api/object", { method: "POST", body: JSON.stringify({ captureId: state.capture.id, objectType: state.objectType, objectId: state.object.id, action }) });
    toast(action === "approve" ? "对象已通过" : "对象已退回");
    await refresh();
  });
}

elements.approveCapture.addEventListener("click", async () => {
  if (!state.capture) return;
  await api("/api/capture/approve", { method: "POST", body: JSON.stringify({ captureId: state.capture.id }) });
  toast("整张截图及其对象已通过");
  await refresh();
});

elements.mode.addEventListener("change", async () => {
  await api("/api/mode", { method: "POST", body: JSON.stringify({ mode: elements.mode.value }) });
  await refresh();
});
elements.filter.addEventListener("change", renderCaptureList);
document.querySelector("#refresh").addEventListener("click", () => refresh());
for (const button of document.querySelectorAll(".view-button")) {
  button.addEventListener("click", async () => {
    state.view = button.dataset.view;
    document.querySelectorAll(".view-button").forEach((item) => item.classList.toggle("active", item === button));
    await loadImage();
  });
}

refresh(false).catch((error) => toast(error.message));
