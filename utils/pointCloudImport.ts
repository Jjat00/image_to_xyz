import { PointCloudData } from "../types";

// Target bounding-box size so any imported cloud frames nicely in the viewer,
// regardless of its original units (meters, pixels, etc.).
const FIT_SIZE = 10;
const DEFAULT_GRAY = 0.8;

interface RawPoints {
  xyz: number[];
  rgb: number[] | null; // raw color values (any scale)
}

const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);
const unpackRgbFromFloat = (f: number): [number, number, number] => {
  _f32[0] = f;
  const v = _u32[0];
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
};

const finalize = (raw: RawPoints): PointCloudData => {
  const count = raw.xyz.length / 3;
  if (count === 0) throw new Error("No se encontraron puntos en el archivo.");

  const positions = Float32Array.from(raw.xyz);
  fitPositions(positions);

  const colors = new Float32Array(count * 3);
  if (raw.rgb && raw.rgb.length === count * 3) {
    let max = 0;
    for (let i = 0; i < raw.rgb.length; i++) if (raw.rgb[i] > max) max = raw.rgb[i];
    const scale = max > 1.0 ? 1 / 255 : 1;
    for (let i = 0; i < colors.length; i++) {
      const c = raw.rgb[i] * scale;
      colors[i] = c < 0 ? 0 : c > 1 ? 1 : c;
    }
  } else {
    colors.fill(DEFAULT_GRAY);
  }

  return { positions, colors, width: count, height: 1 };
};

const fitPositions = (positions: Float32Array): void => {
  const n = positions.length / 3;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  if (!isFinite(size) || size <= 0) return;
  const k = FIT_SIZE / size;
  if (Math.abs(k - 1) < 1e-6) return;
  for (let i = 0; i < positions.length; i++) positions[i] *= k;
};

/* -------------------- ASCII (xyz / csv / txt) -------------------- */

const parseAscii = (text: string, delimiter: "comma" | "whitespace"): PointCloudData => {
  const lines = text.split(/\r?\n/);
  const xyz: number[] = [];
  const rgb: number[] = [];
  let hasColor = true;
  let colIdx: number[] | null = null; // [x,y,z,r,g,b] column indices

  const splitRow = (line: string): string[] =>
    delimiter === "comma" ? line.split(",") : line.trim().split(/[\s,]+/);

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (!line || !line.trim()) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

    const cells = splitRow(line);

    // Header row (CSV-style): map columns by name once.
    if (colIdx === null && cells.some((c) => isNaN(parseFloat(c)))) {
      const names = cells.map((c) => c.trim().toLowerCase());
      const find = (...keys: string[]) => names.findIndex((nm) => keys.includes(nm));
      const ix = find("x"), iy = find("y"), iz = find("z");
      if (ix >= 0 && iy >= 0 && iz >= 0) {
        const ir = find("r", "red"), ig = find("g", "green"), ib = find("b", "blue");
        colIdx = [ix, iy, iz, ir, ig, ib];
        hasColor = ir >= 0 && ig >= 0 && ib >= 0;
      }
      continue; // skip the header line itself
    }

    const nums = cells.map((c) => parseFloat(c));
    if (nums.length < 3 || isNaN(nums[0]) || isNaN(nums[1]) || isNaN(nums[2])) continue;

    if (colIdx) {
      xyz.push(nums[colIdx[0]], nums[colIdx[1]], nums[colIdx[2]]);
      if (hasColor) rgb.push(nums[colIdx[3]], nums[colIdx[4]], nums[colIdx[5]]);
    } else {
      xyz.push(nums[0], nums[1], nums[2]);
      if (nums.length >= 6 && !isNaN(nums[3]) && !isNaN(nums[4]) && !isNaN(nums[5])) {
        rgb.push(nums[3], nums[4], nums[5]);
      } else {
        hasColor = false;
      }
    }
  }

  return finalize({ xyz, rgb: hasColor && rgb.length ? rgb : null });
};

/* -------------------- shared binary helpers -------------------- */

const TYPE_SIZE: Record<string, number> = {
  char: 1, int8: 1, uchar: 1, uint8: 1,
  short: 2, int16: 2, ushort: 2, uint16: 2,
  int: 4, int32: 4, uint: 4, uint32: 4, float: 4, float32: 4,
  double: 8, float64: 8,
};

const readScalar = (dv: DataView, off: number, type: string, le: boolean): number => {
  switch (type) {
    case "char": case "int8": return dv.getInt8(off);
    case "uchar": case "uint8": return dv.getUint8(off);
    case "short": case "int16": return dv.getInt16(off, le);
    case "ushort": case "uint16": return dv.getUint16(off, le);
    case "int": case "int32": return dv.getInt32(off, le);
    case "uint": case "uint32": return dv.getUint32(off, le);
    case "float": case "float32": return dv.getFloat32(off, le);
    case "double": case "float64": return dv.getFloat64(off, le);
    default: throw new Error(`Tipo binario no soportado: ${type}`);
  }
};

