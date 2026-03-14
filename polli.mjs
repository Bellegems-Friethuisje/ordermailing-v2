// test
async function test() {
  const models = ["flux", "turbo", "sana"];
  for (const m of models) {
    try {
      const res = await fetch(`https://image.pollinations.ai/prompt/test?width=1280&height=720&model=${m}`);
      console.log(`${m}: ${res.status}`);
    } catch (e) {
      console.log(`${m}: ${e.message}`);
    }
  }
}
test();
