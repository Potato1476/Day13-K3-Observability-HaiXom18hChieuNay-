"use strict";

const byId = (id) => document.getElementById(id);

const elements = {
  apiState: byId("api-state"),
  traffic: byId("metric-traffic"),
  p95: byId("metric-p95"),
  cost: byId("metric-cost"),
  quality: byId("metric-quality"),
  quickRunForm: byId("quick-run-form"),
  quickPreset: byId("quick-preset"),
  runQuick: byId("run-quick"),
  quickRunHelp: byId("quick-run-help"),
  stressForm: byId("stress-form"),
  stressTotal: byId("stress-total"),
  stressConcurrency: byId("stress-concurrency"),
  stressTimeout: byId("stress-timeout"),
  runStress: byId("run-stress"),
  stopRun: byId("stop-run"),
  promptLabel: byId("prompt-label"),
  promptProductionVersion: byId("prompt-production-version"),
  promptSelectionDetail: byId("prompt-selection-detail"),
  runState: byId("run-state"),
  runProgress: byId("run-progress"),
  runProgressTrack: byId("run-progress-track"),
  runProgressBar: byId("run-progress-bar"),
  runProgressLabel: byId("run-progress-label"),
  runProgressPercent: byId("run-progress-percent"),
  runSent: byId("run-sent"),
  runSuccess: byId("run-success"),
  runServerError: byId("run-server-error"),
  runClientError: byId("run-client-error"),
  runLatency: byId("run-latency"),
  runCompleted: byId("run-completed"),
  eventBody: byId("event-body"),
  commandPreview: byId("command-preview"),
  toast: byId("toast"),
  grafanaFrame: byId("grafana-frame"),
  embedLoading: byId("embed-loading"),
  openDashboard: byId("open-dashboard"),
  grafanaLink: byId("grafana-link"),
  prometheusLink: byId("prometheus-link"),
  jaegerLink: byId("jaeger-link"),
  openJaeger: byId("open-jaeger"),
  refreshTelemetry: byId("refresh-telemetry"),
  logFilterForm: byId("log-filter-form"),
  logCorrelationFilter: byId("log-correlation-filter"),
  logTraceFilter: byId("log-trace-filter"),
  logEventFilter: byId("log-event-filter"),
  logCount: byId("log-count"),
  logStream: byId("log-stream"),
  traceLookback: byId("trace-lookback"),
  traceList: byId("trace-list"),
  traceDetail: byId("trace-detail"),
};

const samples = [
  { feature: "qa", message: "Explain why metrics traces and logs work together" },
  { feature: "refund", message: "What is the refund policy?" },
  { feature: "summary", message: "Summarize the observability workflow" },
  { feature: "monitoring", message: "How should I investigate tail latency?" },
  { feature: "qa", message: "My email is student@example.com. What must logs redact?" },
  { feature: "qa", message: "Call 090 123 4567. Should this appear in logs?" },
  { feature: "summary", message: "Summarize the alert strategy" },
  { feature: "refund", message: "What proof is required for a refund?" },
];

let activeRun = null;
let toastTimer = null;
let selectedTraceId = null;
let promptRegistry = null;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || minimum));
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number(value) || 0);
}

function showToast(message, kind = "info") {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.dataset.kind = kind;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 4200);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000, parentSignal = null) {
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = () => controller.abort("parent-abort");

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort("parent-abort");
    } else {
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }
  }

  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort("timeout");
  }, timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error("Client timeout");
      timeoutError.code = "CLIENT_TIMEOUT";
      throw timeoutError;
    }
    if (parentSignal && parentSignal.aborted) {
      const stoppedError = new Error("Đã dừng từ giao diện");
      stoppedError.code = "RUN_STOPPED";
      throw stoppedError;
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener("abort", onParentAbort);
    }
  }
}

function setApiState(state, label) {
  elements.apiState.dataset.state = state;
  elements.apiState.lastElementChild.textContent = label;
}

function updateIncidentButtons(incidents) {
  document.querySelectorAll("[data-incident]").forEach((button) => {
    const enabled = Boolean(incidents[button.dataset.incident]);
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = enabled ? "Đang bật" : "Đang tắt";
  });
}

