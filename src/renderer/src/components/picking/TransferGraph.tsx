import { WarehouseOperation } from '@renderer/types/picking';
import { cn } from '@renderer/lib/utils';
import { Warehouse, Package, Truck } from 'lucide-react';

const HandoverIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className={className}
    >
        {/* Shadow Oval at bottom */}
        <ellipse cx="12" cy="22.5" rx="8" ry="1" stroke="currentColor" strokeWidth="1.2" />

        {/* MapPin Main Body (Filled) */}
        <path
            d="M12 21C12 21 4 13.5 4 8.5C4 4 7.5 0.5 12 0.5C16.5 0.5 20 4 20 8.5C20 13.5 12 21 12 21Z"
            fill="currentColor"
            stroke="none"
        />

        {/* White Inner Circle */}
        <circle cx="12" cy="8.5" r="6" fill="white" stroke="none" />

        {/* Isometric Box Icon inside Circle */}
        <g transform="translate(8.5, 5.5) scale(0.28)">
            {/* Isometric Box Paths */}
            <path d="M12 2 L2 7 L12 12 L22 7 Z" fill="#1e293b" stroke="#1e293b" strokeWidth="2" />
            <path d="M2 7 L2 18 L12 23 L12 12 Z" fill="#1e293b" stroke="#1e293b" strokeWidth="2" />
            <path d="M12 12 L12 23 L22 18 L22 7 Z" fill="#ffffff" stroke="#1e293b" strokeWidth="2" />
            <path d="M10 4 L14 6" stroke="#ffffff" strokeWidth="3" />
            <path d="M12 12 L12 17" stroke="#1e293b" strokeWidth="1" />
        </g>
    </svg>
);

interface TransferGraphProps {
    operations: WarehouseOperation[];
    deliveryWarehouseId: string | null;
}

