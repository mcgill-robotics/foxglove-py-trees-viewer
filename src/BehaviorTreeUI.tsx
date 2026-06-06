import { useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background, Controls, MiniMap,
  Node, Edge, Position, Handle, MarkerType,
  useNodesState, useEdgesState,
  ReactFlowProvider,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";

// ============================================================
// Types
// ============================================================
type UUID = { uuid: number[] | Uint8Array };

type BehaviourMsg = {
  name: string;
  type: number;
  status: number;
  own_id: UUID;
  parent_id: UUID;
  child_ids: UUID[];
  is_active: boolean;
};

type BehaviorTreeUIProps = {
  treeData: {
    changed: boolean;
    behaviours: BehaviourMsg[];
    blackboard_on_visited_path: { key: string; value: string }[];
  };
};

// ============================================================
// Layout Constants
// ============================================================
const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

// ============================================================
// Helpers
// ============================================================
const uuidToString = (u: UUID): string => {
  if (!u || !u.uuid) return "unknown";
  return Array.from(u.uuid).join("-");
};

const getTypeInfo = (typeCode: number) => {
  switch (typeCode) {
    case 1: return { label: "ACT", icon: "⚙" };
    case 2: return { label: "SEQ", icon: "➔" };
    case 3: return { label: "SEL", icon: "?" };
    case 4: return { label: "PAR", icon: "⇉" };
    case 5: return { label: "CHO", icon: "⧖" };
    case 6: return { label: "DEC", icon: "◇" };
    default: return { label: "???", icon: "■" };
  }
};

// ============================================================
// Custom Node Component
// ============================================================
const CustomTreeNode = ({ data }: { data: any }) => {
  const { name, typeCode, status, isActive, dimmed, message, detail } = data;
  const typeInfo = getTypeInfo(typeCode);

  // Default: INVALID (1) - Waiting to run
  let borderColor = "#475569"; 
  let glowColor = "transparent";
  let statusText = "WAITING"; 
  let backgroundColor = "#0f172a"; 
  let headerColor = "#1e293b";

  if (status === 2) { 
    // RUNNING (2) -> YELLOW/AMBER
    borderColor = "#eab308"; 
    glowColor = "rgba(234, 179, 8, 0.6)"; 
    statusText = "RUNNING"; 
    backgroundColor = "#422006"; 
    headerColor = "#713f12";
  }
  else if (status === 3) { 
    // SUCCESS (3) -> GREEN
    borderColor = "#22c55e"; 
    glowColor = "rgba(34, 197, 94, 0.6)"; 
    statusText = "SUCCESS"; 
    backgroundColor = "#052e16"; 
    headerColor = "#14532d";
  }
  else if (status === 4) { 
    // FAILURE (4) -> RED
    borderColor = "#ef4444"; 
    glowColor = "rgba(239, 68, 68, 0.6)"; 
    statusText = "FAILURE"; 
    backgroundColor = "#450a0a"; 
    headerColor = "#7f1d1d";
  }

  return (
    <div style={{
      width: "100%", height: "100%",
      margin: 0, padding: 0, boxSizing: "border-box",
      background: backgroundColor,
      border: `2px solid ${borderColor}`,
      borderRadius: 8,
      boxShadow: isActive ? `0 0 20px ${glowColor}` : "0 4px 6px rgba(0,0,0,0.3)",
      color: "white",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      position: "relative",
      display: "flex", flexDirection: "column",
      opacity: dimmed ? 0.2 : 1,
      filter: dimmed ? "grayscale(80%)" : "none"
    }}>
      <Handle type="target" position={Position.Top} style={{ background: borderColor, border: "none", width: 8, height: 8 }} />

      {/* Header bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: headerColor, padding: "4px 8px", margin: 0,
        borderBottom: `1px solid ${borderColor}55`,
        fontSize: 11, fontWeight: 700, color: "#cbd5e1",
        borderTopLeftRadius: 6, borderTopRightRadius: 6
      }}>
        <span>{typeInfo.icon} {typeInfo.label}</span>
        {detail && <span style={{ fontSize: 9, background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4, color: "#38bdf8" }}>{detail}</span>}
        <span>{statusText}</span>
      </div>

      {/* Node Body */}
      <div style={{
        padding: "6px 8px", margin: 0, textAlign: "center",
        flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: "1.2", wordBreak: "break-word" }}>{name}</div>
        {message && (
          <div style={{ fontSize: 10, color: "#fcd34d", fontStyle: "italic", marginTop: 6, wordBreak: "break-word", lineHeight: "1.1" }}>
            {message}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: borderColor, border: "none", width: 8, height: 8 }} />
    </div>
  );
};

const nodeTypes = { customTreeCard: CustomTreeNode };

// ============================================================
// Dagre Auto-Layout
// ============================================================
const computeLayout = (nodes: Node[], edges: Edge[]) => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 70 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id);
      return {
        ...n,
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom,
        position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
        style: { width: NODE_WIDTH, height: NODE_HEIGHT },
      };
    }),
    edges,
  };
};