function updatePromptRegistry(registry) {
  promptRegistry = registry;
  const labels = registry?.labels || {};
  elements.promptProductionVersion.textContent = `production → ${labels.production || "unknown"}`;
  const selectedLabel = elements.promptLabel.value;
  const selectedVersion = labels[selectedLabel] || "unknown";
  const description = registry?.versions?.[selectedVersion]?.description || "Không có mô tả";
  elements.promptSelectionDetail.textContent = `${selectedLabel} → ${selectedVersion} · ${description}`;
}

async function refreshStatus({ quiet = false } = {}) {
  try {
    const [healthResponse, metricsResponse] = await Promise.all([
      fetchWithTimeout("/health", { cache: "no-store" }, 3500),
      fetchWithTimeout("/metrics", { cache: "no-store" }, 3500),
    ]);

    if (!healthResponse.ok || !metricsResponse.ok) {
      throw new Error("API status response không hợp lệ");
    }

    const [health, metrics] = await Promise.all([
      healthResponse.json(),
      metricsResponse.json(),
    ]);

    setApiState(
      "online",
      health.tracing_enabled
        ? `API online, tracing ${health.tracing_backend || "bật"}`
        : "API online, tracing tắt",
    );
    updateIncidentButtons(health.incidents || {});
    updatePromptRegistry(health.prompt_registry || {});
    elements.traffic.textContent = formatNumber(metrics.traffic);
    elements.p95.textContent = `${formatNumber(metrics.latency_p95, 0)} ms`;
    elements.cost.textContent = `$${formatNumber(metrics.total_cost_usd, 4)}`;
    elements.quality.textContent = formatNumber(metrics.quality_avg, 2);

    if (!quiet) {
      showToast("Đã cập nhật trạng thái API và metrics.");
    }
  } catch (error) {
    setApiState("offline", "API bận hoặc offline");
    if (!quiet) {
      showToast(`Không đọc được trạng thái: ${error.message}`, "error");
    }
  }
}

function resetRunStats(total) {
  return {
    total,
    sent: 0,
    completed: 0,
    success: 0,
    serverError: 0,
    clientError: 0,
    totalLatency: 0,
  };
}

function renderRunStats(stats, label) {
  elements.runState.textContent = label;
  const progress = stats.total ? Math.min(100, (stats.completed / stats.total) * 100) : 0;
  const roundedProgress = Math.round(progress);
  const hasErrors = stats.serverError > 0 || stats.clientError > 0;
  const stopped = label === "Đã dừng";
  const finished = stats.total > 0 && stats.completed >= stats.total;

  elements.runProgressBar.style.width = `${progress}%`;
  elements.runProgressLabel.textContent = `${formatNumber(stats.completed)} / ${formatNumber(stats.total)} request đã hoàn tất`;
  elements.runProgressPercent.textContent = `${roundedProgress}%`;
  elements.runProgressTrack.setAttribute("aria-valuemax", String(stats.total));
  elements.runProgressTrack.setAttribute("aria-valuenow", String(stats.completed));
  elements.runProgressTrack.setAttribute(
    "aria-valuetext",
    `${stats.completed} trên ${stats.total} request đã hoàn tất`,
  );
  elements.runProgress.dataset.state = stopped
    ? "stopped"
    : finished && hasErrors
      ? "error"
      : finished
        ? "complete"
        : "running";
  elements.runSent.textContent = formatNumber(stats.sent);
  elements.runSuccess.textContent = formatNumber(stats.success);
  elements.runServerError.textContent = formatNumber(stats.serverError);
  elements.runClientError.textContent = formatNumber(stats.clientError);
  elements.runCompleted.textContent = formatNumber(stats.completed);
  const average = stats.completed ? stats.totalLatency / stats.completed : 0;
  elements.runLatency.textContent = `${formatNumber(average, 0)} ms`;
}

