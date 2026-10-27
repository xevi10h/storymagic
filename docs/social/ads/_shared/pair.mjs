// Side-by-side preview of candidate images: node pair.mjs out.jpg img1 img2 ...
import sharp from "sharp";
const [out, ...files] = process.argv.slice(2);
const W = 540, H = 960;
const comp = await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(W, H, { fit: "cover" }).toBuffer(), left: i * (W + 6), top: 0 })));
await sharp({ create: { width: files.length * (W + 6), height: H, channels: 3, background: "#fff" } }).composite(comp).jpeg({ quality: 82 }).toFile(out);
