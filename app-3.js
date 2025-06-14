
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Inicialização
const firebaseConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

let userId = null;
let filesRef = null;
let historyRef = null;
let currentDocs = [];

const authStatus = document.getElementById("auth-status");
const questionInput = document.getElementById("user-question");
const runButton = document.getElementById("run-ai");
const aiResult = document.getElementById("ai-result");
const docViewer = document.getElementById("doc-viewer");
const fileUpload = document.getElementById("file-upload");
const fileList = document.getElementById("file-list");
const historyList = document.getElementById("history-list");

// Tabs
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
    document.querySelector(`#tab-${btn.dataset.tab}`).classList.remove("hidden");
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("tab-active"));
    btn.classList.add("tab-active");
  });
});

// Auth
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userId = user.uid;
    authStatus.textContent = "Conectado | ID: " + userId.substring(0, 8) + "...";
    filesRef = collection(db, "artifacts", appId, "users", userId, "documents");
    historyRef = collection(db, "artifacts", appId, "users", userId, "history");
    setupFileListener();
    setupHistoryListener();
  } else {
    await signInAnonymously(auth);
  }
});

// Upload de arquivos
fileUpload?.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const text = await file.text();
    await addDoc(filesRef, {
      name: file.name,
      content: text,
      createdAt: new Date().toISOString()
    });
  }
});

// Executar IA
runButton?.addEventListener("click", async () => {
  const question = questionInput.value.trim();
  if (!question || currentDocs.length === 0) {
    alert("Digite uma pergunta e envie pelo menos um documento.");
    return;
  }

  aiResult.textContent = "Consultando IA...";
  const base = currentDocs.map(d => `--- ${d.name} ---\n${d.content}`).join("\n\n");
  const prompt = `Você é um assistente jurídico. Use ESTRITAMENTE os documentos a seguir para responder.\n\n${base}\n\nPergunta: ${question}`;

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyASqkgIpeMm5MoHOJE6bg7h86w-uc7mmgA", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await res.json();
  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "Nenhuma resposta gerada.";

  aiResult.textContent = answer;

  await addDoc(historyRef, {
    question,
    answer,
    createdAt: new Date().toISOString()
  });
});

// Mostrar arquivos
function setupFileListener() {
  onSnapshot(filesRef, snapshot => {
    const docs = [];
    fileList.innerHTML = "";
    docViewer.innerHTML = "";
    snapshot.forEach(docSnap => {
      const d = { id: docSnap.id, ...docSnap.data() };
      docs.push(d);
      fileList.innerHTML += `<li><strong>${d.name}</strong></li>`;
      docViewer.innerHTML += `<div class="mb-4"><strong>${d.name}</strong><pre class="bg-white border p-2 rounded mt-1 whitespace-pre-wrap">${d.content}</pre></div>`;
    });
    if (docs.length === 0) {
      docViewer.innerHTML = '<p class="text-gray-500">Nenhum documento carregado ainda.</p>';
    }
    currentDocs = docs;
  });
}

// Mostrar histórico
function setupHistoryListener() {
  onSnapshot(historyRef, snapshot => {
    historyList.innerHTML = "";
    const sorted = snapshot.docs.map(doc => doc.data()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    sorted.forEach(item => {
      historyList.innerHTML += `
        <li class="border p-3 rounded bg-gray-50">
          <p class="text-sm text-gray-500">${new Date(item.createdAt).toLocaleString()}</p>
          <p><strong>Pergunta:</strong> ${item.question}</p>
          <p><strong>Resposta:</strong> ${item.answer}</p>
        </li>`;
    });
  });
}