function setRunControls(running) {
  elements.runQuick.disabled = running;
  elements.quickPreset.disabled = running;
  elements.runStress.disabled = running;
  elements.stopRun.disabled = !running;
  elements.stressTotal.disabled = running;
  elements.stressConcurrency.disabled = running;
  elements.stressTimeout.disabled = running;
  elements.quickRunForm.setAttribute("aria-busy", String(running));
  elements.quickRunHelp.textContent = running
    ? "Một bài test đang chạy. Bấm “Dừng gửi thêm” hoặc đợi hoàn tất để chọn bài khác."
    : "Baseline dùng concurrency 5. Chọn số lượng rồi bấm Chạy bài test đã chọn.";
}

function addEventRow(event) {
  const emptyRow = elements.eventBody.querySelector(".empty-row");
  if (emptyRow) {
    emptyRow.remove();
  }

  const row = document.createElement("tr");

  const timeCell = document.createElement("td");
  timeCell.textContent = event.time;
  row.appendChild(timeCell);

  const requestCell = document.createElement("td");
  const requestButton = document.createElement("button");
  requestButton.type = "button";
  requestButton.className = "inspect-link";
  requestButton.dataset.correlationId = event.requestId;
  requestButton.textContent = event.requestId;
  requestButton.title = "Lọc logs theo correlation ID";
  requestCell.appendChild(requestButton);
  row.appendChild(requestCell);

  const traceCell = document.createElement("td");
  if (event.traceId) {
    const traceButton = document.createElement("button");
    traceButton.type = "button";
    traceButton.className = "inspect-link";
    traceButton.dataset.traceId = event.traceId;
    traceButton.textContent = shortId(event.traceId, 12);
    traceButton.title = event.traceId;
    traceCell.appendChild(traceButton);
  } else {
    traceCell.textContent = "chưa có";
  }
  row.appendChild(traceCell);

  [event.feature, event.prompt, event.status, `${formatNumber(event.latency, 0)} ms`, event.result].forEach(
    (value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 2) {
        cell.className = event.ok ? "status-success" : "status-error";
      }
      row.appendChild(cell);
    },
  );

  elements.eventBody.prepend(row);
  while (elements.eventBody.children.length > 80) {
    elements.eventBody.lastElementChild.remove();
  }
}

function payloadFor(index, runId) {
  const sample = samples[index % samples.length];
  return {
    user_id: `ui-user-${index % 20}`,
    session_id: `ui-${runId}`,
    feature: sample.feature,
    message: sample.message,
    prompt_label: elements.promptLabel.value,
  };
}

async function sendChatRequest(index, runId, timeoutMs, signal, stats) {
  const payload = payloadFor(index, runId);
  const started = performance.now();
  stats.sent += 1;
  renderRunStats(stats, `Đang chạy ${stats.completed}/${stats.total}`);

  let response = null;
  let body = null;
  let result = "Không có response";
  let requestId = "client-only";
  let traceId = null;

  try {
    response = await fetchWithTimeout(
      "/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      timeoutMs,
      signal,
    );

    body = await response.json().catch(() => ({}));
    requestId = body.correlation_id || response.headers.get("x-request-id") || "không có ID";
    traceId = body.trace_id || response.headers.get("x-trace-id") || null;
    if (response.ok) {
      stats.success += 1;
      result = "Thành công";
    } else {
      stats.serverError += 1;
      result = body.detail || `HTTP ${response.status}`;
    }
  } catch (error) {
    stats.clientError += 1;
    if (error.code === "CLIENT_TIMEOUT") {
      result = "Client timeout";
    } else if (error.code === "RUN_STOPPED") {
      result = "Đã dừng";
    } else {
      result = error.message || "Network error";
    }
  } finally {
    const latency = performance.now() - started;
    stats.completed += 1;
    stats.totalLatency += latency;
    addEventRow({
      time: new Date().toLocaleTimeString("vi-VN"),
      requestId,
      traceId,
      feature: payload.feature,
      prompt: body?.prompt_version
        ? `${body.prompt_label} → ${body.prompt_version}`
        : payload.prompt_label,
      status: response ? String(response.status) : "CLIENT",
      latency,
      result,
      ok: Boolean(response && response.ok),
    });
    renderRunStats(stats, `Đang chạy ${stats.completed}/${stats.total}`);
  }
}

