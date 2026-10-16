/* firebase.js — 项目级覆写（[lyrumu 改造]，2026-10-13）
   --------------------------------------------------------------------------
   相比主题版，计数监听保留离线空快照保护，并接收联网恢复的元数据事件；
   加载样式只清除、不反转，重复快照不会重新隐藏数字。

   为什么：Firestore 在客户端判定为 Offline（后端不可达，如国内直连）时会抛出
   本地缓存初始快照，文档不存在时 exists()=false，原逻辑会写入 0，把真实计数
   覆盖成 0。跳过「fromCache 且不存在」的快照后，计数保持占位，由 counter-cache.js
   显示上次缓存；服务器或已缓存的真实数据到达再写入。

   ⚠️ 升级 blowfish 时重新 diff 主题版，保留离线保护、元数据监听与加载状态修复。
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

let app, db, auth, oids;
try {
  const configEl = document.getElementById("firebase-config");
  if (!configEl?.textContent) {
    throw new Error("Firebase config element not found");
  }

  const data = JSON.parse(configEl.textContent);
  app = initializeApp(data.config);

  oids = {
    views: configEl.getAttribute("data-views"),
    likes: configEl.getAttribute("data-likes"),
  };

  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.error("Firebase initialization failed:", e.message);
  throw e;
}

const id = oids?.views?.replaceAll("/", "-");
const id_likes = oids?.likes?.replaceAll("/", "-");
let liked = false;
let authReady = false;

function formatNumber(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function updateDisplay(collection, nodeId) {
  const node = document.getElementById(nodeId);
  if (!node) return;

  const docId = nodeId.replaceAll("/", "-");
  onSnapshot(
    doc(db, collection, docId),
    { includeMetadataChanges: true },
    // [lyrumu 改造] 只跳过「本地缓存且文档不存在」的快照：离线时 Firestore 会以
    // 空文档触发它（exists()=false → 0），会把真实/缓存计数覆盖成 0。带数据的
    // fromCache 快照是之前读到的真实值，照常显示，保持在线时的首屏速度。
    (snapshot) => {
      if (snapshot.metadata && snapshot.metadata.fromCache && !snapshot.exists()) return;
      node.innerText = snapshot.exists() ? formatNumber(snapshot.data()[collection]) : 0;
      node.className = "";
    },
    (error) => {
      console.error("Firebase snapshot update failed:", error);
    },
  );
}

async function recordView(id) {
  if (!id || localStorage.getItem(id)) return;

  try {
    const ref = doc(db, "views", id);
    const snap = await getDoc(ref);

    snap.exists() ? await updateDoc(ref, { views: increment(1) }) : await setDoc(ref, { views: 1 });

    localStorage.setItem(id, true);
  } catch (e) {
    console.error("Record view operation failed:", e.message);
  }
}

function updateButton(isLiked) {
  const hearts = document.querySelectorAll("span[id='button_likes_heart']");
  const empties = document.querySelectorAll("span[id='button_likes_emtpty_heart']");
  const texts = document.querySelectorAll("span[id='button_likes_text']");

  hearts.forEach((el) => {
    el.style.display = isLiked ? "" : "none";
  });
  empties.forEach((el) => {
    el.style.display = isLiked ? "none" : "";
  });
  texts.forEach((el) => {
    el.innerText = isLiked ? "" : "\xa0Like";
  });
}

async function toggleLike(add) {
  if (!id_likes || !authReady) return;

  try {
    const ref = doc(db, "likes", id_likes);
    const snap = await getDoc(ref);

    liked = add;
    add ? localStorage.setItem(id_likes, true) : localStorage.removeItem(id_likes);
    updateButton(add);

    snap.exists()
      ? await updateDoc(ref, { likes: increment(add ? 1 : -1) })
      : await setDoc(ref, { likes: add ? 1 : 0 });
  } catch (e) {
    console.error("Like operation failed:", e.message);
    liked = !add;
    add ? localStorage.removeItem(id_likes) : localStorage.setItem(id_likes, true);
    updateButton(!add);
  }
}

signInAnonymously(auth)
  .then(() => {
    authReady = true;

    document.querySelectorAll("span[id^='views_']").forEach((node) => {
      if (node.id) updateDisplay("views", node.id);
    });

    document.querySelectorAll("span[id^='likes_']").forEach((node) => {
      if (node.id) updateDisplay("likes", node.id);
    });

    recordView(id);

    if (id_likes && localStorage.getItem(id_likes)) {
      liked = true;
      updateButton(true);
    }

    const likeButton = document.getElementById("button_likes");
    if (likeButton) {
      likeButton.addEventListener("click", () => {
        toggleLike(!liked);
      });
    }
  })
  .catch((error) => {
    console.error("Firebase anonymous sign-in failed:", error.message);
    authReady = false;
  });

window.process_article = () => toggleLike(!liked);
