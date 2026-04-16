// Real-time clock
function updateClock() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const day = now.getDate();
  const month = now.toLocaleString("default", { month: "short" });
  const year = now.getFullYear();
  const timeString = `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm} | ${day} ${month} ${year}`;
  document.getElementById("clock").textContent = timeString;
}

setInterval(updateClock, 1000);
updateClock();

// Upload logic
let frontUploaded = false;
let backUploaded = false;

const frontBox = document.getElementById("front-aadhaar");
const backBox = document.getElementById("back-aadhaar");
const frontInput = document.getElementById("front-input");
const backInput = document.getElementById("back-input");
const frontContent = frontBox.querySelector(".upload-content");
const backContent = backBox.querySelector(".upload-content");

frontBox.addEventListener("click", () => frontInput.click());
backBox.addEventListener("click", () => backInput.click());

frontInput.addEventListener("change", handleUpload.bind(null, "front"));
backInput.addEventListener("change", handleUpload.bind(null, "back"));

let frontOCRCompleted = false;
let backOCRCompleted = false;
let frontParsedData = { name: "", dob: "", aadhaar: "" };
let backParsedData = { address: "" };

function extractAadhaarNumber(text) {
  const match = text.match(/\d{4}\s\d{4}\s\d{4}/);
  return match ? match[0] : "";
}

function extractDOB(text) {
  const match = text.match(/\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/);
  return match ? match[0] : "";
}

function extractName(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const dobIndex = lines.findIndex((line) =>
    /\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/.test(line),
  );

  if (dobIndex > 0) {
    const candidate = lines[dobIndex - 1];
    if (candidate && candidate.length < 35 && /[a-zA-Z]/.test(candidate)) {
      return candidate;
    }
  }

  for (const line of lines.slice(0, 4)) {
    if (!/\d/.test(line) && line.length > 3 && line.length < 40) {
      return line;
    }
  }

  return "";
}

function extractAddress(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/aadhaar|government|india|dob|date|year|sex|male|female|dob|name|age/i.test(
          line,
        ),
    );

  if (!lines.length) {
    return "";
  }

  const addressLines = [];
  let capture = false;

  for (const line of lines) {
    if (/address/i.test(line)) {
      capture = true;
      continue;
    }
    if (capture) {
      addressLines.push(line);
    }
  }

  if (!addressLines.length) {
    return lines.join(", ");
  }

  return addressLines.join(", ");
}

function fillForm(data) {
  document.getElementById("name").value = data.name || "";
  document.getElementById("dob").value = data.dob || "";
  document.getElementById("address").value = data.address || "";
  document.getElementById("aadhaar-no").value = data.aadhaar || "";
  syncTransactionState();
}

function tryPopulateForm() {
  if (frontOCRCompleted && backOCRCompleted) {
    fillForm({
      ...frontParsedData,
      ...backParsedData,
    });
  }
}

async function handleUpload(side) {
  const input = side === "front" ? frontInput : backInput;
  const box = side === "front" ? frontBox : backBox;
  const content = side === "front" ? frontContent : backContent;

  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async function (e) {
      const dataUrl = e.target.result;
      content.innerHTML = `<img src="${dataUrl}" alt="${side} Aadhaar" />`;
      box.classList.add("uploaded");

      try {
        // Create image and ensure it's loaded before OCR
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);

          const worker = await Tesseract.createWorker();
          await worker.loadLanguage("eng");
          await worker.initialize("eng");

          const {
            data: { text },
          } = await worker.recognize(canvas);
          await worker.terminate();

          if (side === "front") {
            frontParsedData = {
              name: extractName(text),
              dob: extractDOB(text),
              aadhaar: extractAadhaarNumber(text),
            };
            frontOCRCompleted = true;
          } else {
            backParsedData = {
              address: extractAddress(text),
            };
            backOCRCompleted = true;
          }
          tryPopulateForm();
        };
        img.onerror = () => {
          console.error("Failed to load image for OCR");
        };
        img.src = dataUrl;
      } catch (err) {
        console.error("OCR Error:", err);
      }
    };
    reader.readAsDataURL(file);
  }
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });
}

const DEFAULT_AMOUNT = "\u20B9 5000.00";

const nameInput = document.getElementById("name");
const cardTypeInput = document.getElementById("card-type");
const paymentModeInput = document.getElementById("payment-mode");
const paymentStatusInput = document.getElementById("payment-status");
const amountInput = document.getElementById("amount");

const receiptTitle = document.getElementById("receipt-title");
const receiptName = document.getElementById("receipt-name");
const receiptType = document.getElementById("receipt-type");
const receiptMode = document.getElementById("receipt-mode");
const receiptStatus = document.getElementById("receipt-status");
const receiptAmount = document.getElementById("receipt-amount");
const receiptTotal = document.getElementById("receipt-total");
const receiptModeIcon = document.getElementById("receipt-mode-icon");
const receiptCheck = document.getElementById("receipt-check");
const receiptTypeIcon = document.querySelector(".icon-circle");

const transactionState = {
  name: "Rajesh Kumar",
  type: "Credit",
  mode: "Online",
  status: "Paid",
  amount: DEFAULT_AMOUNT,
};