async function runLoad(total, concurrency, timeoutSeconds) {
  if (activeRun) {
    showToast("Một bài test đang chạy.", "error");
    return;
  }

  const safeTotal = clamp(total, 1, 500);
  const safeConcurrency = clamp(concurrency, 1, Math.min(50, safeTotal));
  const timeoutMs = clamp(timeoutSeconds, 1, 120) * 1000;
  const controller = new AbortController();
  const stats = resetRunStats(safeTotal);
  const runId = Date.now().toString(36);
  let nextIndex = 0;

  activeRun = { controller, stats };
  setRunControls(true);
  renderRunStats(stats, `Đang chạy 0/${safeTotal}`);

  async function worker() {
    while (!controller.signal.aborted) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= safeTotal) {
        return;
      }
      await sendChatRequest(current, runId, timeoutMs, controller.signal, stats);
    }
  }

  try {
    await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));
    const finalLabel = controller.signal.aborted ? "Đã dừng" : "Hoàn tất";
    renderRunStats(stats, finalLabel);
    showToast(
      controller.signal.aborted
        ? `Đã dừng sau ${stats.completed} kết quả. Server có thể vẫn xử lý request đã nhận.`
        : `Hoàn tất ${stats.completed} request. Đợi 5 đến 10 giây để Grafana cập nhật.`,
    );
  } finally {
    activeRun = null;
    setRunControls(false);
    window.setTimeout(() => refreshStatus({ quiet: true }), 5500);
    window.setTimeout(() => refreshTelemetry({ quiet: true }), 1500);
  }
}

async function setIncident(name, enabled) {
  const action = enabled ? "enable" : "disable";
  const command = `python scripts/inject_incident.py --scenario ${name}${enabled ? "" : " --disable"}`;
  elements.commandPreview.textContent = command;

  try {
    const response = await fetchWithTimeout(`/incidents/${name}/${action}`, { method: "POST" }, 5000);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = await response.json();
    updateIncidentButtons(body.incidents || {});
    showToast(`${name} đã ${enabled ? "bật" : "tắt"}.`);
  } catch (error) {
    showToast(`Không đổi được incident: ${error.message}`, "error");
  }
}

async function disableAllIncidents() {
  const names = ["rag_slow", "tool_fail", "cost_spike"];
  elements.commandPreview.textContent = names
    .map((name) => `python scripts/inject_incident.py --scenario ${name} --disable`)
    .join("\n");

  try {
    const results = await Promise.all(
      names.map((name) => fetchWithTimeout(`/incidents/${name}/disable`, { method: "POST" }, 5000)),
    );
    if (results.some((response) => !response.ok)) {
      throw new Error("Một incident không tắt được");
    }
    await refreshStatus({ quiet: true });
    showToast("Đã tắt toàn bộ incident.");
  } catch (error) {
    showToast(`Không tắt được toàn bộ incident: ${error.message}`, "error");
  }
}

async function moveProductionPrompt(version, rollback = false) {
  const url = rollback ? "/prompts/rollback" : "/prompts/labels/production";
  elements.commandPreview.textContent = rollback
    ? "curl -X POST http://127.0.0.1:8000/prompts/rollback"
    : `curl -X POST http://127.0.0.1:8000/prompts/labels/production -H "Content-Type: application/json" -d '{"version":"${version}"}'`;
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rollback ? undefined : JSON.stringify({ version }),
      },
      5000,
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    await refreshStatus({ quiet: true });
    showToast(
      rollback
        ? "Đã rollback production về baseline."
        : `Đã promote production sang ${version}.`,
    );
  } catch (error) {
    showToast(`Không đổi được prompt label: ${error.message}`, "error");
  }
}

function updateStressCommandPreview() {
  const total = clamp(elements.stressTotal.value, 1, 500);
  const concurrency = clamp(elements.stressConcurrency.value, 1, 50);
  const batches = Math.ceil(total / 10);
  const processes = Math.max(1, Math.ceil(concurrency / 10));
  elements.commandPreview.textContent = `seq 1 ${batches} | xargs -P ${processes} -I{} .venv/bin/python scripts/load_test.py --concurrency 10`;
}

function shortId(value, length = 10) {
  if (!value) {
    return "-";
  }
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function formatTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "-") : date.toLocaleTimeString("vi-VN");
}

