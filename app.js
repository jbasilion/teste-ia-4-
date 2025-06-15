
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  listAll,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA09I-bYqDWhruAT5deN3_vWSotnBmgT0A",
  authDomain: "teste-ia-1-5a510.firebaseapp.com",
  projectId: "teste-ia-1-5a510",
  storageBucket: "teste-ia-1-5a510.appspot.com",
  messagingSenderId: "184992945461",
  appId: "1:184992945461:web:06a7bfbc70ae5ddf1de87c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser = null;

// Autenticação anônima
signInAnonymously(auth).catch(console.error);
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    document.getElementById("auth-status").textContent = "Conectado | ID: " + user.uid;
    carregarHistorico();
    carregarDocumentos();
  }
});

// Upload de arquivos
document.getElementById("file-upload").addEventListener("change", async (e) => {
  const files = e.target.files;
  const fileList = document.getElementById("file-list");
  fileList.innerHTML = "";
  for (const file of files) {
    const storageRef = ref(storage, `bases/${currentUser.uid}/${file.name}`);
    await uploadBytes(storageRef, file);
    const li = document.createElement("li");
    li.textContent = file.name + " (enviado)";
    fileList.appendChild(li);
  }
  carregarDocumentos();
});

// Visualizar documentos
async function carregarDocumentos() {
  const viewer = document.getElementById("doc-viewer");
  viewer.innerHTML = "";
  const listRef = ref(storage, `bases/${currentUser.uid}`);
  const res = await listAll(listRef);
  if (res.items.length === 0) {
    viewer.innerHTML = "<p class='text-gray-500'>Nenhum documento carregado ainda.</p>";
    return;
  }
  for (const item of res.items) {
    const url = await getDownloadURL(item);
    const content = await fetch(url).then(res => res.text());
    const div = document.createElement("div");
    div.className = "mb-4";
    div.innerHTML = `<h3 class='font-semibold'>${item.name}</h3><pre class='bg-white p-2 rounded border max-h-40 overflow-auto'>${content}</pre>`;
    viewer.appendChild(div);
  }
}

// Histórico
async function carregarHistorico() {
  const historyList = document.getElementById("history-list");
  historyList.innerHTML = "";
  const q = collection(db, "usuarios", currentUser.uid, "historico");
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach((doc) => {
    const d = doc.data();
    const li = document.createElement("li");
    li.innerHTML = `<b>Pergunta:</b> ${d.pergunta}<br><b>Resposta:</b> ${d.resposta}<hr>`;
    historyList.appendChild(li);
  });
}

// Gemini API: gerar resposta com base em pergunta + documentos
async function gerarRespostaGemini(pergunta, documentos) {
  const prompt = `Documentos base:\n${documentos}\n\nPergunta: ${pergunta}`;
const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyCLozeU35MBIZGSxMOspFN2VYeV74ujPjs");
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro ao gerar resposta.";
}

// Botão Executar IA
document.getElementById("run-ai").addEventListener("click", async () => {
  const pergunta = document.getElementById("user-question").value.trim();
  if (!pergunta) return alert("Digite uma pergunta.");
  const viewer = document.getElementById("doc-viewer");
  const textos = Array.from(viewer.querySelectorAll("pre")).map(el => el.textContent).join("\n\n");
  document.getElementById("ai-result").textContent = "Consultando IA...";
  const resposta = await gerarRespostaGemini(pergunta, textos);
  document.getElementById("ai-result").textContent = resposta;
  await addDoc(collection(db, "usuarios", currentUser.uid, "historico"), {
    pergunta,
    resposta,
    timestamp: serverTimestamp()
  });
  carregarHistorico();
});
