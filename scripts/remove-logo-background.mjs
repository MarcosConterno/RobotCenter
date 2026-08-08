import sharp from "sharp";

const input = "C:/Users/Marcos Trabalho/.codex/generated_images/019fe211-a7e5-7a63-b3f6-8670603cac2b/exec-1bc1021c-98e2-4ccb-b0e4-2870df272a87.png";
const output = "public/images/robot-center-system-logo-transparent.png";

const result = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const data = result.data;
let transparentPixels = 0;
for (let index = 0; index < data.length; index += 4) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const chromaScore = green - Math.max(red, blue);
  const isGreenBackground = green > 100 && green > red * 1.2 && green > blue * 1.2;

  if (isGreenBackground && chromaScore >= 45) {
    data[index + 3] = 0;
    transparentPixels += 1;
  } else if (chromaScore > 20) {
    data[index + 3] = Math.round(255 * (80 - chromaScore) / 60);
    data[index + 1] = Math.min(green, Math.max(red, blue));
  }
}

await sharp(data, {
  raw: {
    width: result.info.width,
    height: result.info.height,
    channels: 4,
  },
}).png().toFile(output);
console.log(`Imagem transparente criada em ${output} (${transparentPixels} pixels removidos)`);
