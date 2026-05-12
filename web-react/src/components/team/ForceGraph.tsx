import { useEffect, useMemo, useRef, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import type { TeamGraphResponse, TeamNode } from '@/types/api'

interface SimNode extends SimulationNodeDatum {
  id: string
  label: string
  role: string
  running: boolean
  avatar: string
}

interface SimLink extends SimulationLinkDatum<SimNode> {}

interface Props {
  graph: TeamGraphResponse
  width: number
  height: number
  onSelect: (name: string) => void
}

const NODE_RADIUS = 28

export function ForceGraph({ graph, width, height, onSelect }: Props) {
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null)
  const [, force] = useState(0) // re-render trigger on every tick
  const draggingRef = useRef<{ id: string; pointerId: number } | null>(null)

  const mainAgentId = graph.mainAgentId || graph.nodes.find((n) => n.role === 'main')?.id

  // Build (and rebuild) the simulation when the graph payload changes.
  // We mutate the same node objects across ticks so we don't reset their
  // positions every render.
  const simNodes = useMemo<SimNode[]>(
    () =>
      graph.nodes.map((n: TeamNode) => ({
        id: n.id,
        label: n.label || n.id,
        role: n.role,
        running: n.running,
        avatar:
          n.id === mainAgentId
            ? '/api/marveen/avatar'
            : `/api/agents/${encodeURIComponent(n.id)}/avatar`,
      })),
    [graph, mainAgentId],
  )

  const simLinks = useMemo<SimLink[]>(
    () => graph.edges.map((e) => ({ source: e.from, target: e.to })),
    [graph],
  )

  useEffect(() => {
    const sim = forceSimulation<SimNode, SimLink>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(120)
          .strength(0.7),
      )
      .force('charge', forceManyBody<SimNode>().strength(-360))
      .force('center', forceCenter(width / 2, height / 2).strength(0.05))
      .force(
        'collide',
        forceCollide<SimNode>(NODE_RADIUS + 10).strength(0.9),
      )
      .alpha(1)
      .on('tick', () => force((v) => v + 1))

    simRef.current = sim
    return () => {
      sim.stop()
      simRef.current = null
    }
  }, [simNodes, simLinks, width, height])

  const handlePointerDown = (
    e: React.PointerEvent<SVGGElement>,
    node: SimNode,
  ) => {
    e.stopPropagation()
    draggingRef.current = { id: node.id, pointerId: e.pointerId }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    if (simRef.current) {
      simRef.current.alphaTarget(0.3).restart()
      node.fx = node.x
      node.fy = node.y
    }
  }
  const handlePointerMove = (
    e: React.PointerEvent<SVGSVGElement>,
  ) => {
    const drag = draggingRef.current
    if (!drag) return
    const node = simNodes.find((n) => n.id === drag.id)
    if (!node) return
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    node.fx = e.clientX - rect.left
    node.fy = e.clientY - rect.top
  }
  const handlePointerUp = (
    e: React.PointerEvent<SVGGElement>,
    node: SimNode,
  ) => {
    if (!draggingRef.current) return
    ;(e.currentTarget as Element).releasePointerCapture(draggingRef.current.pointerId)
    draggingRef.current = null
    if (simRef.current) simRef.current.alphaTarget(0)
    node.fx = null
    node.fy = null
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onPointerMove={handlePointerMove}
      className="block touch-none select-none"
    >
      <defs>
        {simNodes.map((n) => (
          <clipPath key={n.id} id={`avatar-${cssId(n.id)}`}>
            <circle r={NODE_RADIUS - 2} cx={0} cy={0} />
          </clipPath>
        ))}
      </defs>

      {/* Edges */}
      <g stroke="var(--color-border)" strokeWidth={1.5} opacity={0.7}>
        {simLinks.map((link, i) => {
          const s = link.source as SimNode
          const t = link.target as SimNode
          if (typeof s !== 'object' || typeof t !== 'object') return null
          return (
            <line
              key={i}
              x1={s.x ?? 0}
              y1={s.y ?? 0}
              x2={t.x ?? 0}
              y2={t.y ?? 0}
            />
          )
        })}
      </g>

      {/* Nodes */}
      <g>
        {simNodes.map((n) => {
          const isMain = n.id === mainAgentId
          const x = n.x ?? width / 2
          const y = n.y ?? height / 2
          const ringColor = isMain
            ? 'var(--color-accent)'
            : n.running
              ? 'var(--color-success)'
              : 'var(--color-text-muted)'
          return (
            <g
              key={n.id}
              transform={`translate(${x}, ${y})`}
              onPointerDown={(e) => handlePointerDown(e, n)}
              onPointerUp={(e) => handlePointerUp(e, n)}
              onClick={(e) => {
                if (draggingRef.current) return
                e.stopPropagation()
                if (!isMain) onSelect(n.id)
              }}
              className={isMain ? 'cursor-grab' : 'cursor-pointer'}
            >
              <circle
                r={NODE_RADIUS}
                fill="var(--color-surface)"
                stroke={ringColor}
                strokeWidth={isMain ? 3 : 2}
              />
              <image
                href={n.avatar}
                width={(NODE_RADIUS - 2) * 2}
                height={(NODE_RADIUS - 2) * 2}
                x={-(NODE_RADIUS - 2)}
                y={-(NODE_RADIUS - 2)}
                clipPath={`url(#avatar-${cssId(n.id)})`}
                preserveAspectRatio="xMidYMid slice"
              />
              <text
                y={NODE_RADIUS + 16}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="var(--color-text)"
              >
                {truncate(n.label, 18)}
              </text>
              <text
                y={NODE_RADIUS + 28}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-text-muted)"
              >
                {isMain ? 'fôügynök' : n.running ? 'fut' : 'leállva'}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

// Sanitize node id for use as a CSS-safe SVG id (alpha-numeric + dashes).
function cssId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}