function logDescription(record) {
  const parts = [];
  if (record.prompt_label || record.prompt_version) {
    parts.push(`${record.prompt_label || "prompt"} → ${record.prompt_version || "unknown"}`);
  }
  if (record.error_type) {
    parts.push(record.error_type);
  }
  if (record.latency_ms !== undefined) {
    parts.push(`${record.latency_ms} ms`);
  }
  if (record.tokens_in !== undefined || record.tokens_out !== undefined) {
    parts.push(`${record.tokens_in || 0}/${record.tokens_out || 0} tokens`);
  }
  if (record.cost_usd !== undefined) {
    parts.push(`$${Number(record.cost_usd).toFixed(6)}`);
  }
  const payload = record.payload && typeof record.payload === "object"
    ? Object.entries(record.payload)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(" · ")
    : "";
  return [parts.join(" · "), payload].filter(Boolean).join(" | ") || "Không có payload";
}

function renderLogs(items) {
  elements.logStream.replaceChildren();
  const activeFilters = [
    elements.logCorrelationFilter.value.trim(),
    elements.logTraceFilter.value.trim(),
    elements.logEventFilter.value,
  ].filter(Boolean).length;
  elements.logCount.textContent = activeFilters
    ? `${formatNumber(items.length)} event · đang lọc`
    : `${formatNumber(items.length)} event`;
  elements.logCount.dataset.filtered = String(activeFilters > 0);
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "telemetry-empty";
    empty.textContent = "Không tìm thấy log phù hợp với bộ lọc.";
    elements.logStream.appendChild(empty);
    return;
  }

  items.forEach((record) => {
    const entry = document.createElement("article");
    entry.className = "log-entry";
    entry.dataset.level = record.level || "info";

    const time = document.createElement("div");
    time.className = "log-time";
    time.textContent = formatTimestamp(record.ts);
    const level = document.createElement("span");
    level.className = "log-level";
    level.textContent = record.level || "info";
    time.appendChild(document.createElement("br"));
    time.appendChild(level);

    const event = document.createElement("div");
    event.className = "log-event";
    event.textContent = record.event || "unknown";

    const context = document.createElement("div");
    context.className = "log-context";
    if (record.correlation_id) {
      const correlation = document.createElement("button");
      correlation.type = "button";
      correlation.className = "inspect-link";
      correlation.dataset.correlationId = record.correlation_id;
      correlation.textContent = record.correlation_id;
      correlation.title = "Giữ bộ lọc correlation ID";
      context.appendChild(correlation);
    }
    if (record.trace_id) {
      const trace = document.createElement("button");
      trace.type = "button";
      trace.className = "inspect-link";
      trace.dataset.traceId = record.trace_id;
      trace.textContent = shortId(record.trace_id, 14);
      trace.title = record.trace_id;
      context.appendChild(trace);
    }

    const message = document.createElement("div");
    message.className = "log-message";
    const feature = document.createElement("strong");
    feature.textContent = `${record.service || "service"} · ${record.feature || "no feature"}`;
    message.appendChild(feature);
    message.appendChild(document.createTextNode(logDescription(record)));

    entry.append(time, event, context, message);
    elements.logStream.appendChild(entry);
  });
}

async function refreshLogs({ quiet = false } = {}) {
  const params = new URLSearchParams({ limit: "500" });
  const filters = [
    ["correlation_id", elements.logCorrelationFilter.value.trim()],
    ["trace_id", elements.logTraceFilter.value.trim()],
    ["event", elements.logEventFilter.value],
  ];
  filters.forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  try {
    const response = await fetchWithTimeout(`/observability/logs?${params}`, { cache: "no-store" }, 5000);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = await response.json();
    renderLogs(body.items || []);
  } catch (error) {
    const empty = document.createElement("p");
    empty.className = "telemetry-empty";
    empty.textContent = `Không đọc được logs: ${error.message}`;
    elements.logStream.replaceChildren(empty);
    if (!quiet) {
      showToast(`Không đọc được logs: ${error.message}`, "error");
    }
  }
}

