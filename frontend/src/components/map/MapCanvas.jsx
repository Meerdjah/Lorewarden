import { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Rect, Circle, Line, Text, Group, Image as KImage } from 'react-konva'

const GRID_LINE_ALPHA = 0.15

export default function MapCanvas({
    mapImage, gridConfig, tokens, fogAreas, isGM,
    onTokenMove, onAddFog, onToggleFog, onRemoveFog,
    selectedTool, stageRef: externalStageRef,
}) {
    const containerRef = useRef(null)
    const [dims, setDims] = useState({ width: 800, height: 600 })
    const [scale, setScale] = useState(1)
    const [pos, setPos] = useState({ x: 0, y: 0 })
    const [bgImage, setBgImage] = useState(null)
    const [fogStart, setFogStart] = useState(null)
    const [fogPreview, setFogPreview] = useState(null)
    const stageRef = useRef(null)

    // Resize handler
    useEffect(() => {
        function measure() {
            if (containerRef.current) {
                setDims({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight })
            }
        }
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [])

    // Forward stage ref
    useEffect(() => {
        if (externalStageRef) externalStageRef.current = stageRef.current
    }, [stageRef.current])

    // Load background image
    useEffect(() => {
        if (!mapImage) { setBgImage(null); return }
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => setBgImage(img)
        img.src = mapImage
    }, [mapImage])

    // Zoom
    const handleWheel = useCallback((e) => {
        e.evt.preventDefault()
        const stage = stageRef.current
        if (!stage) return
        const oldScale = scale
        const pointer = stage.getPointerPosition()
        const direction = e.evt.deltaY > 0 ? -1 : 1
        const factor = 1.08
        const newScale = direction > 0 ? oldScale * factor : oldScale / factor
        const clampedScale = Math.max(0.1, Math.min(5, newScale))

        const mousePointTo = {
            x: (pointer.x - pos.x) / oldScale,
            y: (pointer.y - pos.y) / oldScale,
        }
        setScale(clampedScale)
        setPos({
            x: pointer.x - mousePointTo.x * clampedScale,
            y: pointer.y - mousePointTo.y * clampedScale,
        })
    }, [scale, pos])

    // Snap to grid
    const snapToGrid = useCallback((val) => {
        if (!gridConfig.enabled) return val
        return Math.round(val / gridConfig.size) * gridConfig.size
    }, [gridConfig])

    // Token drag end
    const handleTokenDragEnd = useCallback((tokenId, e) => {
        const node = e.target
        const x = snapToGrid(node.x())
        const y = snapToGrid(node.y())
        node.x(x)
        node.y(y)
        onTokenMove?.(tokenId, x, y)
    }, [snapToGrid, onTokenMove])

    // Fog drawing
    const handleStageMouseDown = useCallback((e) => {
        if (selectedTool !== 'fog' || !isGM) return
        const stage = stageRef.current
        if (!stage) return
        const pointer = stage.getPointerPosition()
        const x = (pointer.x - pos.x) / scale
        const y = (pointer.y - pos.y) / scale
        setFogStart({ x, y })
        setFogPreview({ x, y, width: 0, height: 0 })
    }, [selectedTool, isGM, pos, scale])

    const handleStageMouseMove = useCallback((e) => {
        if (!fogStart || selectedTool !== 'fog') return
        const stage = stageRef.current
        if (!stage) return
        const pointer = stage.getPointerPosition()
        const x = (pointer.x - pos.x) / scale
        const y = (pointer.y - pos.y) / scale
        setFogPreview({
            x: Math.min(fogStart.x, x),
            y: Math.min(fogStart.y, y),
            width: Math.abs(x - fogStart.x),
            height: Math.abs(y - fogStart.y),
        })
    }, [fogStart, selectedTool, pos, scale])

    const handleStageMouseUp = useCallback(() => {
        if (!fogStart || selectedTool !== 'fog' || !fogPreview) { setFogStart(null); setFogPreview(null); return }
        if (fogPreview.width > 10 && fogPreview.height > 10) {
            onAddFog?.(fogPreview)
        }
        setFogStart(null)
        setFogPreview(null)
    }, [fogStart, selectedTool, fogPreview, onAddFog])

    // Grid lines
    const gridLines = []
    if (gridConfig.enabled && bgImage) {
        const w = bgImage.width || 2000
        const h = bgImage.height || 2000
        const s = gridConfig.size
        for (let x = 0; x <= w; x += s) {
            gridLines.push(<Line key={`gv${x}`} points={[x, 0, x, h]} stroke={gridConfig.color} strokeWidth={1} listening={false} />)
        }
        for (let y = 0; y <= h; y += s) {
            gridLines.push(<Line key={`gh${y}`} points={[0, y, w, y]} stroke={gridConfig.color} strokeWidth={1} listening={false} />)
        }
    }

    const isDraggable = selectedTool === 'select' || selectedTool === 'pan'

    return (
        <div ref={containerRef} className="flex-1 bg-bg-primary overflow-hidden relative" style={{ cursor: selectedTool === 'fog' ? 'crosshair' : selectedTool === 'pan' ? 'grab' : 'default' }}>
            <Stage
                ref={stageRef}
                width={dims.width}
                height={dims.height}
                scaleX={scale}
                scaleY={scale}
                x={pos.x}
                y={pos.y}
                draggable={selectedTool === 'pan'}
                onWheel={handleWheel}
                onDragEnd={(e) => { if (e.target === stageRef.current) setPos({ x: e.target.x(), y: e.target.y() }) }}
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
            >
                {/* Background Layer */}
                <Layer>
                    {bgImage && <KImage image={bgImage} x={0} y={0} />}
                </Layer>

                {/* Grid Layer */}
                <Layer listening={false}>{gridLines}</Layer>

                {/* Token Layer */}
                <Layer>
                    {tokens.map(t => (
                        <Group
                            key={t.id}
                            x={t.x}
                            y={t.y}
                            draggable={selectedTool === 'select'}
                            onDragEnd={(e) => handleTokenDragEnd(t.id, e)}
                        >
                            {t.imageUrl ? (
                                <TokenImage url={t.imageUrl} size={t.size} />
                            ) : (
                                <Circle
                                    radius={t.size / 2}
                                    fill={t.color || '#d4a840'}
                                    stroke="rgba(255,255,255,0.6)"
                                    strokeWidth={2}
                                    shadowColor="black"
                                    shadowBlur={6}
                                    shadowOpacity={0.4}
                                />
                            )}
                            <Text
                                text={t.label}
                                fontSize={11}
                                fill="white"
                                fontStyle="bold"
                                align="center"
                                width={t.size + 20}
                                x={-(t.size + 20) / 2}
                                y={t.size / 2 + 4}
                                listening={false}
                                shadowColor="black"
                                shadowBlur={3}
                            />
                        </Group>
                    ))}
                </Layer>

                {/* Fog Layer */}
                <Layer>
                    {fogAreas.map(f => (
                        !f.revealed && (
                            <Rect
                                key={f.id}
                                x={f.x}
                                y={f.y}
                                width={f.width}
                                height={f.height}
                                fill="black"
                                opacity={isGM ? 0.6 : 1}
                                onClick={() => isGM && onToggleFog?.(f.id)}
                                onTap={() => isGM && onToggleFog?.(f.id)}
                            />
                        )
                    ))}
                    {isGM && fogAreas.filter(f => f.revealed).map(f => (
                        <Rect
                            key={`rev-${f.id}`}
                            x={f.x}
                            y={f.y}
                            width={f.width}
                            height={f.height}
                            fill="rgba(0,0,0,0.15)"
                            stroke="rgba(34,197,94,0.5)"
                            strokeWidth={1}
                            dash={[6, 4]}
                            onClick={() => onToggleFog?.(f.id)}
                            onTap={() => onToggleFog?.(f.id)}
                        />
                    ))}
                    {fogPreview && (
                        <Rect
                            x={fogPreview.x}
                            y={fogPreview.y}
                            width={fogPreview.width}
                            height={fogPreview.height}
                            fill="rgba(0,0,0,0.4)"
                            stroke="rgba(239,68,68,0.7)"
                            strokeWidth={2}
                            dash={[8, 4]}
                            listening={false}
                        />
                    )}
                </Layer>
            </Stage>
        </div>
    )
}

// Token image subcomponent — loads image asynchronously
function TokenImage({ url, size }) {
    const [img, setImg] = useState(null)
    useEffect(() => {
        const image = new window.Image()
        image.crossOrigin = 'anonymous'
        image.onload = () => setImg(image)
        image.src = url
    }, [url])

    if (!img) return <Circle radius={size / 2} fill="#555" />
    return (
        <Group clipFunc={(ctx) => { ctx.arc(0, 0, size / 2, 0, Math.PI * 2); }}>
            <KImage image={img} x={-size / 2} y={-size / 2} width={size} height={size} />
        </Group>
    )
}
