import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";

export const alt = "マイ経理 — AIに相談しながら、未処理明細と定型請求をまとめて管理";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

const navy = "#1f2937";
const blue = "#2864f0";

export default async function OpenGraphImage() {
  const icon = await readFile(new URL("./favicon.svg", import.meta.url));
  const iconSrc = `data:image/svg+xml;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f5f7fa",
          color: navy,
          display: "flex",
          fontFamily: "sans-serif",
          height: "100%",
          padding: "78px 84px",
          width: "100%",
        }}
      >
        <img alt="" height={300} src={iconSrc} style={{ display: "flex" }} width={300} />

        <div style={{ display: "flex", flexDirection: "column", marginLeft: 64 }}>
          <div
            style={{
              color: blue,
              display: "flex",
              fontSize: 54,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            AIと進める経理
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 110,
              fontWeight: 900,
              letterSpacing: -4,
              lineHeight: 1.03,
              marginTop: 16,
            }}
          >
            マイ経理
          </div>
          <div
            style={{
              color: "#52647f",
              display: "flex",
              flexDirection: "column",
              fontSize: 54,
              fontWeight: 700,
              lineHeight: 1.2,
              marginTop: 22,
            }}
          >
            <span>AIに相談しながら、</span>
            <span>未処理明細と定型請求を</span>
            <span>まとめて管理</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
