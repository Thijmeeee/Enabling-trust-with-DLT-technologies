import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { getHierarchyTree } from '../../lib/operations/dppManagerLocal';

interface Node {
  id: string;
  label: string;
  type: 'main' | 'component' | 'supplier';
  did: string;
}

interface Link {
  source: string;
  target: string;
  type: string;
}

export default function RelationshipGraph({
  did,
  onNavigate,
}: {
  did: string;
  onNavigate: (did: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    loadAndRenderGraph();
  }, [did]);

  async function loadAndRenderGraph() {
    const hierarchyData = await getHierarchyTree(did);
    if (!hierarchyData) return;

    const nodes: Node[] = [];
    const links: Link[] = [];

    function processNode(nodeData: any, isRoot = false) {
      const node: Node = {
        id: nodeData.dpp.did,
        label: nodeData.dpp.model,
        type: isRoot ? 'main' : 'component',
        did: nodeData.dpp.did,
      };
      nodes.push(node);

      if (nodeData.dpp.owner) {
        const supplierNode: Node = {
          id: nodeData.dpp.owner,
          label: nodeData.dpp.owner.split(':').pop() || 'Supplier',
          type: 'supplier',
          did: '',
        };

        if (!nodes.find((n) => n.id === supplierNode.id)) {
          nodes.push(supplierNode);
        }

        links.push({
          source: supplierNode.id,
          target: node.id,
          type: 'supplies',
        });
      }

      if (nodeData.children && nodeData.children.length > 0) {
        nodeData.children.forEach((child: any) => {
          processNode(child);
          links.push({
            source: node.id,
            target: child.dpp.did,
            type: 'contains',
          });
        });
      }
    }

    processNode(hierarchyData, true);

    renderGraph(nodes, links);
  }

  function renderGraph(nodes: Node[], links: Link[]) {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 600;

    svg.attr('width', width).attr('height', height);

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
      g.attr('transform', event.transform);
    });

    svg.call(zoom as any);

    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(150)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));

    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);

    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .call(
        d3.drag<any, any>().on('start', dragstarted).on('drag', dragged).on('end', dragended) as any
      );

    node
      .append('circle')
      .attr('r', 40)
      .attr('fill', (d) => {
        if (d.type === 'main') return '#3b82f6';
        if (d.type === 'component') return '#10b981';
        return '#f59e0b';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 3);

    node
      .append('text')
      .text((d) => d.label.split('-')[0])
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('fill', '#fff')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none');

    node
      .append('title')
      .text((d) => `${d.label}\n${d.did || d.id}`);

    node.on('click', (_event, d) => {
      if (d.did && d.type !== 'supplier') {
        onNavigate(d.did);
      }
    });

    node.style('cursor', (d) => (d.type !== 'supplier' ? 'pointer' : 'default'));

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  }

  return (
    <div className="relative">
      <div className="mb-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
          <span className="text-gray-600">Main Product</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500"></div>
          <span className="text-gray-600">Component</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-orange-500"></div>
          <span className="text-gray-600">Supplier</span>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <svg ref={svgRef} className="w-full" style={{ minHeight: '600px' }}></svg>
      </div>

      <p className="text-sm text-gray-500 mt-2">Click and drag nodes to rearrange. Click on products to navigate.</p>
    </div>
  );
}