export function TransferGraph({ operations }: TransferGraphProps) {
    if (operations.length === 0) return null;

    const deliveryOp = operations[0];
    const sourceOps = operations.slice(1);

    // Filter sources vs delivery
    const transferOps = sourceOps.filter(op => !op.isCustomerPickup);
    const directPickupOps = sourceOps.filter(op => op.isCustomerPickup);

    // Layout Constants
    const width = 600;
    const height = 300; // Increased height to accommodate larger source nodes
    const padding = 40;
    const hubX = width / 2;
    const hubY = height / 2;
    const sourceX = padding + 60;
    const customerX = width - padding - 60;

    const nodeWidth = 110;
    const nodeHeight = 60;

    // Calculate source Y positions
    const numSources = sourceOps.length;
    const sourceSpacing = Math.min((height - padding * 2) / Math.max(numSources, 1), 80);
    const sourceStartY = hubY - ((numSources - 1) * sourceSpacing) / 2;

    return (
        <div className="w-full bg-slate-50 border rounded-xl p-4 mb-4 flex flex-col items-center justify-center relative overflow-hidden shadow-inner group">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

            <div className="relative w-full max-w-[600px] aspect-[2/1]">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full drop-shadow-sm">
                    {/* Definitions for arrowheads */}
                    <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
                        </marker>
                        <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
                        </marker>
                        <marker id="arrowhead-amber" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
                        </marker>
                    </defs>

                    {/* Arrows from Sources to Hub/Customer */}
                    {sourceOps.map((op, i) => {
                        const sY = sourceStartY + i * sourceSpacing;
                        // Path to Hub
                        if (!op.isCustomerPickup) {
                            // Center all hub-bound arrows at exactly hubY
                            const d = `M ${sourceX + 55} ${sY} C ${hubX - 100} ${sY}, ${hubX - 110} ${hubY}, ${hubX - 58} ${hubY}`;
                            return (
                                <path
                                    key={`path-to-hub-${i}`}
                                    d={d}
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="2"
                                    strokeDasharray="4 4"
                                    markerEnd="url(#arrowhead-active)"
                                    className="animate-[dash_20s_linear_infinite]"
                                />
                            );
                        } else {
                            // Path to Customer directly (curved around the hub)
                            // Find local index among pickup ops for vertical distribution
                            const pickupIdx = directPickupOps.findIndex(pOp => pOp.warehouseId === op.warehouseId);
                            const numPickup = directPickupOps.length;
                            const targetYOffset = numPickup > 1 ? (pickupIdx - (numPickup - 1) / 2) * 12 : 0;

                            const isAbove = sY < hubY;
                            const verticalShift = isAbove ? -95 - (i * 12) : 95 + (i * 12);
                            const d = `M ${sourceX + 55} ${sY} C ${sourceX + 150} ${sY + verticalShift / 2}, ${customerX - 150} ${hubY + verticalShift}, ${customerX - 58} ${hubY + targetYOffset}`;
                            return (
                                <path
                                    key={`path-to-customer-${i}`}
                                    d={d}
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="2"
                                    strokeDasharray="4 4"
                                    markerEnd="url(#arrowhead-amber)"
                                    style={{ opacity: 0.5 }}
                                />
                            );
                        }
                    })}

                    {/* Arrow Hub to Customer */}
                    <path
                        d={`M ${hubX + 55} ${hubY} L ${customerX - 58} ${hubY}`}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="2.5"
                        markerEnd="url(#arrowhead)"
                    />

                    {/* Nodes - Sources */}
                    {sourceOps.map((op, i) => {
                        const sY = sourceStartY + i * sourceSpacing;
                        return (
                            <g key={`node-source-${i}`}>
                                <rect
                                    x={sourceX - 55}
                                    y={sY - 30}
                                    width={nodeWidth}
                                    height={nodeHeight}
                                    rx="12"
                                    fill="white"
                                    stroke={op.isCustomerPickup ? "#fbbf24" : "#e2e8f0"}
                                    strokeWidth="1.5"
                                    className="shadow"
                                />
                                <foreignObject x={sourceX - 50} y={sY - 5} width="100" height="30">
                                    <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden">
                                        <span className="text-[9px] font-bold text-slate-700 text-center leading-tight line-clamp-2 px-1 select-none">
                                            {op.warehouseName}
                                        </span>
                                    </div>
                                </foreignObject>
                                <foreignObject x={sourceX - 10} y={sY - 25} width="20" height="20">
                                    <Warehouse className={cn("w-5 h-5", op.isCustomerPickup ? "text-amber-600" : "text-slate-400")} />
                                </foreignObject>
                            </g>
                        );
                    })}

                    {/* Node - Hub */}
                    <g>
                        <rect
                            x={hubX - 55}
                            y={hubY - 30}
                            width={nodeWidth}
                            height={nodeHeight}
                            rx="12"
                            fill="white"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            className="shadow-lg"
                        />
                        <foreignObject x={hubX - 50} y={hubY - 5} width="100" height="30">
                            <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden">
                                <span className="text-[9px] font-extrabold text-slate-900 text-center leading-tight line-clamp-2 px-1 select-none">
                                    {deliveryOp.warehouseName}
                                </span>
                            </div>
                        </foreignObject>
                        <text x={hubX} y={hubY + 22} textAnchor="middle" className="text-[7px] font-bold fill-green-600 uppercase tracking-widest select-none">
                        </text>
                        <foreignObject x={hubX - 10} y={hubY - 26} width="20" height="20">
                            <Truck className="w-5 h-5 text-green-600" />
                        </foreignObject>
                    </g>

                    {/* Node - Customer */}
                    <g>
                        <circle
                            cx={customerX}
                            cy={hubY}
                            r="45"
                            fill="#1e293b"
                            stroke="white"
                            strokeWidth="3"
                            className="shadow-xl"
                        />
                        <foreignObject x={customerX - 50} y={hubY + 50} width="100" height="20">
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tighter select-none">
                                    Customer
                                </span>
                            </div>
                        </foreignObject>
                        <foreignObject x={customerX - 20} y={hubY - 20} width="40" height="40">
                            <HandoverIcon className="w-10 h-10 text-white" />
                        </foreignObject>
                    </g>

                    {/* Floating Package Animation Over Hub to Customer Line */}
                    <circle cx={0} cy={0} r="6" fill="#10b981">
                        <animateMotion
                            dur="3s"
                            repeatCount="indefinite"
                            path={`M ${hubX + 50} ${hubY} L ${customerX - 50} ${hubY}`}
                        />
                    </circle>
                    <foreignObject x={0} y={0} width="10" height="10">
                        <Package className="w-2.5 h-2.5 text-white animate-bounce" />
                        <animateMotion
                            dur="3s"
                            repeatCount="indefinite"
                            path={`M ${hubX + 50} ${hubY - 1} L ${customerX - 50} ${hubY - 1}`}
                        />
                    </foreignObject>
                </svg>
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-[2px] bg-green-500 border-t border-dashed" />
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Transfer</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-[2px] bg-amber-500 border-t border-dashed" />
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Direct Pickup</span>
                </div>
            </div>
        </div>
    );
}

// Add simple CSS animation for dash movement
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes dash {
            to {
                stroke-dashoffset: -1000;
            }
        }
    `;
    document.head.appendChild(style);
}
