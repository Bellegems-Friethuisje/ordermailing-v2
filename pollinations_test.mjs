import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const match = env.match(/GEMINI_API_KEY="([^"]+)"/);
if (match) {
  const key = match[1];
  fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=" + key, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: "Create a modern 16:9 digital advertisement background for a perfume" }] },
      ],
    }),
  })
    .then((r) => r.json())
    .then(console.log)
    .catch(console.error);
}
