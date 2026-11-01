// Conkerbury Detectives Club - everything runs in YOUR browser. Nothing you type is sent anywhere or stored.
"use strict";
const SALT = "conkerbury-detectives";
const enc = new TextEncoder(), dec = new TextDecoder();
const norm = s => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function sha(text) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(text))); }
async function unlock(box, password) {
  // AES-GCM with a key made from the password (PBKDF2). Wrong password = decryption fails.
  const base = await crypto.subtle.importKey("raw", enc.encode(norm(password)), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(box.salt), iterations: box.iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(box.iv) }, key, b64(box.ct));
  return JSON.parse(dec.decode(plain));
}
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("div"); c.className = "confetti"; c.setAttribute("aria-hidden", "true");
  const cols = ["#8a4b25", "#e8833a", "#f6c945", "#3e8e5a", "#1f3a5f"];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "vw"; p.style.background = cols[i % cols.length];
    p.style.borderRadius = i % 3 ? "50%" : "4px"; p.style.animationDuration = 1.6 + Math.random() * 1.6 + "s";
    p.style.animationDelay = Math.random() * .5 + "s"; c.appendChild(p);
  }
  document.body.appendChild(c); setTimeout(() => c.remove(), 4200);
}
function show(el, cls, html) { el.className = "result show " + cls; el.innerHTML = html; el.focus(); }
function needCrypto(el) {
  if (window.crypto && crypto.subtle) return true;
  show(el, "no", "<h3>Oops!</h3><p>This browser can't check answers. Try a newer browser, or use the answers in the back of the book.</p>");
  return false;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------------------------------------------------------------- check-your-answer page
async function checkAnswer(ev) {
  ev.preventDefault();
  const out = document.getElementById("result"); if (!needCrypto(out)) return;
  const sel = document.getElementById("case"), caseNo = sel.value, raw = document.getElementById("code").value, code = norm(raw);
  const data = window.CC_ANSWERS[caseNo];
  if (!code) { show(out, "no", "<h3>Type your answer code first!</h3><p>It's at the end of the case: a code word and maybe a number.</p>"); return; }
  if (await sha(`${SALT}|${caseNo}|${code}`) === data.hash) {
    let reward = null; try { reward = await unlock(data.reward, code); } catch (e) {}
    show(out, "ok", `<span class="stamp red" style="float:right">Solved</span><h2>Case cracked!</h2>
      <p class="lead">Brilliant detective work. </p>${reward ? `<p><b>What happened next:</b> ${esc(reward.message)}</p>` : ""}
      ${reward && reward.key ? `<p class="hand">Your secret bonus key is: <b>${esc(reward.key)}</b><br>Take it to the <a href="bonus.html">Bonus Case</a> page!</p>` : ""}`);
    confetti(); return;
  }
  // Not right. Work out a gentle hint without ever revealing the answer.
  const word = code.replace(/[0-9]+$/, ""), num = (code.match(/[0-9]+$/) || [""])[0];
  if (data.wrong) {
    let hint = data.wrong[await sha(`${SALT}|${caseNo}|wrong|${code}`)];
    if (!hint && data.word && await sha(`${SALT}|${caseNo}|word|${word}`) === data.word) hint = data.badnum;
    show(out, "no", `<h3>Not quite, detective&hellip;</h3><p>${esc(hint || data.unknown)}</p><p class="small">Every great detective gets it wrong sometimes. Have another look and try again!</p>`);
    return;
  }
  const wh = await sha(`${SALT}|${caseNo}|who|${word}`), ph = await sha(`${SALT}|${caseNo}|where|${num}`);
  let hint = data.unknown;
  if (data.who[wh] && data.who[wh] !== "RIGHT") hint = data.who[wh];
  else if (data.who[wh] === "RIGHT") hint = num ? (data.where[ph] || data.badnum) : data.nonum;
  show(out, "no", `<h3>Not quite, detective&hellip;</h3><p>${esc(hint)}</p><p class="small">Every great detective gets it wrong sometimes. Have another look and try again!</p>`);
}

// ---------------------------------------------------------------- bonus case page
async function openBonus(ev) {
  ev.preventDefault();
  const out = document.getElementById("bonus-msg"); if (!needCrypto(out)) return;
  let c;
  try { c = await unlock(window.CC_BONUS, document.getElementById("key").value); }
  catch (e) { show(out, "no", "<h3>The lock didn't budge.</h3><p>That's not the secret key. You get it when you crack Case 8 (check your answer on the <a href='check.html'>Check Your Answer</a> page), and it's printed on the Case 8 solution page in the book.</p>"); return; }
  out.className = "result"; document.getElementById("locked").hidden = true;
  const box = document.getElementById("bonus-case"); box.hidden = false;
  box.innerHTML = `
    <div class="folder manila"><span class="tab">BONUS CASE FILE</span>
      <h2>${esc(c.title)}</h2>${c.story.map(p => `<p>${esc(p)}</p>`).join("")}
      <p class="hand">Your mission: work out WHO took the sponge. Your answer code is their CODE WORD.</p></div>
    <h2>The Suspects</h2>
    <div class="suspects">${c.suspects.map(s => `<div class="card"><div class="pic">${s.svg}</div><h3>${esc(s.name)}</h3>
      <div class="role">CODE WORD: <b>${esc(s.code)}</b></div><p class="small">${esc(s.role)}</p>
      <p class="small"><b>Shoes:</b> ${esc(s.shoes)}<br><b>Pencil?</b> ${s.pencil ? "Yes" : "No"}</p><p class="hand" style="font-size:19px">&ldquo;${esc(s.says)}&rdquo;</p></div>`).join("")}</div>
    <h2 style="margin-top:28px">The Clues</h2>${c.clues.map(k => `<div class="clue"><b class="n">${esc(k.ref)}</b><div>${esc(k.text)}</div></div>`).join("")}
    <p class="small">One more fact: ${esc(c.alibi)}</p>
    <form id="bonus-check" class="folder sky" autocomplete="off"><span class="tab">CRACK IT</span>
      <label for="bcode">Answer code</label><input id="bcode" class="code" type="text" maxlength="12" spellcheck="false" autocapitalize="characters">
      <div class="btns"><button class="btn go">Check my answer</button></div>
      <div id="bres" class="result" tabindex="-1" aria-live="polite"></div></form>`;
  document.getElementById("bonus-check").addEventListener("submit", async e => {
    e.preventDefault(); const r = document.getElementById("bres"), code = norm(document.getElementById("bcode").value);
    try { const sol = await unlock(c.solution, code);
      show(r, "ok", `<span class="stamp red" style="float:right">Solved</span><h2>Case cracked!</h2>${sol.map(p => `<p>${esc(p)}</p>`).join("")}<p class="hand">Now print your <a href="printables.html#certificate">Detective Certificate</a>!</p>`); confetti();
    } catch (err) { show(r, "no", `<h3>Not quite!</h3><p>${esc(c.hints[code] || "Check every suspect against every clue. Shoes first, then the pencil, then who was busy somewhere else.")}</p>`); }
  });
}
// ---------------------------------------------------------------- "Get the book" buttons
// The Amazon link lives in ONE place: window.BOOK_URL in data/book.js (empty = "Coming soon on Amazon").
function bookLinks() {
  const url = String(window.BOOK_URL || "").trim(); if (!/^https:\/\/[^\s"<>]+$/.test(url)) return;
  document.querySelectorAll("[data-book-link]").forEach(a => { a.href = url; a.rel = "noopener"; a.classList.remove("soon"); a.textContent = "Get the book on Amazon"; });
  document.querySelectorAll("[data-book-note]").forEach(n => { n.hidden = true; });
}
document.addEventListener("DOMContentLoaded", () => {
  bookLinks();
  const f = document.getElementById("check-form"); if (f) f.addEventListener("submit", checkAnswer);
  const b = document.getElementById("bonus-form"); if (b) b.addEventListener("submit", openBonus);
  const n = document.getElementById("cert-name"); if (n) n.addEventListener("input", () => { document.getElementById("cert-who").textContent = n.value; });
  const pb = document.getElementById("printbtn"); if (pb) pb.addEventListener("click", () => window.print());
  const nl = document.getElementById("nl-form"); if (nl) nl.addEventListener("submit", e => e.preventDefault()); // newsletter not active: never submits
  const d = document.getElementById("cert-date"); if (d) d.textContent = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
});
