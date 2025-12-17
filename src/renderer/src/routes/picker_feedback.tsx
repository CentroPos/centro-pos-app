import { useState, useEffect, useRef, useCallback } from "react";

// ============= Types =============
interface PickItem {
    slNo: number;
    name: string;
    itemCode: string;
    uom: string;
    qty: number;
}

interface PickResult {
    pickerName: string;
    pickerId: string;
    duration: number;
    assigned: string;
    startTime: string;
    endTime: string;
    pickSlipNo: string;
    invoiceNo: string;
    customerName: string;
    items: PickItem[];
}

// ============= Mock Data Generator =============
const generateMockResult = (_barcode: string): PickResult => {
    const names = ["SAHAD PAREED", "JOHN SMITH", "MARIA GARCIA", "ALEX JOHNSON"];
    const customers = ["BISMI Co.", "ALPHA RETAIL", "MEGA MART", "QUICK SHIP"];
    const items = [
        { name: "ABC THE ITEM NAME 500 GM", uom: "CTN" },
        { name: "XYZ PRODUCT 1KG", uom: "PCS" },
        { name: "DEF GOODS 250 ML", uom: "BOX" },
        { name: "GHI SUPPLY 750 GM", uom: "CTN" },
    ];

    const numItems = Math.floor(Math.random() * 5) + 2;
    const generatedItems = Array.from({ length: numItems }, (_, i) => ({
        slNo: i + 1,
        name: items[i % items.length].name,
        itemCode: `ITM-${Math.floor(Math.random() * 90000) + 10000}`,
        uom: items[i % items.length].uom,
        qty: Math.floor(Math.random() * 10) + 1,
    }));

    const now = new Date();
    const duration = Math.floor(Math.random() * 20) + 5;
    const startTime = new Date(now.getTime() - duration * 60000);

    return {
        pickerName: names[Math.floor(Math.random() * names.length)],
        pickerId: `PCK-${Math.floor(Math.random() * 9000) + 1000}`,
        duration,
        assigned: names[Math.floor(Math.random() * names.length)].split(" ")[0],
        startTime: `Today, ${startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`,
        endTime: `Today, ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`,
        pickSlipNo: `PCK-2025-${Math.floor(Math.random() * 90000) + 10000}`,
        invoiceNo: `INV-2025-${Math.floor(Math.random() * 90000) + 10000}`,
        customerName: customers[Math.floor(Math.random() * customers.length)],
        items: generatedItems,
    };
};

// ============= Barcode Icon Component =============
const BarcodeIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14" />
    </svg>
);