function renderTraceList(items) {
  elements.traceList.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "telemetry-empty";
    empty.textContent = "Chưa có trace. Gửi một request rồi làm mới.";
    elements.traceList.appendChild(empty);
    return;
  }

  items.forEach((trace) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "trace-card";
    card.dataset.traceId = trace.trace_id;
    card.dataset.status = trace.status;
    card.setAttribute("aria-current", String(trace.trace_id === selectedTraceId));

    const top = document.createElement("span");
    top.className = "trace-card-top";
    const operation = document.createElement("strong");
    operation.textContent = trace.operation;
    const status = document.createElement("span");
    status.className = "trace-status";
    status.textContent = trace.status === "error" ? "LỖI" : "OK";
    status.title = trace.error_step
      ? `Lỗi bắt đầu tại ${trace.error_step}`
      : trace.status;
    top.append(operation, status);

    const id = document.createElement("span");
    id.className = "trace-card-id";
    id.textContent = trace.trace_id;

    const meta = document.createElement("span");
    meta.className = "trace-card-meta";
    const when = document.createElement("span");
    when.textContent = formatTimestamp(trace.started_at);
    const duration = document.createElement("span");
    duration.textContent = `${formatNumber(trace.duration_ms, 1)} ms · ${trace.span_count} span`;
    meta.append(when, duration);

    card.append(top, id, meta);
    elements.traceList.appendChild(card);
  });
}

function renderTraceDetail(trace) {
  elements.traceDetail.replaceChildren();

  const summary = document.createElement("header");
  summary.className = "trace-summary";
  const title = document.createElement("h4");
  title.textContent = `${trace.operation} · ${formatNumber(trace.duration_ms, 2)} ms`;
  const id = document.createElement("p");
  id.textContent = `${trace.trace_id} · ${trace.span_count} spans · ${trace.status}`;
  summary.append(title, id);

  if (trace.status === "error") {
    const errorBanner = document.createElement("div");
    errorBanner.className = "trace-error-banner";
    const errorType = trace.error?.type || "Error";
    const errorMessage = trace.error?.message ? `: ${trace.error.message}` : "";
    errorBanner.textContent = trace.error_step
      ? `Nguồn lỗi: ${trace.error_step} · ${errorType}${errorMessage}`
      : "Trace trả về lỗi nhưng chưa xác định được span nguồn.";
    summary.appendChild(errorBanner);
  }

  const waterfall = document.createElement("div");
  waterfall.className = "waterfall";
  const totalDuration = Math.max(Number(trace.duration_ms) || 0, 0.001);
  (trace.spans || []).forEach((span) => {
    const row = document.createElement("div");
    row.className = "waterfall-row";
    row.dataset.status = span.status;
    row.tabIndex = 0;

    const name = document.createElement("span");
    name.className = "waterfall-name";
    name.textContent = span.operation;
    name.title = `${span.operation} · ${span.span_id}`;
    if (span.status === "error") {
      const errorBadge = document.createElement("small");
      errorBadge.className = "span-error-badge";
      errorBadge.textContent = span.is_error_origin ? "NGUỒN LỖI" : "LAN TRUYỀN";
      name.appendChild(errorBadge);
    }

    const track = document.createElement("span");
    track.className = "waterfall-track";
    const bar = document.createElement("span");
    bar.className = "waterfall-bar";
    const leftPercent = Math.min(99, Math.max(0, (span.start_offset_ms / totalDuration) * 100));
    const widthPercent = Math.min(
      100 - leftPercent,
      Math.max(0.6, (span.duration_ms / totalDuration) * 100),
    );
    bar.style.left = `${leftPercent}%`;
    bar.style.width = `${widthPercent}%`;
    track.appendChild(bar);

    const duration = document.createElement("span");
    duration.className = "waterfall-duration";
    duration.textContent = `${formatNumber(span.duration_ms, 2)} ms`;

    const attributes = document.createElement("pre");
    attributes.className = "span-attributes";
    attributes.textContent = JSON.stringify(
      {
        span_id: span.span_id,
        parent_span_id: span.parent_span_id || "root",
        status: span.status,
        error_role: span.is_error_origin ? "origin" : span.status === "error" ? "propagated" : null,
        error: span.error || null,
        exception_event_count: span.event_count || 0,
        attributes: span.attributes || {},
      },
      null,
      2,
    );

    row.append(name, track, duration, attributes);
    waterfall.appendChild(row);
  });

  elements.traceDetail.append(summary, waterfall);
}

