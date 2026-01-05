import { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Connection,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlowProvider,
  type NodeProps,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";

type ClaimType = "fact" | "value" | "policy" | "other";
type RelationKind = "support" | "attack";
type GateMode = "AND" | "OR";

type Evidence = {
  id: string;
  title: string;
  excerpt: string;
  trust: number;
  docId?: string;
};

type SupportingDocument = {
  id: string;
  name: string;
  sourceType: "pdf" | "url" | "note";
  location: string;
};

type Claim = {
  id: string;
  text: string;
  type: ClaimType;
  credibility: number;
  evidenceIds: string[];
  isAxiom: boolean;
  ignoreInfluence: boolean;
};

type Warrant = {
  id: string;
  text: string;
  credibility: number;
  evidenceIds: string[];
  isAxiom: boolean;
  ignoreInfluence: boolean;
};

type Gate = {
  id: string;
  mode: GateMode;
  warrantIds: string[];
  status: "active" | "disabled";
};

type Relation = {
  id: string;
  source: string;
  target: string;
  kind: RelationKind;
  gateId: string;
  weight: number;
};

type PatternMatch = {
  pattern_id: string;
  name: string;
  category: string;
  kind: string;
  description: string;
  action: string;
  nodes: string[];
  edges: string[];
  message: string;
};

type WarrantFragility = {
  edge_id: string;
  dst: string;
  gate_mode: GateMode;
  gate_score: number;
  critical_warrants: string[];
};

type ExplanationEntry = {
  edge_id: string;
  src: string;
  dst: string;
  kind: RelationKind;
  gate_score: number;
  src_score: number;
  influence: number;
  warrant_ids: string[];
  gate_mode: GateMode;
};

type ClaimExplanation = {
  evidence_support: number;
  incoming: ExplanationEntry[];
  total_influence: number;
  final_score: number;
};

type GraphState = {
  claims: Claim[];
  relations: Relation[];
  warrants: Warrant[];
  gates: Gate[];
  evidence: Evidence[];
  supportingDocs: SupportingDocument[];
  logs: string[];
  flaws: string[];
  flawClaims: string[];
  flawEdges: string[];
  patterns: PatternMatch[];
  fragility: WarrantFragility[];
  explanations: Record<string, ClaimExplanation>;
  missingAssumptions: Array<{ src: string; dst: string; kind: string }>;
};

type Selection =
  | { type: "claim"; id: string }
  | { type: "relation"; id: string }
  | { type: "warrant"; id: string }
  | { type: "evidence"; id: string }
  | { type: "document"; id: string }
  | null;

const initialNodes = [
  { id: "c1", position: { x: 120, y: 120 }, data: { label: "" }, type: "default" },
  { id: "c2", position: { x: 520, y: 80 }, data: { label: "" }, type: "default" },
  { id: "c3", position: { x: 520, y: 240 }, data: { label: "" }, type: "default" },
];

const initialEdges = [];

const bottomTabs = ["Console", "Diagnostics", "Suggestions"];

const seedGraph: GraphState = {
  claims: [
      {
        id: "c1",
        text: "Automation will displace workers at scale.",
        type: "fact",
        credibility: 0.52,
        evidenceIds: ["e1"],
        isAxiom: false,
        ignoreInfluence: false,
      },
      {
        id: "c2",
        text: "UBI should be adopted to support displaced workers.",
        type: "policy",
        credibility: 0.38,
        evidenceIds: ["e2"],
        isAxiom: false,
        ignoreInfluence: false,
      },
      {
        id: "c3",
        text: "UBI discourages labor participation.",
        type: "value",
        credibility: -0.12,
        evidenceIds: [],
        isAxiom: false,
        ignoreInfluence: false,
      },
    ],
  relations: [
    {
      id: "r1",
      source: "c1",
      target: "c2",
      kind: "support",
      gateId: "g1",
      weight: 0.7,
    },
    {
      id: "r2",
      source: "c3",
      target: "c2",
      kind: "attack",
      gateId: "g2",
      weight: -0.6,
    },
  ],
  warrants: [
      {
        id: "w1",
        text: "Large-scale displacement requires proactive income stabilization.",
        credibility: 0.41,
        evidenceIds: ["e3"],
        isAxiom: false,
        ignoreInfluence: false,
      },
      {
        id: "w2",
        text: "UBI creates disincentives to work for marginal earners.",
        credibility: 0.28,
        evidenceIds: [],
        isAxiom: false,
        ignoreInfluence: false,
      },
    ],
  gates: [
    { id: "g1", mode: "AND", warrantIds: ["w1"], status: "active" },
    { id: "g2", mode: "OR", warrantIds: ["w2"], status: "active" },
  ],
  evidence: [
    {
      id: "e1",
      title: "Labor impact study",
      excerpt: "A 20-year trend analysis projects net displacement in routine jobs.",
      trust: 0.9,
      docId: "d1",
    },
    {
      id: "e2",
      title: "Policy memo",
      excerpt: "UBI pilots show improved household stability during shocks.",
      trust: 0.8,
      docId: "d2",
    },
    {
      id: "e3",
      title: "Economic review",
      excerpt: "Regions with cash transfers show faster recovery after automation shocks.",
      trust: 0.75,
      docId: "d3",
    },
  ],
  supportingDocs: [
    { id: "d1", name: "Labor impact study.pdf", sourceType: "pdf", location: "local" },
    { id: "d2", name: "Policy memo", sourceType: "note", location: "local" },
    { id: "d3", name: "Economic review", sourceType: "url", location: "https://example.com" },
  ],
  logs: [
    "09:41:12 - Scores recomputed (lambda=0.62)",
    "09:41:10 - Warrant gate active on edge c3 -> c2",
    "09:41:08 - Flaw scan completed: 2 warnings",
  ],
  flaws: [
    "Circular reinforcement detected on edge c1 -> c2.",
    "Unsupported generalization warrant on edge c1 -> c2.",
  ],
  flawClaims: ["c2"],
  flawEdges: ["r1"],
  patterns: [],
  fragility: [],
  explanations: {},
  missingAssumptions: [],
};

type ScoreClassification = {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
};

const getScoreClassification = (score: number): ScoreClassification => {
  if (score >= -1.0 && score <= -0.6) {
    return {
      label: "Very Low",
      color: "#b91c1c",
      bgColor: "#fef2f2",
      borderColor: "#fecaca",
    };
  }
  if (score >= -0.59 && score <= -0.2) {
    return {
      label: "Low",
      color: "#b45309",
      bgColor: "#fff7ed",
      borderColor: "#fed7aa",
    };
  }
  if (score >= -0.19 && score <= 0.19) {
    return {
      label: "Neutral",
      color: "#6b7280",
      bgColor: "#f9fafb",
      borderColor: "#e5e7eb",
    };
  }
  if (score >= 0.2 && score <= 0.59) {
    return {
      label: "High",
      color: "#15803d",
      bgColor: "#f0fdf4",
      borderColor: "#bbf7d0",
    };
  }
  if (score >= 0.6 && score <= 1.0) {
    return {
      label: "Very High",
      color: "#166534",
      bgColor: "#ecfdf5",
      borderColor: "#86efac",
    };
  }
  return {
    label: "Unknown",
    color: "#6b7280",
    bgColor: "#f9fafb",
    borderColor: "#e5e7eb",
  };
};

const scoreToProbability = (score: number): number => {
  const value = (score + 1) / 2;
  return Math.max(0, Math.min(1, value));
};

type ClaimNodeData = {
  id: string;
  text: string;
  credibility: number;
  isAxiom: boolean;
  ignoreInfluence: boolean;
  selected: boolean;
  hasFlaw: boolean;
  isImpact: boolean;
  onSelect?: () => void;
};

function ClaimNode({ data }: NodeProps<ClaimNodeData>) {
  const score = getScoreClassification(data.credibility);

    return (
      <div
        className={`claim-node ${data.selected ? "is-selected" : ""} ${
          data.isImpact ? "is-impact" : ""
        }`}
        onMouseDown={() => data.onSelect?.()}
        onClick={() => data.onSelect?.()}
      >
        <Handle type="target" position={Position.Left} className="claim-handle" />
        <div className="claim-node-header">
          <div className="claim-meta">
            <span className="claim-id">{data.id}</span>
            {(data.isAxiom || data.ignoreInfluence) && (
              <span className="claim-badges">
                {data.isAxiom && <span className="claim-badge">A</span>}
                {data.ignoreInfluence && <span className="claim-badge">I</span>}
              </span>
            )}
          </div>
          <span
            className="claim-confidence"
            style={{
              color: score.color,
              background: score.bgColor,
              borderColor: score.borderColor,
            }}
          >
            {score.label}
          </span>
        </div>
      {data.hasFlaw && <span className="claim-flaw" title="Flaw detected" />}
      <div className="claim-text">{data.text}</div>
      <div className="claim-score">{data.credibility.toFixed(2)}</div>
      <Handle type="source" position={Position.Right} className="claim-handle" />
    </div>
  );
}

type CanvasToolbarProps = {
  miniMapEnabled: boolean;
  onToggleMiniMap: () => void;
  onAddClaim: () => void;
};

function CanvasToolbar({ miniMapEnabled, onToggleMiniMap, onAddClaim }: CanvasToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="canvas-actions">
      <button className="icon-btn" type="button" title="Zoom in" onClick={() => zoomIn()}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M11 8v6M8 11h6" />
          <path d="M20 20l-4.35-4.35" />
        </svg>
      </button>
      <button className="icon-btn" type="button" title="Zoom out" onClick={() => zoomOut()}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M8 11h6" />
          <path d="M20 20l-4.35-4.35" />
        </svg>
      </button>
      <button className="icon-btn" type="button" title="Fit to view" onClick={() => fitView()}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M7 7h4v2H9v2H7V7zm10 0h-4v2h2v2h2V7zm-6 10H7v-4h2v2h2v2zm6-4h-2v-2h-2V9h4v4z" />
        </svg>
      </button>
      <div className="toolbar-divider" />
      <button className="icon-btn" type="button" title="Add claim" onClick={onAddClaim}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button
        className={`icon-btn ${miniMapEnabled ? "is-active" : ""}`}
        type="button"
        title="Toggle minimap"
        onClick={onToggleMiniMap}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
          <rect x="13" y="13" width="7" height="7" rx="1" />
        </svg>
      </button>
    </div>
  );
}
export default function App() {
  const [graph, setGraph] = useState<GraphState>(seedGraph);
  const [selection, setSelection] = useState<Selection>({ type: "claim", id: "c2" });
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [bottomTab, setBottomTab] = useState(bottomTabs[0]);
  const [outlinerTab, setOutlinerTab] = useState<Selection["type"]>("claim");
  const [backendUrl, setBackendUrl] = useState("http://127.0.0.1:8000");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [miniMapEnabled, setMiniMapEnabled] = useState(false);
  const nodeTypes = useMemo(() => ({ claim: ClaimNode }), []);
  const claimCounter = useRef(4);
  const relationCounter = useRef(3);
  const warrantCounter = useRef(3);
  const evidenceCounter = useRef(4);
  const [newRelationTarget, setNewRelationTarget] = useState("c1");
  const [newRelationKind, setNewRelationKind] = useState<RelationKind>("support");
  const [newRelationWeight, setNewRelationWeight] = useState(0.4);
  const [newEvidenceTitle, setNewEvidenceTitle] = useState("");
  const [newEvidenceExcerpt, setNewEvidenceExcerpt] = useState("");
  const [newEvidenceTrust, setNewEvidenceTrust] = useState(0.9);
  const [newEvidenceDocId, setNewEvidenceDocId] = useState("");
  const [existingWarrantId, setExistingWarrantId] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [newDocType, setNewDocType] = useState<SupportingDocument["sourceType"]>("pdf");
  const [newDocLocation, setNewDocLocation] = useState("");

  const evidenceById = useMemo(
    () => Object.fromEntries(graph.evidence.map((item) => [item.id, item])),
    [graph.evidence]
  );
  const claimById = useMemo(
    () => Object.fromEntries(graph.claims.map((item) => [item.id, item])),
    [graph.claims]
  );
  const relationById = useMemo(
    () => Object.fromEntries(graph.relations.map((item) => [item.id, item])),
    [graph.relations]
  );
  const warrantById = useMemo(
    () => Object.fromEntries(graph.warrants.map((item) => [item.id, item])),
    [graph.warrants]
  );
  const gateById = useMemo(
    () => Object.fromEntries(graph.gates.map((item) => [item.id, item])),
    [graph.gates]
  );
  const docById = useMemo(
    () => Object.fromEntries(graph.supportingDocs.map((doc) => [doc.id, doc])),
    [graph.supportingDocs]
  );

  const selectedClaim = selection?.type === "claim" ? claimById[selection.id] : null;
  const selectedRelation = selection?.type === "relation" ? relationById[selection.id] : null;
  const selectedWarrant = selection?.type === "warrant" ? warrantById[selection.id] : null;
  const selectedEvidence = selection?.type === "evidence" ? evidenceById[selection.id] : null;
  const selectedDoc = selection?.type === "document" ? docById[selection.id] : null;
  const selectedGate = selectedRelation ? gateById[selectedRelation.gateId] : null;

  const impactClaims = useMemo(() => {
    if (!selectedRelation) {
      return [];
    }
    const adjacency = graph.relations.reduce<Record<string, string[]>>((acc, rel) => {
      acc[rel.source] = acc[rel.source] || [];
      acc[rel.source].push(rel.target);
      return acc;
    }, {});

    const visited = new Set<string>();
    const queue = [selectedRelation.target];
    while (queue.length) {
      const current = queue.shift();
      if (!current || visited.has(current)) {
        continue;
      }
      visited.add(current);
      const nextNodes = adjacency[current] || [];
      nextNodes.forEach((next) => {
        if (!visited.has(next)) {
          queue.push(next);
        }
      });
    }
    return Array.from(visited);
  }, [graph.relations, selectedRelation]);

  useEffect(() => {
    setNodes((prev) =>
      graph.claims.map((claim) => ({
        id: claim.id,
        type: "claim",
        position:
          prev.find((node) => node.id === claim.id)?.position ?? { x: 120, y: 120 },
          data: {
            id: claim.id,
            text: claim.text,
            credibility: claim.credibility,
            isAxiom: claim.isAxiom,
            ignoreInfluence: claim.ignoreInfluence,
            selected: selection?.type === "claim" && selection.id === claim.id,
            hasFlaw: graph.flawClaims.includes(claim.id),
            isImpact: selection?.type === "relation" && impactClaims.includes(claim.id),
            onSelect: () => setSelection({ type: "claim", id: claim.id }),
          },
      }))
    );

    setEdges(
      graph.relations.map((relation) => {
        const color = relation.kind === "support" ? "#15803d" : "#b91c1c";
        const gate = gateById[relation.gateId];
        const disabled = gate?.status === "disabled";
        const flawed = graph.flawEdges.includes(relation.id);
        return {
          id: relation.id,
          source: relation.source,
          target: relation.target,
          label: `${relation.kind} ${relation.weight.toFixed(2)}`,
          style: {
            stroke: color,
            strokeDasharray: disabled ? "4 3" : undefined,
            opacity: disabled ? 0.6 : 1,
          },
          labelStyle: { fill: color },
          markerEnd: { type: MarkerType.ArrowClosed },
          className: flawed ? "edge-flaw" : "",
        };
      })
    );
  }, [
    graph.claims,
    graph.relations,
    graph.flawClaims,
    graph.flawEdges,
    gateById,
    impactClaims,
    selection,
    setEdges,
    setNodes,
  ]);

  const updateClaim = (claimId: string, updates: Partial<Claim>) => {
    setGraph((prev) => ({
      ...prev,
      claims: prev.claims.map((claim) =>
        claim.id === claimId ? { ...claim, ...updates } : claim
      ),
      logs: [`${new Date().toLocaleTimeString()} - Claim updated: ${claimId}`, ...prev.logs],
    }));
  };

  const updateClaimAndRecompute = (claimId: string, updates: Partial<Claim>) => {
    setGraph((prev) => {
      const next = {
        ...prev,
        claims: prev.claims.map((claim) =>
          claim.id === claimId ? { ...claim, ...updates } : claim
        ),
        logs: [
          `${new Date().toLocaleTimeString()} - Claim updated: ${claimId}`,
          ...prev.logs,
        ],
      };
      queueMicrotask(() => {
        void recomputeScores(next);
      });
      return next;
    });
  };

  const resolvePatternEdges = (patternEdges: string[]) => {
    const resolved: string[] = [];
    patternEdges.forEach((edgeId) => {
      if (edgeId.startsWith("e")) {
        const index = Number(edgeId.slice(1));
        const relation = graph.relations[index];
        if (relation) {
          resolved.push(relation.id);
        }
      }
    });
    return resolved;
  };

  const isGraphState = (value: unknown): value is GraphState => {
    if (!value || typeof value !== "object") {
      return false;
    }
    const candidate = value as GraphState;
    return (
      Array.isArray(candidate.claims) &&
      Array.isArray(candidate.relations) &&
      Array.isArray(candidate.warrants) &&
      Array.isArray(candidate.gates)
    );
  };

  const buildExplanations = (state: GraphState) => {
    const explanations: Record<string, ClaimExplanation> = {};
    const claimIndex: Record<string, Claim> = Object.fromEntries(
      state.claims.map((claim) => [claim.id, claim])
    );
    const gateIndex: Record<string, Gate> = Object.fromEntries(
      state.gates.map((gate) => [gate.id, gate])
    );
    const warrantIndex: Record<string, Warrant> = Object.fromEntries(
      state.warrants.map((warrant) => [warrant.id, warrant])
    );
    state.claims.forEach((claim) => {
      explanations[claim.id] = {
        evidence_support: scoreToProbability(claim.credibility),
        incoming: [],
        total_influence: 0,
        final_score: scoreToProbability(claim.credibility),
      };
    });

    const warrantScore = (warrantId: string) => {
      const warrant = warrantIndex[warrantId];
      return warrant ? scoreToProbability(warrant.credibility) : 0.5;
    };

    state.relations.forEach((relation) => {
      const gate = gateIndex[relation.gateId];
      const disabled = gate?.status === "disabled";
      const gateScore = disabled
        ? 0
        : gate?.warrantIds.length
          ? gate.mode === "AND"
            ? Math.min(...gate.warrantIds.map(warrantScore))
            : Math.max(...gate.warrantIds.map(warrantScore))
          : 0;
      const srcClaim = claimIndex[relation.source];
      const srcScore = srcClaim ? scoreToProbability(srcClaim.credibility) : 0;
      const sign = relation.kind === "support" ? 1 : -1;
      const influence = sign * srcScore * gateScore;
      const entry: ExplanationEntry = {
        edge_id: relation.id,
        src: relation.source,
        dst: relation.target,
        kind: relation.kind,
        gate_score: gateScore,
        src_score: srcScore,
        influence,
        warrant_ids: gate?.warrantIds ?? [],
        gate_mode: gate?.mode ?? "OR",
      };
      const target = explanations[relation.target];
      if (target) {
        target.incoming.push(entry);
        target.total_influence += influence;
      }
    });
    return explanations;
  };

  const updateRelation = (relationId: string, updates: Partial<Relation>) => {
    setGraph((prev) => ({
      ...prev,
      relations: prev.relations.map((rel) =>
        rel.id === relationId ? { ...rel, ...updates } : rel
      ),
      logs: [
        `${new Date().toLocaleTimeString()} - Relation updated: ${relationId}`,
        ...prev.logs,
      ],
    }));
  };

  const updateWarrant = (warrantId: string, updates: Partial<Warrant>) => {
    setGraph((prev) => ({
      ...prev,
      warrants: prev.warrants.map((warrant) =>
        warrant.id === warrantId ? { ...warrant, ...updates } : warrant
      ),
      logs: [
        `${new Date().toLocaleTimeString()} - Warrant updated: ${warrantId}`,
        ...prev.logs,
      ],
    }));
  };

  const updateWarrantAndRecompute = (warrantId: string, updates: Partial<Warrant>) => {
    setGraph((prev) => {
      const next = {
        ...prev,
        warrants: prev.warrants.map((warrant) =>
          warrant.id === warrantId ? { ...warrant, ...updates } : warrant
        ),
        logs: [
          `${new Date().toLocaleTimeString()} - Warrant updated: ${warrantId}`,
          ...prev.logs,
        ],
      };
      queueMicrotask(() => {
        void recomputeScores(next);
      });
      return next;
    });
  };

  const addClaim = () => {
    const id = `c${claimCounter.current++}`;
    const claim: Claim = {
      id,
      text: "New claim",
      type: "other",
      credibility: 0,
      evidenceIds: [],
      isAxiom: false,
      ignoreInfluence: false,
    };
    setGraph((prev) => ({
      ...prev,
      claims: [...prev.claims, claim],
      logs: [`${new Date().toLocaleTimeString()} - Claim added: ${id}`, ...prev.logs],
    }));
    setSelection({ type: "claim", id });
  };

  const addRelation = (sourceId: string) => {
    if (sourceId === newRelationTarget) {
      return;
    }
    const relationId = `r${relationCounter.current++}`;
    const gateId = `g${relationId}`;
    const relation: Relation = {
      id: relationId,
      source: sourceId,
      target: newRelationTarget,
      kind: newRelationKind,
      gateId,
      weight: newRelationKind === "support" ? Math.abs(newRelationWeight) : -Math.abs(newRelationWeight),
    };
    const gate: Gate = {
      id: gateId,
      mode: "AND",
      warrantIds: [],
      status: "active",
    };
    setGraph((prev) => ({
      ...prev,
      relations: [...prev.relations, relation],
      gates: [...prev.gates, gate],
      logs: [`${new Date().toLocaleTimeString()} - Relation added: ${relationId}`, ...prev.logs],
    }));
    setSelection({ type: "relation", id: relationId });
  };

  const addRelationFromConnection = (connection: Connection) => {
    if (!connection.source || !connection.target) {
      return;
    }
    if (connection.source === connection.target) {
      return;
    }
    const relationId = `r${relationCounter.current++}`;
    const gateId = `g${relationId}`;
    const relation: Relation = {
      id: relationId,
      source: connection.source,
      target: connection.target,
      kind: "support",
      gateId,
      weight: 0.4,
    };
    const gate: Gate = {
      id: gateId,
      mode: "AND",
      warrantIds: [],
      status: "active",
    };
    setGraph((prev) => ({
      ...prev,
      relations: [...prev.relations, relation],
      gates: [...prev.gates, gate],
      logs: [`${new Date().toLocaleTimeString()} - Relation added: ${relationId}`, ...prev.logs],
    }));
    setSelection({ type: "relation", id: relationId });
  };

  const deleteClaim = (claimId: string) => {
    setGraph((prev) => {
      const remainingRelations = prev.relations.filter(
        (rel) => rel.source !== claimId && rel.target !== claimId
      );
      const remainingGateIds = new Set(remainingRelations.map((rel) => rel.gateId));
      return {
        ...prev,
        claims: prev.claims.filter((claim) => claim.id !== claimId),
        relations: remainingRelations,
        gates: prev.gates.filter((gate) => remainingGateIds.has(gate.id)),
        logs: [`${new Date().toLocaleTimeString()} - Claim removed: ${claimId}`, ...prev.logs],
      };
    });
    setSelection(null);
  };

  const deleteRelation = (relationId: string) => {
    setGraph((prev) => {
      const relation = prev.relations.find((item) => item.id === relationId);
      const remainingRelations = prev.relations.filter((item) => item.id !== relationId);
      return {
        ...prev,
        relations: remainingRelations,
        gates: relation ? prev.gates.filter((gate) => gate.id !== relation.gateId) : prev.gates,
        logs: [`${new Date().toLocaleTimeString()} - Relation removed: ${relationId}`, ...prev.logs],
      };
    });
    setSelection(null);
  };

  const deleteWarrant = (warrantId: string) => {
    setGraph((prev) => ({
      ...prev,
      warrants: prev.warrants.filter((warrant) => warrant.id !== warrantId),
      gates: prev.gates.map((gate) => ({
        ...gate,
        warrantIds: gate.warrantIds.filter((wid) => wid !== warrantId),
      })),
      logs: [`${new Date().toLocaleTimeString()} - Warrant removed: ${warrantId}`, ...prev.logs],
    }));
    setSelection(null);
  };

  const attachEvidence = (entityType: "claim" | "warrant", entityId: string) => {
    if (!newEvidenceTitle.trim() || !newEvidenceExcerpt.trim()) {
      return;
    }
    const evidenceId = `e${evidenceCounter.current++}`;
    const evidence: Evidence = {
      id: evidenceId,
      title: newEvidenceTitle.trim(),
      excerpt: newEvidenceExcerpt.trim(),
      trust: newEvidenceTrust,
      docId: newEvidenceDocId || graph.supportingDocs[0]?.id,
    };
    setGraph((prev) => ({
      ...prev,
      evidence: [...prev.evidence, evidence],
      claims:
        entityType === "claim"
          ? prev.claims.map((claim) =>
              claim.id === entityId
                ? { ...claim, evidenceIds: [...claim.evidenceIds, evidenceId] }
                : claim
            )
          : prev.claims,
      warrants:
        entityType === "warrant"
          ? prev.warrants.map((warrant) =>
              warrant.id === entityId
                ? { ...warrant, evidenceIds: [...warrant.evidenceIds, evidenceId] }
                : warrant
            )
          : prev.warrants,
      logs: [`${new Date().toLocaleTimeString()} - Evidence added: ${evidenceId}`, ...prev.logs],
    }));
    setNewEvidenceTitle("");
    setNewEvidenceExcerpt("");
    setNewEvidenceTrust(0.9);
    setNewEvidenceDocId("");
  };

  const detachEvidence = (entityType: "claim" | "warrant", entityId: string, evidenceId: string) => {
    setGraph((prev) => ({
      ...prev,
      claims:
        entityType === "claim"
          ? prev.claims.map((claim) =>
              claim.id === entityId
                ? { ...claim, evidenceIds: claim.evidenceIds.filter((eid) => eid !== evidenceId) }
                : claim
            )
          : prev.claims,
      warrants:
        entityType === "warrant"
          ? prev.warrants.map((warrant) =>
              warrant.id === entityId
                ? {
                    ...warrant,
                    evidenceIds: warrant.evidenceIds.filter((eid) => eid !== evidenceId),
                  }
                : warrant
            )
          : prev.warrants,
      logs: [`${new Date().toLocaleTimeString()} - Evidence removed: ${evidenceId}`, ...prev.logs],
    }));
  };

  const addWarrantToGate = (gateId: string) => {
    const id = `w${warrantCounter.current++}`;
    const warrant: Warrant = {
      id,
      text: "New warrant",
      credibility: 0,
      evidenceIds: [],
      isAxiom: false,
      ignoreInfluence: false,
    };
    setGraph((prev) => ({
      ...prev,
      warrants: [...prev.warrants, warrant],
      gates: prev.gates.map((gate) =>
        gate.id === gateId ? { ...gate, warrantIds: [...gate.warrantIds, id] } : gate
      ),
      logs: [`${new Date().toLocaleTimeString()} - Warrant added: ${id}`, ...prev.logs],
    }));
    setSelection({ type: "warrant", id });
  };

  const attachExistingWarrant = (gateId: string) => {
    if (!existingWarrantId) {
      return;
    }
    setGraph((prev) => ({
      ...prev,
      gates: prev.gates.map((gate) =>
        gate.id === gateId && !gate.warrantIds.includes(existingWarrantId)
          ? { ...gate, warrantIds: [...gate.warrantIds, existingWarrantId] }
          : gate
      ),
      logs: [
        `${new Date().toLocaleTimeString()} - Warrant linked: ${existingWarrantId}`,
        ...prev.logs,
      ],
    }));
    setExistingWarrantId("");
  };

  const toggleGateStatus = (gateId: string) => {
    setGraph((prev) => ({
      ...prev,
      gates: prev.gates.map((gate) =>
        gate.id === gateId
          ? { ...gate, status: gate.status === "active" ? "disabled" : "active" }
          : gate
      ),
      logs: [`${new Date().toLocaleTimeString()} - Gate toggled: ${gateId}`, ...prev.logs],
    }));
  };

  const addDocument = () => {
    if (!newDocName.trim()) {
      return;
    }
    const id = `d${graph.supportingDocs.length + 1}`;
    const doc: SupportingDocument = {
      id,
      name: newDocName.trim(),
      sourceType: newDocType,
      location: newDocLocation.trim() || "local",
    };
    setGraph((prev) => ({
      ...prev,
      supportingDocs: [...prev.supportingDocs, doc],
      logs: [`${new Date().toLocaleTimeString()} - Document added: ${id}`, ...prev.logs],
    }));
    setNewDocName("");
    setNewDocLocation("");
  };

  const deleteDocument = (docId: string) => {
    setGraph((prev) => ({
      ...prev,
      supportingDocs: prev.supportingDocs.filter((doc) => doc.id !== docId),
      evidence: prev.evidence.map((ev) =>
        ev.docId === docId ? { ...ev, docId: undefined } : ev
      ),
      logs: [`${new Date().toLocaleTimeString()} - Document removed: ${docId}`, ...prev.logs],
    }));
    setSelection(null);
  };

  const runDiagnostics = async () => {
    try {
      const response = await fetch(`${backendUrl}/diagnostics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graph),
      });
      if (!response.ok) {
        throw new Error(`Diagnostics failed: ${response.status}`);
      }
      const payload = (await response.json()) as {
        flaws?: string[];
        flawClaims?: string[];
        flawEdges?: string[];
        result?: { flaws?: string[]; flawClaims?: string[]; flawEdges?: string[] };
        graph?: { flaws?: string[]; flawClaims?: string[]; flawEdges?: string[] };
      };
      const resolved = payload.result ?? payload.graph ?? payload;
      setGraph((prev) => ({
        ...prev,
        flaws: resolved.flaws ?? prev.flaws,
        flawClaims: resolved.flawClaims ?? prev.flawClaims,
        flawEdges: resolved.flawEdges ?? prev.flawEdges,
        logs: [`${new Date().toLocaleTimeString()} - Diagnostics complete`, ...prev.logs],
      }));
    } catch (error) {
      setGraph((prev) => ({
        ...prev,
        logs: [
          `${new Date().toLocaleTimeString()} - Diagnostics error: ${
            error instanceof Error ? error.message : "unknown"
          }`,
          ...prev.logs,
        ],
      }));
    }
  };

  const runCritique = async () => {
    try {
      const response = await fetch(`${backendUrl}/critique`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graph),
      });
      if (!response.ok) {
        throw new Error(`Critique failed: ${response.status}`);
      }
      const payload = (await response.json()) as {
        patterns?: PatternMatch[];
        warrant_fragility?: WarrantFragility[];
        missing_assumptions?: Array<{ src: string; dst: string; kind: string }>;
      };
      const patterns = payload.patterns ?? [];
      const fragility = payload.warrant_fragility ?? [];
      const missingAssumptions = payload.missing_assumptions ?? [];
      const flawEdges = Array.from(
        new Set(patterns.flatMap((pattern) => resolvePatternEdges(pattern.edges)))
      );
      const flawClaims = Array.from(
        new Set(
          patterns
            .flatMap((pattern) => pattern.nodes)
            .filter((id) => !!claimById[id])
        )
      );
      setGraph((prev) => ({
        ...prev,
        patterns,
        fragility,
        missingAssumptions,
        flaws: patterns.map((pattern) => `${pattern.name}: ${pattern.message}`),
        flawClaims,
        flawEdges,
        logs: [`${new Date().toLocaleTimeString()} - Critique complete`, ...prev.logs],
      }));
      setBottomTab("Diagnostics");
    } catch (error) {
      setGraph((prev) => ({
        ...prev,
        logs: [
          `${new Date().toLocaleTimeString()} - Critique error: ${
            error instanceof Error ? error.message : "unknown"
          }`,
          ...prev.logs,
        ],
      }));
    }
  };

  const recomputeScores = async (override?: GraphState | unknown) => {
    const payloadGraph = isGraphState(override) ? override : graph;
    try {
      const response = await fetch(`${backendUrl}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadGraph),
      });
      if (!response.ok) {
        throw new Error(`Scoring failed: ${response.status}`);
      }
      const payload = (await response.json()) as { claims?: Claim[]; warrants?: Warrant[] };
      setGraph((prev) => {
        const next = {
          ...prev,
          claims: payload.claims ?? prev.claims,
          warrants: payload.warrants ?? prev.warrants,
          logs: [`${new Date().toLocaleTimeString()} - Scores recomputed`, ...prev.logs],
        };
        return { ...next, explanations: buildExplanations(next) };
      });
    } catch (error) {
      setGraph((prev) => ({
        ...prev,
        logs: [
          `${new Date().toLocaleTimeString()} - Score error: ${
            error instanceof Error ? error.message : "unknown"
          }`,
          ...prev.logs,
        ],
      }));
    }
  };

  const handleExport = () => {
    const payload = JSON.stringify(graph, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "warrants-graph.json";
    link.click();
    URL.revokeObjectURL(url);
    setGraph((prev) => ({
      ...prev,
      logs: [`${new Date().toLocaleTimeString()} - Graph exported`, ...prev.logs],
    }));
  };

  const handleImport = async (file: File | null) => {
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as GraphState;
      if (!parsed.claims || !parsed.relations) {
        throw new Error("Invalid WGAG payload.");
      }
      const normalizedClaims = (parsed.claims ?? []).map((claim) => ({
        ...claim,
        isAxiom: claim.isAxiom ?? false,
        ignoreInfluence: claim.ignoreInfluence ?? false,
      }));
      const normalizedWarrants = (parsed.warrants ?? []).map((warrant) => ({
        ...warrant,
        isAxiom: warrant.isAxiom ?? false,
        ignoreInfluence: warrant.ignoreInfluence ?? false,
      }));
      setGraph({
        ...seedGraph,
        ...parsed,
        claims: normalizedClaims,
        warrants: normalizedWarrants,
        patterns: parsed.patterns ?? [],
        fragility: parsed.fragility ?? [],
        explanations: parsed.explanations ?? {},
        missingAssumptions: parsed.missingAssumptions ?? [],
      });
      setSelection(parsed.claims[0] ? { type: "claim", id: parsed.claims[0].id } : null);
    } catch (error) {
      setGraph((prev) => ({
        ...prev,
        logs: [
          `${new Date().toLocaleTimeString()} - Import error: ${
            error instanceof Error ? error.message : "unknown"
          }`,
          ...prev.logs,
        ],
      }));
    }
  };
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-title">Warrants</div>
          <div className="brand-subtitle">Warrant-gated argument graph workspace</div>
        </div>
        <div className="status">
          <span className="status-dot" />
          Server: ok
        </div>
        <div className="model-controls">
          <label className="field">
            <span>Backend</span>
            <input value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} />
          </label>
          <label className="field">
            <span>Provider</span>
            <select defaultValue="OpenAI">
              <option>OpenAI</option>
              <option>Ollama</option>
              <option>Anthropic</option>
            </select>
          </label>
          <label className="field">
            <span>Model</span>
            <input defaultValue="gpt-5-mini" />
          </label>
          <div className="button-row">
            <button className="btn" type="button" onClick={addClaim}>
              New Claim
            </button>
            <button className="btn" type="button" onClick={runDiagnostics}>
              Run Diagnostics
            </button>
            <button className="btn" type="button" onClick={runCritique}>
              Run Critique
            </button>
              <button className="btn" type="button" onClick={() => recomputeScores()}>
                Recompute Scores
              </button>
            <button className="btn" type="button" onClick={() => fileInputRef.current?.click()}>
              Import
            </button>
            <button className="btn" type="button" onClick={handleExport}>
              Export
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="file-input"
            onChange={(event) => handleImport(event.target.files?.[0] ?? null)}
          />
        </div>
      </header>

      <div className="workspace">
        <aside className="panel outliner">
          <div className="panel-header">Outliner</div>
          <div className="panel-body">
            <div className="tab-row">
              <button
                className={`tab ${outlinerTab === "claim" ? "active" : ""}`}
                onClick={() => setOutlinerTab("claim")}
              >
                Claims
              </button>
              <button
                className={`tab ${outlinerTab === "relation" ? "active" : ""}`}
                onClick={() => setOutlinerTab("relation")}
              >
                Relations
              </button>
              <button
                className={`tab ${outlinerTab === "warrant" ? "active" : ""}`}
                onClick={() => setOutlinerTab("warrant")}
              >
                Warrants
              </button>
              <button
                className={`tab ${outlinerTab === "evidence" ? "active" : ""}`}
                onClick={() => setOutlinerTab("evidence")}
              >
                Evidence
              </button>
              <button
                className={`tab ${outlinerTab === "document" ? "active" : ""}`}
                onClick={() => setOutlinerTab("document")}
              >
                Docs
              </button>
            </div>
            {outlinerTab === "claim" && (
              <div className="list">
                {graph.claims.map((claim) => (
                  <button
                    key={claim.id}
                    className="list-item outliner-item"
                    onClick={() => setSelection({ type: "claim", id: claim.id })}
                  >
                    <strong>{claim.id}</strong> {claim.text}
                  </button>
                ))}
              </div>
            )}
            {outlinerTab === "relation" && (
              <div className="list">
                {graph.relations.map((rel) => (
                  <button
                    key={rel.id}
                    className="list-item outliner-item"
                    onClick={() => setSelection({ type: "relation", id: rel.id })}
                  >
                    <strong>{rel.id}</strong> {rel.source} {"->"} {rel.target} ({rel.kind})
                  </button>
                ))}
              </div>
            )}
            {outlinerTab === "warrant" && (
              <div className="list">
                {graph.warrants.map((warrant) => (
                  <button
                    key={warrant.id}
                    className="list-item outliner-item"
                    onClick={() => setSelection({ type: "warrant", id: warrant.id })}
                  >
                    <strong>{warrant.id}</strong> {warrant.text}
                  </button>
                ))}
              </div>
            )}
            {outlinerTab === "evidence" && (
              <div className="list">
                {graph.evidence.map((evidence) => (
                  <button
                    key={evidence.id}
                    className="list-item outliner-item"
                    onClick={() => setSelection({ type: "evidence", id: evidence.id })}
                  >
                    <strong>{evidence.id}</strong> {evidence.title}
                  </button>
                ))}
              </div>
            )}
            {outlinerTab === "document" && (
              <>
                <div className="list">
                  {graph.supportingDocs.map((doc) => (
                    <button
                      key={doc.id}
                      className="list-item outliner-item"
                      onClick={() => setSelection({ type: "document", id: doc.id })}
                    >
                      <strong>{doc.id}</strong> {doc.name}
                    </button>
                  ))}
                </div>
                <details className="fold">
                  <summary>Add document</summary>
                  <div className="inline-row">
                    <input
                      value={newDocName}
                      onChange={(event) => setNewDocName(event.target.value)}
                      placeholder="Document name"
                    />
                    <select
                      value={newDocType}
                      onChange={(event) =>
                        setNewDocType(event.target.value as SupportingDocument["sourceType"])
                      }
                    >
                      <option value="pdf">pdf</option>
                      <option value="url">url</option>
                      <option value="note">note</option>
                    </select>
                  </div>
                  <input
                    value={newDocLocation}
                    onChange={(event) => setNewDocLocation(event.target.value)}
                    placeholder="Location or URL"
                  />
                  <button className="btn" type="button" onClick={addDocument}>
                    Add Document
                  </button>
                </details>
              </>
            )}
          </div>
        </aside>

        <ReactFlowProvider>
          <main className="panel canvas-panel">
            <div className="panel-header canvas-header">
              <div className="canvas-title">Viewport</div>
              <CanvasToolbar
                miniMapEnabled={miniMapEnabled}
                onToggleMiniMap={() => setMiniMapEnabled((value) => !value)}
                onAddClaim={addClaim}
              />
            </div>
            <div className="panel-body canvas-body">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                nodeTypes={nodeTypes}
                onNodeClick={(_, node) => setSelection({ type: "claim", id: node.id })}
                onEdgeClick={(_, edge) => setSelection({ type: "relation", id: edge.id })}
                onPaneClick={() => setSelection(null)}
                onConnect={addRelationFromConnection}
                onNodesDelete={(items) => items.forEach((item) => deleteClaim(item.id))}
                onEdgesDelete={(items) => items.forEach((item) => deleteRelation(item.id))}
                deleteKeyCode={["Backspace", "Delete"]}
              >
                <Background gap={18} color="#e2e8f0" />
                <Controls />
                {miniMapEnabled && <MiniMap nodeColor="#111827" />}
              </ReactFlow>
            </div>
          </main>
        </ReactFlowProvider>

        <aside className="panel inspector">
          <div className="panel-header">Properties</div>
          <div className="panel-body inspector-body">
            {!selection && <div className="muted">Select an object to view details.</div>}
            {selectedClaim && (
              <div className="section">
                <div className="section-title">Claim</div>
                <label className="field">
                  <span>Text</span>
                  <textarea
                    value={selectedClaim.text}
                    onChange={(event) => updateClaim(selectedClaim.id, { text: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Type</span>
                  <select
                    value={selectedClaim.type}
                    onChange={(event) =>
                      updateClaim(selectedClaim.id, { type: event.target.value as ClaimType })
                    }
                  >
                    <option value="fact">fact</option>
                    <option value="value">value</option>
                    <option value="policy">policy</option>
                    <option value="other">other</option>
                  </select>
                </label>
                <label className="field">
                  <span>Score</span>
                  <input
                    className="score-input"
                    type="number"
                    step="0.01"
                    min="-1"
                    max="1"
                    value={selectedClaim.credibility}
                    onChange={(event) =>
                      updateClaim(selectedClaim.id, {
                        credibility: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field checkbox">
                  <span>Axiom</span>
                  <input
                    type="checkbox"
                    checked={selectedClaim.isAxiom}
                    onChange={(event) =>
                      updateClaimAndRecompute(selectedClaim.id, {
                        isAxiom: event.target.checked,
                      })
                    }
                  />
                </label>
                <label className="field checkbox">
                  <span>Ignore influence</span>
                  <input
                    type="checkbox"
                    checked={selectedClaim.ignoreInfluence}
                    onChange={(event) =>
                      updateClaimAndRecompute(selectedClaim.id, {
                        ignoreInfluence: event.target.checked,
                      })
                    }
                  />
                </label>
                {graph.explanations[selectedClaim.id] && (
                  <div className="score-row">
                    <div className="score-label">Influence</div>
                    <div className="score-value">
                      {graph.explanations[selectedClaim.id].total_influence.toFixed(2)}
                    </div>
                  </div>
                )}
                <details className="fold">
                  <summary>Evidence</summary>
                  <div className="list">
                    {selectedClaim.evidenceIds.length === 0 && (
                      <div className="list-item muted">No evidence attached.</div>
                    )}
                    {selectedClaim.evidenceIds.map((eid) => {
                      const evidence = evidenceById[eid];
                      if (!evidence) {
                        return null;
                      }
                      return (
                        <div key={eid} className="list-item">
                          <strong>{evidence.title}</strong>
                          <div className="muted">{evidence.excerpt}</div>
                          {evidence.docId && (
                            <div className="muted">
                              Source: {docById[evidence.docId]?.name ?? evidence.docId}
                            </div>
                          )}
                          <button
                            className="btn subtle danger"
                            type="button"
                            onClick={() => detachEvidence("claim", selectedClaim.id, eid)}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="inline-row">
                    <input
                      value={newEvidenceTitle}
                      onChange={(event) => setNewEvidenceTitle(event.target.value)}
                      placeholder="Title"
                    />
                    <input
                      value={newEvidenceTrust}
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      onChange={(event) => setNewEvidenceTrust(Number(event.target.value))}
                    />
                  </div>
                  <textarea
                    value={newEvidenceExcerpt}
                    onChange={(event) => setNewEvidenceExcerpt(event.target.value)}
                    placeholder="Excerpt"
                  />
                  <select
                    value={newEvidenceDocId}
                    onChange={(event) => setNewEvidenceDocId(event.target.value)}
                  >
                    <option value="">Select doc</option>
                    {graph.supportingDocs.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => attachEvidence("claim", selectedClaim.id)}
                  >
                    Add Evidence
                  </button>
                </details>
                <details className="fold">
                  <summary>Relations</summary>
                  <div className="list">
                    {graph.relations
                      .filter((rel) => rel.source === selectedClaim.id || rel.target === selectedClaim.id)
                      .map((rel) => (
                        <div key={rel.id} className="list-item">
                          {rel.source} {"->"} {rel.target} ({rel.kind})
                        </div>
                      ))}
                  </div>
                  <div className="inline-row">
                    <select
                      value={newRelationTarget}
                      onChange={(event) => setNewRelationTarget(event.target.value)}
                    >
                      {graph.claims
                        .filter((claim) => claim.id !== selectedClaim.id)
                        .map((claim) => (
                          <option key={claim.id} value={claim.id}>
                            {claim.id}
                          </option>
                        ))}
                    </select>
                    <select
                      value={newRelationKind}
                      onChange={(event) => setNewRelationKind(event.target.value as RelationKind)}
                    >
                      <option value="support">support</option>
                      <option value="attack">attack</option>
                    </select>
                    <input
                      type="number"
                      min="-1"
                      max="1"
                      step="0.05"
                      value={newRelationWeight}
                      onChange={(event) => setNewRelationWeight(Number(event.target.value))}
                    />
                  </div>
                  <button className="btn" type="button" onClick={() => addRelation(selectedClaim.id)}>
                    Create Relation
                  </button>
                </details>
                <button className="btn subtle danger" type="button" onClick={() => deleteClaim(selectedClaim.id)}>
                  Delete Claim
                </button>
              </div>
            )}
            {selectedRelation && (
              <div className="section">
                <div className="section-title">Relation</div>
                <label className="field">
                  <span>Kind</span>
                  <select
                    value={selectedRelation.kind}
                    onChange={(event) =>
                      updateRelation(selectedRelation.id, {
                        kind: event.target.value as RelationKind,
                      })
                    }
                  >
                    <option value="support">support</option>
                    <option value="attack">attack</option>
                  </select>
                </label>
                <label className="field">
                  <span>Weight</span>
                  <input
                    type="number"
                    step="0.01"
                    min="-1"
                    max="1"
                    value={selectedRelation.weight}
                    onChange={(event) =>
                      updateRelation(selectedRelation.id, {
                        weight: Number(event.target.value),
                      })
                    }
                  />
                </label>
                {selectedGate && (
                  <div className="score-row">
                    <div className="score-label">Gate score</div>
                    <div className="score-value">
                      {(() => {
                        const values = selectedGate.warrantIds.map((wid) =>
                          scoreToProbability(warrantById[wid]?.credibility ?? 0)
                        );
                        if (!values.length) {
                          return "0.00";
                        }
                        const gateScore =
                          selectedGate.mode === "AND"
                            ? Math.min(...values)
                            : Math.max(...values);
                        return gateScore.toFixed(2);
                      })()}
                    </div>
                  </div>
                )}
                <label className="field">
                  <span>Gate mode</span>
                  <select
                    value={selectedGate?.mode ?? "AND"}
                    onChange={(event) => {
                      if (!selectedGate) {
                        return;
                      }
                      const mode = event.target.value as GateMode;
                      setGraph((prev) => ({
                        ...prev,
                        gates: prev.gates.map((gate) =>
                          gate.id === selectedGate.id ? { ...gate, mode } : gate
                        ),
                        logs: [
                          `${new Date().toLocaleTimeString()} - Gate updated: ${selectedGate.id}`,
                          ...prev.logs,
                        ],
                      }));
                    }}
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                </label>
                {selectedGate && (
                  <button className="btn" type="button" onClick={() => toggleGateStatus(selectedGate.id)}>
                    {selectedGate.status === "active" ? "Disable Gate" : "Enable Gate"}
                  </button>
                )}
                <details className="fold">
                  <summary>Warrants</summary>
                  <div className="pill-row">
                    {selectedGate?.warrantIds.map((wid) => {
                      const warrant = warrantById[wid];
                      if (!warrant) {
                        return null;
                      }
                      return (
                        <button
                          key={wid}
                          className="pill"
                          type="button"
                          onClick={() => setSelection({ type: "warrant", id: wid })}
                        >
                          {warrant.id}
                        </button>
                      );
                    })}
                  </div>
                  <div className="inline-row">
                    <select
                      value={existingWarrantId}
                      onChange={(event) => setExistingWarrantId(event.target.value)}
                    >
                      <option value="">Select warrant</option>
                      {graph.warrants.map((warrant) => (
                        <option key={warrant.id} value={warrant.id}>
                          {warrant.id}
                        </option>
                      ))}
                    </select>
                    <button className="btn" type="button" onClick={() => attachExistingWarrant(selectedGate.id)}>
                      Link
                    </button>
                  </div>
                  <button className="btn" type="button" onClick={() => addWarrantToGate(selectedGate.id)}>
                    New Warrant
                  </button>
                </details>
                <button
                  className="btn subtle danger"
                  type="button"
                  onClick={() => deleteRelation(selectedRelation.id)}
                >
                  Delete Relation
                </button>
              </div>
            )}
            {selectedWarrant && (
              <div className="section">
                <div className="section-title">Warrant</div>
                <label className="field">
                  <span>Text</span>
                  <textarea
                    value={selectedWarrant.text}
                    onChange={(event) =>
                      updateWarrant(selectedWarrant.id, { text: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Score</span>
                  <input
                    className="score-input"
                    type="number"
                    step="0.01"
                    min="-1"
                    max="1"
                    value={selectedWarrant.credibility}
                    onChange={(event) =>
                      updateWarrant(selectedWarrant.id, {
                        credibility: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field checkbox">
                  <span>Axiom</span>
                    <input
                      type="checkbox"
                      checked={selectedWarrant.isAxiom}
                      onChange={(event) =>
                        updateWarrantAndRecompute(selectedWarrant.id, {
                          isAxiom: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label className="field checkbox">
                    <span>Ignore influence</span>
                    <input
                      type="checkbox"
                      checked={selectedWarrant.ignoreInfluence}
                      onChange={(event) =>
                        updateWarrantAndRecompute(selectedWarrant.id, {
                          ignoreInfluence: event.target.checked,
                        })
                      }
                    />
                  </label>
                <details className="fold">
                  <summary>Evidence</summary>
                  <div className="list">
                    {selectedWarrant.evidenceIds.length === 0 && (
                      <div className="list-item muted">No evidence attached.</div>
                    )}
                    {selectedWarrant.evidenceIds.map((eid) => {
                      const evidence = evidenceById[eid];
                      if (!evidence) {
                        return null;
                      }
                      return (
                        <div key={eid} className="list-item">
                          <strong>{evidence.title}</strong>
                          <div className="muted">{evidence.excerpt}</div>
                          {evidence.docId && (
                            <div className="muted">
                              Source: {docById[evidence.docId]?.name ?? evidence.docId}
                            </div>
                          )}
                          <button
                            className="btn subtle danger"
                            type="button"
                            onClick={() => detachEvidence("warrant", selectedWarrant.id, eid)}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="inline-row">
                    <input
                      value={newEvidenceTitle}
                      onChange={(event) => setNewEvidenceTitle(event.target.value)}
                      placeholder="Title"
                    />
                    <input
                      value={newEvidenceTrust}
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      onChange={(event) => setNewEvidenceTrust(Number(event.target.value))}
                    />
                  </div>
                  <textarea
                    value={newEvidenceExcerpt}
                    onChange={(event) => setNewEvidenceExcerpt(event.target.value)}
                    placeholder="Excerpt"
                  />
                  <select
                    value={newEvidenceDocId}
                    onChange={(event) => setNewEvidenceDocId(event.target.value)}
                  >
                    <option value="">Select doc</option>
                    {graph.supportingDocs.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => attachEvidence("warrant", selectedWarrant.id)}
                  >
                    Add Evidence
                  </button>
                </details>
                <button
                  className="btn subtle danger"
                  type="button"
                  onClick={() => deleteWarrant(selectedWarrant.id)}
                >
                  Delete Warrant
                </button>
              </div>
            )}
            {selectedEvidence && (
              <div className="section">
                <div className="section-title">Evidence</div>
                <div className="list">
                  <div className="list-item">
                    <strong>{selectedEvidence.title}</strong>
                    <div className="muted">{selectedEvidence.excerpt}</div>
                    <div className="muted">Trust: {selectedEvidence.trust.toFixed(2)}</div>
                    {selectedEvidence.docId && (
                      <div className="muted">
                        Source: {docById[selectedEvidence.docId]?.name ?? selectedEvidence.docId}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {selectedDoc && (
              <div className="section">
                <div className="section-title">Document</div>
                <label className="field">
                  <span>Name</span>
                  <input value={selectedDoc.name} readOnly />
                </label>
                <label className="field">
                  <span>Type</span>
                  <input value={selectedDoc.sourceType} readOnly />
                </label>
                <label className="field">
                  <span>Location</span>
                  <input value={selectedDoc.location} readOnly />
                </label>
                <button className="btn subtle danger" type="button" onClick={() => deleteDocument(selectedDoc.id)}>
                  Delete Document
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      <section className="panel bottom-panel">
        <div className="panel-header bottom-header">
          <div className="tab-row">
            {bottomTabs.map((tab) => (
              <button
                key={tab}
                className={`tab ${tab === bottomTab ? "active" : ""}`}
                onClick={() => setBottomTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-body bottom-body">
          {bottomTab === "Console" && (
            <div className="console">
              {graph.logs.map((line, index) => (
                <div key={`${index}-${line}`}>{line}</div>
              ))}
            </div>
          )}
          {bottomTab === "Diagnostics" && (
            <div className="list">
              {graph.patterns.length > 0 && (
                <div className="list-item">
                  <strong>Patterns</strong>
                </div>
              )}
              {graph.flaws.map((flaw) => (
                <div key={flaw} className="list-item">
                  {flaw}
                </div>
              ))}
              {graph.fragility.length > 0 && (
                <div className="list-item">
                  <strong>Fragile gates</strong>
                </div>
              )}
              {graph.fragility.map((item) => (
                <div key={item.edge_id} className="list-item">
                  {item.edge_id} {item.gate_mode} gate on {item.dst} (score{" "}
                  {item.gate_score.toFixed(2)}), critical warrants:{" "}
                  {item.critical_warrants.join(", ")}
                </div>
              ))}
              {graph.missingAssumptions.length > 0 && (
                <div className="list-item">
                  <strong>Missing assumptions</strong>
                </div>
              )}
                {graph.missingAssumptions.map((item, index) => (
                  <div key={`${item.src}-${item.dst}-${index}`} className="list-item">
                    {item.src} {"->"} {item.dst} ({item.kind})
                  </div>
                ))}
              {graph.flaws.length === 0 && <div className="list-item muted">No diagnostics yet.</div>}
            </div>
          )}
          {bottomTab === "Suggestions" && (
            <div className="list">
              <div className="list-item">Add evidence to warrants on weak edges.</div>
              <div className="list-item">Review low-confidence claims for missing support.</div>
                {graph.missingAssumptions.map((item, index) => (
                  <div key={`${item.src}-${item.dst}-suggest-${index}`} className="list-item">
                    Add warrants for {item.src} {"->"} {item.dst}.
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