// ============= Main Component =============
const PickerFeedbackScreen = () => {
    const [result, setResult] = useState<PickResult | null>(null);
    const [scanValue, setScanValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep input always focused
    const maintainFocus = useCallback(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    useEffect(() => {
        maintainFocus();
        const handleInteraction = () => maintainFocus();
        document.addEventListener("click", handleInteraction);
        document.addEventListener("keydown", handleInteraction);
        const interval = setInterval(maintainFocus, 100);
        return () => {
            document.removeEventListener("click", handleInteraction);
            document.removeEventListener("keydown", handleInteraction);
            clearInterval(interval);
        };
    }, [maintainFocus]);

    // Handle paste event - triggers API call
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = e.clipboardData.getData("text");
        if (pastedText.trim()) {
            e.preventDefault();
            setScanValue(pastedText);
            setIsLoading(true);

            // Simulate API call with delay
            setTimeout(() => {
                const newResult = generateMockResult(pastedText.trim());
                setResult(newResult);
                setIsLoading(false);
                setScanValue("");
                setTimeout(() => inputRef.current?.focus(), 0);
            }, 800);
        }
    }, []);

    return (
        <div className="h-full w-full bg-[#0d1117] text-gray-300 p-4 font-mono overflow-auto flex flex-col select-none">
            {/* Header with Scan Input */}
            <header className="flex justify-center mb-8 shrink-0">
                <div className="relative group w-full max-w-xl">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[#fbbf24] to-[#fbbf24] opacity-30 blur group-hover:opacity-50 transition duration-1000"></div>
                    <div className="relative flex items-center bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
                        <div className="pl-6 pr-4 border-r border-[#30363d]">
                            <BarcodeIcon className="w-8 h-8 text-[#fbbf24]" />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={scanValue}
                            onChange={(e) => setScanValue(e.target.value)}
                            onPaste={handlePaste}
                            placeholder="SCAN BARCODE"
                            className="bg-transparent px-6 py-4 text-2xl font-bold tracking-wider text-[#fbbf24] placeholder:text-[#fbbf24]/30 focus:outline-none w-full uppercase"
                            autoFocus
                            autoComplete="off"
                        />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-[1600px] mx-auto w-full">
                {isLoading ? (
                    /* Loading State */
                    <div className="h-full flex flex-col items-center justify-center space-y-8 opacity-80">
                        <div className="relative">
                            <div className="w-24 h-24 border-4 border-[#30363d] rounded-full"></div>
                            <div className="absolute top-0 left-0 w-24 h-24 border-4 border-[#fbbf24] rounded-full animate-spin border-t-transparent"></div>
                        </div>
                        <p className="text-2xl font-bold text-[#fbbf24] animate-pulse tracking-[0.2em]">PROCESSING...</p>
                    </div>
                ) : result ? (
                    /* Result Display */
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full pb-6">
                        {/* Left Column Group */}
                        <div className="lg:col-span-2 flex flex-col gap-6">

                            {/* Top Row: Picker & Duration */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                {/* Picker Info */}
                                <div className="md:col-span-3 bg-[#161b22] border border-[#30363d] rounded-sm p-6 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#30363d]"></div>
                                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-bold">PICKER</p>
                                    <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">{result.pickerName}</h2>
                                    <p className="text-[#fbbf24] text-lg font-bold tracking-wider">{result.pickerId}</p>
                                </div>

                                {/* Duration */}
                                <div className="md:col-span-1 bg-[#161b22] border border-[#30363d] rounded-sm p-6 flex flex-col items-center justify-center relative">
                                    <div className="absolute top-0 right-0 w-1 h-full bg-[#30363d]"></div>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 text-center">DURATION</p>
                                    <p className="text-6xl font-bold text-[#fbbf24] leading-none mb-1">{result.duration}</p>
                                    <p className="text-xs text-white font-bold tracking-widest uppercase">MINUTES</p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="flex-1 bg-[#161b22] border border-[#30363d] rounded-sm p-6 flex flex-col min-h-[400px]">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="text-sm text-gray-400 uppercase tracking-widest font-bold">ITEMS:</span>
                                    <span className="text-2xl font-bold text-[#22c55e] leading-none">{result.items.length}</span>
                                </div>

                                <div className="w-full">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-12 gap-4 pb-4 border-b border-[#30363d] text-xs uppercase tracking-widest text-gray-400 font-extrabold">
                                        <div className="col-span-1">SL NO</div>
                                        <div className="col-span-7">ITEM</div>
                                        <div className="col-span-2 text-center">UOM</div>
                                        <div className="col-span-2 text-right">QTY</div>
                                    </div>

                                    {/* Scrollable Table Body */}
                                    <div className="overflow-auto max-h-[500px] mt-2">
                                        {result.items.map((item) => (
                                            <div key={item.slNo} className="grid grid-cols-12 gap-4 py-4 border-b border-[#30363d]/50 items-center hover:bg-white/[0.02] transition-colors">
                                                <div className="col-span-1 text-[#fbbf24] font-bold text-lg">{item.slNo}</div>
                                                <div className="col-span-7">
                                                    <p className="text-white font-bold text-lg tracking-tight truncate">{item.name}</p>
                                                    <p className="text-gray-500 text-xs tracking-wider">{item.itemCode}</p>
                                                </div>
                                                <div className="col-span-2 text-center text-white">{item.uom}</div>
                                                <div className="col-span-2 text-right text-[#22c55e] font-bold text-xl">{item.qty.toFixed(1)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Order Details */}
                        <div className="lg:col-span-1 bg-[#161b22] border border-[#30363d] rounded-sm p-8 flex flex-col gap-8 h-full">

                            {/* Assigned */}
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">ASSIGNED</p>
                                <p className="text-2xl font-bold text-white tracking-tight">{result.assigned}</p>
                            </div>

                            {/* Start/End Time */}
                            <div className="space-y-6">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 font-black">START TIME</p>
                                    <p className="text-lg text-white font-medium tracking-wide">{result.startTime.split(', ')[1]}</p>
                                    <p className="text-xs text-gray-600">Today</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 font-black">END TIME</p>
                                    <p className="text-lg text-[#22c55e] font-medium tracking-wide">{result.endTime.split(', ')[1]}</p>
                                    <p className="text-xs text-gray-600">Today</p>
                                </div>
                            </div>

                            <div className="h-px bg-[#30363d] w-full my-2"></div>

                            {/* Pick Slip */}
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">PICK-SLIP NO</p>
                                <p className="text-xl font-bold text-[#fbbf24] tracking-wider">{result.pickSlipNo}</p>
                            </div>

                            {/* Invoice */}
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">INVOICE NO</p>
                                <p className="text-xl font-bold text-white tracking-wider">{result.invoiceNo}</p>
                            </div>

                            <div className="h-px bg-[#30363d] w-full my-2"></div>

                            {/* Customer */}
                            <div className="mt-auto">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">CUSTOMER NAME</p>
                                <p className="text-3xl font-bold text-white tracking-tight leading-tight">{result.customerName}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Ready State */
                    <div className="h-full flex flex-col items-center justify-center opacity-40">
                        <div className="border-4 border-dashed border-[#30363d] rounded-xl p-16 text-center">
                            <p className="text-4xl font-bold text-[#30363d] mb-4 tracking-widest">NO DATA</p>
                            <p className="text-lg text-[#30363d]">WAITING FOR SCAN</p>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="mt-auto pt-6 flex justify-between items-center text-[10px] text-[#30363d] uppercase tracking-widest">
                <span>Warehouse Picker Feedback System</span>
                <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-pulse"></span>
                    ONLINE
                </span>
            </footer>
        </div>
    );
};

export default PickerFeedbackScreen;