function formatLabel(value) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderReceipt() {
  const isPaid = transactionState.status === "Paid";
  const modeBadge = transactionState.mode === "Online" ? "🌐" : "💸";

  receiptName.textContent = transactionState.name;
  receiptType.textContent = transactionState.type;
  receiptMode.textContent = transactionState.mode;
  receiptStatus.textContent = transactionState.status;
  receiptAmount.textContent = transactionState.amount;
  receiptTotal.textContent = transactionState.amount;
  receiptTypeIcon.textContent =
    transactionState.type === "Credit" ? "Cr" : "Dr";

  receiptModeIcon.innerHTML = "";

  const badge = document.createElement("span");
  badge.className = "mode-badge";
  badge.textContent = transactionState.mode === "Online" ? "🌐" : "💸";

  const text = document.createElement("span");
  text.textContent = transactionState.mode;

  receiptModeIcon.appendChild(badge);
  receiptModeIcon.appendChild(text);

  receiptTitle.textContent = isPaid
    ? "TRANSACTION SUCCESSFUL"
    : "TRANSACTION FAILED";
  receiptTitle.classList.toggle("failed", !isPaid);
  receiptCheck.textContent = isPaid ? "\u2713" : "!";
  receiptCheck.classList.toggle("failed", !isPaid);
}

function syncTransactionState() {
  transactionState.name = nameInput.value.trim() || "Rajesh Kumar";
  transactionState.type = formatLabel(cardTypeInput.value) || "Credit";
  transactionState.mode = paymentModeInput.value || "Online";
  transactionState.status = paymentStatusInput.value || "Paid";
  transactionState.amount = amountInput.value.trim() || DEFAULT_AMOUNT;

  renderReceipt();
}

// function captureElementForExport(element) {
//   return new Promise((resolve, reject) => {
//     // ✅ FIRST create clone (IMPORTANT)
//     const clone = element.cloneNode(true);

//     // 🔥 THEN modify clone
//     const selects = clone.querySelectorAll("select");

//     selects.forEach((el) => {
//       const div = document.createElement("div");
//       div.textContent = el.value;
//       div.style.padding = "4px";
//       div.style.borderBottom = "1px solid #ccc";
//       el.parentNode.replaceChild(div, el);
//     });

//     const wrapper = document.createElement("div");
//     wrapper.style.position = "fixed";
//     wrapper.style.top = "0";
//     wrapper.style.left = "0";
//     wrapper.style.width = `${element.offsetWidth}px`;
//     wrapper.style.overflow = "visible";
//     wrapper.style.pointerEvents = "none";
//     // wrapper.style.opacity = "0";
//     wrapper.style.opacity = "0";
//     wrapper.style.visibility = "visible";
//     wrapper.style.zIndex = "-9999";
//     wrapper.appendChild(clone);
//     document.body.appendChild(wrapper);

//     requestAnimationFrame(() => {
//       setTimeout(() => {
//         html2canvas(clone, {
//           scale: 2,
//           useCORS: true,
//           allowTaint: true,
//           backgroundColor: window.getComputedStyle(element).backgroundColor,
//           width: clone.offsetWidth,
//           height: clone.scrollHeight,
//           windowWidth: document.documentElement.scrollWidth,
//           windowHeight: document.documentElement.scrollHeight,
//           scrollX: -window.scrollX,
//           scrollY: -window.scrollY,
//           ignoreElements: (el) => {
//             return el.tagName === "SCRIPT";
//           },
//         })
//           .then((canvas) => {
//             document.body.removeChild(wrapper);
//             resolve(canvas);
//           })
//           .catch((error) => {
//             document.body.removeChild(wrapper);
//             reject(error);
//           });
//       }, 50);
//     });
//   });
// }
function captureElementForExport(element) {
  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",

    scrollX: 0,
    scrollY: 0,

    ignoreElements: (el) => el.tagName === "SCRIPT",
  });
}

// function downloadForm() {
//   const formScreen = document.getElementById("screen-1");
//   captureElementForExport(formScreen).then((canvas) => {
//     const image = canvas.toDataURL("image/png");
//     const link = document.createElement("a");
//     link.href = image;
//     link.download = "Application_Form.png";
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   });
// }
function downloadForm() {
  const formScreen = document.getElementById("screen-1");

  // 🔥 replace select with text TEMPORARILY
  const selects = formScreen.querySelectorAll("select");
  const backups = [];

  selects.forEach((el) => {
    const div = document.createElement("div");
    div.textContent = el.value;
    div.className = "fake-select";

    backups.push({ parent: el.parentNode, original: el, fake: div });

    el.parentNode.replaceChild(div, el);
  });

  captureElementForExport(formScreen)
    .then((canvas) => {
      const image = canvas.toDataURL("image/png");

      const link = document.createElement("a");
      link.href = image;
      link.download = "Application_Form.png";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 🔥 restore original selects
      backups.forEach(({ parent, original, fake }) => {
        parent.replaceChild(original, fake);
      });
    })
    .catch((err) => console.error(err));
}

function downloadReceipt() {
  const receiptCard = document.getElementById("receipt-card");
  captureElementForExport(receiptCard)
    .then((canvas) => {
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = "Transaction_Receipt.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log("Canvas generated ✅");
    })
    .catch((err) => {
      console.error("Canvas failed ❌", err);
    });
}

const downloadBtn = document.getElementById("download-btn");
const generateBtn = document.getElementById("generate-btn");
const backBtn = document.getElementById("back-btn");
const downloadReceiptBtn = document.getElementById("download-receipt-btn");

[nameInput, amountInput].forEach((field) => {
  field.addEventListener("input", syncTransactionState);
});

[cardTypeInput, paymentModeInput, paymentStatusInput].forEach((field) => {
  field.addEventListener("change", syncTransactionState);
});

downloadBtn.addEventListener("click", downloadForm);
generateBtn.addEventListener("click", () => {
  syncTransactionState();
  showScreen("screen-2");
});
backBtn.addEventListener("click", () => showScreen("screen-1"));
downloadReceiptBtn.addEventListener("click", downloadReceipt);

syncTransactionState();
