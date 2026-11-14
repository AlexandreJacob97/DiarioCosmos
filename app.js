const FIRST_APOD_DATE = "1995-06-16";

const dateForm = document.querySelector("#date-form");
const datePicker = document.querySelector("#date-picker");
const mediaFrame = document.querySelector("#media-frame");
const mediaCaption = document.querySelector("#media-caption");
const mediaOpen = document.querySelector("#media-open");
const title = document.querySelector("#apod-title");
const dateLabel = document.querySelector("#apod-date");
const copyright = document.querySelector("#apod-copyright");
const explanation = document.querySelector("#apod-explanation");
const statusMessage = document.querySelector("#status-message");
const previousButton = document.querySelector("#previous-day");
const nextButton = document.querySelector("#next-day");

const today = new Date();
const todayString = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

let activeRequest;

datePicker.min = FIRST_APOD_DATE;
datePicker.max = todayString;
datePicker.value = todayString;

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function setLoading(isLoading) {
  mediaFrame.replaceChildren();
  mediaFrame.classList.toggle("is-loading", isLoading);
  if (isLoading) {
    const loading = document.createElement("div");
    loading.className = "loading-state";
    loading.innerHTML = '<span class="loader" aria-hidden="true"></span><span>Buscando no universo...</span>';
    mediaFrame.append(loading);
  }
}

function showMedia(data) {
  mediaFrame.replaceChildren();
  mediaFrame.classList.remove("is-loading");
  mediaOpen.hidden = true;
  mediaOpen.removeAttribute("href");
  mediaCaption.textContent = data.media_type === "video"
    ? "VÍDEO ASTRONÔMICO DO DIA"
    : "IMAGEM ASTRONÔMICA DO DIA";

  if (data.media_type === "image" && data.url) {
    const link = document.createElement("a");
    link.className = "image-link";
    link.href = data.hdurl || data.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.setAttribute("aria-label", "Abrir imagem em alta resolução");

    const image = document.createElement("img");
    image.src = data.url;
    image.alt = data.title || "Imagem astronômica do dia";
    image.loading = "eager";
    image.addEventListener("error", () => {
      mediaFrame.replaceChildren();
      const message = document.createElement("p");
      message.className = "media-fallback";
      message.textContent = "Não foi possível carregar esta imagem. Tente abrir a mídia diretamente.";
      mediaFrame.append(message);
      mediaOpen.href = data.url;
      mediaOpen.hidden = false;
    }, { once: true });

    link.append(image);
    mediaFrame.append(link);
    return;
  }

  if (data.media_type === "video" && data.url) {
    let mediaUrl;
    try {
      mediaUrl = new URL(data.url);
    } catch {
      mediaUrl = null;
    }

    if (mediaUrl?.protocol === "https:") {
      const video = document.createElement("iframe");
      video.className = "video-player";
      video.src = mediaUrl.href;
      video.title = data.title || "Vídeo astronômico do dia";
      video.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      video.allowFullscreen = true;
      video.referrerPolicy = "strict-origin-when-cross-origin";
      mediaFrame.append(video);
      mediaOpen.href = mediaUrl.href;
      mediaOpen.hidden = false;
      return;
    }
  }

  const videoCard = document.createElement("div");
  videoCard.className = "video-card";
  videoCard.innerHTML = '<span class="video-orbit" aria-hidden="true">◉</span><span class="play-icon" aria-hidden="true">▶</span><span class="video-label">MÍDIA INDISPONÍVEL</span>';
  mediaFrame.append(videoCard);
}

function updateNavigation(selectedDate) {
  const previousDate = new Date(`${selectedDate}T00:00:00Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  previousButton.disabled = previousDate.toISOString().slice(0, 10) < FIRST_APOD_DATE;
  const nextDate = new Date(`${selectedDate}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  nextButton.disabled = nextDate.toISOString().slice(0, 10) > todayString;
}

function shiftDate(days) {
  const selectedDate = new Date(`${datePicker.value}T00:00:00Z`);
  selectedDate.setUTCDate(selectedDate.getUTCDate() + days);
  datePicker.value = selectedDate.toISOString().slice(0, 10);
  loadApod(datePicker.value);
}

async function loadApod(date) {
  if (!date || date < FIRST_APOD_DATE || date > todayString) {
    statusMessage.textContent = "Escolha uma data entre 16 de junho de 1995 e hoje.";
    return;
  }

  if (activeRequest) activeRequest.abort();
  activeRequest = new AbortController();
  const request = activeRequest;

  datePicker.value = date;
  updateNavigation(date);
  title.textContent = "Preparando sua viagem...";
  dateLabel.textContent = formatDate(date);
  explanation.textContent = "Cada dia revela um novo detalhe do nosso universo.";
  copyright.hidden = true;
  mediaCaption.textContent = "IMAGEM ASTRONÔMICA DO DIA";
  mediaOpen.hidden = true;
  statusMessage.textContent = "";
  setLoading(true);

  try {
    const response = await fetch(`/api/apod?date=${encodeURIComponent(date)}`, {
      signal: request.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Não foi possível consultar a NASA (HTTP ${response.status}).`);
    }

    title.textContent = data.title || "Imagem astronômica do dia";
    dateLabel.textContent = formatDate(data.date || date);
    explanation.textContent = data.explanation || "A NASA não forneceu uma explicação para esta mídia.";
    if (data.copyright) {
      copyright.textContent = `CRÉDITO · ${data.copyright}`;
      copyright.hidden = false;
    }
    showMedia(data);
  } catch (error) {
    if (error.name === "AbortError") return;
    setLoading(false);
    title.textContent = "Não foi possível carregar esta edição";
    explanation.textContent = "Verifique se o servidor está configurado e tente novamente.";
    mediaCaption.textContent = "NÃO FOI POSSÍVEL CARREGAR A MÍDIA";
    statusMessage.textContent = error instanceof TypeError
      ? "Servidor local indisponível. Configure NASA_API_KEY e inicie-o com node server.js."
      : error.message || "Ocorreu um erro ao consultar a API da NASA.";
  }
}

dateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadApod(datePicker.value);
});

previousButton.addEventListener("click", () => shiftDate(-1));
nextButton.addEventListener("click", () => shiftDate(1));

loadApod(todayString);