async function loadTrace(traceId, { quiet = false, syncLogFilter = true } = {}) {
  if (!traceId) {
    return;
  }
  selectedTraceId = traceId;
  if (syncLogFilter) {
    elements.logTraceFilter.value = traceId;
  }
  elements.traceList.querySelectorAll(".trace-card").forEach((card) => {
    card.setAttribute("aria-current", String(card.dataset.traceId === traceId));
  });
  const loading = document.createElement("p");
  loading.className = "telemetry-empty";
  loading.textContent = "Đang tải trace waterfall...";
  elements.traceDetail.replaceChildren(loading);

  try {
    const response = await fetchWithTimeout(`/observability/traces/${traceId}`, { cache: "no-store" }, 7000);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    renderTraceDetail(await response.json());
    if (syncLogFilter) {
      refreshLogs({ quiet: true });
    }
  } catch (error) {
    const empty = document.createElement("p");
    empty.className = "telemetry-empty";
    empty.textContent = `Không tải được trace: ${error.message}`;
    elements.traceDetail.replaceChildren(empty);
    if (!quiet) {
      showToast(`Không tải được trace: ${error.message}`, "error");
    }
  }
}

async function refreshTraces({ quiet = false } = {}) {
  try {
    const params = new URLSearchParams({ limit: "30", lookback: elements.traceLookback.value });
    const response = await fetchWithTimeout(`/observability/traces?${params}`, { cache: "no-store" }, 8000);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${response.status}`);
    }
    const body = await response.json();
    const items = body.items || [];
    renderTraceList(items);
    if (selectedTraceId && items.some((item) => item.trace_id === selectedTraceId)) {
      loadTrace(selectedTraceId, { quiet: true, syncLogFilter: false });
    } else if (items.length) {
      loadTrace(items[0].trace_id, { quiet: true, syncLogFilter: false });
    }
  } catch (error) {
    const empty = document.createElement("p");
    empty.className = "telemetry-empty";
    empty.textContent = `Jaeger chưa sẵn sàng: ${error.message}`;
    elements.traceList.replaceChildren(empty);
    if (!quiet) {
      showToast(`Không đọc được traces: ${error.message}`, "error");
    }
  }
}

async function refreshTelemetry({ quiet = false } = {}) {
  await Promise.all([refreshLogs({ quiet }), refreshTraces({ quiet })]);
  if (!quiet) {
    showToast("Đã cập nhật logs và traces.");
  }
}

function configureGrafanaEmbed() {
  const host = window.location.hostname || "localhost";
  const grafanaBase = `http://${host}:3000/d/day13-ai-observability`;
  const dashboardUrl = `${grafanaBase}?orgId=1&from=now-15m&to=now&timezone=browser&refresh=5s&kiosk&theme=dark`;
  const prometheusUrl = `http://${host}:9090/targets`;
  const jaegerUrl = `http://${host}:16686`;

  elements.grafanaFrame.src = dashboardUrl;
  elements.openDashboard.href = grafanaBase;
  elements.grafanaLink.href = grafanaBase;
  elements.prometheusLink.href = prometheusUrl;
  elements.jaegerLink.href = jaegerUrl;
  elements.openJaeger.href = jaegerUrl;
}

elements.quickRunForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const total = Number(elements.quickPreset.value) === 10 ? 10 : 1;
  const concurrency = total === 10 ? 5 : 1;
  elements.commandPreview.textContent = [
    "curl -X POST http://127.0.0.1:8000/chat \\",
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"user_id":"ui-user","session_id":"manual","feature":"qa","message":"Explain observability"}\'',
  ].join("\n");
  if (total === 10) {
    elements.commandPreview.textContent = `.venv/bin/python scripts/load_test.py --concurrency ${concurrency}`;
  }
  runLoad(total, concurrency, 30);
});

elements.quickPreset.addEventListener("change", () => {
  const isBaseline = Number(elements.quickPreset.value) === 10;
  elements.runQuick.textContent = isBaseline ? "Chạy baseline 10 request" : "Gửi 1 request";
  elements.quickRunHelp.textContent = isBaseline
    ? "Baseline gửi 10 request với concurrency 5."
    : "Request đơn dùng concurrency 1 và prompt label đang chọn.";
});

