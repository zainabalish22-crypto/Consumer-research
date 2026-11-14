/**
 * The network model shared by every import format. Edge tables (CSV, TSV, Gephi's edge
 * spreadsheet) and graph files (GEXF, GraphML) all become one Graph, with every problem in the
 * file counted and reported rather than silently repaired. Pure functions, so they can be
 * tested without a browser.
 */

export type Node = { id: string; label: string };
export type Edge = { source: string; target: string; weight: number };
export type Graph = { nodes: Node[]; edges: Edge[]; directed: boolean };

export type EdgeMapping = { source?: string; target?: string; weight?: string };

export type BuildReport = {
  /** Data rows read from the table (excluding the header). */
  rows: number;
  /** Rows dropped because source or target was blank. */
  blankEnds: number;
  /** Edges that start and end at the same node. Kept, and counted. */
  selfLoops: number;
  /** Edges that repeated an earlier pair; their weights were added together. */
  merged: number;
  /** Weight cells that were blank or not a number; the edge gets weight 1. */
  badWeights: number;
  /** Whether the file had a weight column at all. */
  hasWeight: boolean;
};

/** Reads a number, accepting a decimal comma (common in files saved with a semicolon separator). */
export function readWeight(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  const n = Number(/^-?\d+,\d+$/.test(s) ? s.replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
}

/** Edge key: undirected pairs are sorted, so A–B and B–A count as the same tie. */
function keyOf(a: string, b: string, directed: boolean) {
  if (directed || a <= b) return `${a}\u0000${b}`;
  return `${b}\u0000${a}`;
}

/** Builds a graph from table cells. The header is the first row; rows must have header.length cells. */
export function graphFromTable(header: string[], rows: string[][], mapping: EdgeMapping, directed: boolean): { graph: Graph; report: BuildReport } {
  const iSource = mapping.source ? header.indexOf(mapping.source) : -1;
  const iTarget = mapping.target ? header.indexOf(mapping.target) : -1;
  const iWeight = mapping.weight ? header.indexOf(mapping.weight) : -1;
  const report: BuildReport = { rows: rows.length, blankEnds: 0, selfLoops: 0, merged: 0, badWeights: 0, hasWeight: iWeight >= 0 };
  const edges = new Map<string, Edge>();
  const nodes = new Map<string, Node>();

  if (iSource < 0 || iTarget < 0) return { graph: { nodes: [], edges: [], directed }, report: { ...report, blankEnds: rows.length } };

  for (const r of rows) {
    const a = r[iSource]?.trim() ?? "";
    const b = r[iTarget]?.trim() ?? "";
    if (!a || !b) {
      report.blankEnds++;
      continue;
    }
    let weight = 1;
    if (iWeight >= 0) {
      const w = readWeight(r[iWeight] ?? "");
      if (w === null) report.badWeights++;
      else weight = w;
    }
    if (a === b) report.selfLoops++;
    for (const id of [a, b]) if (!nodes.has(id)) nodes.set(id, { id, label: id });
    const k = keyOf(a, b, directed);
    const prev = edges.get(k);
    if (prev) {
      prev.weight += weight;
      report.merged++;
    } else edges.set(k, { source: a, target: b, weight });
  }
  return { graph: { nodes: [...nodes.values()], edges: [...edges.values()], directed }, report };
}

/**
 * Reads a GEXF or GraphML document (text) into a graph. The browser's DOMParser does the XML
 * work; the function only needs a Document, so it is called from the client.
 */
export function graphFromXml(doc: Document, format: "gexf" | "graphml"): { graph: Graph; report: BuildReport } {
  const byName = (root: Element | Document, name: string) => Array.from(root.getElementsByTagNameNS("*", name));
  const graphEl = byName(doc, "graph")[0];
  const directedAttr = (graphEl?.getAttribute(format === "gexf" ? "defaultedgetype" : "edgedefault") ?? "directed").toLowerCase();
  const directed = directedAttr !== "undirected";

  // GraphML keeps weights under a <key> declared for edges; GEXF uses an attribute.
  let weightKey: string | null = null;
  if (format === "graphml") {
    const key = byName(doc, "key").find((k) => k.getAttribute("for") === "edge" && /weight/i.test(k.getAttribute("attr.name") ?? ""));
    weightKey = key?.getAttribute("id") ?? null;
  }

  const rows: string[][] = [];
  const edgeEls = byName(doc, "edge");
  for (const e of edgeEls) {
    let weight = e.getAttribute("weight") ?? "";
    if (format === "graphml" && weightKey) {
      const d = Array.from(e.getElementsByTagNameNS("*", "data")).find((x) => x.getAttribute("key") === weightKey);
      weight = d?.textContent ?? "";
    }
    rows.push([e.getAttribute("source") ?? "", e.getAttribute("target") ?? "", weight]);
  }
  const labels = new Map<string, string>();
  for (const n of byName(doc, "node")) {
    const id = n.getAttribute("id") ?? "";
    if (!id) continue;
    labels.set(id, n.getAttribute("label") ?? id);
  }
  // Only use a weight column when the file actually gives weights; otherwise every edge is 1 and
  // no weight is reported as a problem.
  const anyWeight = rows.some((r) => r[2] !== "");
  const header = anyWeight ? ["source", "target", "weight"] : ["source", "target"];
  const mapping: EdgeMapping = anyWeight ? { source: "source", target: "target", weight: "weight" } : { source: "source", target: "target" };
  const { graph, report } = graphFromTable(header, rows.map((r) => r.slice(0, header.length)), mapping, directed);
  // Isolated nodes (no edges) are part of the network; keep them with their labels.
  const nodes = new Map(graph.nodes.map((n) => [n.id, n] as const));
  for (const [id, label] of labels) if (!nodes.has(id)) nodes.set(id, { id, label });
  for (const n of nodes.values()) n.label = labels.get(n.id) ?? n.label;
  return { graph: { ...graph, nodes: [...nodes.values()] }, report };
}