// Byte offset right after the marker line (e.g. "end_header" or "DATA ...").
const findBodyStart = (bytes: Uint8Array, marker: string): number => {
  const m = new TextEncoder().encode(marker);
  for (let i = 0; i <= bytes.length - m.length; i++) {
    let hit = true;
    for (let j = 0; j < m.length; j++) {
      if (bytes[i + j] !== m[j]) { hit = false; break; }
    }
    if (hit) {
      let k = i + m.length;
      while (k < bytes.length && bytes[k] !== 0x0a) k++;
      return k + 1;
    }
  }
  return -1;
};

/* -------------------- PLY (ascii + binary) -------------------- */

interface PlyProp { name: string; type: string }

const parsePLY = (buffer: ArrayBuffer): PointCloudData => {
  const bytes = new Uint8Array(buffer);
  const bodyStart = findBodyStart(bytes, "end_header");
  if (bodyStart < 0) throw new Error("PLY inválido: falta end_header.");

  const header = new TextDecoder().decode(bytes.subarray(0, bodyStart));
  const lines = header.split(/\r?\n/);

  let format = "ascii";
  let vertexCount = 0;
  let inVertex = false;
  const props: PlyProp[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("format")) {
      format = line.split(/\s+/)[1];
    } else if (line.startsWith("element")) {
      const parts = line.split(/\s+/);
      inVertex = parts[1] === "vertex";
      if (inVertex) vertexCount = parseInt(parts[2], 10);
    } else if (line.startsWith("property") && inVertex) {
      const parts = line.split(/\s+/);
      if (parts[1] === "list") throw new Error("PLY: propiedades 'list' en vertex no soportadas.");
      props.push({ type: parts[1], name: parts[2].toLowerCase() });
    }
  }

  if (!vertexCount) throw new Error("PLY: no hay vértices.");

  const idx = (n: string) => props.findIndex((p) => p.name === n);
  const ix = idx("x"), iy = idx("y"), iz = idx("z");
  if (ix < 0 || iy < 0 || iz < 0) throw new Error("PLY: faltan coordenadas x/y/z.");
  const ir = idx("red") >= 0 ? idx("red") : idx("r");
  const ig = idx("green") >= 0 ? idx("green") : idx("g");
  const ib = idx("blue") >= 0 ? idx("blue") : idx("b");
  const hasColor = ir >= 0 && ig >= 0 && ib >= 0;

  const xyz: number[] = [];
  const rgb: number[] = [];

  if (format === "ascii") {
    const body = new TextDecoder().decode(bytes.subarray(bodyStart));
    const rows = body.split(/\r?\n/);
    let read = 0;
    for (const row of rows) {
      if (read >= vertexCount) break;
      const t = row.trim();
      if (!t) continue;
      const v = t.split(/\s+/).map(Number);
      xyz.push(v[ix], v[iy], v[iz]);
      if (hasColor) rgb.push(v[ir], v[ig], v[ib]);
      read++;
    }
  } else if (format === "binary_little_endian" || format === "binary_big_endian") {
    const le = format === "binary_little_endian";
    const dv = new DataView(buffer);
    const sizes = props.map((p) => {
      const s = TYPE_SIZE[p.type];
      if (!s) throw new Error(`PLY: tipo no soportado '${p.type}'.`);
      return s;
    });
    const offsets: number[] = [];
    let stride = 0;
    for (let i = 0; i < props.length; i++) { offsets.push(stride); stride += sizes[i]; }

    let base = bodyStart;
    for (let i = 0; i < vertexCount; i++) {
      xyz.push(
        readScalar(dv, base + offsets[ix], props[ix].type, le),
        readScalar(dv, base + offsets[iy], props[iy].type, le),
        readScalar(dv, base + offsets[iz], props[iz].type, le)
      );
      if (hasColor) {
        rgb.push(
          readScalar(dv, base + offsets[ir], props[ir].type, le),
          readScalar(dv, base + offsets[ig], props[ig].type, le),
          readScalar(dv, base + offsets[ib], props[ib].type, le)
        );
      }
      base += stride;
    }
  } else {
    throw new Error(`PLY: formato '${format}' no soportado.`);
  }

  return finalize({ xyz, rgb: hasColor ? rgb : null });
};

/* -------------------- PCD (ascii + binary) -------------------- */