elements.stressForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateStressCommandPreview();
  runLoad(elements.stressTotal.value, elements.stressConcurrency.value, elements.stressTimeout.value);
});

elements.stopRun.addEventListener("click", () => {
  if (activeRun) {
    activeRun.controller.abort("user-stop");
  }
});

document.querySelectorAll("[data-incident]").forEach((button) => {
  button.addEventListener("click", () => {
    const currentlyEnabled = button.getAttribute("aria-pressed") === "true";
    setIncident(button.dataset.incident, !currentlyEnabled);
  });
});

byId("disable-incidents").addEventListener("click", disableAllIncidents);
byId("test-prompt-baseline").addEventListener("click", () => {
  elements.promptLabel.value = "baseline";
  updatePromptRegistry(promptRegistry);
  runLoad(1, 1, 30);
});
byId("test-prompt-candidate").addEventListener("click", () => {
  elements.promptLabel.value = "candidate";
  updatePromptRegistry(promptRegistry);
  runLoad(1, 1, 30);
});
byId("promote-prompt").addEventListener("click", () => moveProductionPrompt("local-v2"));
byId("rollback-prompt").addEventListener("click", () => moveProductionPrompt("local-v1", true));
elements.promptLabel.addEventListener("change", () => updatePromptRegistry(promptRegistry));
byId("refresh-status").addEventListener("click", () => refreshStatus());
byId("clear-events").addEventListener("click", () => {
  elements.eventBody.innerHTML = '<tr class="empty-row"><td colspan="8">Feed đã được xóa. Chạy bài test mới để xem kết quả.</td></tr>';
});
byId("reload-dashboard").addEventListener("click", () => {
  elements.embedLoading.classList.remove("is-hidden");
  const currentUrl = new URL(elements.grafanaFrame.src);
  currentUrl.searchParams.set("refreshToken", Date.now().toString());
  elements.grafanaFrame.src = currentUrl.toString();
});

[elements.stressTotal, elements.stressConcurrency, elements.stressTimeout].forEach((input) => {
  input.addEventListener("input", updateStressCommandPreview);
});

elements.grafanaFrame.addEventListener("load", () => {
  window.setTimeout(() => elements.embedLoading.classList.add("is-hidden"), 450);
});

elements.eventBody.addEventListener("click", (event) => {
  const correlationTarget = event.target.closest("[data-correlation-id]");
  if (correlationTarget) {
    elements.logCorrelationFilter.value = correlationTarget.dataset.correlationId;
    refreshLogs();
    elements.logStream.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const traceTarget = event.target.closest("[data-trace-id]");
  if (traceTarget) {
    loadTrace(traceTarget.dataset.traceId);
    elements.traceDetail.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

elements.logStream.addEventListener("click", (event) => {
  const traceTarget = event.target.closest("[data-trace-id]");
  if (traceTarget) {
    loadTrace(traceTarget.dataset.traceId);
    return;
  }
  const correlationTarget = event.target.closest("[data-correlation-id]");
  if (correlationTarget) {
    elements.logCorrelationFilter.value = correlationTarget.dataset.correlationId;
    refreshLogs();
  }
});

elements.traceList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-trace-id]");
  if (card) {
    loadTrace(card.dataset.traceId);
  }
});

elements.logFilterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  refreshLogs();
});

byId("clear-log-filters").addEventListener("click", () => {
  elements.logFilterForm.reset();
  refreshLogs();
});

elements.traceLookback.addEventListener("change", () => refreshTraces());
elements.refreshTelemetry.addEventListener("click", () => refreshTelemetry());

configureGrafanaEmbed();
updateStressCommandPreview();
setRunControls(false);
window.addEventListener("pageshow", () => {
  if (!activeRun) {
    setRunControls(false);
  }
});
refreshStatus({ quiet: true });
window.setTimeout(() => refreshTelemetry({ quiet: true }), 600);
window.setInterval(() => refreshStatus({ quiet: true }), 5000);
window.setInterval(() => refreshTelemetry({ quiet: true }), 12000);