// ============================================================
// Python repr() Parser
// ============================================================
interface PNode {
  type: "object" | "array" | "primitive";
  typeName?: string;
  fields?: { key: string; value: PNode }[];
  items?: PNode[];
  value?: string;
}

function parsePythonRepr(input: string): PNode {
  let pos = 0;
  const len = input.length;

  function cur(): string { return input.charAt(pos); }

  function skipWS() {
    while (pos < len) {
      const c = cur();
      if (c === " " || c === "\t" || c === "\n" || c === "\r") pos++;
      else break;
    }
  }

  function parseValue(): PNode {
    skipWS();
    if (pos >= len) return { type: "primitive", value: "" };
    const c = cur();
    if (c === "[") return parseArray();
    if (c === "'" || c === '"') return parseStr();
    if (/^[a-zA-Z_][\w.]*\s*\(/.test(input.slice(pos))) return parseObj();
    return parsePrim();
  }

  function parseObj(): PNode {
    let typeName = "";
    while (pos < len && cur() !== "(") { typeName += cur(); pos++; }
    typeName = typeName.trim();
    if (pos < len) pos++;
    const fields: { key: string; value: PNode }[] = [];
    skipWS();
    while (pos < len && cur() !== ")") {
      const mark = pos;
      skipWS();
      if (pos >= len || cur() === ")") break;
      let key = "";
      while (pos < len && cur() !== "=" && cur() !== ")" && cur() !== ",") { key += cur(); pos++; }
      key = key.trim();
      if (pos < len && cur() === "=") { pos++; fields.push({ key, value: parseValue() }); }
      skipWS();
      if (pos < len && cur() === ",") pos++;
      if (pos === mark) pos++;
    }
    if (pos < len && cur() === ")") pos++;
    return { type: "object", typeName, fields };
  }

  function parseArray(): PNode {
    pos++;
    const items: PNode[] = [];
    skipWS();
    while (pos < len && cur() !== "]") {
      const mark = pos;
      items.push(parseValue());
      skipWS();
      if (pos < len && cur() === ",") pos++;
      if (pos === mark) pos++;
    }
    if (pos < len) pos++;
    return { type: "array", items };
  }

  function parseStr(): PNode {
    const q = cur(); pos++;
    let v = "";
    while (pos < len && cur() !== q) {
      if (cur() === "\\" && pos + 1 < len) { v += cur() + input.charAt(pos + 1); pos += 2; }
      else { v += cur(); pos++; }
    }
    if (pos < len) pos++;
    return { type: "primitive", value: `'${v}'` };
  }

  function parsePrim(): PNode {
    let v = "";
    while (pos < len) {
      const c = cur();
      if (c === "," || c === ")" || c === "]") break;
      v += c; pos++;
    }
    return { type: "primitive", value: v.trim() };
  }

  try { return parseValue(); }
  catch { return { type: "primitive", value: input }; }
}

// ============================================================
// Parsed Value Renderer (recursive)
// ============================================================
function ParsedValueView({ node, depth }: { node: PNode; depth: number }) {
  if (node.type === "primitive") {
    const v = node.value || "";
    let color = "#fcd34d";
    if (v === "True") color = "#4ade80";
    else if (v === "False") color = "#f87171";
    else if (v === "None") color = "#94a3b8";
    else if (v.startsWith("'") || v.startsWith('"')) color = "#a78bfa";
    else if (/^-?\d/.test(v)) color = "#22d3ee";
    return <span style={{ color, fontSize: 12 }}>{v}</span>;
  }

  if (node.type === "array") {
    if (!node.items || node.items.length === 0) {
      return <span style={{ color: "#64748b", fontSize: 12 }}>[]</span>;
    }
    return (
      <details style={{ marginLeft: depth > 0 ? 8 : 0 }}>
        <summary style={{ cursor: "pointer", color: "#38bdf8", fontSize: 12, outline: "none" }}>
          [{node.items.length} items]
        </summary>
        <div style={{ borderLeft: "2px solid #334155", paddingLeft: 10, marginTop: 4 }}>
          {node.items.map((item, i) => {
            let label = `[${i}]`;
            if (item.type === "object") {
              const shortName = (item.typeName || "").split(".").pop() || "Object";
              label = `[${i}] ${shortName}`;
              const labelF = (item.fields || []).find((f) => f.key === "label");
              const idF = (item.fields || []).find((f) => f.key === "id");
              if (labelF && labelF.value.type === "primitive") label += ` "${(labelF.value.value || "").replace(/'/g, "")}"`;
              if (idF && idF.value.type === "primitive") label += ` #${idF.value.value}`;
            }
            if (item.type === "primitive") {
              return (
                <div key={i} style={{ marginBottom: 2 }}>
                  <span style={{ color: "#64748b", fontSize: 11 }}>[{i}] </span>
                  <ParsedValueView node={item} depth={depth + 1} />
                </div>
              );
            }
            return (
              <details key={i} style={{ marginBottom: 2 }}>
                <summary style={{ cursor: "pointer", color: "#c4b5fd", fontSize: 12, outline: "none" }}>{label}</summary>
                <div style={{ borderLeft: "2px solid #334155", paddingLeft: 10, marginTop: 2 }}>
                  {item.type === "object" && (item.fields || []).map((f, fi) => (
                    <div key={fi} style={{ marginBottom: 2 }}>
                      <span style={{ color: "#38bdf8", fontSize: 12 }}>{f.key}: </span>
                      <ParsedValueView node={f.value} depth={depth + 2} />
                    </div>
                  ))}
                  {item.type === "array" && <ParsedValueView node={item} depth={depth + 1} />}
                </div>
              </details>
            );
          })}
        </div>
      </details>
    );
  }

  if (node.type === "object") {
    const shortName = (node.typeName || "Object").split(".").pop() || "Object";
    const fields = node.fields || [];
    if (fields.length <= 3 && fields.length > 0 && fields.every((f) => f.value.type === "primitive")) {
      return (
        <span style={{ fontSize: 12 }}>
          <span style={{ color: "#94a3b8" }}>{shortName}(</span>
          {fields.map((f, i) => (
            <span key={i}>
              {i > 0 && <span style={{ color: "#475569" }}>, </span>}
              <span style={{ color: "#38bdf8" }}>{f.key}</span>
              <span style={{ color: "#475569" }}>=</span>
              <ParsedValueView node={f.value} depth={depth + 1} />
            </span>
          ))}
          <span style={{ color: "#94a3b8" }}>)</span>
        </span>
      );
    }
    return (
      <details style={{ marginLeft: depth > 0 ? 8 : 0 }}>
        <summary style={{ cursor: "pointer", color: "#c4b5fd", fontSize: 12, outline: "none" }}>
          {shortName} ({fields.length} fields)
        </summary>
        <div style={{ borderLeft: "2px solid #334155", paddingLeft: 10, marginTop: 4 }}>
          {fields.map((f, i) => (
            <div key={i} style={{ marginBottom: 2 }}>
              <span style={{ color: "#38bdf8", fontSize: 12 }}>{f.key}: </span>
              <ParsedValueView node={f.value} depth={depth + 1} />
            </div>
          ))}
        </div>
      </details>
    );
  }
  return <span style={{ color: "#64748b" }}>{JSON.stringify(node)}</span>;
}

// ============================================================
// Blackboard Value
// ============================================================
function BlackboardValue({ value }: { value: string }) {
  if (value.length <= 80 && !value.includes("(")) {
    return <span style={{ color: "#fcd34d", fontFamily: "monospace", fontSize: 12 }}>{value}</span>;
  }
  try {
    const parsed = parsePythonRepr(value);
    if (parsed.type === "primitive") {
      return <span style={{ color: "#fcd34d", fontFamily: "monospace", fontSize: 12 }}>{parsed.value}</span>;
    }
    return <ParsedValueView node={parsed} depth={0} />;
  } catch {
    return (
      <details>
        <summary style={{ cursor: "pointer", color: "#38bdf8", fontSize: 12 }}>
          Raw data ({value.length} chars)
        </summary>
        <pre style={{ whiteSpace: "pre-wrap", color: "#fcd34d", fontSize: 11, background: "#020617", padding: 8, borderRadius: 4, margin: "4px 0", maxHeight: 150, overflow: "auto" }}>
          {value}
        </pre>
      </details>
    );
  }
}

// ============================================================
// Main Flow Component
// ============================================================
function FlowComponent({ treeData }: BehaviorTreeUIProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const topologyHashRef = useRef("");
  const rfInstanceRef = useRef<any>(null);

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isDragging, setIsDragging] = useState(false);
  const prevSelectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setSidebarWidth((w) => Math.max(200, Math.min(800, w - e.movementX)));
    };
    const handleMouseUp = () => setIsDragging(false);
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const onNodeClick = (_: any, node: Node) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
  };

  useEffect(() => {
    if (!treeData || !treeData.behaviours) return;

    const newHash = treeData.behaviours
      .map((b) => `${uuidToString(b.own_id)}:${b.child_ids.map(c => uuidToString(c)).join(",")}`)
      .sort()
      .join("|");

    const bMap = new Map(treeData.behaviours.map((b) => [uuidToString(b.own_id), b]));
    
    if (selectedNodeId !== prevSelectedRef.current) {
      prevSelectedRef.current = selectedNodeId;
      if (selectedNodeId) {
        const descendantsToFit = [{ id: selectedNodeId }];
        const stack2 = [selectedNodeId];
        while (stack2.length > 0) {
          const cur = stack2.pop()!;
          const b = bMap.get(cur);
          if (b && b.child_ids) {
            b.child_ids.forEach(childUuid => {
              const childId = uuidToString(childUuid);
              if (bMap.has(childId)) {
                descendantsToFit.push({ id: childId });
                stack2.push(childId);
              }
            });
          }
        }
        setTimeout(() => {
          rfInstanceRef.current?.fitView({ nodes: descendantsToFit, duration: 600, padding: 0.3 });
        }, 50);
      } else {
        setTimeout(() => {
          rfInstanceRef.current?.fitView({ duration: 600, padding: 0.2 });
        }, 50);
      }
    }

    const highlightedNodes = new Set<string>();
    const highlightedEdges = new Set<string>();

    if (selectedNodeId) {
      let currentId = selectedNodeId;
      while (currentId) {
        highlightedNodes.add(currentId);
        const b = bMap.get(currentId);
        if (!b || !b.parent_id) break;
        const parentId = uuidToString(b.parent_id);
        if (bMap.has(parentId)) {
          highlightedEdges.add(`e-${parentId}-${currentId}`);
          currentId = parentId;
        } else {
          break;
        }
      }

      const stack = [selectedNodeId];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        highlightedNodes.add(cur);
        const b = bMap.get(cur);
        if (b && b.child_ids) {
          b.child_ids.forEach(childUuid => {
            const childId = uuidToString(childUuid);
            if (bMap.has(childId)) {
                highlightedEdges.add(`e-${cur}-${childId}`);
                stack.push(childId);
            }
          });
        }
      }
    }

    if (newHash !== topologyHashRef.current) {
      topologyHashRef.current = newHash;

      const nodeIdSet = new Set(treeData.behaviours.map((b) => uuidToString(b.own_id)));
      const rawNodes: Node[] = [];
      const rawEdges: Edge[] = [];

      treeData.behaviours.forEach((b) => {
        const id = uuidToString(b.own_id);
        const isDimmed = selectedNodeId ? !highlightedNodes.has(id) : false;

        rawNodes.push({
          id,
          type: "customTreeCard",
          position: { x: 0, y: 0 },
          data: { name: b.name, typeCode: b.type, status: b.status, isActive: b.is_active, message: (b as any).message, detail: (b as any).additional_detail, dimmed: isDimmed },
        });

        b.child_ids.forEach((childUuid) => {
          const childId = uuidToString(childUuid);
          if (!nodeIdSet.has(childId)) return; 
          
          const edgeId = `e-${id}-${childId}`;
          const isEdgeDimmed = selectedNodeId ? !highlightedEdges.has(edgeId) : false;
          const targetOpacity = isEdgeDimmed ? 0.1 : 1;

          rawEdges.push({
            id: edgeId,
            source: id,
            target: childId,
            type: "step",
            animated: b.is_active,
            markerEnd: { type: MarkerType.ArrowClosed, color: b.is_active ? "#06b6d4" : "#475569" },
            style: { stroke: b.is_active ? "#06b6d4" : "#475569", strokeWidth: b.is_active ? 2.5 : 1.5, opacity: targetOpacity },
          });
        });
      });

      const layouted = computeLayout(rawNodes, rawEdges);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);

      setTimeout(() => {
        rfInstanceRef.current?.fitView({ padding: 0.2, duration: 400 });
      }, 50);

    } else {
      // --- Status Change: Only update colors (Keeps Pan/Zoom intact) ---
      setNodes((prev) =>
        prev.map((n) => {
          const b = bMap.get(n.id);
          const isDimmed = selectedNodeId ? !highlightedNodes.has(n.id) : false;
          
          if (b) {
            let displayStatus = b.status;
            
            // VISUAL LATCHING FIX: 
            // If the node is currently INVALID (1)
            if (b.status === 1) {
              // But it used to be SUCCESS (3) or FAILURE (4) in the React state, keep it!
              if (n.data.status === 3) displayStatus = 3;
              else if (n.data.status === 4) displayStatus = 4;
            }

            if (
              n.data.status !== displayStatus || 
              n.data.isActive !== b.is_active || 
              n.data.dimmed !== isDimmed ||
              n.data.message !== (b as any).message
            ) {
              return { 
                ...n, 
                data: { 
                  ...n.data, 
                  status: displayStatus, 
                  isActive: b.is_active, 
                  message: (b as any).message, 
                  detail: (b as any).additional_detail, 
                  dimmed: isDimmed 
                } 
              };
            }
          }
          return n;
        })
      );

      setEdges((prev) =>
        prev.map((e) => {
          const parentB = bMap.get(e.source);
          const isEdgeDimmed = selectedNodeId ? !highlightedEdges.has(e.id) : false;
          const targetOpacity = isEdgeDimmed ? 0.1 : 1;
          
          if (parentB) {
            const active = parentB.is_active;
            if (e.animated !== active || e.style?.opacity !== targetOpacity) {
                return {
                    ...e,
                    animated: active,
                    markerEnd: { type: MarkerType.ArrowClosed, color: active ? "#06b6d4" : "#475569" },
                    style: { stroke: active ? "#06b6d4" : "#475569", strokeWidth: active ? 2.5 : 1.5, opacity: targetOpacity },
                };
            }
          }
          return e;
        })
      );
    }
  }, [treeData, selectedNodeId, setNodes, setEdges]);

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", backgroundColor: "#020617", color: "#f8fafc", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      <div style={{ flex: 1, position: "relative", height: "100%", overflow: "hidden" }}>
        {!isSidebarVisible && (
          <button 
            onClick={() => setIsSidebarVisible(true)}
            style={{ position: "absolute", top: 12, right: 12, zIndex: 10, padding: "8px 16px", background: "#1e293b", color: "#38bdf8", border: "1px solid #38bdf8", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: "bold", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}
          >
            Show Blackboard
          </button>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onInit={(instance) => {
            rfInstanceRef.current = instance;
            setTimeout(() => instance.fitView({ padding: 0.2 }), 50);
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          onNodeClick={onNodeClick}
          minZoom={0.05}
          maxZoom={2.0}
        >
          <Background color="#1e293b" gap={24} size={1} />
          <Controls showInteractive={false} style={{ background: "#0f172a", border: "1px solid #334155", fill: "#cbd5e1" }} />
          <MiniMap 
            nodeColor={(n) => {
              if (n.data?.status === 2) return "#eab308"; // RUNNING
              if (n.data?.status === 3) return "#22c55e"; // SUCCESS
              if (n.data?.status === 4) return "#ef4444"; // FAILURE
              return "#334155";
            }} 
            maskColor="#020617aa" 
            style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b" }} 
          />
        </ReactFlow>
      </div>

      {isSidebarVisible && (
        <div 
          onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
          style={{ width: 8, background: isDragging ? "#38bdf8" : "#1e293b", cursor: "col-resize", zIndex: 10, transition: "background 0.2s" }}
        />
      )}

      {isSidebarVisible && (
        <div style={{ width: sidebarWidth, minWidth: 200, maxWidth: 800, padding: 20, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", backgroundColor: "#0f172a", boxSizing: "border-box" }}>
          <div style={{ ...cardStyle, flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
            <button onClick={() => setIsSidebarVisible(false)} style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16 }}>✕</button>
            <h3 style={headerStyle}>📊 Blackboard Telemetry</h3>

          {(!treeData || treeData.blackboard_on_visited_path.length === 0) ? (
            <div style={{ color: "#64748b", fontStyle: "italic", textAlign: "center", marginTop: 20 }}>
              Waiting for active path data...
            </div>
          ) : (
            <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
              {treeData.blackboard_on_visited_path.map((item, index) => (
                <div key={index} style={{
                  padding: "10px 8px",
                  borderBottom: "1px solid #1e293b",
                  background: index % 2 === 0 ? "transparent" : "#1e293b40",
                }}>
                  <div style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    {item.key}
                  </div>
                  <div>
                    <BlackboardValue value={item.value} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

export function BehaviorTreeUI(props: BehaviorTreeUIProps) {
  return (
    <ReactFlowProvider>
      <FlowComponent {...props} />
    </ReactFlowProvider>
  );
}

// ============================================================
// Styling
// ============================================================
const cardStyle = { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: 16, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.5)" };
const headerStyle = { margin: "0 0 16px 0", fontSize: 14, textTransform: "uppercase" as const, letterSpacing: "1px", color: "#f8fafc", borderBottom: "1px solid #334155", paddingBottom: 8 };