const parsePCD = (buffer: ArrayBuffer): PointCloudData => {
  const bytes = new Uint8Array(buffer);
  // Header is always ASCII up to and including the DATA line.
  const headText = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
  const headerLines = headText.split(/\r?\n/);

  let fields: string[] = [];
  let sizes: number[] = [];
  let types: string[] = [];
  let counts: number[] = [];
  let points = 0;
  let dataType = "ascii";

  for (const raw of headerLines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [key, ...rest] = line.split(/\s+/);
    switch (key.toUpperCase()) {
      case "FIELDS": fields = rest.map((f) => f.toLowerCase()); break;
      case "SIZE": sizes = rest.map(Number); break;
      case "TYPE": types = rest; break;
      case "COUNT": counts = rest.map(Number); break;
      case "POINTS": points = parseInt(rest[0], 10); break;
      case "WIDTH": if (!points) points = parseInt(rest[0], 10); break;
      case "DATA": dataType = (rest[0] || "ascii").toLowerCase(); break;
    }
  }

  if (!fields.length) throw new Error("PCD: cabecera inválida (sin FIELDS).");
  if (!counts.length) counts = fields.map(() => 1);

  const fx = fields.indexOf("x"), fy = fields.indexOf("y"), fz = fields.indexOf("z");
  if (fx < 0 || fy < 0 || fz < 0) throw new Error("PCD: faltan campos x/y/z.");
  const frgb = fields.indexOf("rgb") >= 0 ? fields.indexOf("rgb") : fields.indexOf("rgba");
  const hasColor = frgb >= 0;

  const xyz: number[] = [];
  const rgb: number[] = [];

  if (dataType === "ascii") {
    const bodyStart = findBodyStart(bytes, "DATA ascii");
    if (bodyStart < 0) throw new Error("PCD: no se encontró el bloque de datos ASCII.");
    const body = new TextDecoder().decode(bytes.subarray(bodyStart));
    const rows = body.split(/\r?\n/);
    let read = 0;
    for (const row of rows) {
      if (points && read >= points) break;
      const t = row.trim();
      if (!t || t.startsWith("#")) continue;
      const v = t.split(/\s+/);
      xyz.push(parseFloat(v[fx]), parseFloat(v[fy]), parseFloat(v[fz]));
      if (hasColor) {
        const [r, g, b] = unpackRgbFromFloat(parseFloat(v[frgb]));
        rgb.push(r, g, b);
      }
      read++;
    }
  } else if (dataType === "binary") {
    const marker = findBodyStart(bytes, "DATA binary");
    if (marker < 0) throw new Error("PCD: no se encontró el bloque de datos binario.");
    if (!types.length || !sizes.length) throw new Error("PCD: cabecera binaria incompleta.");
    const le = true; // PCD binary is little-endian
    const dv = new DataView(buffer);
    const fieldBytes = sizes.map((s, i) => s * (counts[i] || 1));
    const offsets: number[] = [];
    let stride = 0;
    for (let i = 0; i < fields.length; i++) { offsets.push(stride); stride += fieldBytes[i]; }

    const scalarType = (i: number): string => {
      const t = types[i];
      const s = sizes[i];
      if (t === "F") return s === 8 ? "double" : "float";
      if (t === "U") return s === 1 ? "uchar" : s === 2 ? "ushort" : "uint";
      if (t === "I") return s === 1 ? "char" : s === 2 ? "short" : "int";
      throw new Error(`PCD: tipo '${t}' no soportado.`);
    };

    let base = marker;
    for (let i = 0; i < points; i++) {
      xyz.push(
        readScalar(dv, base + offsets[fx], scalarType(fx), le),
        readScalar(dv, base + offsets[fy], scalarType(fy), le),
        readScalar(dv, base + offsets[fz], scalarType(fz), le)
      );
      if (hasColor) {
        // rgb is stored as a packed 4-byte value (float or uint).
        const packed = dv.getUint32(base + offsets[frgb], le);
        rgb.push((packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff);
      }
      base += stride;
    }
  } else {
    throw new Error(`PCD: DATA '${dataType}' no soportado (usa ascii o binary).`);
  }

  return finalize({ xyz, rgb: hasColor ? rgb : null });
};

/* -------------------- entry point -------------------- */

export const SUPPORTED_IMPORT_EXTENSIONS = [".ply", ".xyz", ".pcd", ".csv", ".txt"];

export const isSupportedPointCloudFile = (name: string): boolean => {
  const lower = name.toLowerCase();
  return SUPPORTED_IMPORT_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

export const loadPointCloudFromFile = async (file: File): Promise<PointCloudData> => {
  const buffer = await file.arrayBuffer();
  const ext = file.name.toLowerCase().split(".").pop() || "";

  switch (ext) {
    case "ply":
      return parsePLY(buffer);
    case "pcd":
      return parsePCD(buffer);
    case "csv":
      return parseAscii(new TextDecoder().decode(buffer), "comma");
    case "xyz":
    case "txt":
      return parseAscii(new TextDecoder().decode(buffer), "whitespace");
    default:
      throw new Error(`Formato no soportado: .${ext}`);
  }
};
