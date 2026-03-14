import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const match = env.match(/GEMINI_API_KEY="([^"]+)"/);
if (match) {
  const key = match[1];
  fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + key)
    .then((r) => r.json())
    .then((d) => {
      const models = d.models || [];
      console.log(
        "IMAGEN MODELS:",
        models.filter((m) => m.name.toLowerCase().includes("imagen") || m.name.toLowerCase().includes("image")),
      );
      console.log("All methods for all models:");
      models.forEach((m) => console.log(m.name, m.supportedGenerationMethods));
    })
    .catch(console.error);
}
